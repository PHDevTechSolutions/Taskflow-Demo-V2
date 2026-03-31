
"use client";

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { CheckCircle, XCircle, Loader } from 'lucide-react';

interface QuotationDetails {
    referenceNo: string;
    clientName: string;
    date: string;
    totalAmount: number;
    companyName: string;
    status?: string;
}

/** 
 * Simple but effective security hash to prevent URL tampering.
 * In a production app, this would use a server-side secret (env variable).
 */
const SECURITY_SALT = "TF-SECURE-2024-DS-EC";
function generateSecurityToken(ref: string, total: string) {
    const raw = `${ref}|${total}|${SECURITY_SALT}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
        const chr = raw.charCodeAt(i);
        hash = (hash << 5) - hash + chr;
        hash |= 0;
    }
    return Math.abs(hash).toString(36).toUpperCase();
}

function VerificationContent() {
    const searchParams = useSearchParams();
    const [details, setDetails] = useState<QuotationDetails | null>(null);
    const [isValid, setIsValid] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [securityAlert, setSecurityAlert] = useState<string | null>(null);

    useEffect(() => {
        if (!searchParams) return;
        
        const ref = searchParams.get('ref');
        const total = searchParams.get('total');
        const token = searchParams.get('v'); // Security verification token

        if (ref && total) {
            const fetchQuotation = async () => {
                setIsLoading(true);
                try {
                    // 1. Fetch record directly from Supabase by reference number
                    const { data, error } = await supabase
                        .from('quotations') 
                        .select('*')
                        .eq('quotation_number', ref)
                        .single();

                    if (error || !data) {
                        setSecurityAlert("Document record not found in Taskflow database.");
                        setIsValid(false);
                    } else {
                        const dbTotal = parseFloat(data.quotation_amount).toFixed(2);
                        const paramTotal = parseFloat(total).toFixed(2);
                        
                        // 2. Perform Strict Integrity Checks
                        
                        // Check A: Database amount must match URL amount
                        const amountMismatch = dbTotal !== paramTotal;
                        
                        // Check B: Verify the security token (if provided)
                        const expectedToken = generateSecurityToken(ref, paramTotal);
                        const tokenMismatch = token && token !== expectedToken;

                        if (amountMismatch) {
                            setSecurityAlert("CRITICAL: The amount on this document does not match our official records.");
                            setIsValid(false);
                        } else if (tokenMismatch) {
                            setSecurityAlert("SECURITY ALERT: This verification link appears to have been tampered with.");
                            setIsValid(false);
                        } else {
                            // Document is verified
                            setDetails({
                                referenceNo: data.quotation_number,
                                clientName: data.company_name,
                                date: new Date(data.date_created).toLocaleDateString(),
                                totalAmount: data.quotation_amount,
                                companyName: data.quotation_type,
                                status: data.status,
                            });
                            setIsValid(true);
                        }
                    }
                } catch (e) {
                    setSecurityAlert("An error occurred during secure verification.");
                    setIsValid(false);
                } finally {
                    setIsLoading(false);
                }
            };
            fetchQuotation();
        } else {
            setSecurityAlert("Missing required verification parameters.");
            setIsValid(false);
            setIsLoading(false);
        }
    }, [searchParams]);

    return (
        <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4 font-sans">
            <div className="max-w-xl w-full bg-white shadow-2xl rounded-2xl border border-gray-100 overflow-hidden">
                {/* Security Header Strip */}
                <div className={`h-2 w-full ${isLoading ? 'bg-gray-300' : isValid ? 'bg-green-500' : 'bg-red-600'}`} />
                
                <div className="p-8 md:p-12">
                    <div className="flex items-center justify-center mb-8">
                        {isLoading ? (
                            <div className="p-4 bg-gray-50 rounded-full">
                                <Loader className="animate-spin text-gray-400 w-12 h-12" />
                            </div>
                        ) : isValid ? (
                            <div className="p-4 bg-green-50 rounded-full border-4 border-green-100">
                                <CheckCircle className="text-green-600 w-16 h-16" />
                            </div>
                        ) : (
                            <div className="p-4 bg-red-50 rounded-full border-4 border-red-100">
                                <XCircle className="text-red-600 w-16 h-16" />
                            </div>
                        )}
                    </div>

                    <h1 className="text-3xl font-black text-center text-[#121212] tracking-tight mb-2 uppercase">
                        {isLoading ? 'Verifying...' : isValid ? 'Document Verified' : 'Security Warning'}
                    </h1>
                    <p className="text-center text-gray-500 text-sm font-medium mb-10 max-w-sm mx-auto leading-relaxed">
                        {isLoading ? 'Checking document integrity against Taskflow central records...' : 
                         isValid ? 'This document is an authentic official quotation from our system.' : 
                         securityAlert || 'This document could not be verified and may have been altered.'}
                    </p>

                    {details && isValid && (
                        <div className="space-y-6">
                            <div className="bg-[#F9FAFA] rounded-xl p-6 border border-gray-100 space-y-4">
                                <div className="flex justify-between items-center pb-3 border-b border-gray-200/50">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Document Reference</span>
                                    <span className="text-sm font-black text-[#121212] font-mono">{details.referenceNo}</span>
                                </div>
                                <div className="flex justify-between items-center pb-3 border-b border-gray-200/50">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Client Name</span>
                                    <span className="text-sm font-bold text-gray-700">{details.clientName}</span>
                                </div>
                                <div className="flex justify-between items-center pb-3 border-b border-gray-200/50">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Date Issued</span>
                                    <span className="text-sm font-bold text-gray-700">{details.date}</span>
                                </div>
                                <div className="flex justify-between items-center pt-2">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Official Amount</span>
                                    <span className="text-2xl font-black text-blue-600 tabular-nums">₱{details.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 p-4 bg-blue-50/50 border border-blue-100 rounded-lg">
                                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                <p className="text-[10px] font-bold text-blue-700 uppercase tracking-tight">
                                    Verified Source: {details.companyName}
                                </p>
                            </div>
                        </div>
                    )}

                    {!isValid && !isLoading && (
                        <div className="bg-red-50 p-6 rounded-xl border border-red-100">
                             <p className="text-xs text-red-700 font-bold leading-relaxed">
                                {securityAlert ? `ERROR: ${securityAlert}` : 'This verification link is invalid or the document has been tampered with.'}
                             </p>
                             <p className="text-[10px] text-red-600 mt-4 italic">
                                Please contact our sales department immediately if you suspect fraud.
                             </p>
                        </div>
                    )}

                    <div className="mt-12 text-center border-t border-gray-100 pt-8">
                        <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] mb-4">Official Verification Protocol</p>
                        <div className="flex justify-center items-center gap-4 grayscale opacity-30 scale-75">
                            <img src="/ecoshift-banner.png" alt="Ecoshift" className="h-6 object-contain" />
                            <div className="w-px h-4 bg-gray-300" />
                            <img src="/disruptive-banner.png" alt="Disruptive" className="h-6 object-contain" />
                        </div>
                        <p className="mt-6 text-[9px] font-bold text-gray-400">
                            {new Date().getFullYear()} © DISRUPTIVE SOLUTIONS INC. | ECOSHIFT CORPORATION
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function VerifyQuotationPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
            <VerificationContent />
        </Suspense>
    );
}
