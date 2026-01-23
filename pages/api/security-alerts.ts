// pages/api/security-alerts.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/mongodb";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const db = await connectToDatabase();
    const collection = db.collection("security_alerts");

    // Fetch all security alerts, newest first
    const alerts = await collection.find({}).sort({ Timestamp: -1 }).toArray();

    return res.status(200).json(alerts);
  } catch (err) {
    console.error("Failed to fetch security alerts:", err);
    return res.status(500).json({ error: "Failed to fetch security alerts" });
  }
}
