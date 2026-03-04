"use client";

import React, { useState, useEffect, ChangeEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, } from "@/components/ui/dialog";
import { Preview } from "./preview";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight, XIcon, FileText } from "lucide-react";

interface Completed {
    id: number;
    start_date?: string;
    end_date?: string;
    product_quantity?: string;
    product_amount?: string;
    product_description?: string;
    product_photo?: string;
    product_title?: string;
    product_sku?: string;
    quotation_number?: string;
    quotation_amount?: number | string;
    quotation_type: string;
    version?: string;
    // Submit to API
    activity_reference_number?: string;
    referenceid?: string;
    tsm?: string;
    manager?: string;
    company_name?: string;
    contact_person?: string;
    contact_number?: string;
    email_address?: string;
    address?: string;
    region?: string;
}

interface ProductItem {
    description: string;
    skus: any;
    title: string;
    images: any;
    isDiscounted: boolean;
    price: number;
    quantity: number;
    product_quantity?: string;
    product_amount?: string;
    product_description?: string;
    product_photo?: string;
    product_title?: string;
    product_sku?: string;
    discount?: number;
}

function splitAndTrim(value?: string): string[] {
    if (!value) return [];
    return value.split(",").map((v) => v.trim());
}

function splitDescription(value?: string): string[] {
    if (!value) return [];
    return value.split("||").map((v) => v.trim());
}

interface Product {
    id: string;
    title: string;
    description?: string;
    images?: { src: string }[];
    skus?: string[];
    price?: string;
}

interface RevisedQuotation {
    id: number;
    quotation_number?: string;
    product_title?: string;
    quotation_amount?: number;
    version: string;
    start_date?: string | Date;
    end_date?: string | Date;
    products?: Product[];
    product_description: string;
    product_quantity: string;
    product_amount: string;
    product_photo: string;
    product_sku: string;
}

interface TaskListEditDialogProps {
    item: Completed;
    onClose: () => void;
    onSave: () => void;
    company?: {
        company_name?: string;
        contact_number?: string;
        type_client?: string;
        email_address?: string;
        address?: string;
        contact_person?: string;
    };
    firstname?: string;
    lastname?: string;
    tsmname?: string;
    tsmemail?: string;
    tsmcontact?: string;
    managername?: string;

    activity_reference_number?: string;
    referenceid?: string;
    tsm?: string;
    manager?: string;
    company_name?: string;
    contact_person?: string;
    contact_number?: string;
    email_address?: string;
    address?: string;
    quotation_number?: string;
    deliveryFee?: string;

    // Signatories
    agentName?: string;
    agentSignature?: string;
    agentContactNumber?: string;
    agentEmailAddress?: string;
    tsmName?: string;
    tsmSignature?: string;
    tsmContactNumber?: string;
    tsmEmailAddress?: string;
    managerName?: string;


    signature?: string;
    email?: string;
    contact?: string;
}

export default function TaskListEditDialog({
    item,
    onClose,
    onSave,
    company,
    firstname,
    lastname,
    email,
    contact,
    tsmname,
    tsmemail,
    tsmcontact,
    managername,
    deliveryFee,

    // Signatories
    agentName,
    agentSignature,
    agentContactNumber,
    agentEmailAddress,
    tsmName,
    tsmSignature,
    tsmContactNumber,
    tsmEmailAddress,
    managerName,

    // Sales Head Signature
    signature,

}: TaskListEditDialogProps) {
    const [products, setProducts] = useState<ProductItem[]>([]);
    const [previewStates, setPreviewStates] = useState<boolean[]>([]);
    const [quotationAmount, setQuotationAmount] = useState<number>(0);

    const [checkedRows, setCheckedRows] = useState<Record<number, boolean>>({});
    const [discount, setDiscount] = React.useState(0);
    const [vatType, setVatType] = React.useState<"vat_inc" | "vat_exe" | "zero_rated">("zero_rated");
    // Confirmation dialog state

    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isDeclineOpen, setIsDeclineOpen] = useState(false);
    const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
    const [tsmRemarks, setTsmRemarks] = useState("");
    const [statusDialogTitle, setStatusDialogTitle] = useState("");
    const [statusDialogMessage, setStatusDialogMessage] = useState("");
    const [selectedStatus, setSelectedStatus] = useState<"Approved By Sales Head" | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);


    // These can be from props or item or company info
    const company_name = company?.company_name || "";
    const contact_number = company?.contact_number || "";
    const quotation_type = item.quotation_type;
    const quotationNumber = item.quotation_number || "";
    const quotationAmountNum = quotationAmount;
    const productQuantity = item.product_quantity || "";
    const productAmount = item.product_amount || "";
    const productPhoto = item.product_photo || "";
    const productTitle = item.product_title || "";
    const productSku = item.product_sku || "";
    const productDescription = item.product_description || "";
    const address = company?.address || ""; // add if available
    const email_address = company?.email_address || ""; // add if available
    const contact_person = company?.contact_person || ""; // add if available
    const quotation_number = quotationNumber;
    const activityRef = ""; // fallback if needed
    const formattedDate = new Date().toLocaleDateString();

    useEffect(() => {
        const quantities = splitAndTrim(item.product_quantity);
        const amounts = splitAndTrim(item.product_amount);
        const titles = splitAndTrim(item.product_title);
        const descriptions = splitDescription(item.product_description);
        const photos = splitAndTrim(item.product_photo);
        const sku = splitAndTrim(item.product_sku);

        const maxLen = Math.max(
            quantities.length,
            amounts.length,
            titles.length,
            descriptions.length,
            photos.length,
            sku.length
        );

        const arr: ProductItem[] = [];
        for (let i = 0; i < maxLen; i++) {
            arr.push({
                product_quantity: quantities[i] ?? "",
                product_amount: amounts[i] ?? "",
                product_title: titles[i] ?? "",
                product_description: descriptions[i] ?? "",
                product_photo: photos[i] ?? "",
                product_sku: sku[i] ?? "",
                quantity: 0,
                description: "",
                skus: undefined,
                title: "",
                images: undefined,
                isDiscounted: false,
                price: 0
            });
        }

        setProducts(arr);
    }, [item]);

    useEffect(() => {
        setPreviewStates(products.map(() => true));
    }, [products]);

    // ✅ Update the quotationAmount calculation to include delivery fee
    useEffect(() => {
        let total = 0;
        products.forEach((p, idx) => {
            const qty = parseFloat(p.product_quantity ?? "0") || 0;
            const amt = parseFloat(p.product_amount ?? "0") || 0;
            let lineTotal = qty * amt;

            // If this row is checked AND vatType is vat_inc, apply discount
            if (checkedRows[idx] && vatType === "vat_inc") {
                const discounted = lineTotal * ((100 - discount) / 100);
                lineTotal = discounted;
            }

            total += lineTotal;
        });

        const deliveryFeeNumber = parseFloat(deliveryFee ?? "0") || 0; // convert delivery fee to number
        const totalWithDelivery = total + deliveryFeeNumber; // ✅ add delivery fee

        setQuotationAmount(totalWithDelivery); // total including delivery fee
    }, [products, checkedRows, discount, vatType, deliveryFee]);

    // Download handler with your given logic integrated
    const getQuotationPayload = () => {
        const salesRepresentativeName = `${firstname ?? ""} ${lastname ?? ""}`.trim();
        const emailUsername = email?.split("@")[0] ?? "";

        let emailDomain = "";
        if (quotation_type === "Disruptive Solutions Inc") {
            emailDomain = "disruptivesolutionsinc.com";
        } else if (quotation_type === "Ecoshift Corporation") {
            emailDomain = "ecoshiftcorp.com";
        } else {
            emailDomain = email?.split("@")[1] ?? "";
        }

        const salesemail = emailUsername && emailDomain ? `${emailUsername}@${emailDomain}` : "";

        const items = products.map((p: ProductItem, index: number) => {
            // Use the 'product_xxx' fields which are updated by handleProductChange
            const qty = parseFloat(p.product_quantity ?? "0") || 0;
            const unitPrice = parseFloat(p.product_amount ?? "0") || 0;
            const isDiscounted = checkedRows[index] ?? false; // Use the row's checked state

            const baseAmount = qty * unitPrice;
            const discountedAmount = (isDiscounted && vatType === "vat_inc")
                ? (baseAmount * discount) / 100
                : 0;
            const totalAmount = baseAmount - discountedAmount;

            return {
                itemNo: index + 1,
                qty,
                // Ensure these match the fields initialized in your useEffect
                photo: p.product_photo ?? "",
                title: p.product_title ?? "",
                sku: p.product_sku ?? "",
                product_description: p.description?.trim()
                    ? p.description
                    : p.product_description || "",
                unitPrice,
                totalAmount,
            };
        });

        return {
            referenceNo: quotationNumber ?? "DRAFT-XXXX",
            date: new Date().toLocaleDateString(),
            companyName: company_name ?? "",
            address: address ?? "",
            telNo: contact_number ?? "",
            email: email_address ?? "",
            attention: contact_person ?? "",
            subject: "For Quotation",
            items,
            vatTypeLabel: vatType === "vat_inc" ? "VAT Inc" : vatType === "vat_exe" ? "VAT Exe" : "Zero-Rated",
            totalPrice: Number(quotationAmount ?? 0),
            deliveryFee: deliveryFee ?? "0",
            salesRepresentative: salesRepresentativeName,
            salesemail,
            salescontact: contact ?? "",
            salestsmname: tsmname ?? "",
            salestsmemail: tsmemail ?? "",
            salestsmcontact: tsmcontact ?? "",

            salesmanagername: managername ?? "",

            // Signatories
            // Agent
            agentName: agentName ?? null,
            agentSignature: agentSignature ?? null,
            agentContactNumber: agentContactNumber ?? null,
            agentEmailAddress: agentEmailAddress ?? null,
            // TSM
            tsmName: tsmName ?? null,
            tsmSignature: tsmSignature ?? null,
            tsmContactNumber: tsmContactNumber ?? null,
            tsmEmailAddress: tsmEmailAddress ?? null,

            // Personal Signatories
            managerName: managerName ?? null,
            signature: signature ?? null,
            salesheademail: email ?? null,
            salesheadcontact: contact ?? null,
        };
    };

    // 1. DATA INITIALIZATION: Defined here so both the UI and handleDownloadQuotation can access it.
    const payload = getQuotationPayload();
    // 1. BRAND SELECTION LOGIC
    const isEcoshift = quotation_type === "Ecoshift Corporation";

    // 2. ASSET PATH RESOLUTION
    const headerImagePath = isEcoshift
        ? "/ecoshift-banner.png"
        : "/disruptive-banner.png";

    const DownloadPDF = async () => {
        console.log('pdf dl');
        if (typeof window === 'undefined') return;
        const PRIMARY_CHARCOAL = '#121212';
        const OFF_WHITE = '#F9FAFA';
        try {
            const { default: jsPDF } = await import('jspdf');
            const { default: html2canvas } = await import('html2canvas');
            const payload = getQuotationPayload();
            const isEcoshift = quotation_type === "Ecoshift Corporation";

            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'pt',
                format: [612, 936] // Legal Format
            });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const BOTTOM_MARGIN = 0;

            // 1. CREATE VIRTUAL CANVAS
            const iframe = document.createElement('iframe');
            Object.assign(iframe.style, {
                position: 'fixed',
                right: '1000%',
                width: '816px',
                visibility: 'hidden'
            });
            document.body.appendChild(iframe);
            const iframeDoc = iframe.contentWindow?.document;
            if (!iframeDoc) throw new Error("Initialization Failed");

            iframeDoc.open();
            iframeDoc.write(`
          <html>
            <head>
            <style>
            * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
            body { 
            font-family: 'Arial', sans-serif; 
            margin: 0; 
            padding: 0; 
            background: white; /* Changed from OFF_WHITE to white for seamless capture */
            width: 816px; 
            color: ${PRIMARY_CHARCOAL};
            overflow: hidden; /* Prevents scrollbar padding */
            }
            
            .header-img { width: 100%; display: block; }
            .content-area { 
            padding: 0px 60px; 
            margin: 0 !important; /* Ensure no external margins */
            }
            
            /* 1. CLIENT INFORMATION GRID */
            .client-grid { border-left: 1.5px solid black; border-right: 1.5px solid black; background: white; }
            .grid-row { display: flex; align-items: center; min-height: 20px; padding: 2px 15px; }
            .border-t { border-top: 1.5px solid black; }
            .border-b { border-bottom: 1.5px solid black; padding-bottom: 10px;}
            .label { width: 140px; font-weight: 900; font-size: 10px; flex-shrink: 1; }
            .value { flex-grow: 1; font-size: 10px; font-weight: bold; color: #374151; padding-left: 15px; text-transform: uppercase; }
            .intro-text { font-size: 10px; font-style: italic; color: #6b7280; font-weight: 500; padding: 5px 0; }
            
            /* 2. SPECIFICATION TABLE */
            .table-container { 
            border: 1.5px solid black; 
            border-bottom: none; /* Let the row blocks handle the bottom border */
            background: white; 
            margin: 0;
            }
            
            .main-table { 
            width: 100%; 
            border-collapse: collapse; 
            table-layout: fixed; 
            margin: 0;
            }
            
            .main-table thead tr { background: ${OFF_WHITE}; border-bottom: 1.5px solid black;}
            .main-table th { 
            padding: 5px 8px; font-size: 9px; font-weight: 900; color: ${PRIMARY_CHARCOAL}; 
            text-transform: uppercase; border-right: 1px solid black;
            }
            
            .main-table td { 
            padding: 15px 10px; vertical-align: top; border-right: 1px solid black; 
            border-bottom: 1px solid black; font-size: 10px; 
            }
            
            .main-table td:last-child, .main-table th:last-child { border-right: none; }
            .item-no { color: #9ca3af; font-weight: bold; text-align: center; }
            .qty-col { font-weight: 900; text-align: center; color: ${PRIMARY_CHARCOAL}; }
            .ref-photo { mix-blend-mode: multiply; width: 96px; height: 96px; object-fit: contain; display: block; margin: 0 auto; }
            .product-title { font-weight: 900; text-transform: uppercase; font-size: 12px; margin-bottom: 4px; }
            .sku-text { color: #2563eb; font-weight: bold; font-size: 9px; margin-bottom: 10px; letter-spacing: -0.025em; }
            .desc-text { width: 100%; font-size: 9px; color: #000000; line-height: 1.2; }
            .variance-footnote { margin-top: 15px; font-size: 10px; font-weight: 900; text-transform: uppercase; border-bottom: 1px solid black; padding-bottom: 4px; }
            
            /* LOGISTICS GRID */
            .logistics-container { margin-top: 15px; border: 1px solid black; font-size: 9.5px; line-height: 1.3; }
            .logistics-row { display: flex; border-bottom: 1px solid black; }
            .logistics-row:last-child { border-bottom: none; }
            .logistics-label { width: 100px; padding: 8px; font-weight: 900; border-right: 1px solid black; flex-shrink: 0; }
            .logistics-value { padding: 8px; flex-grow: 1; }
            .bg-yellow-header { background-color: #facc15; }
            .bg-yellow-content { background-color: #fef9c3; }
            .bg-yellow-note { background-color: #fefce8; }
            .text-red-strong { color: #dc2626; font-weight: 900; display: block; margin-top: 4px; }

            /* 3. EXTENDED TERMS & CONDITIONS */
            .terms-section { margin-top: 25px; border-top: 2.5px solid black; padding-top: 10px; }
            .terms-header { background: ${PRIMARY_CHARCOAL}; color: white; padding: 4px 12px; font-size: 10px; font-weight: 900; text-transform: uppercase; display: inline-block; margin-bottom: 12px; }
            .terms-grid { display: grid; grid-template-columns: 120px 1fr; gap: 8px; font-size: 9px; line-height: 1.4; }
            .terms-label { font-weight: 900; text-transform: uppercase; padding: 4px 0; }
            .terms-val { padding: 4px 12px;}
            .terms-highlight { background-color: #fef9c3; }
            .bank-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
            
            /* SUMMARY BAR */
            .summary-bar { background: ${PRIMARY_CHARCOAL}; color: white; height: 45px; }
            .summary-bar td { border: none; vertical-align: middle; padding: 0 15px; }
            .tax-label { color: #f87171; font-style: italic; font-weight: 900; font-size: 9px; text-transform: uppercase; }
            .tax-options { display: flex; gap: 15px; font-size: 9px; font-weight: 900; text-transform: uppercase; }
            .tax-active { color: white; }
            .tax-inactive { color: rgba(255,255,255,0.3); }
            .grand-total-label { text-align: left; font-weight: 900; font-size: 10px; text-transform: uppercase; white-space: nowrap; }
            .grand-total-value { text-align: right; font-weight: 900; font-size: 18px; }
            
            /* 4. OFFICIAL SIGNATURE HIERARCHY */
            .sig-hierarchy { margin-top: 40px; padding-top: 16px; border-top: 4px solid #1d4ed8; padding-bottom: 20px; }
            .sig-message { font-size: 9px; margin-bottom: 15px; font-weight: 500; line-height: 1.4; }
            .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
            .sig-side-internal { display: flex; flex-direction: column; gap: 10px; }
            .sig-side-client { display: flex; flex-direction: column; align-items: flex-end; gap: 40px; }
            .sig-line { border-bottom: 1px solid black; width: 256px; }
            .sig-rep-box { width: 150px; height: 15px; display: flex; align-items: center; 
            justify-content: center; text-align: center; font-size: 8px; 
            font-weight: 900; color: #dc2626; text-transform: uppercase; padding: 0 8px;
            }
            
            .sig-sub-label { font-size: 9px; font-weight: bold; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }
            </style>
          </head>
        <body></body>
      </html>
      `);
            iframeDoc.close();

            // 2. HELPER: ATOMIC SECTION CAPTURE
            const renderBlock = async (html: string) => {
                iframeDoc.body.innerHTML = html;
                // Allow time for images to resolve
                const images = iframeDoc.querySelectorAll('img');
                await Promise.all(Array.from(images).map(img => {
                    if (img.complete) return Promise.resolve();
                    return new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
                }));

                const canvas = await html2canvas(iframeDoc.body, {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: '#ffffff',
                    logging: false
                });
                return {
                    img: canvas.toDataURL('image/jpeg', 1.0),
                    h: (canvas.height * pdfWidth) / canvas.width
                };
            };

            let currentY = 0;
            let pageCount = 1;

            const drawPageNumber = (currentCount: number) => {
                pdf.setFont("helvetica", "normal");
                pdf.setFontSize(8);
                pdf.setTextColor(150);
                pdf.text(`Page ${currentCount}`, pdfWidth - 60, pdfHeight - 20);
            };

            const initiateNewPage = async () => {
                const banner = await renderBlock(`<img src="${headerImagePath}" class="header-img" />`);
                pdf.addImage(banner.img, 'JPEG', 0, 0, pdfWidth, banner.h);

                // Draw number for the CURRENT page
                drawPageNumber(pageCount);

                return banner.h;
            };

            // --- START GENERATION ---
            currentY = await initiateNewPage();

            // A. CLIENT INFO BLOCK
            const clientBlock = await renderBlock(`
        <div class="content-area">
        <div style="text-align:right; font-weight:900; font-size:10px; margin-bottom:10px;">
        REFERENCE NO: ${payload.referenceNo}<br>DATE: ${payload.date}
        </div>
        
        <div class="client-grid">
        <div class="grid-row border-t">
        <div class="label">COMPANY NAME:</div>
        <div class="value">${payload.companyName}</div>
        </div>
        
        <div class="grid-row"><div class="label">ADDRESS:</div>
        <div class="value">${payload.address}</div></div>
        <div class="grid-row">
        <div class="label">TEL NO:</div>
        <div class="value">${payload.telNo}</div>
        </div>
        
        <div class="grid-row border-b">
        <div class="label">EMAIL ADDRESS:</div>
        <div class="value">${payload.email}</div>
        </div>
        
        <div class="grid-row">
        <div class="label">ATTENTION:</div>
        <div class="value">${payload.attention}</div>
        </div>
        
        <div class="grid-row border-b">
        <div class="label">SUBJECT:</div>
        <div class="value">${payload.subject}</div>
        </div>
        </div>
        <p class="intro-text">We are pleased to offer you the following products for consideration:</p>
        </div>
        `);
            pdf.addImage(clientBlock.img, 'JPEG', 0, currentY, pdfWidth, clientBlock.h);
            currentY += clientBlock.h;

            // B. TABLE HEADER BLOCK
            const headerBlock = await renderBlock(`
        <div class="content-area">
        <div class="table-container" style="border-bottom: 1.5px solid black;">
        <table class="main-table">
        <thead>
        <tr>
        <th style="width: 40px;">ITEM NO</th>
        <th style="width: 40px;">QTY</th>
        <th style="width: 120px;">REFERENCE PHOTO</th>
        <th style="width: 200px;">PRODUCT DESCRIPTION</th>
        <th style="width: 80px; text-align:right;">UNIT PRICE</th>
        <th style="width: 80px; text-align:right;">TOTAL AMOUNT</th>
        </tr>
        </thead>
        </table>
        </div>
        </div>
        `);
            pdf.addImage(headerBlock.img, 'JPEG', 0, currentY, pdfWidth, headerBlock.h);
            currentY += 28; // Header height minus stitch to first row

            // C. ITEM ROWS
            for (const [index, item] of payload.items.entries()) {
                const rowBlock = await renderBlock(`
          <div class="content-area">
          <table class="main-table" style="border: 1.5px solid black; border-top: none;">
          <tr>
          <td style="width: 40px;" class="item-no">${index + 1}</td>
          <td style="width: 40px;" class="qty-col">${item.qty}</td>
          <td style="width: 120px;"><img src="${item.photo}" class="ref-photo"></td>
          <td style="width: 200px;">
          <div class="product-title" style="font-size: 7px;">${item.title}</div>
          <div class="sku-text">${item.sku}</div>
          <div class="desc-text">${item.product_description}</div>
          </td>
          <td style="width: 80px; text-align:right;">₱${item.unitPrice.toLocaleString()}</td>
          <td style="width: 80px; text-align:right; font-weight:900;">₱${item.totalAmount.toLocaleString()}</td>
          </tr>
          </table>
          </div>
          `);

                // Handle Page Breaks (Same logic)
                if (currentY + rowBlock.h > (pdfHeight - 50)) {
                    pdf.addPage([612, 936]);
                    pageCount++;
                    currentY = await initiateNewPage();
                    pdf.addImage(headerBlock.img, 'JPEG', 0, currentY, pdfWidth, headerBlock.h);
                    currentY += 28; // Re-apply stitch on new page
                }

                pdf.addImage(rowBlock.img, 'JPEG', 0, currentY, pdfWidth, rowBlock.h);

                // UPDATE: Maintain the stitch for the next row
                currentY += rowBlock.h;
            }

            // D. GRAND TOTAL & LOGISTICS
            const footerBlock = await renderBlock(`
        <div class="content-area" style="padding-top:0; padding-bottom:0;">
        <div class="table-container">
        <table class="main-table">
        <tr class="summary-bar">
        <td colspan="1" ></td>
        <td class="tax-label">Tax Type:</td>
        <td style="width: 300px;">
        <div class="tax-options" style="margin-left: 50px;">
        <span class="${payload.vatTypeLabel === "VAT Inc" ? 'tax-active' : 'tax-inactive'}">
        ${payload.vatTypeLabel === "VAT Inc" ? "●" : "○"} VAT Inc
        </span>
        <span class="${payload.vatTypeLabel === "VAT Exe" ? 'tax-active' : 'tax-inactive'}">
        ${payload.vatTypeLabel === "VAT Exe" ? "●" : "○"} VAT Exe
        </span>
        <span class="${payload.vatTypeLabel === "Zero-Rated" ? 'tax-active' : 'tax-inactive'}">
        ${payload.vatTypeLabel === "Zero-Rated" ? "●" : "○"} Zero-Rated
        </span>
        </div>
        </td>
        <td style="width: 120px; text-align:left;" class="grand-total-label">Delivery Fee:</td>
        <td style="width: 80px; text-align:right;" class="grand-total-value">₱${payload.deliveryFee}</td>
        </tr>
        <tr class="summary-bar">
        <td colspan="3" ></td>
        <td style="width: 120px; text-align:left;" class="grand-total-label">Grand Total:</td>
        <td style="width: 80px; text-align:right;" class="grand-total-value">₱${payload.totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
        </tr>
        </table>
        </div>
        </div>
        `);
            if (currentY + footerBlock.h > (pdfHeight - BOTTOM_MARGIN)) {
                pdf.addPage([612, 936]); pageCount++; currentY = await initiateNewPage();
                pageCount++;
            }
            pdf.addImage(footerBlock.img, 'JPEG', 0, currentY, pdfWidth, footerBlock.h);
            currentY += footerBlock.h;

            // --- SECTION E.1: LOGISTICS & EXCLUSIONS ---
            const logisticsBlock = await renderBlock(`
        <div class="content-area" style="padding-top:0;">
        <div class="variance-footnote">*PHOTO MAY VARY FROM ACTUAL UNIT</div>
        <div class="logistics-container">
        <div class="logistics-row">
        <div class="logistics-label bg-yellow-header">Included:</div>
        <div class="logistics-value bg-yellow-content">
        <p>Orders Within Metro Manila: Free delivery for a minimum sales transaction of ₱5,000.</p>
        <p>Orders outside Metro Manila Free delivery is available for a minimum sales transaction of ₱10,000 in Rizal, ₱15,000 in Bulacan and Cavite, and ₱25,000 in Laguna, Pampanga, and Batangas.</p>
        </div>
        </div>
        
        <div class="logistics-row">
        <div class="logistics-label bg-yellow-header">Excluded:</div>
        <div class="logistics-value bg-yellow-content">
        <p>All lamp poles are subject to a delivery charge.</p>
        <p>Installation and all hardware/accessories not indicated above.</p>
        <p>Freight charges, arrastre, and other processing fees.</p>
        </div>
        </div>
        <div class="logistics-row">
        <div class="logistics-label">Notes:</div>
        <div class="logistics-value bg-yellow-note" style="font-style: italic;">
        <p>Deliveries are up to the vehicle unloading point only.</p>
        <p>Additional shipping fee applies for other areas not mentioned above.</p>
        <p>Subject to confirmation upon getting the actual weight and dimensions of the items.</p>
        <span class="text-red-strong"><u>In cases of client error, there will be a 10% restocking fee for returns, refunds, and exchanges.</u></span>
        </div>
        </div>
        </div>
        
        <div class="terms-section">
        <div class="terms-header">Terms and Conditions</div>
        <div class="terms-grid">
        <div class="terms-label">Availability:</div>
        <div class="terms-val terms-highlight">
        <p>*5-7 days if on stock upon receipt of approved PO.</p>
        <p>*For items not on stock/indent order, an estimate of 45-60 days upon receipt of approved PO & down payment. Barring any delay in shipping and customs clearance beyond Disruptive's control.</p>
        <p>*In the event of a conflict or inconsistency in estimated days under Availability and another estimate indicated elsewhere in this quotation, the latter will prevail.</p>
        </div>
        
        <div class="terms-label">Warranty:</div>
        <div class="terms-val terms-highlight">
        <p>One (1) year from the time of delivery for all busted lights except the damaged fixture.</p>
        <p>The warranty will be VOID under the following circumstances:</p>
        <p>*If the unit is being tampered with.</p>
        <p>*If the item(s) is/are altered in any way by unauthorized technicians.</p>
        <p>*If it has been subjected to misuse, mishandling, neglect, or accident.</p>
        <p>*If damaged due to spillage of liquids, tear corrosion, rusting, or stains.</p>
        <p>*This warranty does not cover loss of product accessories such as remote control, adaptor, battery, screws, etc.</p>
        <p>*Shipping costs for warranty claims are for customers' account.</p>
        <p>*If the product purchased is already phased out when the warranty is claimed, the latest model or closest product SKU will be given as a replacement.</p>
        </div>
        
        <div class="terms-label">SO Validity:</div>
        <div class="terms-val">
        <p>Sales order has <b style="color:red;">validity period of 14 working days.</b> (excluding holidays and Sundays) from the date of issuance. Any sales order not confirmed and no verified payment within this <b style="color:red;">14-day period will be automatically cancelled.</b></p>
        </div>
        
        <div class="terms-label">Storage:</div>
        <div class="terms-val terms-highlight">
        <p>Orders with confirmation/verified payment but undelivered after 14 working days (excluding holidays and Sundays starting from picking date) due to clients’ request or shortcomings will be charged a storage fee of 10% of the value of the orders per month <b style="color:red;">(10% / 30 days = 0.33% per day).</b></p>
        </div>
        
        <div class="terms-label">Return:</div>
        <div class="terms-val terms-highlight">
        <p><b style="color:red;"><u>7 days return policy -</u></b>  if the product received is defective, damaged, or incomplete. This must be communicated to Disruptive, and Disruptive has duly acknowledged communication as received within a maximum of 7 days to qualify for replacement.</p>
        </div>
        </div>
        </div>
        </div>
        `);

            if (currentY + logisticsBlock.h > (pdfHeight - BOTTOM_MARGIN)) {
                pdf.addPage([612, 936]); pageCount++; currentY = await initiateNewPage();
            }
            pdf.addImage(logisticsBlock.img, 'JPEG', 0, currentY, pdfWidth, logisticsBlock.h);
            currentY += logisticsBlock.h;

            // --- SECTION E.2: FULL TERMS & SIGNATURE HIERARCHY ---
            const termsAndSigBlock = await renderBlock(`
        <div class="content-area" style="padding-top:0;">
        <div class="terms-grid">
        <div class="terms-label">Payment:</div>
        <div class="terms-val">
        <p><strong style="color:red;">Cash on Delivery (COD)</strong></p>
        <p><strong>NOTE: Orders below 10,000 pesos can be paid in cash at the time of delivery. Exceeding 10,000 pesos should be transacted through bank deposit or mobile electronic transactions.</strong></p>
        <p>For special items, Seventy Percent (70%) down payment, 30% upon delivery.</p>
        <br>
        <p><strong>BANK DETAILS</strong></p>
        <p><b>Payee to: </b><strong>${isEcoshift ? 'ECOSHIFT CORPORATION' : 'DISRUPTIVE SOLUTIONS INC.'}</strong></p>
        <br>
        
        <div class="bank-grid" style="display: flex; gap: 20px;">
        <div><strong>BANK: METROBANK</strong><br/>Account Name: ${isEcoshift ? 'ECOSHIFT CORPORATION' : 'DISRUPTIVE SOLUTIONS INC.'}<br/>Account Number: ${isEcoshift ? '243-7-243805100' : '243-7-24354164-2'}</div>
        <div><strong>BANK: BDO</strong><br/>Account Name: ${isEcoshift ? 'ECOSHIFT CORPORATION' : 'DISRUPTIVE SOLUTIONS INC.'}<br/>Account Number: ${isEcoshift ? '0021-8801-7271' : '0021-8801-9258'}</div>
        </div>
        </div>
        
        <div class="terms-label">DELIVERY:</div>
        <div class="terms-val terms-highlight">
        <p>Delivery/Pick up is subject to confirmation.</p>
        </div>
        
        <div class="terms-label">Validity:</div>
        <div class="terms-val">
        <p><b style="color:red;"><u>Thirty (30) calendar days from the date of this offer.</u></b></p>
        <p>In the event of changes in prevailing market conditions, duties, taxes, and all other importation charges, quoted prices are subject to change.</p>
        </div>
        
        <div class="terms-label">CANCELLATION:</div>
        <div class="terms-val terms-highlight">
        <p>1. Above quoted items are non-cancellable.</p>
        <p>2. If the customer cancels the order under any circumstances, the client shall be responsible for 100% cost incurred by Disruptive, including freight and delivery charges.</p>
        <p>3. Downpayment for items not in stock/indent and order/special items are non-refundable and will be forfeited if the order is canceled.</p>
        <p>4. COD transaction payments should be ready upon delivery. If the payment is not ready within seven (7) days from the date of order, the transaction is automatically canceled.</p>
        <p>5. Cancellation for Special Projects (SPF) are not allowed and will be subject to a 100% charge.</p>
        </div>
        </div>
        
        <div class="sig-hierarchy">
        <p class="sig-message">
        Thank you for allowing us to service your requirements. We hope that the above offer merits your acceptance. Unless otherwise indicated, you are deemed to have accepted the Terms and Conditions of this Quotation.
        </p>
        
        <div class="sig-grid">
        <div class="sig-side-internal">
        <div>
        <p style="font-style: italic; font-size: 10px; font-weight: 900; margin-bottom: 25px;">${isEcoshift ? 'Ecoshift Corporation' : 'Disruptive Solutions Inc'}</p>
                                   
        <img src="${payload.agentSignature || ''}" class="sig-rep-box" />
        <p style="font-size: 10px; font-weight: 900; text-transform: uppercase; mt-1">${payload.agentName}</p>
        <div class="sig-line"></div>
        <p class="sig-sub-label">Sales Representative</p>
        <p style="font-size: 10px; font-style: italic;">Mobile: ${payload.agentContactNumber || 'N/A'}</p>
        <p style="font-size: 10px; font-style: italic;">Email: ${payload.agentEmailAddress || 'N/A'}</p>
        </div>
        <div>
        <p style="font-size: 9px; font-weight: 900; text-transform: uppercase; color: #9ca3af; margin-bottom: 25px;">Approved By:</p>
        <img src="${payload.tsmSignature || ''}" class="sig-rep-box" />
        <p style="font-size: 10px; font-weight: 900; text-transform: uppercase; mt-1">${payload.tsmName}</p>
        <div class="sig-line"></div>
        <p class="sig-sub-label">SALES MANAGER</p>
        <p style="font-size: 10px; font-style: italic;">Mobile: ${payload.tsmContactNumber || 'N/A'} </p>
        <p style="font-size: 10px; font-style: italic;">Email: ${payload.tsmEmailAddress || 'N/A'}</p>
        </div>
        <div>
        
        <p style="font-size: 9px; font-weight: 900; text-transform: uppercase; color: #9ca3af; margin-bottom: 25px;">Noted By:</p>
        <img src="${payload.signature || ''}" class="sig-rep-box" />
        <p style="font-size: 10px; font-weight: 900; text-transform: uppercase; mt-1">${payload.managerName}</p>
        <div class="sig-line"></div>
        <p class="sig-sub-label">Sales-B2B</p>
        </div>
        </div>
        
        <div class="sig-side-client">
        <div>
        <div class="sig-line" style="margin-top: 73px;"></div>
        <p style="font-size: 9px; text-align: center; font-weight: 900; margin-top: 4px; text-transform: uppercase;">Company Authorized Representative</p>
        </div>
        <div style="width: 256px;">
        <div class="sig-line" style="margin-top: 68px;"></div>
        <p style="font-size: 9px; text-align: center; font-weight: 900; margin-top: 4px; text-transform: uppercase;">Payment Release Date</p>
        </div>
        <div style="width: 256px;">
        <div class="sig-line" style="margin-top: 68px;"></div>
        <p style="font-size: 9px; text-align: center; font-weight: 900; margin-top: 4px; text-transform: uppercase;">Position in the Company</p>
        </div>
        </div>
        </div>
        </div>
        </div>
        `);

            if (currentY + termsAndSigBlock.h > (pdfHeight - BOTTOM_MARGIN)) {
                pdf.addPage([612, 936]); pageCount++; currentY = await initiateNewPage();
            }
            pdf.addImage(termsAndSigBlock.img, 'JPEG', 0, currentY, pdfWidth, termsAndSigBlock.h);

            // 3. FINALIZATION
            pdf.save(`QUOTATION_${payload.referenceNo}.pdf`);
            document.body.removeChild(iframe);
        } catch (error) {
            console.error("Critical Export Error:", error);
        }
    }

    // Open dialog para sa Approved / Endorsed
    const openStatusDialog = (status: "Approved By Sales Head") => {
        setSelectedStatus(status);
        setTsmRemarks(""); // Reset remarks sa dialog

        const now = new Date().toISOString();

        setStatusDialogTitle(`Quotation ${status}`); // Fixed title
        setStatusDialogMessage(`${status} on ${now}`);
        setIsStatusDialogOpen(true);
    };

    // Updated handleUpdateStatus
    const handleUpdateStatus = async (
        status: "Approved By Sales Head" | "Decline By Sales Head",
        remarks?: string
    ) => {
        if (!item.quotation_number) {
            alert("Missing activity reference number");
            return;
        }

        const approvalDate = new Date().toISOString();

        setIsUpdating(true);
        try {
            const res = await fetch("/api/activity/manager/quotation/update", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    quotation_number: item.quotation_number,
                    tsm_approved_status: status,
                    manager_remarks: remarks ?? null,
                    manager_approval_date: approvalDate,
                    contact,
                    email,
                    signature: signature ?? agentSignature,
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Update failed");

            alert(`Quotation ${status} successfully`);
            onClose();
        } catch (err: any) {
            console.error(err);
            alert(err.message || "Something went wrong");
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <>
            <Dialog open={true} onOpenChange={onClose}>
                <DialogContent
                    className="max-w-[1000px] w-[95vw] max-h-[90vh] p-0 border-none bg-white shadow-2xl flex flex-col"
                    style={{ maxWidth: "950px", width: "100vw" }}
                >
                    {/* Scrollable content */}
                    <div className="flex flex-col flex-1 overflow-auto p-2 space-y-4">
                        <Preview
                            payload={getQuotationPayload()}
                            quotationType={quotation_type}
                            setIsPreviewOpen={setIsPreviewOpen}
                        />
                    </div>

                    {/* Footer always visible */}
                    <DialogFooter className="flex justify-end gap-2 border-t p-4 bg-white">
                        <Button
                            onClick={() => openStatusDialog("Approved By Sales Head")}
                            disabled={isUpdating}
                            className="rounded-none p-6 bg-green-600"
                        >
                            <Check /> Approve
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => setIsDeclineOpen(true)}
                            disabled={isUpdating}
                            className="rounded-none p-6"
                        >
                            <XIcon /> Decline
                        </Button>
                        <Button
                            type="button"
                            onClick={DownloadPDF}
                            className="rounded-xs p-6 bg-blue-600"
                        >
                            <FileText />
                            PDF
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isDeclineOpen} onOpenChange={setIsDeclineOpen}>
                <DialogContent className="max-w-md rounded-none">
                    <DialogHeader>
                        <DialogTitle>Decline Quotation</DialogTitle>
                        <DialogDescription>Provide a reason for declining this quotation.</DialogDescription>
                    </DialogHeader>

                    <textarea
                        value={tsmRemarks}
                        onChange={(e) => setTsmRemarks(e.target.value)}
                        placeholder="Enter reason for decline..."
                        className="w-full min-h-[120px] border p-2 text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                    />

                    <DialogFooter className="flex justify-end gap-3">
                        <Button variant="outline" onClick={() => setIsDeclineOpen(false)} className="rounded-none p-6">
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            disabled={!tsmRemarks.trim() || isUpdating}
                            onClick={() => {
                                handleUpdateStatus("Decline By Sales Head", tsmRemarks);
                                setIsDeclineOpen(false);
                            }}
                            className="rounded-none p-6"
                        >
                            Confirm Decline
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Approve / Endorse Dialog */}
            <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
                <DialogContent className="max-w-md rounded-none">
                    <DialogHeader>
                        <DialogTitle>{statusDialogTitle}</DialogTitle>
                        <DialogDescription>
                        </DialogDescription>
                    </DialogHeader>

                    <textarea
                        value={tsmRemarks}
                        onChange={(e) => setTsmRemarks(e.target.value)}
                        placeholder="Enter remarks..."
                        className="w-full min-h-[100px] border p-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 mt-2"
                    />

                    <DialogFooter className="flex justify-end gap-3 mt-2">
                        <Button
                            variant="outline"
                            onClick={() => setIsStatusDialogOpen(false)}
                            className="rounded-none p-6"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => {
                                handleUpdateStatus(selectedStatus!, tsmRemarks);
                                setIsStatusDialogOpen(false);
                            }}
                            className="rounded-none p-6"
                        >
                            Confirm
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
