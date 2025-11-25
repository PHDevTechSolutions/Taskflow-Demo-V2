"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, } from "@/components/ui/sheet";
import { toast } from "sonner";

import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldSet, FieldTitle, } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle, } from "@/components/ui/empty";

import { Spinner } from "@/components/ui/spinner";
import { CancelDialog } from "./activity-cancel-dialog";
import { OutboundSheet } from "./activity-sheet-outbound";
import { InboundSheet } from "./activity-sheet-inbound";
import { QuotationSheet } from "./activity-sheet-quotation";
import { SOSheet } from "./activity-sheet-so";
import { DRSheet } from "./activity-sheet-dr";

interface Activity {
    id: string;
    type_client: string; // now required
    activity_reference_number: string;
    account_reference_number: string;
    type_activity: string;
    status: string;
    date_created: string;
    date_updated: string;

    target_quota?: string;
    referenceid: string;
    tsm: string;
    manager: string;

    // optional outbound fields
    source: string;
    callback?: string; // only callback remains optional
    call_status: string;
    call_type: string;

    // quotation fields
    product_category?: string;
    project_type?: string;
    project_name?: string;
    quotation_number?: string;
    quotation_amount?: string;

    // sales order fields
    so_number?: string;
    so_amount?: string;

    actual_sales?: string;
    dr_number?: string;
    payment_terms?: string;
    delivery_date?: string;

    date_followup?: string;
    remarks: string;

    start_date?: string;
    end_date?: string;
}

interface CreateActivityDialogProps {
    onCreated: (newActivity: Activity) => void;
    referenceid: string;
    tsm: string;
    manager: string;
    target_quota?: string;
    type_client: string;
    contact_number: string;
    activityReferenceNumber?: string;
    accountReferenceNumber?: string;
}

function SpinnerEmpty({ onCancel }: { onCancel?: () => void }) {
    return (
        <Empty className="w-full">
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <Spinner />
                </EmptyMedia>
                <EmptyTitle>Processing your request</EmptyTitle>
                <EmptyDescription>
                    Please wait while we process your request. Do not refresh the page.
                </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
                <Button variant="outline" size="sm" onClick={onCancel}>
                    Cancel
                </Button>
            </EmptyContent>
        </Empty>
    );
}

export function CreateActivityDialog({
    onCreated,
    referenceid,
    target_quota,
    tsm,
    manager,
    type_client,
    contact_number,
    activityReferenceNumber,
    accountReferenceNumber,
}: CreateActivityDialogProps) {
    const [sheetOpen, setSheetOpen] = useState(false);
    // Confirmation dialog state
    const [showConfirmCancel, setShowConfirmCancel] = useState(false);

    // STEPPER
    const [step, setStep] = useState(1);

    // FORM STATES (all required except callback)
    const [activityRef, setActivityRef] = useState(activityReferenceNumber || "");
    const [accountRef, setAccountRef] = useState(accountReferenceNumber || "");
    const [typeActivity, setTypeActivity] = useState("");
    const [source, setSource] = useState("");
    const [callback, setCallback] = useState(""); // optional
    const [callStatus, setCallStatus] = useState("");
    const [callType, setCallType] = useState("");

    const [productCat, setProductCat] = useState("");
    const [projectType, setProjectType] = useState("");
    const [projectName, setProjectName] = useState("");
    const [quotationNumber, setQuotationNumber] = useState("");
    const [quotationAmount, setQuotationAmount] = useState("");

    const [soNumber, setSoNumber] = useState("");
    const [soAmount, setSoAmount] = useState("");

    const [drNumber, setDrNumber] = useState("");
    const [siAmount, setSiAmount] = useState("");
    const [paymentTerms, setPaymentTerms] = useState("");
    const [deliveryDate, setDeliveryDate] = useState("");

    const [followUpDate, setFollowUpDate] = useState("");
    const [status, setStatus] = useState("");
    const [remarks, setRemarks] = useState("");
    const [startDate, setStartDate] = useState("");
    const [dateCreated, setDateCreated] = useState("");

    const [loading, setLoading] = useState(false);
    const [elapsedTime, setElapsedTime] = useState("");

    // AUTO SET DATE CREATED
    useEffect(() => {
        setDateCreated(new Date().toISOString());
    }, []);

    const initialState = {
        activityRef: activityReferenceNumber || "",
        accountRef: accountReferenceNumber || "",
        source: "",
        callback: "",
        callStatus: "",
        callType: "",
        productCat: "",
        projectType: "",
        projectName: "",
        quotationNumber: "",
        quotationAmount: "",
        soNumber: "",
        soAmount: "",
        followUpDate: "",
        status: "",
        remarks: "",
        startDate: "",
        dateCreated: new Date().toISOString(),
    };

    function resetForm() {
        setActivityRef(initialState.activityRef);
        setAccountRef(initialState.accountRef);
        setSource(initialState.source);
        setCallback(initialState.callback);
        setCallStatus(initialState.callStatus);
        setCallType(initialState.callType);
        setProductCat(initialState.productCat);
        setProjectType(initialState.projectType);
        setProjectName(initialState.projectName);
        setQuotationNumber(initialState.quotationNumber);
        setQuotationAmount(initialState.quotationAmount);
        setSoNumber(initialState.soNumber);
        setSoAmount(initialState.soAmount);
        setFollowUpDate(initialState.followUpDate);
        setStatus(initialState.status);
        setRemarks(initialState.remarks);
        setStartDate(initialState.startDate);
        setDateCreated(initialState.dateCreated);
    }

    useEffect(() => {
        // Set initial created date on open
        if (sheetOpen) {
            setDateCreated(new Date().toISOString());
        }
    }, [sheetOpen]);

    function timeAgo(dateString: string) {
        const now = new Date();
        const past = new Date(dateString);
        const diff = Math.floor((now.getTime() - past.getTime()) / 1000); // seconds

        if (diff < 60) return `${diff} second${diff !== 1 ? 's' : ''} ago`;
        if (diff < 3600) return `${Math.floor(diff / 60)} minute${Math.floor(diff / 60) !== 1 ? 's' : ''} ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)} hour${Math.floor(diff / 3600) !== 1 ? 's' : ''} ago`;
        return `${Math.floor(diff / 86400)} day${Math.floor(diff / 86400) !== 1 ? 's' : ''} ago`;
    }

    useEffect(() => {
        if (!startDate) {
            setElapsedTime("");
            return;
        }

        // update elapsed time every second
        const interval = setInterval(() => {
            setElapsedTime(timeAgo(startDate));
        }, 1000);

        // update immediately on mount
        setElapsedTime(timeAgo(startDate));

        return () => clearInterval(interval);
    }, [startDate]);

    const validateStep = (currentStep: number) => {
        switch (currentStep) {
            case 1:
                if (!typeActivity.trim()) {
                    toast.error("Please select Activity Type.");
                    return false;
                }
                return true;

            case 2:
                // Source required if Outbound Calls (quotation also requires source)
                if (typeActivity === "Outbound Calls" && !source.trim()) {
                    toast.error("Please select Source.");
                    return false;
                }
                return true;

            case 3:
                // Call Status required if Outbound Calls
                if (typeActivity === "Outbound Calls" && !callStatus.trim()) {
                    toast.error("Please select Call Status.");
                    return false;
                }
                return true;

            case 4:
                if (typeActivity === "Outbound Calls" && !followUpDate.trim()) {
                    toast.error("Please select Follow Up Date.");
                    return false;
                }
                return true;

            case 5:
                // Remarks optional, status required
                if (!status.trim()) {
                    toast.error("Please select Status.");
                    return false;
                }
                return true;

            default:
                return true;
        }
    };

    const handleBack = () => setStep((prev) => (prev > 1 ? prev - 1 : prev));

    const handleNext = () => {
        if (validateStep(step)) {
            setStep((prev) => prev + 1);
        }
    };

    const handleSave = async () => {
        setLoading(true);

        const newActivity: Activity = {
            id: activityRef,
            activity_reference_number: activityRef,
            account_reference_number: accountRef,
            type_client,
            date_created: dateCreated,
            date_updated: new Date().toISOString(),
            status,
            type_activity: typeActivity,
            target_quota,
            referenceid,
            tsm,
            manager,

            source,
            callback: callback || undefined,
            call_status: callStatus,
            call_type: callType,

            product_category: productCat || undefined,
            project_type: projectType || undefined,
            project_name: projectName || undefined,
            quotation_number: quotationNumber || undefined,
            quotation_amount: quotationAmount || undefined,

            so_number: soNumber || undefined,
            so_amount: soAmount || undefined,

            dr_number: drNumber || undefined,
            actual_sales: siAmount || undefined,
            payment_terms: paymentTerms || undefined,
            delivery_date: deliveryDate || undefined,

            date_followup: followUpDate || undefined,
            remarks,

            start_date: startDate,
            end_date: new Date().toISOString(),
        };

        try {
            const res = await fetch("/api/act-save-activity", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newActivity),
            });

            const result = await res.json();

            if (!res.ok) {
                toast.error(result.error || "Failed to save activity.");
                return;
            }

            const statusRes = await fetch("/api/act-edit-status-activity", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    activity_reference_number: activityRef,
                    status,
                }),
            });

            const statusResult = await statusRes.json();

            if (!statusRes.ok) {
                toast.error(statusResult.error || "Failed to update activity status.");
                return;
            }

            toast.success("Activity created and status updated successfully!");

            resetForm();
            setStep(1);
            setSheetOpen(false);
            onCreated(newActivity);

        } catch (error) {
            toast.error("Server error. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // Intercept sheet close request:
    const onSheetOpenChange = (open: boolean) => {
        if (!open) {
            // User trying to close the sheet (click outside or close button)
            // Show confirmation dialog instead of closing immediately
            setShowConfirmCancel(true);
        } else {
            setSheetOpen(true);
        }
    };

    // Handle user confirmed cancel
    const confirmCancel = () => {
        resetForm();
        setShowConfirmCancel(false);
        setSheetOpen(false);
    };

    // Handle user canceled cancel (keep sheet open)
    const cancelCancel = () => {
        setShowConfirmCancel(false);
        setSheetOpen(true);
    };

    return (
        <>
            <Sheet open={sheetOpen} onOpenChange={onSheetOpenChange}>
                <SheetTrigger asChild>
                    <Button
                        variant="outline"
                        onClick={() => {
                            setActivityRef(activityReferenceNumber || "");
                            setAccountRef(accountReferenceNumber || "");
                            setSheetOpen(true);
                        }}
                    >
                        Create
                    </Button>
                </SheetTrigger>

                <SheetContent side="right" className="w-full sm:w-[600px] overflow-auto custom-scrollbar">
                    <SheetHeader>
                        <SheetTitle>Create New Activity</SheetTitle>
                        <SheetDescription>
                            Fill out the steps to create a new activity.
                        </SheetDescription>
                        {/* Show floating elapsed time */}
                        {startDate && (
                            <p className="text-sm text-muted-foreground mt-1">
                                Started: <span className="font-medium">{elapsedTime}</span>
                            </p>
                        )}
                    </SheetHeader>

                    {loading ? (
                        <SpinnerEmpty
                            onCancel={() => {
                                setLoading(false);
                                setSheetOpen(false);
                            }}
                        />
                    ) : (
                        <div className="p-4 grid gap-6">
                            {/* STEP 1 */}
                            {step === 1 && (
                                <div>
                                    <FieldGroup>
                                        <FieldSet>
                                            <FieldLabel>Select Activity Type</FieldLabel>
                                            <RadioGroup
                                                defaultValue={typeActivity}
                                                onValueChange={(value) => {
                                                    setTypeActivity(value);
                                                    setStartDate(new Date().toISOString());  // <-- set startDate here
                                                }}
                                            >

                                                <FieldLabel>
                                                    <Field orientation="horizontal">
                                                        <FieldContent>
                                                            <FieldTitle>Outbound Calls</FieldTitle>
                                                            <FieldDescription>
                                                                Make outgoing calls to clients for updates,
                                                                touchbase, or follow-ups.
                                                            </FieldDescription>
                                                        </FieldContent>
                                                        <RadioGroupItem value="Outbound Calls" />
                                                    </Field>
                                                </FieldLabel>

                                                <FieldLabel>
                                                    <Field orientation="horizontal">
                                                        <FieldContent>
                                                            <FieldTitle>Inbound Calls</FieldTitle>
                                                            <FieldDescription>
                                                                Handle incoming calls from clients requesting
                                                                assistance or information.
                                                            </FieldDescription>
                                                        </FieldContent>
                                                        <RadioGroupItem value="Inbound Calls" />
                                                    </Field>
                                                </FieldLabel>

                                                <FieldLabel>
                                                    <Field orientation="horizontal">
                                                        <FieldContent>
                                                            <FieldTitle>Quotation Preparation</FieldTitle>
                                                            <FieldDescription>
                                                                Prepare and submit quotations for clients including pricing and project details.
                                                            </FieldDescription>
                                                        </FieldContent>
                                                        <RadioGroupItem value="Quotation Preparation" />
                                                    </Field>
                                                </FieldLabel>

                                                <FieldLabel>
                                                    <Field orientation="horizontal">
                                                        <FieldContent>
                                                            <FieldTitle>Sales Order Preparation</FieldTitle>
                                                            <FieldDescription>
                                                                Prepare and submit sales orders for clients including pricing and project details.
                                                            </FieldDescription>
                                                        </FieldContent>
                                                        <RadioGroupItem value="Sales Order Preparation" />
                                                    </Field>
                                                </FieldLabel>

                                                <FieldLabel>
                                                    <Field orientation="horizontal">
                                                        <FieldContent>
                                                            <FieldTitle>Delivered / Closed Transaction</FieldTitle>
                                                            <FieldDescription>
                                                                Handle completed transactions including delivery confirmation, closing documentation, and final client coordination.
                                                            </FieldDescription>
                                                        </FieldContent>
                                                        <RadioGroupItem value="Delivered / Closed Transaction" />
                                                    </Field>
                                                </FieldLabel>
                                            </RadioGroup>
                                        </FieldSet>
                                    </FieldGroup>

                                    <h2 className="text-sm font-semibold mt-3">
                                        Step 1 — Type of Activity
                                    </h2>
                                    <Button className="mt-4 w-full" onClick={handleNext}>
                                        Next
                                    </Button>
                                </div>
                            )}

                            {typeActivity === "Outbound Calls" && (
                                <OutboundSheet
                                    step={step}
                                    setStep={setStep}
                                    source={source}
                                    setSource={setSource}
                                    callback={callback}
                                    contact_number={contact_number}
                                    setCallback={setCallback}
                                    callStatus={callStatus}
                                    setCallStatus={setCallStatus}
                                    callType={callType}
                                    setCallType={setCallType}
                                    followUpDate={followUpDate}
                                    setFollowUpDate={setFollowUpDate}
                                    status={status}
                                    setStatus={setStatus}
                                    remarks={remarks}
                                    setRemarks={setRemarks}
                                    loading={loading}
                                    handleBack={handleBack}
                                    handleNext={handleNext}
                                    handleSave={handleSave}
                                />
                            )}

                            {typeActivity === "Inbound Calls" && (
                                <InboundSheet
                                    step={step}
                                    setStep={setStep}
                                    source={source}
                                    setSource={setSource}
                                    callType={callType}
                                    setCallType={setCallType}
                                    remarks={remarks}
                                    setRemarks={setRemarks}
                                    status={status}
                                    setStatus={setStatus}
                                    handleBack={handleBack}
                                    handleNext={handleNext}
                                    handleSave={handleSave}
                                />
                            )}

                            {typeActivity === "Quotation Preparation" && (
                                <QuotationSheet
                                    step={step}
                                    setStep={setStep}
                                    source={source}
                                    setSource={setSource}
                                    productCat={productCat}
                                    setProductCat={setProductCat}
                                    projectType={projectType}
                                    setProjectType={setProjectType}
                                    projectName={projectName}
                                    setProjectName={setProjectName}
                                    quotationNumber={quotationNumber}
                                    setQuotationNumber={setQuotationNumber}
                                    quotationAmount={quotationAmount}
                                    setQuotationAmount={setQuotationAmount}
                                    callType={callType}
                                    setCallType={setCallType}
                                    followUpDate={followUpDate}
                                    setFollowUpDate={setFollowUpDate}
                                    remarks={remarks}
                                    setRemarks={setRemarks}
                                    status={status}
                                    setStatus={setStatus}
                                    handleBack={handleBack}
                                    handleNext={handleNext}
                                    handleSave={handleSave}
                                />
                            )}

                            {typeActivity === "Sales Order Preparation" && (
                                <SOSheet
                                    step={step}
                                    setStep={setStep}
                                    source={source}
                                    setSource={setSource}
                                    soNumber={soNumber}
                                    setSoNumber={setSoNumber}
                                    soAmount={soAmount}
                                    setSoAmount={setSoAmount}
                                    callType={callType}
                                    setCallType={setCallType}
                                    remarks={remarks}
                                    setRemarks={setRemarks}
                                    status={status}
                                    setStatus={setStatus}
                                    handleBack={handleBack}
                                    handleNext={handleNext}
                                    handleSave={handleSave}
                                />
                            )}

                            {typeActivity === "Delivered / Closed Transaction" && (
                                <DRSheet
                                    step={step}
                                    setStep={setStep}
                                    source={source}
                                    setSource={setSource}
                                    drNumber={drNumber}
                                    setDrNumber={setDrNumber}
                                    siAmount={siAmount}
                                    setSiAmount={setSiAmount}
                                    paymentTerms={paymentTerms}
                                    setPaymentTerms={setPaymentTerms}
                                    deliveryDate={deliveryDate}
                                    setDeliveryDate={setDeliveryDate}
                                    remarks={remarks}
                                    setRemarks={setRemarks}
                                    status={status}
                                    setStatus={setStatus}
                                    handleBack={handleBack}
                                    handleNext={handleNext}
                                    handleSave={handleSave}
                                />
                            )}

                        </div>
                    )}

                    {showConfirmCancel && (
                        <CancelDialog
                            onCancel={cancelCancel}
                            onConfirm={confirmCancel}
                        />
                    )}

                </SheetContent>
            </Sheet>
        </>
    );
}
