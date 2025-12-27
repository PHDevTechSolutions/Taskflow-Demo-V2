import type { NextApiRequest, NextApiResponse } from "next";

const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
  throw new Error("Missing Upstash Redis credentials in environment variables");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;

  if (method === "GET") {
    const { key } = req.query;
    if (!key || typeof key !== "string") {
      return res.status(400).json({ error: "Missing or invalid key" });
    }

    try {
      const response = await fetch(`${UPSTASH_REDIS_REST_URL}/get/${encodeURIComponent(key)}`, {
        headers: {
          Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({ error: errorText });
      }

      const data = await response.json();

      // data.result has the value or null
      return res.status(200).json({ value: data.result });
    } catch (error) {
      return res.status(500).json({ error: "Failed to fetch from Redis" });
    }
  } else if (method === "POST") {
    const { key, value } = req.body;
    if (!key || typeof key !== "string" || typeof value !== "string") {
      return res.status(400).json({ error: "Missing or invalid key/value" });
    }

    try {
      const response = await fetch(`${UPSTASH_REDIS_REST_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({ error: errorText });
      }

      return res.status(200).json({ message: "Saved" });
    } catch (error) {
      return res.status(500).json({ error: "Failed to save to Redis" });
    }
  } else {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end(`Method ${method} Not Allowed`);
  }
}
