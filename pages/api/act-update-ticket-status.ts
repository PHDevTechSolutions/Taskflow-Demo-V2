import type { NextApiRequest, NextApiResponse } from "next";
import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB;

if (!MONGODB_URI) {
    throw new Error("Please define the MONGODB_URI environment variable inside .env.local");
}

if (!MONGODB_DB) {
    throw new Error("Please define the MONGODB_DB environment variable inside .env.local");
}

const mongoUri: string = MONGODB_URI;
const mongoDb: string = MONGODB_DB;

let cachedClient: MongoClient | null = null;
let cachedDb: any = null;

async function connectToDatabase() {
    if (cachedClient && cachedDb) {
        return { client: cachedClient, db: cachedDb };
    }

    const client = new MongoClient(mongoUri);
    await client.connect();
    const db = client.db(mongoDb);

    cachedClient = client;
    cachedDb = db;

    return { client, db };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method Not Allowed" });
    }

    try {
        const { ticket_reference_number, status } = req.body;

        if (!ticket_reference_number || !status) {
            return res.status(400).json({ error: "Missing ticket_reference_number or status" });
        }

        const { db } = await connectToDatabase();
        const collection = db.collection("endorsed-ticket");

        // Update the status field of the ticket document matching the ticket_reference_number
        const updateResult = await collection.updateOne(
            { ticket_reference_number: ticket_reference_number },
            { $set: { status: status } }
        );

        if (updateResult.matchedCount === 0) {
            return res.status(404).json({ error: "Ticket not found" });
        }

        return res.status(200).json({ success: true, message: "Ticket status updated" });
    } catch (error: any) {
        console.error("MongoDB update error:", error);
        return res.status(500).json({ error: "Server error" });
    }
}
