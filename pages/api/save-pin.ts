import { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";

const PIN_DATA_FILE = path.join(process.cwd(), "data", "pin-credentials.json");

// Ensure data directory exists
const ensureDataDirectory = () => {
  const dataDir = path.dirname(PIN_DATA_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
};

// Read PIN data from JSON file
const readPinData = () => {
  try {
    ensureDataDirectory();
    if (fs.existsSync(PIN_DATA_FILE)) {
      const data = fs.readFileSync(PIN_DATA_FILE, "utf8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error reading PIN data:", error);
  }
  return {};
};

// Write PIN data to JSON file
const writePinData = (data: any) => {
  try {
    ensureDataDirectory();
    fs.writeFileSync(PIN_DATA_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error writing PIN data:", error);
    throw error;
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { email, pin, action } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    const pinData = readPinData();

    if (action === "save") {
      if (!pin || pin.length !== 4) {
        return res.status(400).json({ error: "Valid 4-digit PIN is required" });
      }

      // Save or update PIN
      pinData[email] = {
        pin,
        timestamp: new Date().toISOString(),
      };

      writePinData(pinData);
      return res.status(200).json({ message: "PIN saved successfully" });

    } else if (action === "remove") {
      // Remove PIN
      if (pinData[email]) {
        delete pinData[email];
        writePinData(pinData);
        return res.status(200).json({ message: "PIN removed successfully" });
      }
      return res.status(404).json({ error: "No PIN found for this email" });

    } else if (action === "get") {
      // Get PIN
      const userPinData = pinData[email];
      if (userPinData) {
        return res.status(200).json(userPinData);
      }
      return res.status(404).json({ error: "No PIN found for this email" });

    } else {
      return res.status(400).json({ error: "Invalid action" });
    }

  } catch (error) {
    console.error("Error handling PIN data:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}