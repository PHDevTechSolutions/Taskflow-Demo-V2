import { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/mongodb";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const db = await connectToDatabase();
    const referenceId = req.query.id as string; // This is the Manager's ReferenceID passed as query param

    if (!referenceId) {
      return res.status(400).json({ error: "ReferenceID (Manager) is required" });
    }

    // Fetch TSMs filtered by Manager, Role=TSM, and Status not Resigned or Terminated
    const tsms = await db
      .collection("users")
      .find({
        Manager: referenceId,
        Role: "Territory Sales Manager",
        Status: { $nin: ["Resigned", "Terminated"] },
      })
      .project({
        Firstname: 1,
        Lastname: 1,
        ReferenceID: 1,
        profilePicture: 1,
        Position: 1,
        Status: 1,
        Role: 1,
        TargetQuota: 1,
        _id: 0,
      })
      .toArray();

    if (tsms.length === 0) {
      return res.status(404).json({ error: "No TSMs found for this Manager" });
    }

    res.status(200).json(tsms);
  } catch (error) {
    console.error("Error fetching TSMs:", error);
    res.status(500).json({ error: "Server error fetching TSMs" });
  }
}
