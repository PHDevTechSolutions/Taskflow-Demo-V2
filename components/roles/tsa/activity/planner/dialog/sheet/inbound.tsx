"use client";

import React, { useEffect } from "react";
import { Button, } from "@/components/ui/button";
import { Field, FieldContent, FieldLabel, FieldSet, FieldGroup, FieldTitle, FieldDescription, } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ArrowRight, CheckCircle2Icon } from "lucide-react";

const INBOUND_SOURCES = [
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
    typeClient: string;
    setTypeClient: (value: string) => void;
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
    typeClient,
    setTypeClient,
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
                            <FieldLabel className="font-bold">Source</FieldLabel>


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
                                                        <Button type="button" variant="outline" className="rounded-none" onClick={handleBack}>
                                                            <ArrowLeft /> Back
                                                        </Button>
                                                        <Button type="button" className="rounded-none" onClick={handleNext} disabled={!source}>
                                                            Next <ArrowRight />
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

            {/* Step 3: Call Type */}
            {step === 3 && (
                <>
                    <FieldGroup>
                        <FieldSet>
                            <FieldLabel className="font-bold">Call Type</FieldLabel>

                            <RadioGroup
                                value={callType}
                                onValueChange={setCallType}
                                className="space-y-4"
                            >
                                {INBOUND_CALL_TYPES.map(({ label, description }) => (
                                    <FieldLabel key={label}>
                                        <Field orientation="horizontal" className="w-full items-start">
                                            {/* LEFT */}
                                            <FieldContent className="flex-1">
                                                <FieldTitle>{label}</FieldTitle>
                                                <FieldDescription>{description}</FieldDescription>

                                                {/* Buttons only show if selected */}
                                                {callType === label && (
                                                    <div className="mt-4 flex gap-2">
                                                        <Button type="button" variant="outline" className="rounded-none" onClick={handleBack}>
                                                            <ArrowLeft /> Back
                                                        </Button>
                                                        <Button type="button" className="rounded-none" onClick={handleNext} disabled={!source}>
                                                            Next <ArrowRight />
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

            {/* Step 4: Remarks and Status */}
            {step === 4 && (
                <>
                    <FieldGroup>
                        <FieldSet>
                            <FieldLabel className="font-bold">Remarks</FieldLabel>
                            <Textarea
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                placeholder="Enter remarks"
                                required
                                className="capitalize rounded-none"
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
                                                        <Button type="button" variant="outline" className="rounded-none" onClick={handleBack}>
                                                           <ArrowLeft /> Back
                                                        </Button>
                                                        <Button type="button" className="rounded-none" onClick={handleSave}>
                                                            Save <CheckCircle2Icon />
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
