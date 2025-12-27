"use client";

import React, { useEffect } from "react";
import { Button, } from "@/components/ui/button";
import { Field, FieldContent, FieldLabel, FieldSet, FieldGroup, FieldTitle, FieldDescription, } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";

const INBOUND_SOURCES = [
    {
        label: "Facebook Marketplace",
        description: "Leads or inquiries from Facebook Marketplace.",
    },
];

const INBOUND_CALL_TYPES = [
    {
        label: "Reply Message Concern",
        description: "Issues or questions regarding reply messages.",
    },

    {
        label: "Posting",
        description: "Assistance with creating or managing postings.",
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

export function FBMarketplaceSheet({
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

            {/* Step 3: Call Type */}
            {step === 3 && (
                <>
                    <FieldGroup>
                        <FieldSet>
                            <FieldLabel>Call Type</FieldLabel>

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
                                                        <Button type="button" onClick={handleBack} variant="outline">
                                                            Back
                                                        </Button>
                                                        <Button type="button" onClick={handleNext} disabled={!callType}>
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
