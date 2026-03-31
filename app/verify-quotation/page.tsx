
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
                    // 1. First, check the main 'quotations' table
                    let { data, error } = await supabase
                        .from('quotations') 
                        .select('*')
                        .eq('quotation_number', ref)
                        .maybeSingle();

                    // 2. If not found, check 'history' (this is where Taskflow stores activity history)
                    if (!data) {
                        const { data: historyData, error: historyError } = await supabase
                            .from('history')
                            .select('*')
                            .eq('quotation_number', ref)
                            .order('id', { ascending: false })
                            .limit(1)
                            .maybeSingle();
                        
                        if (historyData) {
                            data = historyData;
                        }
                    }

                    // 3. If still not found, check 'revised_quotations' (for drafts)
                    if (!data) {
                        const { data: revisedData, error: revisedError } = await supabase
                            .from('revised_quotations')
                            .select('*')
                            .eq('quotation_number', ref)
                            .order('id', { ascending: false })
                            .limit(1)
                            .maybeSingle();
                        
                        if (revisedData) {
                            data = revisedData;
                        }
                    }

                    if (!data) {
                        setSecurityAlert("Document record not found in Taskflow database.");
                        setIsValid(false);
                    } else {
                        // Extract fields with priority based on Taskflow conventions
                        const dbTotalAmount = data.quotation_amount || data.total_amount || 0;
                        const dbCompanyName = data.company_name || data.client_name || "Official Client";
                        const dbDate = data.date_created || data.start_date || new Date().toISOString();
                        const dbQuotationType = data.quotation_type || (data.is_ecoshift ? "Ecoshift Corporation" : "Disruptive Solutions Inc.");
                        const dbStatus = data.tsm_approved_status || data.status || "Active";

                        const dbTotal = parseFloat(dbTotalAmount).toFixed(2);
                        const paramTotal = parseFloat(total).toFixed(2);
                        
                        // Perform Strict Integrity Checks
                        const amountMismatch = dbTotal !== paramTotal;
                        const expectedToken = generateSecurityToken(ref, paramTotal);
                        const tokenMismatch = token && token !== expectedToken;

                        if (amountMismatch) {
                            setSecurityAlert("CRITICAL: The amount on this document does not match our official records.");
                            setIsValid(false);
                        } else if (tokenMismatch) {
                            setSecurityAlert("SECURITY ALERT: This verification link appears to have been tampered with.");
                            setIsValid(false);
                        } else {
                            setDetails({
                                referenceNo: data.quotation_number,
                                clientName: dbCompanyName,
                                date: new Date(dbDate).toLocaleDateString(),
                                totalAmount: parseFloat(dbTotalAmount),
                                companyName: dbQuotationType,
                                status: dbStatus,
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
        <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-4 font-sans">
            <div className="max-w-xl w-full bg-white shadow-2xl rounded-2xl border border-gray-100 overflow-hidden relative">
                {/* Dynamic Brand Header */}
                {!isLoading && isValid && details && (
                    <div className="w-full h-24 bg-white flex items-center justify-center border-b border-gray-50 px-8">
                        <img 
                            src={details.companyName.toLowerCase().includes('ecoshift') ? "/ecoshift-banner.png" : "/disruptive-banner.png"} 
                            alt="Company Logo" 
                            className="h-16 w-full object-contain"
                        />
                    </div>
                )}

                {/* Security Header Strip */}
                <div className={`h-1.5 w-full ${isLoading ? 'bg-gray-300' : isValid ? 'bg-green-500' : 'bg-red-600'}`} />
                
                <div className="p-8 md:p-12">
                    <div className="flex items-center justify-center mb-8">
                        {isLoading ? (
                            <div className="p-4 bg-gray-50 rounded-full">
                                <Loader className="animate-spin text-gray-400 w-12 h-12" />
                            </div>
                        ) : isValid ? (
                            <div className="p-4 bg-green-50 rounded-full border-4 border-green-100 relative">
                                <CheckCircle className="text-green-600 w-16 h-16" />
                                {/* Status Badge Overlay */}
                                {details?.status && (
                                    <div className="absolute -bottom-2 -right-2 bg-green-600 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg uppercase tracking-widest border-2 border-white">
                                        {details.status}
                                    </div>
                                )}
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
                                <div className="flex justify-between items-center pb-3 border-b border-gray-200/50">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Official Status</span>
                                    <span className={`text-[11px] font-black px-3 py-1 rounded uppercase tracking-widest ${
                                        details.status?.toLowerCase().includes('approved') ? 'bg-green-100 text-green-700' : 
                                        details.status?.toLowerCase().includes('pending') ? 'bg-orange-100 text-orange-700' : 
                                        'bg-gray-100 text-gray-700'
                                    }`}>
                                        {details.status || 'Active'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center pt-2">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Official Amount</span>
                                    <span className="text-2xl font-black text-blue-600 tabular-nums">₱{details.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
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

                    {/* Dynamic Footer */}
                    <div className="mt-12 text-center border-t border-gray-100 pt-8">
                        <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] mb-4">Official Verification Protocol</p>
                        <div className="flex justify-center items-center gap-4">
                            {(!isValid || isLoading || (details && details.companyName.toLowerCase().includes('ecoshift'))) && (
                                <img src="/ecoshift-banner.png" alt="Ecoshift" className={`h-6 object-contain ${isValid && !details?.companyName.toLowerCase().includes('ecoshift') ? 'hidden' : ''}`} />
                            )}
                            {isValid && details && details.companyName.toLowerCase().includes('ecoshift') && details.companyName.toLowerCase().includes('disruptive') && (
                                <div className="w-px h-4 bg-gray-300" />
                            )}
                            {(!isValid || isLoading || (details && details.companyName.toLowerCase().includes('disruptive'))) && (
                                <img src="/disruptive-banner.png" alt="Disruptive" className={`h-6 object-contain ${isValid && !details?.companyName.toLowerCase().includes('disruptive') ? 'hidden' : ''}`} />
                            )}
                        </div>
                        <p className="mt-6 text-[9px] font-bold text-gray-400">
                            {new Date().getFullYear()} © {isValid && details ? details.companyName.toUpperCase() : 'DISRUPTIVE SOLUTIONS INC. | ECOSHIFT CORPORATION'}
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
