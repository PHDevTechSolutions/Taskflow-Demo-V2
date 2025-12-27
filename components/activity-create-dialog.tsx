"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, } from "@/components/ui/sheet";
import { toast } from "sonner";

import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldSet, FieldTitle, } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle, } from "@/components/ui/empty";
import { Item, ItemActions, ItemContent, ItemDescription, ItemFooter, ItemMedia, ItemTitle, } from "@/components/ui/item"
import { Progress } from "@/components/ui/progress"
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
    const [exportStatusMessage, setExportStatusMessage] = useState("");

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

    const today = new Date();
    const formattedDate = today.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });

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


    // Sa loob ng component mo, i-add state para sa progress:
    const [progress, setProgress] = useState(0);

    // Function to handle export with progress bar + delayed download
    const startProgressAndDownload = (url: string, refNo: string) => {
        setShowExportNotification(true);
        setProgress(0);
        setExportStatusMessage("Initializing product table creation...");

        const duration = 1000; // 20 seconds total progress duration
        const intervalTime = 50; // update every 50ms
        const totalSteps = duration / intervalTime;
        let step = 0;

        const interval = setInterval(() => {
            step++;
            const newProgress = Math.min(100, (step / totalSteps) * 100);
            setProgress(newProgress);

            // Update status messages based on progress ranges
            if (newProgress <= 30) {
                setExportStatusMessage("Creating product tables...");
            } else if (newProgress <= 60) {
                setExportStatusMessage("Processing media and content...");
            } else if (newProgress < 90) {
                setExportStatusMessage("Finalizing export and packaging...");
            } else if (newProgress < 100) {
                setExportStatusMessage("Almost done! Preparing download...");
            } else if (newProgress === 100) {
                setExportStatusMessage("Your quotation has been successfully created.");
            }

            if (newProgress === 100) {
                clearInterval(interval);

                // Trigger download when progress hits 100%
                const a = document.createElement("a");
                a.href = url;
                a.download = `Quotation_${refNo}.xlsx`;
                a.click();

                // Close notification and reset form after short delay so user can see final message
                setTimeout(() => {
                    setShowExportNotification(false);
                    resetForm();
                    setStep(1);
                    setSheetOpen(false);
                    setExportStatusMessage(""); // reset message
                }, 1500);
            }
        }, intervalTime);
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
            ticket_reference_number,
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

            if (typeActivity === "Quotation Preparation") {
                // Check if productCat is empty/undefined/blank
                if (!productCat || productCat.trim() === "") {
                    toast.error("Cannot export quotation: Product Category is empty.");
                    resetForm();
                    setStep(1);
                    setSheetOpen(false);
                } else {
                    // Proceed with export only if productCat is present

                    const productCats = productCat.split(",");
                    const quantities = productQuantity ? productQuantity.split(",") : [];
                    const amounts = productAmount ? productAmount.split(",") : [];
                    const photos = productPhoto ? productPhoto.split(",") : [];
                    const titles = productTitle ? productTitle.split(",") : [];
                    const skus = productSku ? productSku.split(",") : [];
                    const descriptions = productDescription ? productDescription.split("||") : [];

                    const salesRepresentativeName = `${firstname} ${lastname}`;

                    // Extract username part before '@' if email already has domain
                    const emailUsername = email.split("@")[0];

                    // Determine email domain based on quotationType
                    let emailDomain = "";
                    if (quotationType === "Disruptive Solutions Inc") {
                        emailDomain = "disruptivesolutionsinc.com";
                    } else if (quotationType === "Ecoshift Corporation") {
                        emailDomain = "ecoshiftcorp.com";
                    } else {
                        emailDomain = email.split("@")[1] || ""; // fallback to original domain if any
                    }

                    const salesemail = `${emailUsername}@${emailDomain}`;
                    const salescontact = `${contact}`;
                    const salestsmname = `${tsmname}`;
                    const salesmanagername = `${managername}`;

                    const items = productCats.map((_, index) => {
                        const qty = Number(quantities[index] || 0);
                        const amount = Number(amounts[index] || 0);
                        const photo = photos[index] || "";
                        const title = titles[index] || "";
                        const sku = skus[index] || "";
                        const description = descriptions[index] || "";

                        const descriptionTable = `<table>
            <tr><td>${title}</td></tr>
            <tr><td>${sku}</td></tr>
            <tr><td>${description}</td></tr>
          </table>`;

                        return {
                            itemNo: index + 1,
                            qty,
                            referencePhoto: photo,
                            description: descriptionTable,
                            unitPrice: qty > 0 ? amount / qty : 0,
                            totalAmount: amount,
                        };
                    });

                    const quotationData = {
                        referenceNo: quotationNumber || activityRef,
                        date: formattedDate,
                        companyName: company_name,
                        address: address,
                        telNo: contact_number,
                        email: email_address,
                        attention: `${contact_person}, ${address}`,
                        subject: "For Quotation",
                        items,
                        vatType: "Vat Inc",
                        totalPrice: Number(quotationAmount),
                        salesRepresentative: salesRepresentativeName,
                        salesemail,
                        salescontact,
                        salestsmname,
                        salesmanagername,
                    };

                    // Determine API endpoint based on quotationType
                    let apiEndpoint = "/api/quotation/disruptive"; // default

                    if (quotationType === "Ecoshift Corporation") {
                        apiEndpoint = "/api/quotation/ecoshift";
                    } else if (quotationType === "Disruptive Solutions Inc") {
                        apiEndpoint = "/api/quotation/disruptive";
                    }

                    // Call server API to generate Excel
                    const resExport = await fetch(apiEndpoint, {
                        method: "POST",
                        body: JSON.stringify(quotationData),
                    });

                    const blob = await resExport.blob();
                    const url = URL.createObjectURL(blob);

                    startProgressAndDownload(url, quotationData.referenceNo || activityRef);

                }
            }

            resetForm();
            setStep(1);
            setSheetOpen(false);

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
                        className="cursor-pointer"
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
                        <SheetTitle>Create New Activity for <br />{company_name}</SheetTitle>
                        <SheetDescription>
                            Fill out the steps to create a new activity.
                        </SheetDescription>

                        {startDate && (
  <div
    className="
      fixed top-16 left-1/2 z-50
      bg-gray-900 text-green-400
      rounded-lg px-4 py-2
      shadow-[0_0_10px_rgba(16,185,129,0.7)]
      -translate-x-1/2
      font-mono font-semibold
      text-xl
      select-none
      flex items-center
      space-x-1
      cursor-default
    "
  >
    <span>Started:</span>
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
                                                ].map((item) => (
                                                    <FieldLabel key={item.value}>
                                                        <Field orientation="horizontal">
                                                            <FieldContent>
                                                                <FieldTitle>{item.title}</FieldTitle>
                                                                <FieldDescription>{item.desc}</FieldDescription>

                                                                {typeActivity === item.value && (
                                                                    <div className="mt-4 flex">
                                                                        <Button onClick={handleNext}>
                                                                            Next
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
                                    tsm={tsmState}
                                    setTSM={setTSMState}
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

            {showExportNotification && (
                <div style={{
                    position: "fixed",
                    top: "1rem",
                    right: "1rem",
                    zIndex: 9999,
                    backgroundColor: "white",
                }}>
                    <Item variant="outline">
                        <ItemMedia variant="icon">
                            <Spinner />
                        </ItemMedia>
                        <ItemContent>
                            <ItemTitle>Quotation Export</ItemTitle>
                            <ItemDescription>{exportStatusMessage}</ItemDescription>
                        </ItemContent>
                        <ItemActions className="hidden sm:flex">
                            <Button variant="outline" size="sm" onClick={() => setShowExportNotification(false)}>
                                Close
                            </Button>
                        </ItemActions>
                        <ItemFooter>
                            <Progress value={progress} />
                            {Math.round(progress)}%
                        </ItemFooter>
                    </Item>
                </div>
            )}
        </>
    );
}
