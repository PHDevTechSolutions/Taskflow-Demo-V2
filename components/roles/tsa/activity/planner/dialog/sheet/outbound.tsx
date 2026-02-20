"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2Icon, ArrowLeft, ArrowRight, PhoneIncoming, Pen } from "lucide-react";

import { FieldGroup, FieldSet, FieldLabel, Field, FieldContent, FieldDescription, FieldTitle, } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

interface OutboundSheetProps {
    step: number;
    setStep: React.Dispatch<React.SetStateAction<number>>;
    source: string;
    setSource: React.Dispatch<React.SetStateAction<string>>;
    callStatus: string;
    setCallStatus: React.Dispatch<React.SetStateAction<string>>;
    callType: string;
    setCallType: React.Dispatch<React.SetStateAction<string>>;
    followUpDate: string;
    setFollowUpDate: React.Dispatch<React.SetStateAction<string>>;
    status: string;
    setStatus: React.Dispatch<React.SetStateAction<string>>;
    remarks: string;
    setRemarks: React.Dispatch<React.SetStateAction<string>>;
    loading: boolean;

    contact_number: string;
    setContactNumber: React.Dispatch<React.SetStateAction<string>>;
    handleBack: () => void;
    handleNext: () => void;
    handleSave: () => void;
}

export function OutboundSheet(props: OutboundSheetProps) {
    const {
        step,
        source,
        callStatus,
        callType,
        followUpDate,
        status,
        remarks,
        // handlers
        handleNext,
    } = props;

    // Removed useEffect that depended on callback

    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogMessage, setDialogMessage] = useState("");
    const [useToday, setUseToday] = useState(false);
    const [editNumber, setEditNumber] = useState(false);
    const [editedNumber, setEditedNumber] = useState(props.contact_number);

    useEffect(() => {
        if (!callType) {
            props.setFollowUpDate("");
            setUseToday(false);
            return;
        }

        // ✅ if checkbox "Today" is checked, FORCE today
        if (useToday) {
            const today = new Date().toISOString().split("T")[0];
            if (followUpDate !== today) {
                props.setFollowUpDate(today);
            }
            return;
        }

        const today = new Date();
        let newDate: Date;

        switch (callType) {
            case "Ringing Only":
                newDate = new Date(today);
                newDate.setDate(today.getDate() + 10);
                break;

            case "No Requirements":
                newDate = new Date(today);
                newDate.setDate(today.getDate() + 15);
                break;

            case "Cannot Be Reached":
            case "Not Connected With The Company":
                newDate = new Date(today);
                break;

            case "Waiting for Future Projects":
                newDate = new Date(today);
                newDate.setDate(today.getDate() + 30);
                break;

            case "With RFQ": // ✅ ADD THIS
                newDate = new Date(today);
                break;

            default:
                return;
        }


        const formattedDate = newDate.toISOString().split("T")[0];
        if (formattedDate !== followUpDate) {
            props.setFollowUpDate(formattedDate);
        }
    }, [callType, useToday, followUpDate]);

    useEffect(() => {
        setUseToday(false);
    }, [callType]);

    // Validation function to check if current step inputs are filled
    function validateStep() {
        switch (step) {
            case 2:
                if (!source) {
                    setDialogMessage("Please select a Source.");
                    setDialogOpen(true);
                    return false;
                }
                return true;
            case 3:
                if (!callStatus) {
                    setDialogMessage("Please select Call Status.");
                    setDialogOpen(true);
                    return false;
                }
                return true;
            case 4:
                if (!callType) {
                    setDialogMessage("Please select Call Type.");
                    setDialogOpen(true);
                    return false;
                }
                if (!followUpDate) {
                    setDialogMessage("Please enter Follow Up Date.");
                    setDialogOpen(true);
                    return false;
                }
                return true;
            case 5:
                if (!remarks.trim()) {
                    setDialogMessage("Please enter Remarks.");
                    setDialogOpen(true);
                    return false;
                }
                if (!status) {
                    setDialogMessage("Please select Status.");
                    setDialogOpen(true);
                    return false;
                }
                return true;
            default:
                return true;
        }
    }

    function onSaveClick() {
        if (validateStep()) {
            props.handleSave();
        }
    }

    function onNextClick() {
        if (validateStep()) {
            handleNext();
        }
    }

    return (
        <>
            {/* STEP 2 */}
            {step === 2 && (
                <div>
                    <h2 className="text-sm font-semibold mb-3">Step 2 — Source</h2>
                    <FieldGroup>
                        <FieldSet>
                            <FieldLabel className="font-bold">Source</FieldLabel>
                            <FieldDescription>
                                Select the source of the outbound call. This helps categorize the call type for reporting and analytics.
                            </FieldDescription>
                            <RadioGroup
                                value={source}
                                onValueChange={props.setSource}
                                className="space-y-4"
                            >
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
                                            <FieldContent className="flex-1">
                                                <FieldTitle>{item.title}</FieldTitle>
                                                <FieldDescription>{item.desc}</FieldDescription>

                                                {source === item.value && (
                                                    <div className="mt-4 flex gap-2 flex">
                                                        <Button variant="outline" className="rounded-none" onClick={props.handleBack}>
                                                            <ArrowLeft /> Back
                                                        </Button>
                                                        <Button className="rounded-none" onClick={onNextClick}>
                                                            Next <ArrowRight />
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

            {/* STEP 3 */}
            {step === 3 && (
                <div>
                    <h2 className="text-sm font-semibold mb-3">Step 3 — Call Details</h2>
                    {/* STEP 3 — Call Details */}
                    {/* Contact Number Alert */}
                    <Alert
                        variant="default"
                        className="mb-4 flex flex-col gap-4 border-cyan-300 border-2 bg-cyan-50 rounded-lg p-4 shadow-sm"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 mr-6">
                                <span className="inline-flex items-center justify-center w-10 h-10 rounded-full text-lg">
                                    <Button
                                        variant="outline"
                                        className="rounded-sm px-2 py-0.5 text-xs border-none"
                                        onClick={() => setEditNumber(true)}
                                    >
                                        <Pen />
                                    </Button>
                                </span>

                                <div className="flex flex-col">
                                    <AlertTitle className="font-semibold text-gray-800 flex items-center gap-2">
                                        Contact #
                                    </AlertTitle>
                                    <AlertDescription className="text-gray-600">{props.contact_number}</AlertDescription>
                                </div>
                            </div>

                            {/* Viber Call Button */}
                            <Button
                                className="rounded-sm p-2 flex items-center gap-1"
                                onClick={() => {
                                    const phoneNumber = props.contact_number.replace(/\D/g, "");
                                    window.open(`viber://chat?number=${phoneNumber}`, "_blank");
                                }}
                            >
                                <PhoneIncoming /> Viber Tap
                            </Button>
                        </div>
                        <p className="text-sm text-gray-700 mt-2">
                            Tap the button to open Viber and start a chat or call with the client directly. Multiple Number Not Allowed in One Click,
                            <span className="font-bold text-red-500"> Make sure the contact number is in Viber format, starting with +63</span>.
                        </p>
                    </Alert>

                    {/* Edit Number Dialog */}
                    <Dialog open={editNumber} onOpenChange={setEditNumber}>
                        <DialogContent style={{ width: "400px", maxWidth: "90%" }} className="rounded-none">
                            <DialogHeader>
                                <DialogTitle>Edit Contact Number</DialogTitle>
                                <DialogDescription>Update the contact number for this client.</DialogDescription>
                            </DialogHeader>
                            <div className="p-4">
                                <Input
                                    value={editedNumber}
                                    onChange={(e) => setEditedNumber(e.target.value)}
                                    placeholder="Enter contact number"
                                />
                            </div>
                            <DialogFooter className="flex justify-end gap-2">
                                <Button
                                    variant="ghost"
                                    className="rounded-none"
                                    onClick={() => {
                                        setEditedNumber(props.contact_number); // reset
                                        setEditNumber(false);
                                    }}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    className="rounded-none"
                                    onClick={() => {
                                        props.setContactNumber(editedNumber); // update parent state
                                        setEditNumber(false);
                                    }}
                                >
                                    Save
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    <FieldGroup className="mt-4">
                        <FieldSet>
                            <FieldLabel className="font-bold">Call Status</FieldLabel>
                            <FieldDescription>
                                Select the status of the call to indicate if the client was reached or not.
                            </FieldDescription>
                            <RadioGroup
                                value={callStatus}
                                onValueChange={props.setCallStatus}
                            >
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
                                            <FieldContent className="flex-1">
                                                <FieldTitle>{item.title}</FieldTitle>
                                                <FieldDescription>{item.desc}</FieldDescription>

                                                {callStatus === item.value && (
                                                    <div className="mt-4 flex gap-2">
                                                        <Button variant="outline" className="rounded-none" onClick={props.handleBack}>
                                                            <ArrowLeft /> Back
                                                        </Button>
                                                        <Button className="rounded-none" onClick={onNextClick}>
                                                            Next <ArrowRight />
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

            {/* STEP 4 */}
            {step === 4 && (
                <div>
                    <h2 className="text-sm font-semibold mb-3">Step 4 — Call Details</h2>
                    <FieldGroup>
                        <FieldSet>
                            <FieldLabel className="font-bold">Call Type</FieldLabel>
                            <FieldDescription>
                                Choose the type of call outcome based on the client's response and situation.
                            </FieldDescription>
                            <RadioGroup
                                value={callType}
                                onValueChange={props.setCallType}
                            >
                                {(
                                    callStatus === "Successful"
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
                                            // ✅ ADD HERE
                                            {
                                                value: "Not Connected With The Company",
                                                title: "Not Connected With The Company",
                                                desc:
                                                    "Client confirmed they are no longer associated with the company.",
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
                                            <FieldContent className="flex-1">
                                                <FieldTitle>{item.title}</FieldTitle>
                                                <FieldDescription>{item.desc}</FieldDescription>

                                                {callType === item.value && (
                                                    <div className="mt-4 flex gap-2">
                                                        <Button variant="outline" className="rounded-none" onClick={props.handleBack}>
                                                            <ArrowLeft /> Back
                                                        </Button>
                                                        <Button className="rounded-none" onClick={onNextClick}>
                                                            Next <ArrowRight />
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

            {/* STEP 5 */}
            {step === 5 && (
                <div>
                    <h2 className="text-sm font-semibold mb-3">Step 5 — Remarks & Status</h2>
                    {followUpDate ? (
                        <Alert variant="default" className="mb-4 flex flex-col gap-3 border-cyan-300 border-3 bg-cyan-100">
                            <div>
                                <AlertTitle className="font-bold">Follow Up Date:</AlertTitle>
                                <AlertDescription>
                                    {followUpDate} — This is the scheduled date to reconnect with the client.
                                </AlertDescription>
                            </div>

                            <label className="flex items-center gap-2 text-sm font-medium">
                                <Input
                                    type="checkbox"
                                    checked={useToday}
                                    onChange={(e) => setUseToday(e.target.checked)}
                                    className="h-4 w-4"
                                />
                                <span className="font-semibold">Today <span className="text-red-500 italic text-[10px]">(check if today)</span></span>
                            </label>
                        </Alert>
                    ) : (
                        <></>
                    )}
                    <FieldGroup>
                        <FieldSet>
                            <FieldLabel className="font-bold">Remarks</FieldLabel>
                            <FieldDescription>
                                Add any additional notes or important details about the call or client interaction.
                            </FieldDescription>
                            <Textarea
                                value={remarks}
                                onChange={(e) => props.setRemarks(e.target.value)}
                                placeholder="Enter remarks"
                                required
                                className="capitalize rounded-none"
                            />
                        </FieldSet>
                    </FieldGroup>

                    <FieldGroup className="mt-4">
                        <FieldSet>
                            <FieldLabel>Status</FieldLabel>
                            <FieldDescription>
                                Select the final status to indicate if the client was assisted or not assisted during this call.
                            </FieldDescription>
                            <RadioGroup value={status} onValueChange={props.setStatus} className="space-y-4">
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
                                            <FieldContent className="flex-1">
                                                <FieldTitle>{item.title}</FieldTitle>
                                                <FieldDescription>{item.desc}</FieldDescription>

                                                {status === item.value && (
                                                    <div className="mt-4 flex gap-2">
                                                        <Button type="button" variant="outline" className="rounded-none" onClick={props.handleBack}>
                                                            <ArrowLeft /> Back
                                                        </Button>
                                                        <Button type="button" className="rounded-none" onClick={onSaveClick}>
                                                            <CheckCircle2Icon /> Save
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

                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogContent className="rounded-none">
                            <DialogHeader>
                                <DialogTitle className="text-red-600">Validation Error</DialogTitle>
                                <DialogDescription>{dialogMessage}</DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <Button className="rounded-none" onClick={() => setDialogOpen(false)}>OK</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            )}
        </>
    );
}
