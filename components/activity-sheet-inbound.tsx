"use client";

import React, { useEffect } from "react";
import { Button, } from "@/components/ui/button";
import { Field, FieldContent, FieldLabel, FieldSet, FieldGroup, FieldTitle, FieldDescription, } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";

const INBOUND_SOURCES = [
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

const INBOUND_CALL_TYPES = [
    {
        label: "After Sales",
        description: "Support after purchase or service completion — including warranty, replacement, certificates.",
    },

    {
        label: "Delivery Concern",
        description: "Issues or questions regarding delivery.",
    },
    {
        label: "Accounting Concern",
        description: "Billing or payment related inquiries.",
    },
    {
        label: "Technical / Product Concern",
        description: "Product or service technical support.",
    },
    {
        label: "Request for Quotation",
        description: "Potential client requesting price info.",
    },
    {
        label: "Inquiries",
        description: "General questions or information requests.",
    },
    {
        label: "Follow Up",
        description: "Following up on previous communication.",
    },
];

const STATUS_OPTIONS = [
    {
        label: "Assisted",
        description: "Call handled successfully.",
        value: "Assisted",
    },
];

interface InboundSheetProps {
    step: number;
    setStep: React.Dispatch<React.SetStateAction<number>>;
    source: string;
    setSource: (value: string) => void;
    callType: string;
    setCallType: (value: string) => void;
    remarks: string;
    setRemarks: (value: string) => void;
    status: string;
    setStatus: (value: string) => void;
    handleBack: () => void;
    handleNext: () => void;
    handleSave: () => void;
}

export function InboundSheet({
    step,
    setStep,
    source,
    setSource,
    callType,
    setCallType,
    remarks,
    setRemarks,
    status,
    setStatus,
    handleBack,
    handleNext,
    handleSave,
}: InboundSheetProps) {
    // If status empty, default to "Assisted"
    useEffect(() => {
        if (!status) {
            setStatus("Assisted");
        }
    }, [status, setStatus]);

    return (
        <>
            {/* Step 2: Source */}
            {step === 2 && (
                <>
                    <FieldGroup>
                        <FieldSet>
                            <FieldLabel>Source</FieldLabel>
                            <RadioGroup
                                defaultValue={source}
                                onValueChange={(value) => setSource(value)}
                            >
                                {INBOUND_SOURCES.map(({ label, description }) => (
                                    <FieldLabel key={label}>
                                        <Field orientation="horizontal">
                                            <FieldContent>
                                                <FieldTitle>{label}</FieldTitle>
                                                <FieldDescription>{description}</FieldDescription>
                                            </FieldContent>
                                            <RadioGroupItem value={label} />
                                        </Field>
                                    </FieldLabel>
                                ))}
                            </RadioGroup>
                        </FieldSet>
                    </FieldGroup>

                    <div className="flex justify-between mt-4">
                        <Button onClick={handleBack}>Back</Button>
                        <Button onClick={handleNext} disabled={!source}>
                            Next
                        </Button>
                    </div>
                </>
            )}

            {/* Step 3: Call Type */}
            {step === 3 && (
                <>
                    <FieldGroup>
                        <FieldSet>
                            <FieldLabel>Call Type</FieldLabel>
                            <RadioGroup
                                defaultValue={callType}
                                onValueChange={(value) => setCallType(value)}
                            >
                                {INBOUND_CALL_TYPES.map(({ label, description }) => (
                                    <FieldLabel key={label}>
                                        <Field orientation="horizontal">
                                            <FieldContent>
                                                <FieldTitle>{label}</FieldTitle>
                                                <FieldDescription>{description}</FieldDescription>
                                            </FieldContent>
                                            <RadioGroupItem value={label} />
                                        </Field>
                                    </FieldLabel>
                                ))}
                            </RadioGroup>
                        </FieldSet>

                    </FieldGroup>

                    <div className="flex justify-between mt-4">
                        <Button onClick={handleBack}>Back</Button>
                        <Button onClick={handleNext} disabled={!callType}>
                            Next
                        </Button>
                    </div>
                </>
            )}

            {/* Step 4: Remarks and Status */}
            {step === 4 && (
                <>
                    <FieldGroup>
                        <FieldSet>
                            <FieldLabel>Remarks</FieldLabel>
                            <Textarea
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                placeholder="Enter remarks"
                                required
                                className="capitalize"
                            />
                        </FieldSet>
                    </FieldGroup>

                    <FieldGroup className="mt-4">
                        <FieldSet>
                            <FieldLabel>Status</FieldLabel>
                            <RadioGroup
                                defaultValue={status}
                                onValueChange={(value) => setStatus(value)}
                            >
                                {STATUS_OPTIONS.map(({ label, description, value }) => (
                                    <FieldLabel key={value}>
                                        <Field orientation="horizontal">
                                            <FieldContent>
                                                <FieldTitle>{label}</FieldTitle>
                                                <FieldDescription>{description}</FieldDescription>
                                            </FieldContent>
                                            <RadioGroupItem value={value} />
                                        </Field>
                                    </FieldLabel>
                                ))}
                            </RadioGroup>
                        </FieldSet>
                    </FieldGroup>
                    <div className="flex justify-between mt-4">
                        <Button variant="outline" onClick={handleBack}>Back</Button>
                        <Button onClick={handleSave}>Save</Button>
                    </div>
                </>
            )}
        </>
    );
}
