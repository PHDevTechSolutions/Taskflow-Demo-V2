"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue, } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Completed {
  id: number;
  activity_reference_number: string;
  referenceid: string;
  tsm: string;
  manager: string;
  project_name?: string;
  type_activity?: string;
  product_category?: string;
  project_type?: string;
  source?: string;
  call_status?: string;
  quotation_number?: string;
  quotation_amount?: number;
  quotation_status?: string;
  so_number?: string;
  so_amount?: number;
  actual_sales?: number;
  delivery_date?: string;
  dr_number?: string;
  remarks?: string;
  payment_terms?: string;
}

interface TaskListEditDialogProps {
  item: Completed;
  onClose: () => void;
  onSave: () => void;

  company?: {
    account_reference_number: string;
    company_name?: string;
    contact_number?: string;
    type_client?: string;
    email_address?: string;
    address?: string;
    contact_person?: string;
  };

  firstname?: string;
  lastname?: string;
  email?: string;
  contact?: string;
  tsmname?: string;
  managername?: string;
}

const editableFields: (keyof Completed)[] = [
  "project_name",
  "project_type",
  "source",
  "type_activity", // disabled input
  "call_status",
  "quotation_number",
  "quotation_amount",
  "quotation_status",
  "so_number",
  "so_amount",
  "actual_sales",
  "delivery_date",
  "dr_number",
  "remarks",
  "payment_terms",
];

const sourceOptions = [
  {
    label: "Existing Client",
    description: "Clients with active accounts or previous transactions.",
  },
  {
    label: "CSR Inquiry",
    description: "Customer Service Representative inquiries.",
  },
  {
    label: "Government",
    description: "Calls coming from government agencies.",
  },
  {
    label: "Philgeps Website",
    description: "Inquiries from Philgeps online platform.",
  },
  {
    label: "Philgeps",
    description: "Other Philgeps related contacts.",
  },
  {
    label: "Distributor",
    description: "Calls from product distributors or resellers.",
  },
  {
    label: "Modern Trade",
    description: "Contacts from retail or modern trade partners.",
  },
  {
    label: "Facebook Marketplace",
    description: "Leads or inquiries from Facebook Marketplace.",
  },
  {
    label: "Walk-in Showroom",
    description: "Visitors physically coming to showroom.",
  },
];

const paymentTermsOptions = [
  {
    label: "COD",
    description: "Customer pays the full amount upon delivery of the items.",
  },
  {
    label: "Check",
    description:
      "Payment will be made through dated or current check upon delivery or agreed schedule.",
  },
  {
    label: "Cash",
    description:
      "Customer pays in cash either upon order confirmation or delivery.",
  },
  {
    label: "Bank Deposit",
    description:
      "Payment is sent via bank transfer or direct deposit to the company account.",
  },
  {
    label: "GCash",
    description:
      "Customer pays via GCash wallet transfer prior to or during delivery.",
  },
  {
    label: "Terms",
    description:
      "Payment follows an agreed credit term (e.g., 30/45/60 days) after delivery.",
  },
];

const quotationStatusOptions = [
  "Convert to SO",
  "Declined / Dissaproved",
  "Pending PD",
  "Pending Procurement",
  "Pending Client Approval",
  "Wait Bid Results",
  "Lost Bid",
];

export default function TaskListEditDialog({
  item,
  onClose,
  onSave,
}: TaskListEditDialogProps) {
  const initialFormState = editableFields.reduce((acc, key) => {
    const value = item[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      (acc as any)[key] = value;
    }
    return acc;
  }, {} as Partial<Completed>);

  const [formData, setFormData] = useState<Partial<Completed>>(initialFormState);

  useEffect(() => {
    setFormData(initialFormState);
  }, [item]);

  const handleChange = (field: keyof Completed, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const getInputType = (key: string) => {
    switch (key) {
      case "callback":
        return "datetime-local";
      case "delivery_date":
        return "date";
      case "quotation_amount":
      case "so_amount":
      case "actual_sales":
        return "number";
      default:
        return "text";
    }
  };

  const handleSave = async () => {
    try {
      const res = await fetch(`/api/activity/tsa/historical/update?id=${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error("Failed to update activity");

      toast.success("Activity updated successfully!");
      onSave();
    } catch (error) {
      toast.error("Update failed! Please try again.");
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm">Edit Activity: {item.activity_reference_number}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-auto">
          {Object.entries(formData).map(([key, value]) => {
            if (key === "type_activity") {
              return <Input key={key} type="hidden" value={value as any} disabled readOnly />;
            }

            if (key === "call_status") {
              return (
                <div key={key} className="flex flex-col">
                  <Label className="capitalize mb-2">{key.replace(/_/g, " ")}</Label>
                  <Select value={String(value ?? "")} onValueChange={(val) => handleChange(key as keyof Completed, val)}>
                    <SelectTrigger className="w-full text-left">
                      <SelectValue placeholder="Select call status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="Successful">Successful</SelectItem>
                        <SelectItem value="Unsuccessful">Unsuccessful</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              );
            }

            if (key === "quotation_status") {
              return (
                <div key={key} className="flex flex-col">
                  <Label className="capitalize mb-2">Quotation Status</Label>
                  <Select value={String(value ?? "")} onValueChange={(val) => handleChange("quotation_status", val)}>
                    <SelectTrigger className="w-full text-left">
                      <SelectValue placeholder="Select quotation status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {quotationStatusOptions.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              );
            }

            if (key === "remarks") {
              return (
                <div key={key} className="flex flex-col">
                  <Label className="capitalize mb-2">{key.replace(/_/g, " ")}</Label>
                  <Textarea className="w-full" value={value as any} onChange={(e) => handleChange(key as keyof Completed, e.target.value)} />
                </div>
              );
            }

            return (
              <div key={key} className="flex flex-col">
                <Label className="capitalize mb-2">{key.replace(/_/g, " ")}</Label>
                <Input className="w-full" type={getInputType(key)} value={value as any} onChange={(e) => handleChange(key as keyof Completed, e.target.value)} />
              </div>
            );
          })}
        </div>
        <DialogFooter className="mt-4 flex justify-end space-x-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
