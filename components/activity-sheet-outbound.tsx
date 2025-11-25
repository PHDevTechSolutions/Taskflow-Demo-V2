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
                    <FieldGroup>
                        <FieldSet>
                            <FieldLabel>Source</FieldLabel>

                            <RadioGroup value={source} onValueChange={setSource}>
                                <FieldLabel>
                                    <Field orientation="horizontal">
                                        <FieldContent>
                                            <FieldTitle>Outbound - Touchbase</FieldTitle>
                                            <FieldDescription>
                                                Initial call to reconnect or update the client about ongoing
                                                concerns.
                                            </FieldDescription>
                                        </FieldContent>
                                        <RadioGroupItem value="Outbound - Touchbase" />
                                    </Field>
                                </FieldLabel>

                                <FieldLabel>
                                    <Field orientation="horizontal">
                                        <FieldContent>
                                            <FieldTitle>Outbound - Follow-up</FieldTitle>
                                            <FieldDescription>
                                                Follow-up call to check progress or request additional
                                                requirements.
                                            </FieldDescription>
                                        </FieldContent>
                                        <RadioGroupItem value="Outbound - Follow-up" />
                                    </Field>
                                </FieldLabel>
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

                    <h2 className="text-sm font-semibold mt-3">Step 2 — Source</h2>
                    <div className="flex justify-between mt-4">
                        <Button variant="outline" onClick={handleBack}>Back</Button>
                        <Button onClick={handleNext} disabled={!source}>
                            Next
                        </Button>
                    </div>
                </div>
            )}

            {/* STEP 3 */}
            {step === 3 && (
                <div>
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

                            <RadioGroup value={callStatus} onValueChange={setCallStatus}>
                                <FieldLabel>
                                    <Field orientation="horizontal">
                                        <FieldContent>
                                            <FieldTitle>Successful</FieldTitle>
                                            <FieldDescription>
                                                Client was reached and conversation was completed.
                                            </FieldDescription>
                                        </FieldContent>
                                        <RadioGroupItem value="Successful" />
                                    </Field>
                                </FieldLabel>

                                <FieldLabel>
                                    <Field orientation="horizontal">
                                        <FieldContent>
                                            <FieldTitle>Unsuccessful</FieldTitle>
                                            <FieldDescription>
                                                Client was not reached or call was not completed.
                                            </FieldDescription>
                                        </FieldContent>
                                        <RadioGroupItem value="Unsuccessful" />
                                    </Field>
                                </FieldLabel>
                            </RadioGroup>
                        </FieldSet>
                    </FieldGroup>

                    <h2 className="text-sm font-semibold mt-3">Step 3 — Call Details</h2>

                    <div className="flex justify-between mt-4">
                        <Button variant="outline" onClick={handleBack}>Back</Button>
                        <Button onClick={handleNext}>Next</Button>
                    </div>
                </div>
            )}

            {/* STEP 4 */}
            {step === 4 && (
                <div>
                    <FieldGroup>
                        <FieldSet>
                            <FieldLabel>Call Type</FieldLabel>

                            <RadioGroup value={callType} onValueChange={setCallType}>
                                {callStatus === "Successful" ? (
                                    <>
                                        <FieldLabel>
                                            <Field orientation="horizontal">
                                                <FieldContent>
                                                    <FieldTitle>No Requirements</FieldTitle>
                                                    <FieldDescription>
                                                        Client states no requirements at the moment.
                                                    </FieldDescription>
                                                </FieldContent>
                                                <RadioGroupItem value="No Requirements" />
                                            </Field>
                                        </FieldLabel>

                                        <FieldLabel>
                                            <Field orientation="horizontal">
                                                <FieldContent>
                                                    <FieldTitle>Waiting for Future Projects</FieldTitle>
                                                    <FieldDescription>
                                                        Client may have upcoming projects but no current
                                                        requirements.
                                                    </FieldDescription>
                                                </FieldContent>
                                                <RadioGroupItem value="Waiting for Future Projects" />
                                            </Field>
                                        </FieldLabel>

                                        <FieldLabel>
                                            <Field orientation="horizontal">
                                                <FieldContent>
                                                    <FieldTitle>With RFQ</FieldTitle>
                                                    <FieldDescription>
                                                        Client has a Request for Quotation.
                                                    </FieldDescription>
                                                </FieldContent>
                                                <RadioGroupItem value="With RFQ" />
                                            </Field>
                                        </FieldLabel>
                                    </>
                                ) : callStatus === "Unsuccessful" ? (
                                    <>
                                        <FieldLabel>
                                            <Field orientation="horizontal">
                                                <FieldContent>
                                                    <FieldTitle>Ringing Only</FieldTitle>
                                                    <FieldDescription>
                                                        Phone rang but no one answered the call.
                                                    </FieldDescription>
                                                </FieldContent>
                                                <RadioGroupItem value="Ringing Only" />
                                            </Field>
                                        </FieldLabel>

                                        <FieldLabel>
                                            <Field orientation="horizontal">
                                                <FieldContent>
                                                    <FieldTitle>Cannot Be Reached</FieldTitle>
                                                    <FieldDescription>
                                                        Client is unreachable or phone is unattended.
                                                    </FieldDescription>
                                                </FieldContent>
                                                <RadioGroupItem value="Cannot Be Reached" />
                                            </Field>
                                        </FieldLabel>

                                        <FieldLabel>
                                            <Field orientation="horizontal">
                                                <FieldContent>
                                                    <FieldTitle>Not Connected With The Company</FieldTitle>
                                                    <FieldDescription>
                                                        Client confirmed they are no longer associated with the
                                                        company.
                                                    </FieldDescription>
                                                </FieldContent>
                                                <RadioGroupItem value="Not Connected With The Company" />
                                            </Field>
                                        </FieldLabel>
                                    </>
                                ) : null}
                            </RadioGroup>
                        </FieldSet>
                    </FieldGroup>

                    <Label className="mb-3 mt-3">Follow Up Date</Label>
                    <Input
                        type="date"
                        value={followUpDate}
                        onChange={(e) => setFollowUpDate(e.target.value)}
                    />

                    <h2 className="text-sm font-semibold mt-3">Step 4 — Call Details</h2>
                    <div className="flex justify-between mt-4">
                        <Button variant="outline" onClick={handleBack}>Back</Button>
                        <Button onClick={handleNext}>Next</Button>
                    </div>
                </div>
            )}

            {/* STEP 5 */}
            {step === 5 && (
                <div>
                    <FieldGroup>
                        <FieldSet>
                            <FieldLabel>Remarks</FieldLabel>
                            <Textarea
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                placeholder="Enter remarks"
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
                                            <FieldTitle>Assisted</FieldTitle>
                                            <FieldDescription>
                                                Client was assisted and provided with the needed
                                                information or support.
                                            </FieldDescription>
                                        </FieldContent>
                                        <RadioGroupItem value="Assisted" />
                                    </Field>
                                </FieldLabel>

                                <FieldLabel>
                                    <Field orientation="horizontal">
                                        <FieldContent>
                                            <FieldTitle>Not Assisted</FieldTitle>
                                            <FieldDescription>
                                                Unable to assist the client due to incomplete info,
                                                missed call, etc.
                                            </FieldDescription>
                                        </FieldContent>
                                        <RadioGroupItem value="Not Assisted" />
                                    </Field>
                                </FieldLabel>
                            </RadioGroup>
                        </FieldSet>
                    </FieldGroup>
                    <h2 className="text-sm font-semibold mb-3 mt-3">Step 5 — Remarks & Status</h2>
                    <div className="flex justify-between mt-4">
                        <Button variant="outline" onClick={handleBack}>Back</Button>
                        <Button onClick={handleSave}>Save</Button>
                    </div>
                </div>
            )}
        </>
    );
}
