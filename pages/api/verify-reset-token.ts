import { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/mongodb";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ valid: false });
  }

  const db = await connectToDatabase();
  const record = await db.collection("password_resets").findOne({
    token,
    expiresAt: { $gt: new Date() },
  });

  if (!record) {
    return res.status(400).json({ valid: false });
  }

  return res.status(200).json({ valid: true, email: record.email });
}
