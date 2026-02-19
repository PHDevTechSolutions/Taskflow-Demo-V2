"use client";

import React, { useState } from "react";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldSet, FieldTitle, } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CheckCircle2Icon } from "lucide-react";

interface Props {
    step: number;
    setStep: (step: number) => void;
    source: string;
    setSource: (v: string) => void;
    soAmount: string;
    setSoAmount: (v: string) => void;
    callType: string;
    setCallType: (v: string) => void;
    remarks: string;
    setRemarks: (v: string) => void;
    status: string;
    setStatus: (v: string) => void;
    typeClient: string;
    setTypeClient: (value: string) => void;
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
        soAmount,
        setSoAmount,
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
    } = props;

    // Validation helpers
    const isStep2Valid = source.trim() !== "";
    const isStep4Valid = callType.trim() !== "";

    // Step 3 Next handler with validation
    const handleNextStep3 = () => {
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

    const filteredSources =
        typeClient === "CSR Client"
            ? [
                {
                    label: "CSR Inquiry",
                    description: "Customer Service Representative inquiries.",
                },
            ]
            : SO_SOURCES.filter(
                (source) => source.label !== "CSR Inquiry"
            );

    return (
        <>
            {/* STEP 2 — SOURCE */}
            {step === 2 && (
                <div>
                    <FieldGroup>
                        <FieldSet>
                            <FieldLabel className="font-bold">Source</FieldLabel>
                            <RadioGroup
                                value={source}
                                onValueChange={setSource}
                            >
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
                                                        <Button type="button" onClick={handleNext} disabled={!isStep2Valid} className="rounded-none">
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
                </div>
            )}

            {/* STEP 3 — SO NUMBER & AMOUNT */}
            {step === 3 && (
                <div>
                    <FieldGroup>
                        {/* SO Amount */}
                        <FieldSet className="mt-3">
                            <FieldLabel className="font-bold">SO Amount</FieldLabel>
                            <p className="text-xs text-muted-foreground mb-1">
                                Total amount of the Sales Order. This should match the approved SO value.
                            </p>
                            <Input
                                type="number"
                                step="0.01"
                                min={0}
                                value={soAmount}
                                onChange={(e) => setSoAmount(e.target.value)}
                                placeholder="Enter SO Amount"
                                className="rounded-none"
                            />
                        </FieldSet>
                    </FieldGroup>

                    <div className="flex justify-between mt-4">
                        <Button variant="outline" className="rounded-none" onClick={handleBack}>
                           <ArrowLeft /> Back 
                        </Button>
                        <Button className="rounded-none" onClick={handleNextStep3}>
                            Next <ArrowRight />
                        </Button>
                    </div>
                </div>
            )}

            {/* STEP 4 — CALL TYPE */}
            {step === 4 && (
                <div>
                    <FieldGroup>
                        <FieldSet>
                            <FieldLabel className="font-bold">Type</FieldLabel>

                            <RadioGroup
                                value={callType}
                                onValueChange={setCallType}
                            >
                                {CALL_TYPES.map(({ label, description }) => (
                                    <FieldLabel key={label}>
                                        <Field orientation="horizontal" className="w-full items-start">
                                            {/* LEFT */}
                                            <FieldContent className="flex-1">
                                                <FieldTitle>{label}</FieldTitle>
                                                <FieldDescription>{description}</FieldDescription>

                                                {/* Buttons only visible if selected */}
                                                {callType === label && (
                                                    <div className="mt-4 flex gap-2">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            className="rounded-none"
                                                            onClick={handleBack}
                                                        >
                                                          <ArrowLeft /> Back
                                                        </Button>

                                                        <Button
                                                            type="button"
                                                            onClick={handleNextStep4}
                                                            disabled={!isStep4Valid}
                                                            className="rounded-none"
                                                        >
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
                </div>
            )}


            {/* STEP 5 — REMARKS & STATUS */}
            {step === 5 && (
                <div className="space-y-2">
                    <FieldGroup>
                        <FieldSet>
                            <FieldLabel className="font-bold">Remarks</FieldLabel>
                            <Textarea
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                placeholder="Enter remarks"
                                className="capitalize rounded-none"
                                required
                            />
                        </FieldSet>
                    </FieldGroup>

                    <FieldGroup>
                        <FieldSet>
                            <FieldLabel className="font-bold">Status</FieldLabel>

                            <RadioGroup value={status} onValueChange={props.setStatus}>
                                {[
                                    {
                                        value: "SO-Done",
                                        title: "SO-Done",
                                        desc: "Client was success and provided with the needed information or support.",
                                    },
                                    {
                                        value: "Cancelled",
                                        title: "Cancelled",
                                        desc: "Sales Order process is cancelled.",
                                    },
                                ].map((item) => (
                                    <FieldLabel key={item.value}>
                                        <Field orientation="horizontal" className="w-full items-start">
                                            <FieldContent className="flex-1">
                                                <FieldTitle>{item.title}</FieldTitle>
                                                <FieldDescription>{item.desc}</FieldDescription>

                                                {status === item.value && (
                                                    <div className="mt-4 flex gap-2">
                                                        <Button type="button" variant="outline" className="rounded-none" onClick={props.handleBack}>
                                                           <ArrowLeft /> Back
                                                        </Button>
                                                        <Button type="button" className="rounded-none" onClick={handleSave}>
                                                            Save <CheckCircle2Icon />
                                                        </Button>

                                                    </div>
                                                )}
                                            </FieldContent>
                                            <RadioGroupItem value={item.value} />
                                        </Field>
                                    </FieldLabel>
                                ))}
                            </RadioGroup>
                        </FieldSet>
                    </FieldGroup>

                </div>
            )}
        </>
    );
}
