import type { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/mongodb";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  const Email = req.query.Email as string;

  if (!Email) {
    return res.status(400).json({ error: "Email query parameter is required" });
  }

  try {
    const db = await connectToDatabase();
    const logs = await db
      .collection("TaskLog")
      .find({ Email })  // filter by Email field
      .project({ Type: 1, Status: 1, date_created: 1, Location: 1, PhotoURL: 1, _id: 0 }) // select fields to return
      .sort({ date_created: -1 }) // sort descending by date_created
      .toArray();

    return res.status(200).json({ success: true, data: logs });
  } catch (error: any) {
    console.error("Error fetching time logs:", error);
    return res.status(500).json({ error: "Server error" });
  }
}
