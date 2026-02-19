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
    description: string;
    unitPrice: number;
    totalAmount: number;
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
    salestsmcontact?: string;
    salestsmemail?: string;
    items: Item[];
    totalPrice: number;
    vatTypeLabel: string;
};

type PreviewProps = {
    payload: Payload;
    quotationType: string;
    setIsPreviewOpen: (open: boolean) => void;
    DownloadPDF: () => void;
};

export const Preview: React.FC<PreviewProps> = ({
    payload,
    quotationType,
    setIsPreviewOpen,
    DownloadPDF,
}) => {
    const isEcoshift = quotationType === "Ecoshift Corporation";
    const headerImagePath = isEcoshift
        ? "/ecoshift-banner.png"
        : "/disruptive-banner.png";

    return (
        <div className="flex flex-col bg-white min-h-full font-sans text-[#121212]">
            <div id="printable-protocol-area" className="p-12 text-[#121212] bg-white">
                {/* CORPORATE BRANDING HEADER */}
                <div className="w-full flex justify-center py-6 border-b border-gray-100 bg-white">
                    <div className="w-full max-w-[900px] h-[110px] relative flex items-center justify-center overflow-hidden">
                        <img
                            key={quotationType}
                            src={headerImagePath}
                            alt={`${quotationType} Header`}
                            className="w-full h-full object-contain"
                            onError={(e) => {
                                e.currentTarget.style.display = "none";
                                const parent = e.currentTarget.parentElement;
                                if (parent) {
                                    parent.innerHTML = `
                    <div class="w-full h-full bg-[#121212] flex flex-col items-center justify-center text-white">
                      <span class="font-black text-2xl tracking-[0.2em] uppercase">${isEcoshift ? "ECOSHIFT CORPORATION" : "DISRUPTIVE SOLUTIONS INC."
                                        }</span>
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
                        <p className="flex justify-end gap-2">
                            <span className="font-black text-[#121212]">Region:</span>
                            <span className="text-gray-600">{payload.date}</span>
                        </p>
                    </div>

                    {/* CLIENT INFORMATION GRID */}
                    <div className="mt-8 border-l border-r border-black">
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
                                className={`grid grid-cols-6 py-2 px-4 items-center min-h-[35px]
                  ${info.borderTop ? "border-t border-black" : ""} 
                  ${info.borderBottom ? "border-b border-black" : ""}`}
                            >
                                <span className="col-span-1 font-black text-[10px] text-[#121212]">{info.label}:</span>
                                <span className="col-span-5 text-[11px] font-bold text-gray-700 pl-4">{info.value || "---"}</span>
                            </div>
                        ))}
                    </div>

                    <p className="text-[10px] italic py-8 text-gray-500 font-medium">
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
                                    <th className="p-3 border-r border-black w-32 text-right">UNIT PRICE</th>
                                    <th className="p-3 w-32 text-right">TOTAL AMOUNT</th>
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
                                            <p className="font-black text-[#121212] text-xs uppercase mb-1">{item.title}</p>
                                            <p className="text-[9px] text-blue-600 font-bold mb-3 tracking-tighter">{item.sku}</p>
                                            <div
                                                className="text-[10px] text-gray-500 leading-relaxed prose-sm max-w-none"
                                                dangerouslySetInnerHTML={{ __html: item.description }}
                                            />
                                        </td>
                                        <td className="p-4 text-right border-r border-black align-top font-medium">
                                            ₱{item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="p-4 text-right font-black align-top text-[#121212]">
                                            ₱{item.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                ))}

                                {/* SUMMARY BAR */}
                                <tr className="border-t-2 border-black bg-[#121212] text-white h-[45px]">
                                    <td colSpan={2} className="border-r border-white/20"></td>
                                    <td className="px-4 border-r border-white/20 font-black text-red-400 italic text-[9px] uppercase">Tax Type:</td>
                                    <td className="px-4 border-r border-white/20">
                                        <div className="flex gap-4 text-[9px] font-black uppercase tracking-tight">
                                            <span className={payload.vatTypeLabel === "VAT Inc" ? "text-white" : "text-white/30"}>
                                                {payload.vatTypeLabel === "VAT Inc" ? "●" : "○"} VAT Inc
                                            </span>
                                            <span className={payload.vatTypeLabel === "VAT Exe" ? "text-white" : "text-white/30"}>
                                                {payload.vatTypeLabel === "VAT Exe" ? "●" : "○"} VAT Exe
                                            </span>
                                            <span className={payload.vatTypeLabel === "Zero-Rated" ? "text-white" : "text-white/30"}>
                                                {payload.vatTypeLabel === "Zero-Rated" ? "●" : "○"} Zero-Rated
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 text-right border-r border-white/20 font-black text-[10px] uppercase">Grand Total:</td>
                                    <td className="px-4 text-right font-black text-lg">
                                        ₱{payload.totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                                <p>• Orders Within Metro Manila: Free delivery for a minimum sales transaction of ₱5,000.</p>{/* ECO NCR */}
                                <p>• Orders outside Metro Manila: Freed delivery for a minum sales transaction of P10,000.00 in Rizal, P15,000.00 in Bulacan and Cavite, and P25,000.00 in Laguna, Pampanga, and Batangas.</p>{/* ECO NCR */}                                                </div>
                        </div>
                        <div className="grid grid-cols-6 border-b border-black">
                            <div className="col-span-1 p-2 bg-yellow-400 font-black border-r border-black">Excluded:</div>
                            <div className="col-span-5 p-2 bg-yellow-100">
                                <p>• All lamp poles are subject to a delivery charge, freight charges, arrastre and other processing fees.</p>{/* ECO NCR */}
                                <p>• Installation and all hardware/accessories not indicated above.</p>{/* ECO NCR */}
                            </div>
                        </div>
                        <div className="grid grid-cols-6 bg-yellow-50">
                            <div className="col-span-1 p-2 font-black border-r border-black">Note:</div>
                            <div className="col-span-5 p-2 italic">
                                <p>Deliveries are up to the vehicle unloading point only.</p>{/* ECO NCR */}
                                <p>Additional shipping fee applies for other areas.</p>{/* ECO NCR */}
                                <p>Shipping fee is subject to confirmation upon getting the actual weight and dimensions of the items.</p>{/* ECO NCR */}
                                <span className="font-black underline block mt-1 text-red-600">In cases of client error, there will be a 10% restocking fee for returns, refunds, and exchanges.</span>{/* ECO NCR */}
                            </div>
                        </div>
                    </div>

                    {/* 3. TERMS & CONDITIONS */}
                    <div className="mt-6 border-t-2 border-black pt-2">
                        <h3 className="bg-[#121212] text-white px-3 py-1 text-[10px] font-black inline-block mb-4 uppercase">Terms and Conditions</h3>
                        <div className="grid grid-cols-12 gap-y-4 text-[9px]">
                            <div className="col-span-2 font-black uppercase">Terms of Payment:</div>
                            <div className="col-span-10 pl-4 border-l border-gray-100 bg-yellow-50">
                                <p>Cash on Delivery (COD)</p>
                                <p>For 10,000 & below, can be paid in cash at the time of delivery</p>
                                <p>Exceeding 10,000 pesos should be transacted through bank deposit or mobile electronic transactions.</p>
                                <p>If Dated Check payment, 1-3 days bank clearing needed before item/s will be released.</p>
                                <p>Check must be payable to: Ecoshift Corporation.</p>
                                <p>For special items,  Seventy Percent (70%) down payment, 30% upon delivery.</p>
                                <p>Prices are subject to change without prior notice and may vary depending on the final quantity and product mix.</p>
                                <p>Subject for pick-up or delivery cost.</p>
                            </div>

                            <div className="col-span-2 font-black uppercase">Bank Details:</div>
                            <div className="col-span-10 pl-4 border-l border-gray-100 grid grid-cols-2 gap-4">
                                <div>
                                    <p className="font-black">METROBANK (Payee: {isEcoshift ? 'ECOSHIFT CORPORATION' : 'DISRUPTIVE SOLUTIONS INC.'})</p>
                                    <p>Account Number: {isEcoshift ? '243-7-243805100' : '243-7-24354164-2'}</p>
                                </div>
                                <div>
                                    <p className="font-black">BDO (Payee: {isEcoshift ? 'ECOSHIFT CORPORATION' : 'DISRUPTIVE SOLUTIONS INC.'})</p>
                                    <p>Account Number: {isEcoshift ? '0021-8801-7271' : '0021-8801-9258'}</p>
                                </div>
                            </div>

                            <div className="col-span-2 font-black uppercase">Availability:</div>
                            <div className="col-span-10 pl-4 border-l border-gray-100 bg-yellow-50">
                                <p>*Availability of item/merchandise, subject to confirmation.</p>
                                <p>*For items not on stock/indent order, an estimate of 45-60 days upon receipt of approved PO & down payment.*For Available orders, 5-7days  upon confirmed order and payment.</p>
                                <p>*For items not on stock/indent order, an estimate of 45-60 days upon receipt of approved PO & down payment. Barring any delay in shipping and customs clearance beyond Ecoshift's control.</p>
                                <p>*In the event of a conflict or inconsistency in estimated days under Availability and another estimate indicated elsewhere in this quotation, the latter will prevail.</p>
                                <p>*Add on charge depending on final destination.</p>
                            </div>

                            <div className="col-span-2 font-black uppercase">Warranty:</div>
                            <div className="col-span-10 pl-4 border-l border-gray-100 bg-yellow-50">
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

                            <div className="col-span-2 font-black uppercase">SO Validity:</div>
                            <div className="col-span-10 pl-4 border-l border-gray-100">
                                <p>Sales order has <span className="text-red-600 font-black italic">validity period of 14 working days</span>. days (excluding holidays and Sundays) from the date of issuance. Any sales order not confirmed and no verified payment within this <span className="text-red-600 font-black">automatically cancelled14-day period will be automatically cancelled</span>.</p>
                            </div>

                            <div className="col-span-2 font-black uppercase">Storage:</div>
                            <div className="col-span-10 pl-4 border-l border-gray-100 bg-yellow-50">
                                <p>Orders with confirmation/verified payment but undelivered after 14 working days (excluding holidays and Sundays starting from picking date) due to clients’ request or shortcomings will be charged a storage fee of 10% of the value of the orders per month <span className="text-red-600 font-black">(10% / 30 days =  0.33% per day)</span>.</p>
                            </div>

                            <div className="col-span-2 font-black uppercase">Return:</div>
                            <div className="col-span-10 pl-4 border-l border-gray-100 bg-yellow-50">
                                <p>Ecoshift corporation shall accept returns and exchanges of purchased products only if the items are regular in-stock items or are proven to be defective or damaged.</p>
                                <p>Ecoshift Corporation will not entertain return and exhanges of products that do not come with its original packaging or in unsalable form.</p>
                                <p><span className="text-red-600 font-black italic"><u>7 days return policy -</u></span> if the product received is defective, damaged, or incomplete. This must be communicated to Ecoshift, and Ecoshift has duly acknowledged communication as received within a maximum of 7 days to qualify for replacement.</p>
                            </div>

                            <div className="col-span-2 font-black uppercase">Delivery:</div>
                            <div className="col-span-10 pl-4 border-l border-gray-100 bg-yellow-50">
                                <p>Delivery/Pick up is subject to confirmation.</p>
                            </div>

                            <div className="col-span-2 font-black uppercase">CANCELLATION:</div>
                            <div className="col-span-10 pl-4 border-l border-gray-100 bg-yellow-50">
                                <p>1. Above quoted items are non-cancellable.</p>
                                <p>2. If the customer cancels the order under any circumstances, the client shall be responsible for 100% cost incurred by Ecoshift, including freight and delivery charges.</p>
                                <p>3. Downpayment for items not in stock/indent and order/special items are non-refundable and will be forfeited if the order is canceled.</p>
                                <p>4. COD transaction payments should be ready upon delivery. If the payment is not ready within seven (7) days from the date of order, the transaction is automatically canceled.</p>
                                <p>5. Cancellation for Special Projects (SPF) are not allowed and will be subject to a 100% charge.</p>
                            </div>

                            <div className="col-span-2 font-black uppercase">MISCELLANEOUS:</div>
                            <div className="col-span-10 pl-4 border-l border-gray-100 bg-yellow-50">
                                <p>1. Ecoshift Corporation's maximum liability for any damages, loss, or claim  arising from any delay, negligence, or breach shall not exceed the aggregate amount actually paid under the relevant PO.</p>
                                <p>2. Each Party will comply with all applicable Laws and the operating regulations, governmental requirements, and industry standards.</p>
                                <p>3. Should any part of this Agreement be declared unconstitutional, illegal, void or the like, the parts not affected shall remain valid and binding.</p>
                                <p>4. Any modification or alteration on the terms and conditions of this Agreement shall be confirmed in writing duly signed by both parties</p>
                                <p>5. No waiver of any party with respect to a breach or default of right or remedy is presumed under this Agreement. Any waiver of a party’s rights, powers, privileges or remedies must be in writing and signed by that party.</p>
                            </div>
                        </div>
                    </div>

                    {/* 4. OFFICIAL SIGNATURE HIERARCHY */}
                    <div className="mt-12 pt-4 border-t-4 border-blue-700 pb-20">
                        <p className="text-[9px] mb-8 font-medium">
                            Thank you for allowing us to service your requirements. We hope that the above offer merits your acceptance.                                                 Unless otherwise indicated in your Approved Purchase Order, you are deemed to have accepted the Terms and Conditions of this Quotation.
                        </p>
                        <div className="grid grid-cols-2 gap-x-20 gap-y-12">
                            {/* Left Side: Internal Team */}
                            <div className="space-y-10">
                                <div>
                                    <p className="italic text-[10px] font-black mb-12">{isEcoshift ? 'Ecoshift Corporation' : 'Disruptive Solutions Inc'}</p>
                                    <p className="text-[11px] font-black uppercase mt-1">{payload.salesRepresentative}</p>
                                    <div className="border-b border-black w-64"></div>
                                    <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Sales Representative</p>
                                    <p className="text-[9px] text-gray-500 font-bold italic">Mobile No.: {payload.salescontact}</p>
                                    <p className="text-[9px] text-gray-500 font-bold italic">Email: {payload.salesemail}</p>
                                </div>

                                <div>
                                    <p className="text-[9px] font-black uppercase text-gray-400 mb-12">Approved By:</p>
                                    <p className="text-[11px] font-black uppercase mt-1">{payload.salestsmname}</p>
                                    <div className="border-b border-black w-64"></div>
                                    <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Sales Manager</p>
                                    <p className="text-[9px] text-gray-500 font-bold italic">Mobile: {payload.salestsmcontact}</p>
                                    <p className="text-[9px] text-gray-500 font-bold italic">Email: {payload.salestsmemail}</p>
                                </div>

                                <div>
                                    <p className="text-[9px] font-black uppercase text-gray-400">Noted By:</p>
                                    <div className="border-b border-black w-64 mt-4"></div>
                                    <p className="text-[11px] font-black underline mt-1"></p>
                                    <p className="text-[9px] font-black uppercase tracking-tighter"></p>
                                </div>
                            </div>

                            {/* Right Side: Client Side */}
                            <div className="space-y-10 flex flex-col items-end">
                                <div className="w-64 mt-20">
                                    <div className="border-b border-black w-full mt-1"></div>
                                    <div className="h-10 w-full bg-red-400/10 border border-red-400 flex items-center justify-center text-[8px] font-black text-red-600 uppercase text-center px-2 mt-1">
                                        Company Authorized Representative PLEASE SIGN OVER PRINTED NAME
                                    </div>
                                </div>

                                <div className="w-64">
                                    <div className="border-b border-black w-full mt-10"></div>
                                    <p className="text-[9px] text-right font-black mt-1 uppercase tracking-widest">Payment Release Date</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* FOOTER ACTIONS */}
            <div className="p-8 bg-gray-50 border-t flex justify-between items-center sticky bottom-0">
                <Button variant="ghost" onClick={() => setIsPreviewOpen(false)} className="font-black uppercase">
                    Close Preview
                </Button>
            </div>
        </div>
    );
};
