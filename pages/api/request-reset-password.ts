import { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/mongodb";
import crypto from "crypto";
import nodemailer from "nodemailer";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  const db = await connectToDatabase();
  const user = await db.collection("users").findOne({ Email: email });

  // ⚠️ silent success (security)
  if (!user) {
    return res.status(200).json({ message: "If email exists, reset link was sent." });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 mins

  await db.collection("password_resets").insertOne({
    email,
    token,
    expiresAt,
    createdAt: new Date(),
  });

  const resetLink = `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password?token=${token}`;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: `"Taskflow Support" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Reset Your Taskflow Password",
    html: `
      <p>You requested a password reset.</p>
      <p>
        <a href="${resetLink}">
          Click here to reset your password
        </a>
      </p>
      <p>This link will expire in 30 minutes.</p>
    `,
  });

  return res.status(200).json({ message: "Reset link sent." });
}
