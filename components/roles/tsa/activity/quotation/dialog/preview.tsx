"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";

type Item = {
    itemNo: number | string;
    qty: number | string;
    photo?: string;
    title: string;
    sku: string;
    product_description: string;
    unitPrice: number;
    discount?: number;
    discountedAmount?: number;
    totalAmount: number;
    remarks: string;
    /** True when this item originates from an SPF 1 (procurement-approved) record */
    isSpf1?: boolean;
    /** Lead time string from procurement — shown as a badge below the SKU for SPF 1 items */
    procurementLeadTime?: string;
};

type Payload = {
    referenceNo: string;
    date: string;
    companyName: string;
    address: string;
    telNo: string;
    email: string;
    attention: string;
    subject: string;
    salesRepresentative: string;
    salescontact: string;
    salesemail: string;
    salestsmname?: string;
    salesmanagername: string;
    salestsmcontact?: string;
    salestsmemail?: string;
    items: Item[];
    totalPrice: number;
    vatType?: string | null;
    deliveryFee?: string | number;
    restockingFee?: number;
    whtType?: string;
    whtLabel?: string;
    whtAmount?: number;
    netAmountToCollect?: number;
    salesManagerContact?: string;
    salesManagerEmail?: string;

    // Signatories
    agentSignature?: string | null;
    agentContactNumber?: string | null;
    agentEmailAddress?: string | null;
    TsmSignature?: string | null;
    TsmEmailAddress?: string | null;
    TsmContactNumber?: string | null;
    ManagerSignature?: string | null;
    ManagerContactNumber?: string | null;
    ManagerEmailAddress?: string | null;
};

type PreviewProps = {
    payload: Payload;
    quotationType: string;
    setIsPreviewOpen: (open: boolean) => void;
};

export const Preview: React.FC<PreviewProps> = ({
    payload,
    quotationType,
    setIsPreviewOpen,
}) => {
    const isEcoshift = quotationType === "Ecoshift Corporation";
    const headerImagePath = isEcoshift
        ? "/ecoshift-banner.png"
        : "/disruptive-banner.png";

    // ── QR Code Security ──────────────────────────────────────────────────────
    const [qrDataUrl, setQrDataUrl] = React.useState<string | null>(null);

    React.useEffect(() => {
        const generateQr = async () => {
            try {
                const QRCode = await import("qrcode");

                // Security Token Generation (must match verify page logic)
                const SECURITY_SALT = "TF-SECURE-2024-DS-EC";
                const generateToken = (ref: string, total: string) => {
                    const raw = `${ref}|${total}|${SECURITY_SALT}`;
                    let hash = 0;
                    for (let i = 0; i < raw.length; i++) {
                        const chr = raw.charCodeAt(i);
                        hash = (hash << 5) - hash + chr;
                        hash |= 0;
                    }
                    return Math.abs(hash).toString(36).toUpperCase();
                };

                const totalStr = payload.totalPrice.toFixed(2);
                const token = generateToken(payload.referenceNo, totalStr);

                const verificationUrl = `${window.location.origin}/verify-quotation?ref=${encodeURIComponent(payload.referenceNo)}&total=${totalStr}&v=${token}`;

                const dataUrl = await QRCode.toDataURL(verificationUrl, {
                    width: 128,
                    margin: 1,
                    color: { dark: "#121212", light: "#ffffff" },
                    errorCorrectionLevel: "H", // High error correction for better reliability
                });
                setQrDataUrl(dataUrl);
            } catch (err) {
                console.error("QR Generation failed", err);
            }
        };
        generateQr();
    }, [payload, isEcoshift]);

    // ── Security helpers ──────────────────────────────────────────────────────
    const securityTimestamp = new Date().toISOString();
    const companyLabel = isEcoshift ? "ECOSHIFT CORPORATION" : "DISRUPTIVE SOLUTIONS INC.";
    const watermarkText = `${companyLabel} · OFFICIAL QUOTATION · ${payload.referenceNo}`;

    return (
        <div className="flex flex-col bg-white min-h-full font-sans text-[#121212]" style={{ position: "relative" }}>

            {/* ── DIAGONAL WATERMARK OVERLAY ─────────────────────────────────────── */}
            <div
                aria-hidden="true"
                style={{
                    position: "absolute",
                    inset: 0,
                    pointerEvents: "none",
                    zIndex: 10,
                    overflow: "hidden",
                }}
            >
                <svg
                    width="100%"
                    height="100%"
                    style={{ position: "absolute", inset: 0 }}
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <defs>
                        <pattern
                            id="wm-pattern"
                            x="0"
                            y="0"
                            width="800"
                            height="150"
                            patternUnits="userSpaceOnUse"
                            patternTransform="rotate(-25)"
                        >
                            <text
                                x="0"
                                y="40"
                                fontFamily="Arial, sans-serif"
                                fontSize="9"
                                fontWeight="bold"
                                fill="#121212"
                                fillOpacity="0.06"
                                letterSpacing="1"
                            >
                                {watermarkText}
                            </text>
                            <text
                                x="400"
                                y="115"
                                fontFamily="Arial, sans-serif"
                                fontSize="9"
                                fontWeight="bold"
                                fill="#121212"
                                fillOpacity="0.06"
                                letterSpacing="1"
                            >
                                {watermarkText}
                            </text>
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#wm-pattern)" />
                </svg>
            </div>

            {/* CORPORATE BRANDING HEADER */}
            <div className="w-full flex justify-center py-5 border-b border-gray-100 bg-white">
                <div className="w-full max-w-[900px] h-[110px] relative flex items-center justify-center overflow-hidden">
                    <img
                        key={quotationType}
                        src={headerImagePath}
                        alt={`${quotationType} Header`}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const parent = e.currentTarget.parentElement;
                            if (parent) {
                                parent.innerHTML = `
                      <div class="w-full h-full bg-[#121212] flex flex-col items-center justify-center text-white">
                        <span class="font-black text-2xl tracking-[0.2em] uppercase">${isEcoshift ? 'ECOSHIFT CORPORATION' : 'DISRUPTIVE SOLUTIONS INC.'}</span>
                        <span class="text-[10px] tracking-[0.5em] font-light opacity-70">OFFICIAL QUOTATION PROTOCOL</span>
                      </div>
                    `;
                            }
                        }}
                    />
                </div>
            </div>

            <div className="px-12 py-8 space-y-1">
                {/* REFERENCE & DATE SECTION */}
                <div className="text-right text-[11px] font-medium uppercase space-y-1">
                    <p className="flex justify-end gap-2">
                        <span className="font-black text-[#121212]">Reference No:</span>
                        <span className="text-gray-600">{payload.referenceNo}</span>
                    </p>
                    <p className="flex justify-end gap-2">
                        <span className="font-black text-[#121212]">Date:</span>
                        <span className="text-gray-600">{payload.date}</span>
                    </p>
                </div>

                {/* CLIENT INFORMATION GRID */}
                <div className="mt-5 border-l border-r border-black">
                    {[
                        { label: "COMPANY NAME", value: payload.companyName, borderTop: true },
                        { label: "ADDRESS", value: payload.address },
                        { label: "TEL NO", value: payload.telNo },
                        { label: "EMAIL ADDRESS", value: payload.email, borderBottom: true },
                        { label: "ATTENTION", value: payload.attention },
                        { label: "SUBJECT", value: payload.subject, borderBottom: true },
                    ].map((info, i) => (
                        <div
                            key={i}
                            className={`grid grid-cols-6 py-1 px-4 items-center min-h-[30px]
                    ${info.borderTop ? 'border-t border-black' : ''} 
                    ${info.borderBottom ? 'border-b border-black' : ''}
                  `}
                        >
                            <span className="col-span-1 font-black text-[10px] text-[#121212]">{info.label}:</span>
                            <span className="col-span-5 text-[11px] font-bold text-gray-700 pl-4">{info.value || "---"}</span>
                        </div>
                    ))}
                </div>

                <p className="text-[10px] italic mt-5 text-gray-500 font-medium">
                    We are pleased to offer you the following products for consideration:
                </p>

                {/* ITEM SPECIFICATION TABLE */}
                <div className="border border-black overflow-hidden shadow-sm">
                    <table className="w-full text-[10px] border-collapse">
                        <thead>
                            <tr className="bg-[#F9FAFA] border-b border-black font-black uppercase text-[#121212]">
                                <th className="p-3 border-r border-black w-16 text-center">ITEM NO</th>
                                <th className="p-3 border-r border-black w-16 text-center">QTY</th>
                                <th className="p-3 border-r border-black w-32 text-center">REFERENCE PHOTO</th>
                                <th className="p-3 border-r border-black text-left">PRODUCT DESCRIPTION</th>
                                <th className="p-3 border-r border-black w-20 text-center">UNIT PRICE</th>
                                <th className="p-3 border-r border-black w-14 text-center">DISC</th>
                                <th className="p-3 border-r border-black w-20 text-center">DISCOUNT PRICE</th>
                                <th className="p-3 w-20 text-center">TOTAL AMOUNT</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-black">
                            {payload.items.map((item, idx) => (
                                <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="p-4 text-center border-r border-black align-top font-bold text-gray-400">{item.itemNo}</td>
                                    <td className="p-4 text-center border-r border-black align-top font-black text-[#121212]">{item.qty}</td>
                                    <td className="p-3 border-r border-black align-top bg-white">
                                        {item.photo ? (
                                            <img src={item.photo} className="w-24 h-24 object-contain mx-auto mix-blend-multiply" alt="sku-ref" />
                                        ) : (
                                            <div className="w-24 h-24 bg-gray-50 flex items-center justify-center text-[8px] text-gray-300 italic">No Image</div>
                                        )}
                                    </td>
                                    <td className="p-4 border-r border-black align-top">
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="font-black text-[#121212] text-xs uppercase">{item.title}</p>
                                            {item.isSpf1 && (
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-red-600 text-white shrink-0">
                                                    SPF
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[9px] text-blue-600 font-bold mb-3 tracking-tighter">{item.sku}</p>
                                        {item.isSpf1 && item.procurementLeadTime && (
                                            <div className="mb-2 flex items-center gap-1.5">
                                                <span className="text-[8px] font-black uppercase tracking-widest text-gray-500">Lead Time:</span>
                                                <span className="text-[9px] font-bold text-orange-700 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded">
                                                    {item.procurementLeadTime}
                                                </span>
                                            </div>
                                        )}
                                        <div
                                            className="text-[10px] text-gray-500 leading-relaxed prose-sm max-w-none"
                                            dangerouslySetInnerHTML={{ __html: item.product_description }}
                                        />
                                        <span className="bg-orange-400 mt-2 p-1 capitalize text-red-800">{item.remarks}</span>
                                    </td>
                                    <td className="p-4 text-right border-r border-black align-top font-medium">
                                        ₱{item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-4 text-center border-r border-black align-top">
                                        {item.discount && item.discount > 0 ? (
                                            <span className="font-bold text-[#121212]">{item.discount}%</span>
                                        ) : (
                                            <span className="text-gray-400">-</span>
                                        )}
                                    </td>
                                    <td className="p-4 text-center border-r border-black align-top font-medium">
                                        {item.discount && item.discount > 0 && item.discountedAmount !== undefined ? (
                                            <span>₱{Number(item.discountedAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        ) : (
                                            <span>₱{Number(item.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        )}
                                    </td>
                                    <td className="p-4 text-center font-black align-top text-[#121212]">
                                        ₱{(item.totalAmount !== undefined ? Number(item.totalAmount) : Number(item.qty) * Number(item.unitPrice)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            ))}

                            {/* SUMMARY BAR */}
                            <tr className="border-t-2 border-black bg-white text-gray-900">
                                {/* Left: Tax Type + WHT */}
                                <td colSpan={4} className="border-r-2 border-black p-3 align-top">
                                    <div className="flex flex-col gap-2">
                                        {/* VAT Type */}
                                        <div className="flex items-center gap-3">
                                            <span className="font-bold text-red-600 italic text-[11px] uppercase whitespace-nowrap">Tax Type:</span>
                                            <div className="flex gap-3 text-[10px] font-black uppercase">
                                                {["vat_inc", "vat_exe", "zero_rated"].map((v) => (
                                                    <span key={v} className={payload.vatType === v ? "text-gray-900" : "text-gray-300"}>
                                                        {payload.vatType === v ? "●" : "○"} {v === "vat_inc" ? "VAT Inc" : v === "vat_exe" ? "VAT Exe" : "Zero-Rated"}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        {/* EWT */}
                                        {payload.whtType && payload.whtType !== "none" && (
                                            <div className="flex items-center gap-3">
                                                <span className="font-bold text-blue-600 italic text-[10px] uppercase whitespace-nowrap">Withholding:</span>
                                                <span className="text-[10px] font-black uppercase text-blue-800">● {payload.whtLabel}</span>
                                            </div>
                                        )}
                                    </div>
                                </td>

                                <td colSpan={4} className="p-0 align-top">
                                    <table className="w-full border-collapse text-[10px]">
                                        <tbody>

                                            {/* Net Sales */}
                                            <tr className="border-b border-gray-100">
                                                <td className="px-3 py-1.5 text-right font-bold uppercase border-r-2 border-black text-gray-400 text-[9px]">
                                                    Net Sales {payload.vatType === "vat_inc" ? "(VAT Inc)" : "(Non-VAT)"}
                                                </td>
                                                <td className="px-3 py-1.5 text-right font-black tabular-nums">
                                                    ₱{((payload.items || []).reduce((acc, item) => acc + (item.totalAmount !== undefined ? Number(item.totalAmount) : (Number(item.qty) || 0) * item.unitPrice), 0))
                                                        .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                            </tr>

                                            {/* Delivery Fee */}
                                            <tr className="border-b border-gray-100">
                                                <td className="px-3 py-1.5 text-right font-bold uppercase border-r-2 border-black text-gray-400 text-[9px]">
                                                    Delivery Charge
                                                </td>
                                                <td className="px-3 py-1.5 text-right font-black tabular-nums">
                                                    ₱{(Number(payload.deliveryFee) || 0)
                                                        .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                            </tr>

                                            {/* Restocking Fee */}
                                            <tr className="border-b-2 border-black">
                                                <td className="px-3 py-1.5 text-right font-bold uppercase border-r-2 border-black text-gray-400 text-[9px]">
                                                    Restocking Fee
                                                </td>
                                                <td className="px-3 py-1.5 text-right font-black tabular-nums">
                                                    ₱{(Number(payload.restockingFee) || 0)
                                                        .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                            </tr>

                                            {/* Total Invoice */}
                                            <tr className="bg-gray-50 border-b border-black">
                                                <td className="px-3 py-2 text-right font-black uppercase border-r-2 border-black text-[10px]">
                                                    Total Invoice Amount
                                                </td>
                                                <td className="px-3 py-2 text-right font-black text-[13px] text-blue-900 tabular-nums">
                                                    ₱{Number(payload.totalPrice)
                                                        .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                            </tr>

                                            {/* VAT Breakdown */}
                                            {payload.vatType === "vat_inc" && (
                                                <>
                                                    <tr className="border-b border-gray-100">
                                                        <td className="px-3 py-1.5 text-right font-bold uppercase border-r-2 border-black text-gray-400 text-[8px]">
                                                            Less: VAT (12%)
                                                        </td>
                                                        <td className="px-3 py-1.5 text-right font-bold text-gray-400 tabular-nums">
                                                            ₱{(Number(payload.totalPrice) * (12 / 112))
                                                                .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </td>
                                                    </tr>

                                                    <tr className={payload.whtType && payload.whtType !== "none"
                                                        ? "border-b border-gray-100"
                                                        : "border-b-2 border-black"}>
                                                        <td className="px-3 py-1.5 text-right font-bold uppercase border-r-2 border-black text-gray-400 text-[8px]">
                                                            Net of VAT (Tax Base)
                                                        </td>
                                                        <td className="px-3 py-1.5 text-right font-bold text-gray-400 tabular-nums">
                                                            ₱{(Number(payload.totalPrice) / 1.12)
                                                                .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </td>
                                                    </tr>

                                                    {payload.whtType && payload.whtType !== "none" && (
                                                        <tr className="border-b-2 border-black bg-blue-50">
                                                            <td className="px-3 py-2 text-right font-black uppercase border-r-2 border-black text-blue-700 text-[8px]">
                                                                Less: {payload.whtLabel}
                                                            </td>
                                                            <td className="px-3 py-2 text-right font-black text-blue-700 tabular-nums">
                                                                − ₱{(Number(payload.whtAmount) || 0)
                                                                    .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </td>
                                                        </tr>
                                                    )}
                                                </>
                                            )}

                                            {/* Non-VAT */}
                                            {payload.vatType !== "vat_inc" && (
                                                <tr className="border-b-2 border-black">
                                                    <td className="px-3 py-1.5 text-right font-bold uppercase border-r-2 border-black text-gray-400 text-[8px]">
                                                        Tax Status
                                                    </td>
                                                    <td className="px-3 py-1.5 text-right font-bold text-gray-400 italic">
                                                        {payload.vatType === "vat_exe" ? "VAT Exempt" : "Zero-Rated"}
                                                    </td>
                                                </tr>
                                            )}

                                            {/* Final Total */}
                                            <tr className="bg-gray-900 text-white">
                                                <td className="px-3 py-3 text-right font-black uppercase border-r border-gray-700 text-[10px] tracking-tight">
                                                    {payload.whtType && payload.whtType !== "none"
                                                        ? "Net Amount to Collect"
                                                        : "Total Amount Due"}
                                                </td>
                                                <td className="px-3 py-3 text-right font-black text-[15px] tabular-nums">
                                                    ₱{(Number(payload.netAmountToCollect ?? payload.totalPrice))
                                                        .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                            </tr>

                                        </tbody>
                                    </table>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* 1. PRODUCT VARIANCE FOOTNOTE */}
                <div className="mt-4 text-[10px] font-black uppercase tracking-tight border-b border-black pb-1">
                    *PHOTO MAY VARY FROM ACTUAL UNIT
                </div>

                {/* 2. LOGISTICS & NOTES GRID */}
                <div className="mt-4 border border-black text-[9.5px] leading-tight">
                    <div className="grid grid-cols-6 border-b border-black">
                        <div className="col-span-1 p-2 bg-yellow-400 font-black border-r border-black">Included:</div>
                        <div className="col-span-5 p-2 bg-yellow-100">
                            <p>Orders Within Metro Manila: Free delivery for a minimum sales transaction of ₱5,000.</p>
                            <p>Orders outside Metro Manila Free delivery is available for a minimum sales transaction of ₱10,000 in Rizal, ₱15,000 in Bulacan and Cavite, and ₱25,000 in Laguna, Pampanga, and Batangas.</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-6 border-b border-black">
                        <div className="col-span-1 p-2 bg-yellow-400 font-black border-r border-black">Excluded:</div>
                        <div className="col-span-5 p-2 bg-yellow-100">
                            <p>All lamp poles are subject to a delivery charge.</p>
                            <p>Installation and all hardware/accessories not indicated above.</p>
                            <p>Freight charges, arrastre, and other processing fees.</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-6 bg-yellow-50">
                        <div className="col-span-1 p-2 font-black border-r border-black">Notes:</div>
                        <div className="col-span-5 p-2 italic">
                            <p>Deliveries are up to the vehicle unloading point only.</p>
                            <p>Additional shipping fee applies for other areas not mentioned above.</p>
                            <p>Subject to confirmation upon getting the actual weight and dimensions of the items.</p>
                            <span className="font-black underline block mt-1 text-red-600">In cases of client error, there will be a 10% restocking fee for returns, refunds, and exchanges.</span>
                        </div>
                    </div>
                </div>

                {/* 3. EXTENDED TERMS & CONDITIONS */}
                <div className="mt-6 border-t-2 border-black pt-2">
                    <h3 className="bg-[#121212] text-white px-3 py-1 text-[10px] font-black inline-block mb-4 uppercase">Terms and Conditions</h3>

                    <div className="grid grid-cols-12 gap-y-4 text-[9px]">
                        <div className="col-span-2 font-black uppercase">Availability:</div>
                        <div className="col-span-10 pl-4 border-l border-gray-100 bg-yellow-50">
                            <p>*5-7 days if on stock upon receipt of approved PO.</p>
                            <p>*For items not on stock/indent order, an estimate of 45-60 days upon receipt of approved PO & down payment. Barring any delay in shipping and customs clearance beyond Disruptive's control.</p>
                            <p>*In the event of a conflict or inconsistency in estimated days under Availability and another estimate indicated elsewhere in this quotation, the latter will prevail.</p>
                        </div>

                        <div className="col-span-2 font-black uppercase">Warranty:</div>
                        <div className="col-span-10 pl-4 border-l border-gray-100 bg-yellow-50">
                            <p><b>Regular Item:</b> One (1) year from the time of delivery for all busted lights except the damaged fixture.</p>
                            <p><b>Promo Item:</b> Three (3) months from the time of delivery for all busted lights except the damaged fixture.</p>
                            <p>The warranty will be VOID under the following circumstances:</p>
                            <p>*If the unit is being tampered with.</p>
                            <p>*If the item(s) is/are altered in any way by unauthorized technicians.</p>
                            <p>*If it has been subjected to misuse, mishandling, neglect, or accident.</p>
                            <p>*If damaged due to spillage of liquids, tear corrosion, rusting, or stains.</p>
                            <p>*This warranty does not cover loss of product accessories such as remote control, adaptor, battery, screws, etc.</p>
                            <p>*Shipping costs for warranty claims are for customers' account.</p>
                            <p>*If the product purchased is already phased out when the warranty is claimed, the latest model or closest product SKU will be given as a replacement.</p>
                        </div>

                        <div className="col-span-2 font-black uppercase">SO Validity:</div>
                        <div className="col-span-10 pl-4 border-l border-gray-100">
                            <p>Sales order has <span className="text-red-600 font-black italic">validity period of 14 working days</span>. (excluding holidays and Sundays) from the date of issuance. Any sales order not confirmed and no verified payment within this <span className="text-red-600 font-black">14-day period will be automatically cancelled</span>.</p>
                        </div>

                        <div className="col-span-2 font-black uppercase">Storage:</div>
                        <div className="col-span-10 pl-4 border-l border-gray-100 bg-yellow-50">
                            <p>Orders with confirmation/verified payment but undelivered after 14 working days (excluding holidays and Sundays starting from picking date) due to clients’ request or shortcomings will be charged a storage fee of 10% of the value of the orders per month <span className="text-red-600 font-black"> (10% / 30 days =  0.33% per day)</span>.</p>
                        </div>

                        <div className="col-span-2 font-black uppercase">Return:</div>
                        <div className="col-span-10 pl-4 border-l border-gray-100 bg-yellow-50">
                            <p><span className="text-red-600 font-black"><u>7 days return policy - </u></span>if the product received is defective, damaged, or incomplete. This must be communicated to Disruptive, and Disruptive has duly acknowledged communication as received within a maximum of 7 days to qualify for replacement.</p>
                        </div>

                        {/* <div className="col-span-2 font-black uppercase">Bank Details:</div> */}
                        <div className="col-span-2 font-black uppercase">Payment:</div>
                        <div className="col-span-10 pl-4 border-l border-gray-100 ">
                            <p><span className="text-red-600 font-black">Cash on Delivery (COD)</span></p>
                            <p><strong>NOTE: Orders below 10,000 pesos can be paid in cash at the time of delivery. Exceeding 10,000 pesos should be transacted through bank deposit or mobile electronic transactions.</strong></p>
                            <p>For special items,  Seventy Percent (70%) down payment, 30% upon delivery.</p>
                            <p className="mt-5"><b>BANK DETAILS</b></p>
                            <p className="mb-5"><strong>Payee to: <b>{isEcoshift ? 'ECOSHIFT CORPORATION' : 'DISRUPTIVE SOLUTIONS INC.'}</b></strong></p>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="font-black">BANK: METROBANK</p>
                                    <p>Account Name: {isEcoshift ? 'ECOSHIFT CORPORATION' : 'DISRUPTIVE SOLUTIONS INC.'}</p>
                                    <p>Account Number: {isEcoshift ? '243-7-243805100' : '243-7-24354164-2'}</p>
                                </div>
                                <div>
                                    <p className="font-black">BANK: BDO</p>
                                    <p>Account Name: {isEcoshift ? 'ECOSHIFT CORPORATION' : 'DISRUPTIVE SOLUTIONS INC.'}</p>
                                    <p>Account Number: {isEcoshift ? '0021-8801-7271' : '0021-8801-9258'}</p>
                                </div>
                            </div>
                        </div>

                        <div className="col-span-2 font-black uppercase">DELIVERY:</div>
                        <div className="col-span-10 pl-4 border-l border-gray-100 bg-yellow-50">
                            <p>Delivery/Pick up is subject to confirmation.</p>
                        </div>

                        <div className="col-span-2 font-black uppercase">Validity:</div>
                        <div className="col-span-10 pl-4 border-l border-gray-100">
                            <p className="text-red-600 font-black underline">Thirty (30) calendar days from the date of this offer.</p>
                            <p>In the event of changes in prevailing market conditions, duties, taxes, and all other importation charges, quoted prices are subject to change.</p>
                        </div>

                        <div className="col-span-2 font-black uppercase">CANCELLATION:</div>
                        <div className="col-span-10 pl-4 border-l border-gray-100 bg-yellow-50">
                            <p>1. Above quoted items are non-cancellable.</p>
                            <p>2. If the customer cancels the order under any circumstances, the client shall be responsible for 100% cost incurred by Disruptive, including freight and delivery charges.</p>
                            <p>3. Downpayment for items not in stock/indent and order/special items are non-refundable and will be forfeited if the order is canceled.</p>
                            <p>4. COD transaction payments should be ready upon delivery. If the payment is not ready within seven (7) days from the date of order, the transaction is automatically canceled.</p>
                            <p>5. Cancellation for Special Projects (SPF) are not allowed and will be subject to a 100% charge.</p>
                        </div>
                    </div>
                </div>

                {/* 4. OFFICIAL SIGNATURE HIERARCHY */}
                <div className="mt-12 pt-4 border-t-4 border-blue-700 pb-20">
                    <p className="text-[9px] mb-8 font-medium">
                        Thank you for allowing us to service your requirements. We hope that the above offer merits your acceptance.
                        Unless otherwise indicated, you are deemed to have accepted the Terms and Conditions of this Quotation.
                    </p>

                    <div className="grid grid-cols-2 gap-x-20 gap-y-12">
                        {/* Left Side: Internal Team */}
                        <div className="space-y-10">
                            <div>
                                <p className="italic text-[10px] font-black mb-10">{isEcoshift ? 'Ecoshift Corporation' : 'Disruptive Solutions Inc'}</p>
                                {payload.agentSignature ? (
                                    <div className="relative inline-block">
                                        <img
                                            src={payload.agentSignature}
                                            alt="Agent Signature"
                                            className="w-40 h-20 object-contain flex align-items center justify-center mb-2 border-none"
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <span className="text-[10px] font-black text-[#121212] opacity-[0.03] rotate-[-15deg] uppercase tracking-[0.5em]">
                                                Official Verified
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-[9px] text-gray-500 italic mb-2">No signature available</p>
                                )}
                                <p className="text-[11px] font-black uppercase mt-1">{payload.salesRepresentative}</p>
                                <div className="border-b border-black w-64"></div>
                                <p className="text-[9px] font-bold text-gray-500 mt-1 uppercase tracking-widest">Sales Representative</p>
                                <p className="text-[9px] text-gray-500 font-bold italic">Mobile: {payload.agentContactNumber || "N/A"}</p>
                                <p className="text-[9px] text-gray-500 font-bold italic">Email: {payload.agentEmailAddress || "N/A"}</p>
                            </div>

                            <div>
                                <p className="text-[10px] font-black uppercase text-gray-400 mb-10">Approved By:</p>
                                {payload.TsmSignature ? (
                                    <div className="relative inline-block">
                                        <img
                                            src={payload.TsmSignature}
                                            alt="Agent Signature"
                                            className="w-40 h-20 object-contain flex align-items center justify-center mb-2 border-none"
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <span className="text-[10px] font-black text-[#121212] opacity-[0.03] rotate-[-15deg] uppercase tracking-[0.5em]">
                                                Official Verified
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-[9px] text-gray-500 italic mb-2">No signature available</p>
                                )}
                                <p className="text-[11px] font-black uppercase mt-1">{payload.salestsmname || "—"}</p>
                                <div className="border-b border-black w-64"></div>
                                <p className="text-[9px] font-bold text-gray-500 mt-1 uppercase tracking-widest">Territory Sales Manager</p>
                                <p className="text-[9px] text-gray-500 font-bold italic">Mobile: {payload.TsmContactNumber || "N/A"}</p>
                                <p className="text-[9px] text-gray-500 font-bold italic">Email: {payload.TsmEmailAddress || "N/A"}</p>
                            </div>

                            <div>
                                <p className="text-[10px] font-black uppercase text-gray-400 mb-10">Noted By:</p>
                                {payload.ManagerSignature ? (
                                    <div className="relative inline-block">
                                        <img
                                            src={payload.ManagerSignature}
                                            alt="Agent Signature"
                                            className="w-40 h-20 object-contain flex align-items center justify-center mb-2 border-none"
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <span className="text-[10px] font-black text-[#121212] opacity-[0.03] rotate-[-15deg] uppercase tracking-[0.5em]">
                                                Official Verified
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-[9px] text-gray-500 italic mb-2">No signature available</p>
                                )}
                                <p className="text-[11px] font-black uppercase mt-1">{payload.salesmanagername || "—"}</p>
                                <div className="border-b border-black w-64"></div>
                                <p className="text-[9px] font-bold text-gray-500 mt-1 uppercase tracking-widest">Sales-B2B</p>
                                <p className="text-[9px] text-gray-500 font-bold italic">Mobile: {payload.ManagerContactNumber || "N/A"}</p>
                                <p className="text-[9px] text-gray-500 font-bold italic">Email: {payload.ManagerEmailAddress || "N/A"}</p>
                                {/* <p className="text-[9px] font-black uppercase tracking-tighter">SALES HEAD</p> */}
                            </div>
                        </div>

                        {/* Right Side: Client Side */}
                        <div className="space-y-10 flex flex-col items-end">
                            {/* Company Authorized Representative */}
                            <div className="w-64 text-center">
                                <p className="text-[10px] font-black uppercase mb-1">{payload.attention || "—"}</p>
                                <div className="border-b border-black w-64" />
                                <p className="text-[9px] font-bold text-gray-500 mt-1 uppercase tracking-widest leading-none">
                                    Company Authorized Representative
                                </p>
                                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest leading-none">
                                    (PLEASE SIGN OVER PRINTED NAME)
                                </p>
                            </div>

                            {/* Payment Release Date */}
                            <div className="w-64 text-center">
                                <div className="border-b border-black w-64 mt-12" />
                                <p className="text-[9px] font-bold text-gray-500 mt-1 uppercase tracking-widest">
                                    Payment Release Date
                                </p>
                            </div>

                            {/* Position in the Company */}
                            <div className="w-64 text-center">
                                <div className="border-b border-black w-64 mt-12" />
                                <p className="text-[9px] font-bold text-gray-500 mt-1 uppercase tracking-widest">
                                    Position in the Company
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── DOCUMENT SECURITY MICRO-FOOTER ───────────────────────────────────── */}
            <div className="mx-12 mb-8 border-t border-dashed border-gray-300 pt-3 flex items-center justify-between gap-4">
                <div className="flex flex-col">
                    <p className="text-[8px] text-gray-400 font-medium leading-relaxed">
                        Document ID: <span className="font-black text-gray-500">{payload.referenceNo}</span>
                        &nbsp;·&nbsp; Issued: {securityTimestamp}
                        &nbsp;·&nbsp; {companyLabel}
                    </p>
                    <p className="text-[8px] text-gray-400 italic shrink-0 mt-1">
                        This document is only valid when downloaded from Taskflow.
                    </p>
                </div>

                {qrDataUrl && (
                    <div className="flex flex-col items-center">
                        <img src={qrDataUrl} alt="Verification QR" className="w-20 h-20 opacity-80 mix-blend-multiply" />
                        <span className="text-[6px] font-black text-gray-300 uppercase tracking-widest mt-1">Verify Authenticity</span>
                    </div>
                )}
            </div>

            {/* ACTION BUTTONS BAR */}
            <div className="p-8 bg-white border-t border-gray-100 flex justify-between items-center sticky bottom-0 z-50">
                <Button
                    variant="outline"
                    onClick={() => setIsPreviewOpen(false)}
                    className="rounded-none border-2 border-[#121212] font-black uppercase text-[10px] px-8 h-12 hover:bg-gray-50 transition-all"
                >
                    Back to Editor
                </Button>
            </div>
        </div>
    );
};