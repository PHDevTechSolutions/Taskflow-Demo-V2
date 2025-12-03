"use client";

import React, { useState } from "react";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldSet, FieldTitle, } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface Props {
    step: number;
    setStep: (step: number) => void;

    source: string;
    setSource: (v: string) => void;

    soNumber: string;
    setSoNumber: (v: string) => void;

    soAmount: string;
    setSoAmount: (v: string) => void;

    callType: string;
    setCallType: (v: string) => void;

    remarks: string;
    setRemarks: (v: string) => void;

    status: string;
    setStatus: (v: string) => void;

    handleBack: () => void;
    handleNext: () => void;
    handleSave: () => void;
}

const SO_SOURCES = [
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

const CALL_TYPES = [
    {
        label: "Regular SO",
        description: "Standard sales order without special conditions.",
    },
    {
        label: "Willing to Wait",
        description: "Client agrees to wait for product availability or delivery.",
    },
    {
        label: "SPF - Special Project",
        description: "Sales order related to special projects requiring special handling.",
    },
    {
        label: "SPF - Local",
        description: "Special project sales order for local clients.",
    },
    {
        label: "SPF - Foreign",
        description: "Special project sales order for foreign clients.",
    },
    {
        label: "Promo",
        description: "Sales order under promotional campaigns or discounts.",
    },
    {
        label: "FB Marketplace",
        description: "Sales orders generated from Facebook Marketplace leads.",
    },
    {
        label: "Internal Order",
        description: "Orders placed internally within the company.",
    },
];

export function SOSheet(props: Props) {
    const {
        step,
        setStep,
        source,
        setSource,
        soNumber,
        setSoNumber,
        soAmount,
        setSoAmount,
        callType,
        setCallType,
        remarks,
        setRemarks,
        status,
        setStatus,
        handleBack,
        handleNext,
        handleSave,
    } = props;

    // Validation helpers
    const isStep2Valid = source.trim() !== "";
    const isStep3Valid = soNumber.trim() !== "" && soAmount.trim() !== "" && !isNaN(Number(soAmount));
    const isStep4Valid = callType.trim() !== "";
    const isStep5Valid = remarks.trim() !== "";

    // Step 3 Next handler with validation
    const handleNextStep3 = () => {
        if (soNumber.trim() === "") {
            toast.error("Please enter SO Number.");
            return;
        }
        if (soAmount.trim() === "" || isNaN(Number(soAmount))) {
            toast.error("Please enter valid SO Amount.");
            return;
        }
        handleNext();
    };

    // Step 4 Next handler with validation
    const handleNextStep4 = () => {
        if (callType.trim() === "") {
            toast.error("Please select Call Type.");
            return;
        }
        handleNext();
    };

    return (
        <>
            {/* STEP 2 — SOURCE */}
            {step === 2 && (
                <div>
                    <FieldGroup>
                        <FieldSet>
                            <FieldLabel>Source</FieldLabel>
                            <RadioGroup
                                defaultValue={source}
                                onValueChange={(value) => setSource(value)}
                            >
                                {SO_SOURCES.map(({ label, description }) => (
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
                        <Button onClick={handleNext} disabled={!isStep2Valid}>
                            Next
                        </Button>
                    </div>
                </div>
            )}

            {/* STEP 3 — SO NUMBER & AMOUNT */}
            {step === 3 && (
                <div>
                    <FieldGroup>
                        <FieldSet>
                            <FieldLabel>SO Number</FieldLabel>
                            <Input
                                type="text"
                                value={soNumber}
                                onChange={(e) => setSoNumber(e.target.value)}
                                placeholder="Enter SO Number"
                                className="uppercase"
                            />
                        </FieldSet>

                        <FieldSet className="mt-3">
                            <FieldLabel>SO Amount</FieldLabel>
                            <Input
                                type="number"
                                step="0.01"
                                min={0}
                                value={soAmount}
                                onChange={(e) => setSoAmount(e.target.value)}
                                placeholder="Enter SO Amount"
                            />
                        </FieldSet>
                    </FieldGroup>

                    <div className="flex justify-between mt-4">
                        <Button variant="outline" onClick={handleBack}>
                            Back
                        </Button>
                        <Button onClick={handleNextStep3} disabled={!isStep3Valid}>
                            Next
                        </Button>
                    </div>
                </div>
            )}

            {/* STEP 4 — CALL TYPE */}
            {step === 4 && (
                <div>
                    <FieldGroup>
                        <FieldSet>
                            <FieldLabel>Call Type</FieldLabel>
                            <RadioGroup value={callType} onValueChange={setCallType}>
                                {CALL_TYPES.map(({ label, description }) => (
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
                        <Button variant="outline" onClick={handleBack}>
                            Back
                        </Button>
                        <Button onClick={handleNextStep4} disabled={!isStep4Valid}>
                            Next
                        </Button>
                    </div>
                </div>
            )}

            {/* STEP 5 — REMARKS & STATUS */}
            {step === 5 && (
                <div>
                    <FieldGroup>
                        <FieldSet>
                            <FieldLabel>Remarks</FieldLabel>
                            <Textarea
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                placeholder="Enter remarks"
                                className="capitalize"
                                required
                            />
                        </FieldSet>
                    </FieldGroup>

                    <FieldGroup>
                        <FieldSet>
                            <FieldLabel>Status</FieldLabel>
                            <RadioGroup
                                value={status}
                                onValueChange={setStatus}
                            >
                                <FieldLabel>
                                    <Field orientation="horizontal">
                                        <FieldContent>
                                            <FieldTitle>SO-Done</FieldTitle>
                                            <FieldDescription>
                                                Sales Order process is complete.
                                            </FieldDescription>
                                        </FieldContent>
                                        <RadioGroupItem value="SO-Done" />
                                    </Field>
                                </FieldLabel>
                            </RadioGroup>
                        </FieldSet>
                    </FieldGroup>

                    <div className="flex justify-between mt-4">
                        <Button variant="outline" onClick={handleBack}>Back</Button>
                        <Button onClick={handleSave}>Save</Button>
                    </div>
                </div>
            )}
        </>
    );
}
