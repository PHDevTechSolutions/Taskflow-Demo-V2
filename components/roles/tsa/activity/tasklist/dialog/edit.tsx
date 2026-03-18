"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sileo } from "sileo";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  call_type?: string;
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
  "type_activity",
  "call_type",
  "call_status",
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

const quotationStatusOptions = [
  "Pending Client Approval",
  "For Bidding",
  "Nego",
  "Order Complete",
  "Convert to SO",
  "Loss Price is Too High",
  "Lead Time Issue",
  "Out of Stock",
  "Insufficient Stock",
  "Lost Bid",
  "Canvass Only",
  "Did Not Meet the Specs",
  "Declined / Disapproved",
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
      const res = await fetch(
        `/api/activity/tsa/historical/update?id=${item.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        }
      );

      if (!res.ok) throw new Error("Failed to update activity");

      sileo.success({
        title: "Succeess",
        description: "Activity updated successfully!",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: {
          title: "text-white!",
          description: "text-white",
        },
      });

      onSave();
    } catch (error) {
      sileo.error({
        title: "Failed",
        description: "Update failed! Please try again.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: {
          title: "text-white!",
          description: "text-white",
        },
      });
    }
  };

  const getLabel = (key: string) => {
    if (key === "call_type") return "Type";
    return key.replace(/_/g, " ");
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg rounded-none">
        <DialogHeader>
          <DialogTitle className="text-sm">
            Edit Activity: {item.activity_reference_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-auto">
          {Object.entries(formData).map(([key, value]) => {
            if (key === "type_activity") {
              return (
                <Input
                  key={key}
                  type="hidden"
                  className="rounded-none"
                  value={value as any}
                  disabled
                  readOnly
                />
              );
            }

            if (key === "call_status") {
              return (
                <div key={key} className="flex flex-col">
                  <Label className="capitalize mb-2">
                    {getLabel(key)}
                  </Label>
                  <Select
                    value={String(value ?? "")}
                    onValueChange={(val) =>
                      handleChange(key as keyof Completed, val)
                    }
                  >
                    <SelectTrigger className="w-full text-left rounded-none">
                      <SelectValue placeholder="Select call status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="Successful">
                          Successful
                        </SelectItem>
                        <SelectItem value="Unsuccessful">
                          Unsuccessful
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              );
            }

            if (key === "quotation_status") {
              return (
                <div key={key} className="flex flex-col">
                  <Label className="capitalize mb-2">
                    Quotation Status
                  </Label>
                  <Select
                    value={String(value ?? "")}
                    onValueChange={(val) =>
                      handleChange("quotation_status", val)
                    }
                  >
                    <SelectTrigger className="w-full text-left rounded-none">
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
                  <Label className="capitalize mb-2">
                    {getLabel(key)}
                  </Label>
                  <Textarea
                    className="w-full rounded-none"
                    value={value as any}
                    onChange={(e) =>
                      handleChange(
                        key as keyof Completed,
                        e.target.value
                      )
                    }
                  />
                </div>
              );
            }

            return (
              <div key={key} className="flex flex-col">
                <Label className="capitalize mb-2">
                  {getLabel(key)}
                </Label>
                <Input
                  className="w-full rounded-none"
                  type={getInputType(key)}
                  value={value as any}
                  onChange={(e) =>
                    handleChange(
                      key as keyof Completed,
                      e.target.value
                    )
                  }
                />
              </div>
            );
          })}
        </div>

        <DialogFooter className="mt-4 flex justify-end">
          <Button
            variant="outline"
            onClick={onClose}
            className="rounded-none p-6"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="rounded-none p-6"
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}