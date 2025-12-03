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

    drNumber: string;
    setDrNumber: (v: string) => void;

    siAmount: string;
    setSiAmount: (v: string) => void;

    paymentTerms: string;
    setPaymentTerms: (v: string) => void;

    deliveryDate: string;
    setDeliveryDate: (v: string) => void;

    remarks: string;
    setRemarks: (v: string) => void;

    status: string;
    setStatus: (v: string) => void;

    handleBack: () => void;
    handleNext: () => void;
    handleSave: () => void;
}

const SO_SOURCES = [
    { label: "Existing Client", description: "Clients with active accounts or previous transactions." },
    { label: "CSR Inquiry", description: "Customer Service Representative inquiries." },
    { label: "Government", description: "Calls coming from government agencies." },
    { label: "Philgeps Website", description: "Inquiries from Philgeps online platform." },
    { label: "Philgeps", description: "Other Philgeps related contacts." },
    { label: "Distributor", description: "Calls from product distributors or resellers." },
    { label: "Modern Trade", description: "Contacts from retail or modern trade partners." },
    { label: "Facebook Marketplace", description: "Leads or inquiries from Facebook Marketplace." },
    { label: "Walk-in Showroom", description: "Visitors physically coming to showroom." },
];

const PAYMENT_TERMS = [
  {
    label: "COD",
    description: "Customer pays the full amount upon delivery of the items.",
  },
  {
    label: "Check",
    description: "Payment will be made through dated or current check upon delivery or agreed schedule.",
  },
  {
    label: "Cash",
    description: "Customer pays in cash either upon order confirmation or delivery.",
  },
  {
    label: "Bank Deposit",
    description: "Payment is sent via bank transfer or direct deposit to the company account.",
  },
  {
    label: "GCash",
    description: "Customer pays via GCash wallet transfer prior to or during delivery.",
  },
  {
    label: "Terms",
    description: "Payment follows an agreed credit term (e.g., 30/45/60 days) after delivery.",
  },
];

export function DRSheet(props: Props) {
    const {
        step, setStep,
        source, setSource,
        drNumber, setDrNumber,
        siAmount, setSiAmount,
        paymentTerms, setPaymentTerms,
        deliveryDate, setDeliveryDate,
        remarks, setRemarks,
        status, setStatus,
        handleBack,
        handleNext,
        handleSave,
    } = props;

    // Step Validations
    const isStep2Valid = source.trim() !== "";
    const isStep3Valid =
        drNumber.trim() !== "" &&
        siAmount.trim() !== "" &&
        !isNaN(Number(siAmount));

    const isStep4Valid =
        paymentTerms.trim() !== "" &&
        deliveryDate.trim() !== "";

    const isStep5Valid = remarks.trim() !== "";

    const handleNextStep3 = () => {
        if (drNumber.trim() === "") {
            toast.error("Please enter DR Number.");
            return;
        }
        if (siAmount.trim() === "" || isNaN(Number(siAmount))) {
            toast.error("Please enter valid SI Amount.");
            return;
        }
        handleNext();
    };

    const handleNextStep4 = () => {
        if (paymentTerms.trim() === "") {
            toast.error("Please select Payment Terms.");
            return;
        }
        if (deliveryDate.trim() === "") {
            toast.error("Please select Delivery Date.");
            return;
        }
        handleNext();
    };

    return (
        <>

            {/* STEP 2 - SOURCE */}
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

            {/* STEP 3 - DR Number & SI Amount */}
            {step === 3 && (
                <div>
                    <FieldGroup>
                        {/* DR Number */}
                        <FieldSet>
                            <FieldLabel>DR Number</FieldLabel>
                            <Input
                                type="text"
                                value={drNumber}
                                onChange={(e) => setDrNumber(e.target.value)}
                                placeholder="Enter DR Number"
                                className="uppercase"
                            />
                        </FieldSet>

                        {/* SI Amount */}
                        <FieldSet className="mt-3">
                            <FieldLabel>SI (Actual Sales)</FieldLabel>
                            <Input
                                type="number"
                                min={0}
                                step="0.01"
                                value={siAmount}
                                onChange={(e) => setSiAmount(e.target.value)}
                                placeholder="Enter SI Amount"
                            />
                        </FieldSet>
                    </FieldGroup>

                    <div className="flex justify-between mt-4">
                        <Button variant="outline" onClick={handleBack}>Back</Button>
                        <Button onClick={handleNextStep3} disabled={!isStep3Valid}>
                            Next
                        </Button>
                    </div>
                </div>
            )}

            {/* STEP 4 - PAYMENT TERMS + DELIVERY DATE */}
            {step === 4 && (
                <div>
                    <FieldGroup>
                        {/* PAYMENT TERMS */}
                        <FieldSet>
                            <FieldLabel>Payment Terms</FieldLabel>
                            <RadioGroup
                                value={paymentTerms}
                                onValueChange={setPaymentTerms}
                            >
                                {PAYMENT_TERMS.map(({ label, description }) => (
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

                        {/* DELIVERY DATE */}
                        <FieldSet className="mt-4">
                            <FieldLabel>Delivery Date</FieldLabel>
                            <Input
                                type="date"
                                value={deliveryDate}
                                onChange={(e) => setDeliveryDate(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                Select the actual date of delivery.
                            </p>
                        </FieldSet>
                    </FieldGroup>

                    <div className="flex justify-between mt-4">
                        <Button variant="outline" onClick={handleBack}>Back</Button>
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
                                required
                                className="capitalize"
                            />
                        </FieldSet>
                    </FieldGroup>

                    <FieldGroup>
                        <FieldSet>
                            <FieldLabel>Status</FieldLabel>
                            <RadioGroup value={status} onValueChange={setStatus}>
                                <FieldLabel>
                                    <Field orientation="horizontal">
                                        <FieldContent>
                                            <FieldTitle>Delivered</FieldTitle>
                                            <FieldDescription>
                                                All fields completed (DR, SI, Payment Terms & Delivery Date)
                                            </FieldDescription>
                                        </FieldContent>
                                        <RadioGroupItem value="Delivered" />
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
