"use client";

import React from "react";
import { CheckCircle2Icon } from "lucide-react";

import { FieldGroup, FieldSet, FieldLabel, Field, FieldContent, FieldDescription, FieldTitle, } from "@/components/ui/field";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface OutboundSheetProps {
    step: number; setStep: React.Dispatch<React.SetStateAction<number>>;
    source: string; setSource: React.Dispatch<React.SetStateAction<string>>;
    callback: string; setCallback: React.Dispatch<React.SetStateAction<string>>;
    callStatus: string; setCallStatus: React.Dispatch<React.SetStateAction<string>>;
    callType: string; setCallType: React.Dispatch<React.SetStateAction<string>>;
    followUpDate: string; setFollowUpDate: React.Dispatch<React.SetStateAction<string>>;
    status: string; setStatus: React.Dispatch<React.SetStateAction<string>>;
    remarks: string; setRemarks: React.Dispatch<React.SetStateAction<string>>;
    loading: boolean;

    contact_number: string;
    handleBack: () => void;
    handleNext: () => void;
    handleSave: () => void;
}

export function OutboundSheet({
    step, setStep,
    source, setSource,
    callback, setCallback,
    callStatus, setCallStatus,
    callType, setCallType,
    followUpDate, setFollowUpDate,
    status, setStatus,
    remarks, setRemarks,
    loading,
    contact_number,
    handleBack,
    handleNext,
    handleSave,

}: OutboundSheetProps) {
    return (
        <>
            {/* STEP 2 */}
            {step === 2 && (
                <div>
                    <h2 className="text-sm font-semibold mb-3">Step 2 — Source</h2>
                    <FieldGroup>
                        <FieldSet>
                            <FieldLabel>Source</FieldLabel>

                            <RadioGroup value={source} onValueChange={setSource} className="space-y-4">
                                {[
                                    {
                                        value: "Outbound - Touchbase",
                                        title: "Outbound - Touchbase",
                                        desc:
                                            "Initial call to reconnect or update the client about ongoing concerns.",
                                    },
                                    {
                                        value: "Outbound - Follow-up",
                                        title: "Outbound - Follow-up",
                                        desc:
                                            "Follow-up call to check progress or request additional requirements.",
                                    },
                                ].map((item) => (
                                    <FieldLabel key={item.value}>
                                        <Field orientation="horizontal" className="w-full items-start">
                                            {/* LEFT */}
                                            <FieldContent className="flex-1">
                                                <FieldTitle>{item.title}</FieldTitle>
                                                <FieldDescription>{item.desc}</FieldDescription>

                                                {/* Button lalabas lang sa selected */}
                                                {source === item.value && (
                                                    <div className="mt-4 flex gap-2 flex">
                                                        <Button variant="outline" onClick={handleBack}>Back</Button>
                                                        <Button onClick={handleNext}>
                                                            Next
                                                        </Button>
                                                    </div>
                                                )}
                                            </FieldContent>

                                            {/* RIGHT */}
                                            <RadioGroupItem value={item.value} />
                                        </Field>
                                    </FieldLabel>
                                ))}
                            </RadioGroup>

                        </FieldSet>
                    </FieldGroup>

                    <Alert className="mt-6 flex flex-col space-y-2 border-blue-400 bg-blue-50 text-blue-900">
                        <div className="flex items-center space-x-2">
                            <CheckCircle2Icon className="w-6 h-6 text-blue-600" />
                            <AlertTitle className="text-lg font-semibold">Note on Source Counting</AlertTitle>
                        </div>
                        <AlertDescription className="text-sm leading-relaxed">
                            The{" "}
                            <span className="font-semibold text-blue-700">Outbound - Touchbase</span>{" "}
                            calls are counted in the dashboard, national sales, and conversion
                            rates, whereas the{" "}
                            <span className="font-semibold text-blue-700">Outbound - Follow-up</span>{" "}
                            calls are only counted in the source statistics.
                        </AlertDescription>
                    </Alert>
                </div>
            )}

            {/* STEP 3 */}
            {step === 3 && (
                <div>
                    <h2 className="text-sm font-semibold mb-3">Step 3 — Call Details</h2>
                    {/* CONTACT NUMBER DISPLAY */}
                    <Alert>
                        <CheckCircle2Icon />
                        <AlertTitle>{contact_number}</AlertTitle>
                        <AlertDescription>
                            Use this number when calling the client. Ensure accuracy before proceeding.
                        </AlertDescription>

                    </Alert>

                    <Label className="mb-3 mt-4">Callback (Optional)</Label>
                    <Input
                        type="datetime-local"
                        value={callback}
                        onChange={(e) => setCallback(e.target.value)}
                    />

                    <FieldGroup className="mt-4">
                        <FieldSet>
                            <FieldLabel>Call Status</FieldLabel>

                            <RadioGroup value={callStatus} onValueChange={setCallStatus} className="space-y-4">
                                {[
                                    {
                                        value: "Successful",
                                        title: "Successful",
                                        desc: "Client was reached and conversation was completed.",
                                    },
                                    {
                                        value: "Unsuccessful",
                                        title: "Unsuccessful",
                                        desc: "Client was not reached or call was not completed.",
                                    },
                                ].map((item) => (
                                    <FieldLabel key={item.value}>
                                        <Field orientation="horizontal" className="w-full items-start">
                                            {/* LEFT */}
                                            <FieldContent className="flex-1">
                                                <FieldTitle>{item.title}</FieldTitle>
                                                <FieldDescription>{item.desc}</FieldDescription>

                                                {/* Buttons lalabas lang sa selected */}
                                                {callStatus === item.value && (
                                                    <div className="mt-4 flex gap-2">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            onClick={handleBack}
                                                        >
                                                            Back
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            onClick={handleNext}
                                                        >
                                                            Next
                                                        </Button>
                                                    </div>
                                                )}
                                            </FieldContent>

                                            {/* RIGHT */}
                                            <RadioGroupItem value={item.value} />
                                        </Field>
                                    </FieldLabel>
                                ))}
                            </RadioGroup>

                        </FieldSet>
                    </FieldGroup>
                </div>
            )}

            {/* STEP 4 */}
            {step === 4 && (
                <div>
                    <h2 className="text-sm font-semibold mb-3">Step 4 — Call Details</h2>
                    <Label className="mb-3 mt-3">Follow Up Date</Label>
                    <Input
                        type="date"
                        value={followUpDate}
                        onChange={(e) => setFollowUpDate(e.target.value)}
                        className="mb-4"
                    />

                    <FieldGroup>
                        <FieldSet>
                            <FieldLabel>Call Type</FieldLabel>
                            <RadioGroup
                                value={callType}
                                onValueChange={setCallType}
                                className="space-y-4"
                            >
                                {(callStatus === "Successful"
                                    ? [
                                        {
                                            value: "No Requirements",
                                            title: "No Requirements",
                                            desc: "Client states no requirements at the moment.",
                                        },
                                        {
                                            value: "Waiting for Future Projects",
                                            title: "Waiting for Future Projects",
                                            desc:
                                                "Client may have upcoming projects but no current requirements.",
                                        },
                                        {
                                            value: "With RFQ",
                                            title: "With RFQ",
                                            desc: "Client has a Request for Quotation.",
                                        },
                                    ]
                                    : callStatus === "Unsuccessful"
                                        ? [
                                            {
                                                value: "Ringing Only",
                                                title: "Ringing Only",
                                                desc: "Phone rang but no one answered the call.",
                                            },
                                            {
                                                value: "Cannot Be Reached",
                                                title: "Cannot Be Reached",
                                                desc: "Client is unreachable or phone is unattended.",
                                            },
                                            {
                                                value: "Not Connected With The Company",
                                                title: "Not Connected With The Company",
                                                desc:
                                                    "Client confirmed they are no longer associated with the company.",
                                            },
                                        ]
                                        : []
                                ).map((item) => (
                                    <FieldLabel key={item.value}>
                                        <Field orientation="horizontal" className="w-full items-start">
                                            {/* LEFT */}
                                            <FieldContent className="flex-1">
                                                <FieldTitle>{item.title}</FieldTitle>
                                                <FieldDescription>{item.desc}</FieldDescription>

                                                {/* Buttons lalabas lang sa selected */}
                                                {callType === item.value && (
                                                    <div className="mt-4 flex gap-2">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            onClick={handleBack}
                                                        >
                                                            Back
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            onClick={handleNext}
                                                        >
                                                            Next
                                                        </Button>
                                                    </div>
                                                )}
                                            </FieldContent>

                                            {/* RIGHT */}
                                            <RadioGroupItem value={item.value} />
                                        </Field>
                                    </FieldLabel>
                                ))}
                            </RadioGroup>
                        </FieldSet>
                    </FieldGroup>
                </div>
            )}

            {/* STEP 5 */}
            {step === 5 && (
                <div>
                    <h2 className="text-sm font-semibold mb-3">Step 5 — Remarks & Status</h2>
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

                            <RadioGroup value={status} onValueChange={setStatus} className="space-y-4">
                                {[
                                    {
                                        value: "Assisted",
                                        title: "Assisted",
                                        desc: "Client was assisted and provided with the needed information or support.",
                                    },
                                    {
                                        value: "Not Assisted",
                                        title: "Not Assisted",
                                        desc: "Unable to assist the client due to incomplete info, missed call, etc.",
                                    },
                                ].map((item) => (
                                    <FieldLabel key={item.value}>
                                        <Field orientation="horizontal" className="w-full items-start">
                                            {/* LEFT */}
                                            <FieldContent className="flex-1">
                                                <FieldTitle>{item.title}</FieldTitle>
                                                <FieldDescription>{item.desc}</FieldDescription>

                                                {/* Buttons only visible if selected */}
                                                {status === item.value && (
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
