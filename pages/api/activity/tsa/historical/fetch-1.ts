import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";
import fs from "fs";
import path from "path";

const BATCH_SIZE = 5000;
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

// ===========================
// Base64 Encode/Decode Helpers
// ===========================
function encodeBase64(text: string) {
  return Buffer.from(text, "utf8").toString("base64");
}

function decodeBase64(text: string) {
  return Buffer.from(text, "base64").toString("utf8");
}

// ===========================
// Fetch Supabase in Batches
// ===========================
async function fetchHistory(referenceid: string, fromDate?: string, toDate?: string) {
  let lastId: number | null = null;
  const results: any[] = [];

  while (true) {
    let query = supabase
      .from("history")
      .select("*")
      .eq("referenceid", referenceid)
      .order("id", { ascending: true })
      .limit(BATCH_SIZE);

    if (lastId) query = query.gt("id", lastId);
    if (fromDate && toDate) query = query.gte("date_created", fromDate).lte("date_created", toDate);

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;

    results.push(...data);
    lastId = data[data.length - 1].id;
  }

  return results;
}

// ===========================
// API Handler
// ===========================
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { referenceid, from, to, refresh } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({ message: "Missing or invalid referenceid" });
  }

  const fromDate = typeof from === "string" ? from : undefined;
  const toDate = typeof to === "string" ? to : undefined;
  const forceRefresh = refresh === "true";

  try {
    // Auto-create cache/historical folder
    const cacheDir = path.join(process.cwd(), "cache");
    const historicalDir = path.join(cacheDir, "historical");
    if (!fs.existsSync(historicalDir)) fs.mkdirSync(historicalDir, { recursive: true });

    const cacheFile = path.join(historicalDir, `history-${referenceid}.cache`);

    let useCache = false;

    if (fs.existsSync(cacheFile) && !forceRefresh) {
      const stats = fs.statSync(cacheFile);
      const age = Date.now() - stats.mtime.getTime();
      if (age < CACHE_TTL) useCache = true;

      // Auto-refresh if new rows exist
      const encoded = fs.readFileSync(cacheFile, "utf8");
      const decoded = decodeBase64(encoded);
      const cached = JSON.parse(decoded);

      // Check latest row in Supabase
      const { data: latestRow, error: latestError } = await supabase
        .from("history")
        .select("date_created")
        .eq("referenceid", referenceid)
        .order("date_created", { ascending: false })
        .limit(1);

      if (!latestError && latestRow && latestRow.length > 0) {
        const latestDate = latestRow[0].date_created;
        const lastCachedDate = cached.length ? cached[cached.length - 1].date_created : null;

        if (!lastCachedDate || new Date(latestDate) > new Date(lastCachedDate)) {
          useCache = false; // may bagong row, i-refresh cache
        }
      }

      if (useCache) {
        return res.json({
          activities: cached,
          total: cached.length,
          cached: true,
        });
      }
    }

    // Fetch latest from Supabase
    const data = await fetchHistory(referenceid, fromDate, toDate);

    // Save Base64 encoded cache
    const encoded = encodeBase64(JSON.stringify(data, null, 2));
    fs.writeFileSync(cacheFile, encoded);

    res.json({
      activities: data,
      total: data.length,
      cached: false,
    });

  } catch (err: any) {
    console.error("Server error:", err);
    res.status(500).json({ message: err.message || "Server error" });
  }
}