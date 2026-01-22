import { NextApiRequest, NextApiResponse } from "next";
import { validateUser, connectToDatabase } from "@/lib/mongodb";
import { serialize } from "cookie";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { Email, Password, deviceId } = req.body;
  if (!Email || !Password || !deviceId) {
    return res.status(400).json({ message: "Email, Password and deviceId are required." });
  }

  const db = await connectToDatabase();
  const users = db.collection("users");

  const user = await users.findOne({ Email });
  if (!user) {
    return res.status(401).json({ message: "Invalid credentials." });
  }

  // ❌ Resigned / Terminated
  if (["Resigned", "Terminated"].includes(user.Status)) {
    return res.status(403).json({
      message: `Your account is ${user.Status}. Login not allowed.`,
    });
  }

  // 🔒 Already locked
  if (user.Status === "Locked") {
    return res.status(403).json({
      message: "Account Is Locked. Submit your ticket to IT Department.",
      locked: true,
    });
  }

  const result = await validateUser({ Email, Password });

  // ❌ INVALID PASSWORD
  if (!result.success) {
    const attempts = (user.LoginAttempts || 0) + 1;

    if (attempts >= 5) {
      await users.updateOne(
        { Email },
        {
          $set: {
            LoginAttempts: attempts,
            Status: "Locked",
            LockUntil: null,
          },
        }
      );

      return res.status(403).json({
        message: "Account Is Locked. Submit your ticket to IT Department.",
        locked: true,
      });
    }

    await users.updateOne(
      { Email },
      { $set: { LoginAttempts: attempts } }
    );

    return res.status(401).json({
      message: `Invalid credentials. Attempt ${attempts}/5`,
    });
  }

  // ❗ SALES ONLY
  if (user.Department !== "Sales") {
    return res.status(403).json({
      message: "Only Sales department users are allowed to log in.",
    });
  }

  // ✅ RESET AFTER SUCCESS and save deviceId
  await users.updateOne(
    { Email },
    {
      $set: {
        LoginAttempts: 0,
        Status: "Active",
        LockUntil: null,
        DeviceId: deviceId,  // save deviceId here
      },
    }
  );

  const userId = result.user._id.toString();

  res.setHeader(
    "Set-Cookie",
    serialize("session", userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== "development",
      sameSite: "strict",
      maxAge: 60 * 60 * 24, // 1 day
      path: "/",
    })
  );

  return res.status(200).json({
    message: "Login successful",
    userId,
    Role: user.Role,
    Department: user.Department,
    Status: user.Status,
    ReferenceID: user.ReferenceID,
    TSM: user.TSM,
    Manager: user.Manager,
  });
}
