import { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/mongodb";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res
      .status(405)
      .json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const db = await connectToDatabase();

    const agents = await db
      .collection("users")
      .find({
        Department: "Sales",
        Status: {
          $nin: ["Resigned", "Terminated"],
        },
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
        Department: 1,
        _id: 0,
      })
      .toArray();

    if (agents.length === 0) {
      return res
        .status(404)
        .json({ error: "No agents found" });
    }

    return res.status(200).json(agents);
  } catch (error) {
    console.error("Error fetching agents:", error);
    return res
      .status(500)
      .json({ error: "Server error fetching agents" });
  }
}
