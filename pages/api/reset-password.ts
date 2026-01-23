import { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/mongodb";
import { hashPassword } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ message: "Invalid request" });
  }

  const db = await connectToDatabase();

  const reset = await db.collection("password_resets").findOne({
    token,
    expiresAt: { $gt: new Date() },
  });

  if (!reset) {
    return res.status(400).json({ message: "Token expired or invalid" });
  }

  const hashedPassword = await hashPassword(newPassword);

  await db.collection("users").updateOne(
    { Email: reset.email },
    {
      $set: {
        Password: hashedPassword,
        LoginAttempts: 0,
        Status: "Active",
        LockUntil: null,
      },
    }
  );

  // 🔥 delete token after use
  await db.collection("password_resets").deleteOne({ token });

  return res.status(200).json({ message: "Password reset successful" });
}
