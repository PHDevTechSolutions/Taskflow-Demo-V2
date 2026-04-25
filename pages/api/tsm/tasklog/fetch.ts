import { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/mongodb";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  const { tsm, manager, type, from, to } = req.query;

  if (!tsm && !manager) {
    return res.status(400).json({ error: "tsm or manager query parameter is required" });
  }

  try {
    const db = await connectToDatabase();

    // Build query filter
    const filter: any = {};

    // Filter by Type (e.g., "Site Visit")
    if (type) {
      filter.Type = type;
    }

    // Filter by date range - ensure proper date parsing
    if (from || to) {
      filter.date_created = {};
      if (from) {
        const fromDate = new Date(from as string);
        fromDate.setHours(0, 0, 0, 0);
        filter.date_created.$gte = fromDate;
      }
      if (to) {
        const toDate = new Date(to as string);
        toDate.setHours(23, 59, 59, 999);
        filter.date_created.$lte = toDate;
      }
    }

    let agentReferenceIds: string[] = [];

    if (tsm) {
      // Filter by TSM - find all agents under this TSM
      const agents = await db
        .collection("users")
        .find({ TSM: tsm })
        .toArray();
      agentReferenceIds = agents.map(agent => agent.ReferenceID);
    } else if (manager) {
      // Filter by Manager - find all TSMs under this Manager, then agents under those TSMs
      // First, get all TSMs under this Manager
      const tsms = await db
        .collection("users")
        .find({ Manager: manager, Role: "Territory Sales Manager" })
        .toArray();
      
      const tsmIds = tsms.map(tsm => tsm.ReferenceID);
      
      if (tsmIds.length === 0) {
        return res.status(200).json({ taskLogs: [] });
      }

      // Then get all agents under those TSMs
      const agents = await db
        .collection("users")
        .find({ TSM: { $in: tsmIds } })
        .toArray();
      
      agentReferenceIds = agents.map(agent => agent.ReferenceID);
    }

    if (agentReferenceIds.length === 0) {
      return res.status(200).json({ taskLogs: [] });
    }

    // Filter TaskLog by ReferenceID (agents under this TSM)
    filter.ReferenceID = { $in: agentReferenceIds };

    // Query TaskLog collection
    const taskLogs = await db
      .collection("TaskLog")
      .find(filter)
      .sort({ date_created: -1 })
      .toArray();

    // Map to expected format - handle all possible field name variations
    const formattedLogs = taskLogs.map(log => {
      // Try all possible casings for SiteVisitAccount
      const siteVisitAccount = log.SiteVisitAccount 
        || log.siteVisitAccount 
        || log.SitevisitAccount 
        || log.sitevisitAccount
        || log["Site Visit Account"]
        || log["site visit account"]
        || null;
      
      // Try all possible casings for Location
      const location = log.Location 
        || log.location 
        || log["Location"]
        || null;
      
      return {
        ReferenceID: log.ReferenceID,
        Type: log.Type,
        SiteVisitAccount: siteVisitAccount,
        Location: location,
        date_created: log.date_created,
      };
    });

    res.status(200).json({ taskLogs: formattedLogs });
  } catch (error) {
    // Error occurred but don't log to console
    res.status(500).json({ error: "Server error fetching task logs" });
  }
}
