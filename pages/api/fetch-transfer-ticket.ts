import { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/mongodb";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const db = await connectToDatabase();

    const { tsm } = req.query;

    // Base query: users with Role 'Territory Sales Associate' and not resigned/terminated
    const query: any = {
      Status: { $nin: ["Resigned", "Terminated"] },
      Role: "Territory Sales Associate",
    };

    // Filter by TSM if tsm query param exists
    if (tsm && typeof tsm === "string") {
      query.TSM = tsm;  // Assuming your field is capitalized 'TSM' as per project()
    }

    const users = await db
      .collection("users")
      .find(query)
      .project({
        Firstname: 1,
        Lastname: 1,
        TSM: 1,
        ReferenceID: 1,
        profilePicture: 1,
        _id: 0,
      })
      .sort({ Lastname: 1 })
      .toArray();

    if (users.length === 0) {
      return res.status(404).json({ error: "No Territory Sales Associate users found" });
    }

    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Server error fetching users" });
  }
}
