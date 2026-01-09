import { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/mongodb";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  const referenceid = (req.query.referenceid as string)?.trim();

  if (!referenceid) {
    return res.status(400).json({ error: "referenceid query parameter is required" });
  }

  try {
    const db = await connectToDatabase();

    // Query TaskLog collection filtering by exact ReferenceID
    const siteVisits = await db
  .collection("TaskLog")
  .find({
    ReferenceID: { $regex: `^${referenceid}$`, $options: "i" }
  })
  .sort({ date_created: -1 })
  .toArray();

    res.status(200).json({ siteVisits });
  } catch (error) {
    console.error("Error fetching site visits:", error);
    res.status(500).json({ error: "Server error fetching site visits" });
  }
}
