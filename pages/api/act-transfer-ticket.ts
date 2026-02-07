import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../utils/supabase";
import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI!;
const MONGODB_DB = process.env.MONGODB_DB!;

let cachedClient: MongoClient | null = null;
let cachedDb: any = null;

async function connectToMongo() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }
  if (!MONGODB_URI) {
    throw new Error("Please define the MONGODB_URI environment variable");
  }
  if (!MONGODB_DB) {
    throw new Error("Please define the MONGODB_DB environment variable");
  }

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(MONGODB_DB);

  cachedClient = client;
  cachedDb = db;

  return { client, db };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    let { id, newReferenceID } = req.body;

    if (!id || !newReferenceID) {
      return res.status(400).json({ error: "Missing ID or ReferenceID" });
    }

    id = Number(id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "ID must be a valid number" });
    }

    // 1. Get activity record from supabase (to get ticket_reference_number)
    const { data: activityData, error: activityError } = await supabase
      .from("activity")
      .select("ticket_reference_number")
      .eq("id", id)
      .single();

    if (activityError) {
      console.error("Supabase fetch activity error:", activityError);
      return res.status(500).json({ error: activityError.message });
    }

    if (!activityData) {
      return res.status(404).json({ error: "Activity not found" });
    }

    const ticketRef = activityData.ticket_reference_number;
    if (!ticketRef) {
      return res.status(400).json({ error: "Activity missing ticket_reference_number" });
    }

    // 2. Update activity status & date_updated in supabase
    const { error: updateActivityError } = await supabase
      .from("activity")
      .update({
        status: "Transfer",
        date_updated: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateActivityError) {
      console.error("Supabase update activity error:", updateActivityError);
      return res.status(500).json({ error: updateActivityError.message });
    }

    // 3. Update endorsed-ticket record with new referenceid, status, and date_updated in supabase
    const { error: endorseError } = await supabase
      .from("endorsed-ticket")
      .update({
        referenceid: newReferenceID,
        status: "Endorsed",
        condition: "Transfer",
        date_transfer: new Date().toISOString(),
        date_updated: new Date().toISOString(),
      })
      .eq("ticket_reference_number", ticketRef);

    if (endorseError) {
      console.error("Supabase update endorsed-ticket error:", endorseError);
      return res.status(500).json({ error: endorseError.message });
    }

    // 4. Connect directly to MongoDB and update activity document's agent by ticket_reference_number
    const { db } = await connectToMongo();

    const mongoUpdateResult = await db.collection("activity").updateOne(
      { ticket_reference_number: ticketRef },
      { $set: { agent: newReferenceID } }
    );

    if (mongoUpdateResult.matchedCount === 0) {
      console.warn("No MongoDB activity document matched ticket_reference_number:", ticketRef);
      // Optional: decide if this should be an error or not
    }

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
