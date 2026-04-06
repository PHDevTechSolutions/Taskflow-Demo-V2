import { supabase } from "@/utils/supabase";
import { logAuditTrailWithSession } from "@/lib/auditTrail";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { id, quotation_status, quotation_status_sub } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Missing ID' });
  }

  try {
    const { data, error } = await supabase
      .from('history')
      .update({
        quotation_status,
        quotation_status_sub,
        date_updated: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Log audit trail for quotation status update
    await logAuditTrailWithSession(
      req,
      "update",
      "quotation status",
      id,
      `Status: ${quotation_status}`,
      `Updated quotation status to ${quotation_status}`,
      { quotation_status, quotation_status_sub }
    );

    return res.status(200).json(data);
  } catch (err: any) {
    console.error("Error updating quotation status:", err);
    return res.status(500).json({ error: err.message || 'Failed to update quotation status.' });
  }
}
