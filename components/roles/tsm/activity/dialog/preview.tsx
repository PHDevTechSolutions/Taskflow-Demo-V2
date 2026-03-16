"use client";

import React from "react";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Item = {
    itemNo: number | string;
    qty: number | string;
    photo?: string;
    title: string;
    sku: string;
    product_description: string;
    unitPrice: number;
    totalAmount: number;
    remarks: string;
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
    vatTypeLabel: string;
    vatType: string;
    deliveryFee: string;
    salesManagerContact?: string;
    salesManagerEmail?: string;

    // Signatories
    agentName?: string | null;
    agentSignature?: string | null;
    agentContactNumber?: string | null;
    agentEmailAddress?: string | null;
    tsmName?: string | null;

    signature?: string | null;
    tsmcontact?: string | null;
    tsmemail?: string | null;
};

type PreviewProps = {
    payload: Payload;
    quotationType: string;
    setIsPreviewOpen: (open: boolean) => void;
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

const TaxOption = ({
    label,
    active,
}: {
    label: string;
    active: boolean;
}) => (
    <span className={`flex items-center gap-1 ${active ? "text-gray-900 font-black" : "text-gray-400 font-medium"}`}>
        <span className="text-[14px] leading-none">{active ? "●" : "○"}</span>
        {label}
    </span>
);

// ─── Component ─────────────────────────────────────────────────────────────────

export const Preview: React.FC<PreviewProps> = ({ payload, quotationType }) => {
    const isEcoshift = quotationType === "Ecoshift Corporation";
    const headerImagePath = isEcoshift ? "/ecoshift-banner.png" : "/disruptive-banner.png";
    const companyName = isEcoshift ? "ECOSHIFT CORPORATION" : "DISRUPTIVE SOLUTIONS INC.";

    return (
        <div className="flex flex-col bg-white min-h-full font-sans text-[#121212] text-[11px]">

            {/* ── HEADER ─────────────────────────────────────────────────────── */}
            <div className="w-full border-b border-gray-100">
                <div className="w-full h-[100px] relative overflow-hidden">
                    <img
                        key={quotationType}
                        src={headerImagePath}
                        alt={`${quotationType} Header`}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                            e.currentTarget.style.display = "none";
                            const p = e.currentTarget.parentElement;
                            if (p) {
                                p.innerHTML = `<div class="w-full h-full bg-[#121212] flex flex-col items-center justify-center text-white">
                  <span class="font-black text-xl tracking-[0.2em] uppercase">${companyName}</span>
                  <span class="text-[9px] tracking-[0.5em] font-light opacity-60">OFFICIAL QUOTATION</span>
                </div>`;
                            }
                        }}
                    />
                </div>
            </div>

            <div className="px-10 py-6 space-y-5">

                {/* ── REFERENCE & DATE ─────────────────────────────────────────── */}
                <div className="text-right space-y-0.5">
                    {[
                        { label: "Reference No", value: payload.referenceNo },
                        { label: "Date", value: payload.date },
                    ].map(({ label, value }) => (
                        <p key={label} className="flex justify-end gap-2 text-[10px]">
                            <span className="font-black text-gray-800 uppercase">{label}:</span>
                            <span className="text-gray-500">{value}</span>
                        </p>
                    ))}
                </div>

                {/* ── CLIENT INFO ───────────────────────────────────────────────── */}
                <div className="border-l border-r border-black">
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
                            className={`flex items-center px-4 py-1.5 min-h-[28px]
                ${info.borderTop ? "border-t border-black" : ""}
                ${info.borderBottom ? "border-b border-black" : ""}`}
                        >
                            <span className="w-36 shrink-0 font-black text-[10px] text-gray-800 uppercase">{info.label}:</span>
                            <span className="flex-1 font-semibold text-gray-600 pl-3 text-[10px] uppercase">{info.value || "—"}</span>
                        </div>
                    ))}
                </div>

                <p className="text-[10px] italic text-gray-400 font-medium">
                    We are pleased to offer you the following products for consideration:
                </p>

                {/* ── ITEMS TABLE ───────────────────────────────────────────────── */}
                <div className="border border-black overflow-hidden">
                    <table className="w-full text-[10px] border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-black">
                                {["ITEM NO", "QTY", "REFERENCE PHOTO", "PRODUCT DESCRIPTION", "UNIT PRICE", "TOTAL AMOUNT"].map((h, i) => (
                                    <th
                                        key={h}
                                        className={`p-2.5 font-black uppercase text-[9px] text-gray-700
                      ${i < 5 ? "border-r border-black" : ""}
                      ${i === 0 || i === 1 ? "w-14 text-center" : ""}
                      ${i === 2 ? "w-28 text-center" : ""}
                      ${i === 4 || i === 5 ? "w-28 text-right" : "text-left"}`}
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {payload.items.map((item, idx) => (
                                <tr key={idx} className="border-b border-black last:border-b-0 hover:bg-gray-50/40 transition-colors">
                                    <td className="p-3 text-center border-r border-black align-top font-bold text-gray-400">
                                        {item.itemNo}
                                    </td>
                                    <td className="p-3 text-center border-r border-black align-top font-black text-gray-800">
                                        {item.qty}
                                    </td>
                                    <td className="p-2 border-r border-black align-top bg-white">
                                        {item.photo ? (
                                            <img
                                                src={item.photo}
                                                className="w-20 h-20 object-contain mx-auto mix-blend-multiply"
                                                alt="product"
                                            />
                                        ) : (
                                            <div className="w-20 h-20 bg-gray-50 flex items-center justify-center text-[8px] text-gray-300 italic mx-auto">
                                                No Image
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-3 border-r border-black align-top">
                                        <p className="font-black text-[10px] uppercase mb-1 text-gray-900">{item.title}</p>
                                        <p className="text-[9px] text-blue-600 font-bold mb-2 tracking-tight">{item.sku}</p>
                                        <div
                                            className="text-[9px] text-gray-500 leading-relaxed"
                                            dangerouslySetInnerHTML={{ __html: item.product_description }}
                                        />
                                        {item.remarks && (
                                            <span className="inline-block mt-1.5 bg-orange-400 px-1.5 py-0.5 text-[8px] font-bold text-red-900 uppercase">
                                                {item.remarks}
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-3 text-right border-r border-black align-top tabular-nums">
                                        ₱{item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-3 text-right align-top font-black tabular-nums text-gray-900">
                                        ₱{item.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            ))}

                            {/* Tax type row */}
                            <tr className="bg-gray-200 border-t-2 border-black h-10">
                                <td colSpan={2} className="border-r border-gray-400" />
                                <td className="px-3 border-r border-gray-400">
                                    <span className="text-red-600 italic font-black text-[12px]">Tax Type:</span>
                                </td>
                                <td className="px-3 border-r border-gray-400">
                                    <div className="flex gap-4 text-[10px] uppercase font-bold">
                                        <TaxOption label="VAT Inc" active={payload.vatType === "vat_inc"} />
                                        <TaxOption label="VAT Exe" active={payload.vatType === "vat_exe"} />
                                        <TaxOption label="Zero-Rated" active={payload.vatType === "zero_rated"} />
                                    </div>
                                </td>
                                <td className="px-3 text-right border-r border-gray-400 font-semibold text-[9px] uppercase text-gray-600">
                                    Delivery Fee:
                                </td>
                                <td className="px-3 text-right font-black text-[12px] tabular-nums">
                                    ₱{payload.deliveryFee}
                                </td>
                            </tr>

                            {/* Grand total row */}
                            <tr className="bg-gray-200 border-t border-gray-300 h-10">
                                <td colSpan={4} className="border-r border-gray-400" />
                                <td className="px-3 text-right border-r border-gray-400 font-semibold text-[9px] uppercase text-gray-600">
                                    Grand Total:
                                </td>
                                <td className="px-3 text-right font-black text-[13px] text-emerald-700 tabular-nums">
                                    ₱{payload.totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* ── FOOTNOTE ─────────────────────────────────────────────────── */}
                <p className="text-[9px] font-black uppercase tracking-tight border-b border-black pb-1 mt-3">
                    *PHOTO MAY VARY FROM ACTUAL UNIT
                </p>

                {/* ── LOGISTICS ─────────────────────────────────────────────────── */}
                <div className="border border-black text-[9px] leading-snug">
                    {[
                        {
                            label: "Included:",
                            content: (
                                <>
                                    <p>Orders within Metro Manila: Free delivery for minimum ₱5,000.</p>
                                    <p className="mt-1">Outside Metro Manila: Free delivery from ₱10,000 (Rizal), ₱15,000 (Bulacan/Cavite), ₱25,000 (Laguna/Pampanga/Batangas).</p>
                                </>
                            ),
                            yellow: true,
                        },
                        {
                            label: "Excluded:",
                            content: (
                                <>
                                    <p>All lamp poles subject to delivery charge.</p>
                                    <p>Installation and hardware/accessories not indicated above.</p>
                                    <p>Freight charges, arrastre, and processing fees.</p>
                                </>
                            ),
                            yellow: true,
                        },
                        {
                            label: "Notes:",
                            content: (
                                <>
                                    <p className="italic">Deliveries are up to the vehicle unloading point only.</p>
                                    <p className="italic">Additional shipping fee applies for other areas.</p>
                                    <p className="italic">Subject to confirmation upon getting actual weight/dimensions.</p>
                                    <p className="font-black text-red-600 underline mt-1">
                                        In cases of client error, there will be a 10% restocking fee for returns, refunds, and exchanges.
                                    </p>
                                </>
                            ),
                            yellow: false,
                        },
                    ].map(({ label, content, yellow }, i, arr) => (
                        <div
                            key={label}
                            className={`flex ${i < arr.length - 1 ? "border-b border-black" : ""}`}
                        >
                            <div className={`w-24 shrink-0 p-2 font-black border-r border-black ${yellow ? "bg-yellow-400" : ""}`}>
                                {label}
                            </div>
                            <div className={`flex-1 p-2 ${yellow ? "bg-yellow-100" : "bg-yellow-50"}`}>
                                {content}
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── TERMS & CONDITIONS ───────────────────────────────────────── */}
                <div className="border-t-2 border-black pt-3">
                    <span className="bg-gray-900 text-white px-3 py-1 text-[9px] font-black inline-block mb-4 uppercase tracking-wider">
                        Terms and Conditions
                    </span>

                    <div className="grid grid-cols-12 gap-y-3 text-[9px] leading-snug">
                        {[
                            {
                                label: "Availability",
                                content: (
                                    <div className="bg-yellow-50 p-2">
                                        <p>*5-7 days if on stock upon receipt of approved PO.</p>
                                        <p>*Indent orders: 45-60 days upon receipt of approved PO & down payment.</p>
                                        <p>*In conflict of estimates, the latter will prevail.</p>
                                    </div>
                                ),
                            },
                            {
                                label: "Warranty",
                                content: (
                                    <div className="bg-yellow-50 p-2">
                                        <p>One (1) year from delivery for all busted lights except damaged fixture.</p>
                                        <p className="mt-1">VOID if: tampered, altered by unauthorized technicians, subjected to misuse/neglect/accident, liquid damage.</p>
                                        <p>*Shipping costs for warranty claims are for customers' account.</p>
                                    </div>
                                ),
                            },
                            {
                                label: "SO Validity",
                                content: (
                                    <p>
                                        Sales order valid for <span className="text-red-600 font-black">14 working days</span> from issuance.
                                        Unconfirmed orders within this period are <span className="text-red-600 font-black">automatically cancelled</span>.
                                    </p>
                                ),
                            },
                            {
                                label: "Storage",
                                content: (
                                    <div className="bg-yellow-50 p-2">
                                        <p>
                                            Undelivered confirmed orders after 14 working days charged
                                            <span className="text-red-600 font-black"> 10% storage fee/month (0.33%/day)</span>.
                                        </p>
                                    </div>
                                ),
                            },
                            {
                                label: "Return",
                                content: (
                                    <div className="bg-yellow-50 p-2">
                                        <p>
                                            <span className="text-red-600 font-black underline">7-day return policy</span> for defective, damaged, or incomplete products —
                                            must be communicated within 7 days.
                                        </p>
                                    </div>
                                ),
                            },
                            {
                                label: "Payment",
                                content: (
                                    <div className="p-2">
                                        <p><span className="text-red-600 font-black">Cash on Delivery (COD)</span></p>
                                        <p className="font-semibold mt-1">
                                            Orders below ₱10,000: cash on delivery accepted. Above ₱10,000: bank deposit or e-payment required.
                                        </p>
                                        <p className="mt-1">For special items: 70% down payment, 30% upon delivery.</p>
                                        <p className="font-black mt-3">BANK DETAILS — Payee: {companyName}</p>
                                        <div className="grid grid-cols-2 gap-4 mt-2">
                                            <div>
                                                <p className="font-black">METROBANK</p>
                                                <p>Account Name: {companyName}</p>
                                                <p>Account No: {isEcoshift ? "243-7-243805100" : "243-7-24354164-2"}</p>
                                            </div>
                                            <div>
                                                <p className="font-black">BDO</p>
                                                <p>Account Name: {companyName}</p>
                                                <p>Account No: {isEcoshift ? "0021-8801-7271" : "0021-8801-9258"}</p>
                                            </div>
                                        </div>
                                    </div>
                                ),
                            },
                            {
                                label: "Delivery",
                                content: (
                                    <div className="bg-yellow-50 p-2">
                                        <p>Delivery/Pick up is subject to confirmation.</p>
                                    </div>
                                ),
                            },
                            {
                                label: "Validity",
                                content: (
                                    <p>
                                        <span className="text-red-600 font-black underline">Thirty (30) calendar days</span> from the date of this offer.
                                        Quoted prices subject to change with market conditions.
                                    </p>
                                ),
                            },
                            {
                                label: "Cancellation",
                                content: (
                                    <div className="bg-yellow-50 p-2 space-y-0.5">
                                        <p>1. Quoted items are non-cancellable.</p>
                                        <p>2. Client responsible for 100% of costs incurred if cancelled.</p>
                                        <p>3. Downpayment for indent/special items is non-refundable.</p>
                                        <p>4. COD payment must be ready within 7 days or order is auto-cancelled.</p>
                                        <p>5. Special Projects (SPF) cancellations subject to 100% charge.</p>
                                    </div>
                                ),
                            },
                        ].map(({ label, content }) => (
                            <React.Fragment key={label}>
                                <div className="col-span-2 font-black uppercase pt-1">{label}:</div>
                                <div className="col-span-10 pl-3 border-l border-gray-100">{content}</div>
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                {/* ── SIGNATURE HIERARCHY ───────────────────────────────────────── */}
                <div className="mt-10 pt-4 border-t-4 border-blue-700 pb-16">
                    <p className="text-[9px] mb-8 text-gray-600 leading-relaxed font-medium">
                        Thank you for allowing us to service your requirements. We hope that the above offer merits your acceptance.
                        Unless otherwise indicated, you are deemed to have accepted the Terms and Conditions of this Quotation.
                    </p>

                    <div className="grid grid-cols-2 gap-x-16 gap-y-10">
                        {/* Left: Internal */}
                        <div className="space-y-10">
                            {/* Sales Rep */}
                            <div>
                                <p className="italic text-[10px] font-black mb-8">
                                    {isEcoshift ? "Ecoshift Corporation" : "Disruptive Solutions Inc"}
                                </p>
                                {payload.agentSignature ? (
                                    <img
                                        src={payload.agentSignature}
                                        alt="Agent Signature"
                                        className="h-14 object-contain mb-1"
                                    />
                                ) : (
                                    <div className="h-14 flex items-end">
                                        <p className="text-[9px] text-gray-300 italic">No signature on file</p>
                                    </div>
                                )}
                                <p className="text-[10px] font-black uppercase mt-1">{payload.agentName || "—"}</p>
                                <div className="border-b border-black w-56 mt-0.5" />
                                <p className="text-[9px] font-bold text-gray-400 mt-1 uppercase tracking-widest">Sales Representative</p>
                                <p className="text-[9px] text-gray-400 italic">Mobile: {payload.agentContactNumber || "N/A"}</p>
                                <p className="text-[9px] text-gray-400 italic">Email: {payload.agentEmailAddress || "N/A"}</p>
                            </div>

                            {/* Approver */}
                            <div>
                                <p className="text-[9px] font-black uppercase text-gray-400 mb-8">Approved By:</p>
                                {payload.signature ? (
                                    <img
                                        src={payload.signature}
                                        alt="TSM Signature"
                                        className="h-14 object-contain mb-1"
                                    />
                                ) : (
                                    <div className="h-14 flex items-end">
                                        <p className="text-[9px] text-gray-300 italic">No signature on file</p>
                                    </div>
                                )}
                                <p className="text-[10px] font-black uppercase mt-1">{payload.tsmName || "—"}</p>
                                <div className="border-b border-black w-56 mt-0.5" />
                                <p className="text-[9px] font-bold text-gray-400 mt-1 uppercase tracking-widest">Territory Sales Manager</p>
                                <p className="text-[9px] text-gray-400 italic">Mobile: {payload.tsmcontact || "N/A"}</p>
                                <p className="text-[9px] text-gray-400 italic">Email: {payload.tsmemail || "N/A"}</p>
                            </div>

                            {/* Noted By */}
                            <div>
                                <p className="text-[9px] font-black uppercase text-gray-400 mb-8">Noted By:</p>
                                <p className="text-[10px] font-black uppercase mt-1">{payload.salesmanagername || "—"}</p>
                                <div className="border-b border-black w-56 mt-0.5" />
                                <p className="text-[9px] font-bold text-gray-400 mt-1 uppercase tracking-widest">Sales-B2B</p>
                            </div>
                        </div>

                        {/* Right: Client */}
                        <div className="flex flex-col items-end gap-10">
                            {[
                                "Company Authorized Representative\n(PLEASE SIGN OVER PRINTED NAME)",
                                "Payment Release Date",
                                "Position in the Company",
                            ].map((label) => (
                                <div key={label} className="w-60">
                                    <div className="border-b border-black w-60 mt-16" />
                                    {label.split("\n").map((line, i) => (
                                        <p
                                            key={i}
                                            className="text-[8px] text-center font-bold text-gray-400 mt-1 uppercase tracking-widest"
                                        >
                                            {line}
                                        </p>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};