"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, } from "@/components/ui/sheet";
import { toast } from "sonner";
import { Plus, ArrowRight } from "lucide-react";

import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldSet, FieldTitle, } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle, } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";

// Dialogs and Sheets
import { CancelDialog } from "./cancel";
import { OutboundSheet } from "./sheet/outbound";
import { InboundSheet } from "./sheet/inbound";
import { ViberRepliesSheet } from "./sheet/viber-replies";
import { FBMarketplaceSheet } from "./sheet/fb-marketplace";
import { QuotationSheet } from "./sheet/quotation";
import { SOSheet } from "./sheet/so";
import { DRSheet } from "./sheet/dr";

interface Activity {
    id: string;
    type_client: string;
    company_name: string;
    contact_person: string;
    contact_number: string;
    email_address: string;
    address: string;
    activity_reference_number: string;
    account_reference_number: string;
    ticket_reference_number: string;
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
    callback?: string;
    call_status: string;
    call_type: string;

    // quotation fields
    product_category?: string;
    product_quantity?: string;
    product_amount?: string;
    product_description?: string;
    product_photo?: string;
    product_sku?: string;
    product_title?: string;

    project_type?: string;
    project_name?: string;
    quotation_number?: string;
    quotation_amount?: string;
    quotation_type?: string;
    quotation_status?: string;

    // sales order fields
    so_number?: string;
    so_amount?: string;
    si_date?: string;

    actual_sales?: string;
    dr_number?: string;
    payment_terms?: string;
    delivery_date?: string;

    date_followup?: string;
    remarks: string;
    // CSR
    agent: string;
    start_date?: string;
    end_date?: string;
}

interface CreateActivityDialogProps {
    onCreated: (newActivity: Activity) => void;
    referenceid: string;
    firstname: string;
    lastname: string;
    email: string;
    contact: string;
    tsm: string;
    manager: string;
    target_quota?: string;
    type_client: string;
    contact_number: string;
    email_address: string;
    contact_person: string;
    address: string;
    company_name: string;
    tsmname: string;
    managername: string;
    ticket_reference_number: string;
    agent: string;
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
    firstname,
    lastname,
    email,
    contact,
    target_quota,
    ticket_reference_number,
    agent,
    tsm,
    manager,
    type_client,
    contact_number,
    company_name,
    contact_person,
    email_address,
    address,
    tsmname,
    managername,
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
    const [typeClient, setTypeClient] = useState(type_client || "");
    const [typeActivity, setTypeActivity] = useState("");
    const [source, setSource] = useState("");
    const [callback, setCallback] = useState(""); // optional
    const [callStatus, setCallStatus] = useState("");
    const [callType, setCallType] = useState("");

    const [productCat, setProductCat] = useState("");
    const [productAmount, setProductAmount] = useState("");
    const [productQuantity, setProductQuantity] = useState("");
    const [productDescription, setProductDescription] = useState("");
    const [productPhoto, setProductPhoto] = useState("");
    const [productSku, setProductSku] = useState("");
    const [productTitle, setProductTitle] = useState("");

    const [projectType, setProjectType] = useState("");
    const [projectName, setProjectName] = useState("");
    const [quotationNumber, setQuotationNumber] = useState("");
    const [quotationAmount, setQuotationAmount] = useState("");
    const [quotationType, setQuotationType] = useState("");
    const [quotationStatus, setQuotationStatus] = useState("");

    const [soNumber, setSoNumber] = useState("");
    const [soAmount, setSoAmount] = useState("");
    const [siDate, setSiDate] = useState("");

    const [drNumber, setDrNumber] = useState("");
    const [siAmount, setSiAmount] = useState("");
    const [paymentTerms, setPaymentTerms] = useState("");
    const [deliveryDate, setDeliveryDate] = useState("");

    const [followUpDate, setFollowUpDate] = useState("");
    const [status, setStatus] = useState("");
    const [remarks, setRemarks] = useState("");
    const [startDate, setStartDate] = useState("");
    const [dateCreated, setDateCreated] = useState("");

    const [tsmState, setTSMState] = useState(tsm || "");

    const [loading, setLoading] = useState(false);
    const [elapsedTime, setElapsedTime] = useState("");
    const [showExportNotification, setShowExportNotification] = React.useState(false);

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
        productQuantity: "",
        productAmount: "",
        productDescription: "",
        productPhoto: "",
        productSku: "",
        productTitle: "",
        projectType: "",
        projectName: "",
        quotationNumber: "",
        quotationAmount: "",
        quotationType: "",
        quotationStatus: "",
        soNumber: "",
        soAmount: "",
        siDate: "",
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
        setProductQuantity(initialState.productQuantity);
        setProductAmount(initialState.productAmount);
        setProductDescription(initialState.productDescription);
        setProductPhoto(initialState.productPhoto);
        setProductSku(initialState.productSku);
        setProductTitle(initialState.productTitle);
        setProjectType(initialState.projectType);
        setProjectName(initialState.projectName);
        setQuotationNumber(initialState.quotationNumber);
        setQuotationAmount(initialState.quotationAmount);
        setQuotationType(initialState.quotationType);
        setQuotationStatus(initialState.quotationStatus);
        setSoNumber(initialState.soNumber);
        setSoAmount(initialState.soAmount);
        setSiDate(initialState.siDate);
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

        if (diff < 60) return `${diff} sec${diff !== 1 ? 's' : ''} ago`;
        if (diff < 3600) return `${Math.floor(diff / 60)} min${Math.floor(diff / 60) !== 1 ? 's' : ''} ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)} hr${Math.floor(diff / 3600) !== 1 ? 's' : ''} ago`;
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

    // Set export in progress
    localStorage.setItem('exportInProgress', 'true');

    // Clear kapag done
    localStorage.removeItem('exportInProgress');

    // Sa component mount (useEffect)
    useEffect(() => {
        const inProgress = localStorage.getItem('exportInProgress');
        if (inProgress === 'true') {
            setShowExportNotification(true);
            // Simulate progress resume or start counting from 0 again
        }
    }, []);

    const handleSave = async () => {
        setLoading(true);

        const newActivity: Activity = {
            id: activityRef,
            activity_reference_number: activityRef,
            account_reference_number: accountRef,
            type_client,
            company_name,
            contact_person,
            contact_number,
            email_address,
            address,
            date_created: dateCreated,
            date_updated: new Date().toISOString(),
            status,
            type_activity: typeActivity,
            target_quota,
            referenceid,
            tsm,
            manager,
            ticket_reference_number,
            agent,
            source,
            call_status: callStatus,
            call_type: callType,

            product_category: productCat || undefined,
            product_quantity: productQuantity || undefined,
            product_amount: productAmount || undefined,
            product_description: productDescription || undefined,
            product_photo: productPhoto || undefined,
            product_sku: productSku || undefined,
            product_title: productTitle || undefined,

            project_type: projectType || undefined,
            project_name: projectName || undefined,
            quotation_number: quotationNumber || undefined,
            quotation_amount: quotationAmount || undefined,
            quotation_type: quotationType || undefined,
            quotation_status: quotationStatus || undefined,

            so_number: soNumber || undefined,
            so_amount: soAmount || undefined,
            si_date: siDate || undefined,

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
            // Save activity
            const res = await fetch("/api/act-save-activity", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newActivity),
            });

            const result = await res.json();

            if (!res.ok) {
                toast.error(result.error || "Failed to save activity.");
                setLoading(false);
                return;
            }

            // Prepare scheduled_date for update status API
            const scheduled_date = followUpDate || null;

            // Update status AND scheduled_date if available
            const statusRes = await fetch("/api/act-edit-status-activity", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    activity_reference_number: activityRef,
                    status,
                    ...(scheduled_date && { scheduled_date }), // only add if scheduled_date is not null
                }),
            });

            const statusResult = await statusRes.json();

            if (!statusRes.ok) {
                toast.error(statusResult.error || "Failed to update activity status.");
                setLoading(false);
                return;
            }

            onCreated(newActivity);

            // Success save + status update toast
            toast.success("Activity created and status updated successfully!");
            resetForm();
            setStep(1);
            setSheetOpen(false);

            window.location.reload();

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
                        className="cursor-pointer rounded-none"
                        onClick={() => {
                            setActivityRef(activityReferenceNumber || "");
                            setAccountRef(accountReferenceNumber || "");
                            setSheetOpen(true);
                        }}
                    >
                        <Plus /> Create
                    </Button>
                </SheetTrigger>

                <SheetContent side="right" className="w-full sm:w-[600px] overflow-auto custom-scrollbar">
                    <SheetHeader>
                        <SheetTitle>Create New Activity for <br />{company_name}</SheetTitle>
                        <SheetDescription>
                            Fill out the steps to create a new activity.
                        </SheetDescription>
                        {startDate && (
                            <div className="fixed bottom-20 right-100 z-50 bg-black/30 text-white rounded-xs px-4 py-4 font-mono font-semibold text-lg select-none flex items-center space-x-2 cursor-default min-w-[120px] justify-center">
                                <span className="tracking-wide">{elapsedTime}</span>
                            </div>
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
                                    <h2 className="text-sm font-semibold mb-3"> Step 1 — Type of Activity</h2>
                                    <FieldGroup>
                                        <FieldSet>
                                            <FieldLabel>Select Activity Type</FieldLabel>
                                            <RadioGroup
                                                value={typeActivity}
                                                onValueChange={(value) => {
                                                    setTypeActivity(value);
                                                    setStartDate(new Date().toISOString());
                                                }}
                                            >
                                                {[
                                                    {
                                                        value: "Outbound Calls",
                                                        title: "Outbound Calls",
                                                        desc:
                                                            "Make outgoing calls to clients for updates, touchbase, or follow-ups.",
                                                    },
                                                    {
                                                        value: "Inbound Calls",
                                                        title: "Inbound Calls",
                                                        desc:
                                                            "Handle incoming calls from clients requesting assistance or information.",
                                                    },
                                                    {
                                                        value: "Quotation Preparation",
                                                        title: "Quotation Preparation",
                                                        desc:
                                                            "Prepare and submit quotations for clients including pricing and project details.",
                                                    },
                                                    {
                                                        value: "Sales Order Preparation",
                                                        title: "Sales Order Preparation",
                                                        desc:
                                                            "Prepare and submit sales orders for clients including pricing and project details.",
                                                    },
                                                    {
                                                        value: "Delivered / Closed Transaction",
                                                        title: "Delivered / Closed Transaction",
                                                        desc:
                                                            "Handle completed transactions including delivery confirmation, closing documentation, and final client coordination.",
                                                    },
                                                    {
                                                        value: "Viber Replies / Messages",
                                                        title: "Viber Replies / Messages",
                                                        desc:
                                                            "Handle Viber replies and messages from clients.",
                                                    },
                                                    {
                                                        value: "Admin - Supplier Accreditation",
                                                        title: "Admin - Supplier Accreditation",
                                                        desc:
                                                            "Handle supplier accreditation tasks.",
                                                    },
                                                    {
                                                        value: "Admin - Credit Terms Application",
                                                        title: "Admin - Credit Terms Application",
                                                        desc:
                                                            "Handle credit terms application tasks.",
                                                    },
                                                    {
                                                        value: "Accounting Concerns",
                                                        title: "Accounting Concerns",
                                                        desc:
                                                            "Handle accounting concerns.",
                                                    },
                                                    {
                                                        value: "After Sales Refunds",
                                                        title: "After Sales Refunds",
                                                        desc:
                                                            "Handle after sales refunds.",
                                                    },
                                                    {
                                                        value: "After Sales Repair / Replacement",
                                                        title: "After Sales Repair / Replacement",
                                                        desc:
                                                            "Handle after sales repair or replacement.",
                                                    },
                                                    {
                                                        value: "Bidding Preparations",
                                                        title: "Bidding Preparations",
                                                        desc:
                                                            "Handle bidding preparations.",
                                                    },
                                                    {
                                                        value: "Customer Orders",
                                                        title: "Customer Orders",
                                                        desc:
                                                            "Handle customer orders.",
                                                    },
                                                    {
                                                        value: "Customer Inquiry Sales",
                                                        title: "Customer Inquiry Sales",
                                                        desc:
                                                            "Handle customer inquiry sales.",
                                                    },
                                                    {
                                                        value: "Delivery Concern",
                                                        title: "Delivery Concern",
                                                        desc:
                                                            "Handle delivery concerns.",
                                                    },
                                                    {
                                                        value: "FB Marketplace Replies / Messages",
                                                        title: "FB Marketplace Replies / Messages",
                                                        desc:
                                                            "Handle FB Marketplace replies and messages from clients.",
                                                    },
                                                    {
                                                        value: "Follow Up",
                                                        title: "Follow Up",
                                                        desc:
                                                            "Handle follow-up activities.",
                                                    },
                                                    {
                                                        value: "Sample Requests",
                                                        title: "Sample Requests",
                                                        desc:
                                                            "Handle sample requests.",
                                                    },
                                                    {
                                                        value: "Site Visits / Demos",
                                                        title: "Site Visits / Demos",
                                                        desc:
                                                            "Handle site visits and demos.",
                                                    },
                                                    {
                                                        value: "Technical Concerns",
                                                        title: "Technical Concerns",
                                                        desc:
                                                            "Handle technical concerns.",
                                                    },
                                                ].map((item) => (
                                                    <FieldLabel key={item.value}>
                                                        <Field orientation="horizontal">
                                                            <FieldContent>
                                                                <FieldTitle>{item.title}</FieldTitle>
                                                                <FieldDescription>{item.desc}</FieldDescription>

                                                                {typeActivity === item.value && (
                                                                    <div className="mt-4 flex">
                                                                        <Button className="rounded-none" onClick={handleNext}>
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

                            {typeActivity === "Outbound Calls" && (
                                <OutboundSheet
                                    step={step}
                                    setStep={setStep}
                                    source={source}
                                    setSource={setSource}
                                    contact_number={contact_number}
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

                                    typeClient={typeClient}
                                    setTypeClient={setTypeClient}
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
                                    productQuantity={productQuantity}
                                    setProductQuantity={setProductQuantity}
                                    productAmount={productAmount}
                                    setProductAmount={setProductAmount}
                                    productDescription={productDescription}
                                    setProductDescription={setProductDescription}
                                    productPhoto={productPhoto}
                                    setProductPhoto={setProductPhoto}
                                    productSku={productSku}
                                    setProductSku={setProductSku}
                                    productTitle={productTitle}
                                    setProductTitle={setProductTitle}
                                    projectType={projectType}
                                    setProjectType={setProjectType}
                                    projectName={projectName}
                                    setProjectName={setProjectName}
                                    quotationNumber={quotationNumber}
                                    setQuotationNumber={setQuotationNumber}
                                    quotationAmount={quotationAmount}
                                    setQuotationAmount={setQuotationAmount}
                                    quotationType={quotationType}
                                    setQuotationType={setQuotationType}
                                    quotationStatus={quotationStatus}
                                    setQuotationStatus={setQuotationStatus}
                                    callType={callType}
                                    setCallType={setCallType}
                                    followUpDate={followUpDate}
                                    setFollowUpDate={setFollowUpDate}
                                    remarks={remarks}
                                    setRemarks={setRemarks}
                                    status={status}
                                    setStatus={setStatus}

                                    typeClient={typeClient}
                                    setTypeClient={setTypeClient}
                                    tsm={tsm}
                                    setTSM={setTSMState}
                                    handleBack={handleBack}
                                    handleNext={handleNext}
                                    handleSave={handleSave}

                                    // The props you want to pass down:
                                    firstname={firstname}
                                    lastname={lastname}
                                    email={email}
                                    contact={contact}
                                    tsmname={tsmname}
                                    managername={managername}
                                    company_name={company_name}
                                    address={address}
                                    contact_number={contact_number}
                                    email_address={email_address}
                                    contact_person={contact_person}
                                />
                            )}

                            {typeActivity === "Sales Order Preparation" && (
                                <SOSheet
                                    step={step}
                                    setStep={setStep}
                                    source={source}
                                    setSource={setSource}
                                    soAmount={soAmount}
                                    setSoAmount={setSoAmount}
                                    callType={callType}
                                    setCallType={setCallType}
                                    remarks={remarks}
                                    setRemarks={setRemarks}
                                    status={status}
                                    setStatus={setStatus}

                                    typeClient={typeClient}
                                    setTypeClient={setTypeClient}
                                    handleBack={handleBack}
                                    handleNext={handleNext}
                                    handleSave={handleSave}
                                />
                            )}

                            {typeActivity === "Delivered / Closed Transaction" && (
                                <DRSheet
                                    step={step}
                                    setStep={setStep}
                                    drNumber={drNumber}
                                    setDrNumber={setDrNumber}
                                    soNumber={soNumber}
                                    setSoNumber={setSoNumber}
                                    siAmount={siAmount}
                                    setSiAmount={setSiAmount}
                                    siDate={siDate}
                                    setSiDate={setSiDate}
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

                            {
                                (
                                    typeActivity === "Viber Replies / Messages" ||
                                    typeActivity === "Admin - Supplier Accreditation" ||
                                    typeActivity === "Admin - Credit Terms Application" ||
                                    typeActivity === "Accounting Concerns" ||
                                    typeActivity === "After Sales Refunds" ||
                                    typeActivity === "After Sales Repair / Replacement" ||
                                    typeActivity === "Bidding Preparations" ||
                                    typeActivity === "Customer Orders" ||
                                    typeActivity === "Customer Inquiry Sales" ||
                                    typeActivity === "Delivery Concern" ||
                                    typeActivity === "Follow Up" ||
                                    typeActivity === "Sample Requests" ||
                                    typeActivity === "Site Visits / Demos" ||
                                    typeActivity === "Technical Concerns"
                                ) && (
                                    <ViberRepliesSheet
                                        step={step}
                                        setStep={setStep}
                                        source={source}
                                        setSource={setSource}
                                        remarks={remarks}
                                        setRemarks={setRemarks}
                                        status={status}
                                        setStatus={setStatus}
                                        typeClient={typeClient}
                                        setTypeClient={setTypeClient}
                                        handleBack={handleBack}
                                        handleNext={handleNext}
                                        handleSave={handleSave}
                                    />
                                )
                            }

                            {typeActivity === "FB Marketplace Replies / Messages" && (
                                <FBMarketplaceSheet
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

                                    typeClient={typeClient}
                                    setTypeClient={setTypeClient}
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
