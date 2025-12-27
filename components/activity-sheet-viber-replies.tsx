"use client";

import React, { useEffect } from "react";
import { Button, } from "@/components/ui/button";
import { Field, FieldContent, FieldLabel, FieldSet, FieldGroup, FieldTitle, FieldDescription, } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";

const INBOUND_SOURCES = [
    {
        label: "New Client",
        description: "Clients with new accounts.",
    },
    {
        label: "Existing Client",
        description: "Clients with active accounts or previous transactions.",
    },
    {
        label: "CSR Endorsement",
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

const STATUS_OPTIONS = [
    {
        label: "Assisted",
        description: "Client was assisted and provided with the needed information or support.",
        value: "Assisted",
    },
    {
        label: "Not Assisted",
        description: "Unable to assist the client due to incomplete info, missed call, no response, seen, etc.",
        value: "Not Assisted",
    },
];

interface ViberRepliesSheetProps {
    step: number;
    setStep: React.Dispatch<React.SetStateAction<number>>;
    source: string;
    setSource: (value: string) => void;
    remarks: string;
    setRemarks: (value: string) => void;
    status: string;
    setStatus: (value: string) => void;
    typeClient: string;
    setTypeClient: (value: string) => void;
    handleBack: () => void;
    handleNext: () => void;
    handleSave: () => void;
}

export function ViberRepliesSheet({
    step,
    setStep,
    source,
    setSource,
    remarks,
    setRemarks,
    status,
    setStatus,
    typeClient,
    setTypeClient,
    handleBack,
    handleNext,
    handleSave,
}: ViberRepliesSheetProps) {
    // If status empty, default to "Assisted"
    useEffect(() => {
        if (!status) {
            setStatus("Assisted");
        }
    }, [status, setStatus]);

    const filteredSources =
        typeClient === "CSR Client"
            ? [
                {
                    label: "CSR Endorsement",
                    description: "Customer Service Representative inquiries.",
                },
            ]
            : INBOUND_SOURCES.filter(
                (source) => source.label !== "CSR Endorsement"
            );


    return (
        <>
            {/* Step 2: Source */}
            {step === 2 && (
                <>
                    <FieldGroup>
                        <FieldSet>
                            <FieldLabel>Source</FieldLabel>
                            <RadioGroup value={source} onValueChange={setSource}>
                                {filteredSources.map(({ label, description }) => (
                                    <FieldLabel key={label}>
                                        <Field orientation="horizontal" className="w-full items-start">
                                            {/* LEFT */}
                                            <FieldContent className="flex-1">
                                                <FieldTitle>{label}</FieldTitle>
                                                <FieldDescription>{description}</FieldDescription>

                                                {/* Buttons only visible if selected */}
                                                {source === label && (
                                                    <div className="mt-4 flex gap-2">
                                                        <Button type="button" variant="outline" onClick={handleBack}>
                                                            Back
                                                        </Button>
                                                        <Button type="button" onClick={handleNext} disabled={!source}>
                                                            Next
                                                        </Button>
                                                    </div>
                                                )}
                                            </FieldContent>

                                            {/* RIGHT */}
                                            <RadioGroupItem value={label} />
                                        </Field>
                                    </FieldLabel>
                                ))}
                            </RadioGroup>
                        </FieldSet>
                    </FieldGroup>
                </>
            )}

            {/* Step 3: Remarks and Status */}
            {step === 3 && (
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
                                value={status}
                                onValueChange={setStatus}
                                className="space-y-4"
                            >
                                {STATUS_OPTIONS.map(({ label, description, value }) => (
                                    <FieldLabel key={value}>
                                        <Field orientation="horizontal" className="w-full items-start">
                                            {/* LEFT */}
                                            <FieldContent className="flex-1">
                                                <FieldTitle>{label}</FieldTitle>
                                                <FieldDescription>{description}</FieldDescription>

                                                {/* Buttons only visible if selected */}
                                                {status === value && (
                                                    <div className="mt-4 flex gap-2">
                                                        <Button type="button" variant="outline" onClick={handleBack}>
                                                            Back
                                                        </Button>
                                                        <Button type="button" onClick={handleSave}>
                                                            Save
                                                        </Button>
                                                    </div>
                                                )}
                                            </FieldContent>

                                            {/* RIGHT */}
                                            <RadioGroupItem value={value} />
                                        </Field>
                                    </FieldLabel>
                                ))}
                            </RadioGroup>
                        </FieldSet>
                    </FieldGroup>
                </>
            )}
        </>
    );
}
