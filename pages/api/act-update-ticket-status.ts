import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { ticket_reference_number, status } = req.body;

    if (!ticket_reference_number || !status) {
      return res
        .status(400)
        .json({ error: "Missing ticket_reference_number or status" });
    }

    const { data, error } = await supabase
      .from("endorsed-ticket")
      .update({ status })
      .eq("ticket_reference_number", ticket_reference_number)
      .select(); // ✅ IMPORTANT

    if (error) {
      console.error("Supabase update error:", error);
      return res.status(500).json({ error: error.message });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Ticket status updated",
      data,
    });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
