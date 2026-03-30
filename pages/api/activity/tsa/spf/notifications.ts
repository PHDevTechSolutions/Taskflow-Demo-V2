import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { referenceid } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({ message: "Missing or invalid referenceid" });
  }

  try {
    // Fetch SPF requests with status 'approved by procurement'
    const { data: spfData, error: spfError } = await supabase
      .from("spf_request")
      .select("*")
      .eq("referenceid", referenceid)
      .order("date_updated", { ascending: false });

    if (spfError) {
      console.error("Error fetching SPF requests:", spfError);
      return res.status(500).json({ message: "Database error" });
    }

    if (!spfData || spfData.length === 0) {
      return res.json({ notifications: [] });
    }

    // Get SPF numbers to check status
    const spfNumbers = spfData.map(item => item.spf_number).filter(Boolean);
    
    // Fetch status from spf_creation table
    const { data: statusData, error: statusError } = await supabase
      .from("spf_creation")
      .select("spf_number, status, date_updated")
      .in("spf_number", spfNumbers);

    if (statusError) {
      console.error("Error fetching SPF status:", statusError);
      return res.status(500).json({ message: "Database error" });
    }

    // Create a map of SPF number to status and date_updated
    const statusMap = new Map();
    if (statusData) {
      statusData.forEach(item => {
        statusMap.set(item.spf_number, {
          status: item.status,
          date_updated: item.date_updated
        });
      });
    }

    // Filter for SPF requests with 'approved by procurement' status
    const procurementApproved = spfData.filter(item => {
      const statusInfo = statusMap.get(item.spf_number);
      return statusInfo && statusInfo.status === "Approved By Procurement";
    });

    // Merge with status information
    const notifications = procurementApproved.map(item => {
      const statusInfo = statusMap.get(item.spf_number);
      return {
        id: item.id,
        spf_number: item.spf_number,
        company_name: item.company_name,
        date_created: item.date_created,
        date_updated: statusInfo?.date_updated || item.date_updated,
        status: "Approved By Procurement",
        referenceid: item.referenceid,
        activity_reference_number: item.activity_reference_number
      };
    });

    // Sort by date_updated (newest first)
    notifications.sort((a, b) => {
      const dateA = new Date(a.date_updated || a.date_created).getTime();
      const dateB = new Date(b.date_updated || b.date_created).getTime();
      return dateB - dateA;
    });

    res.json({ notifications });

  } catch (err: any) {
    console.error("Server error:", err);
    res.status(500).json({ message: err.message || "Server error" });
  }
}