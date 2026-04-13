"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { sileo } from "sileo";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  AlertCircleIcon,
  PlusIcon,
  MinusIcon,
  CheckCircle2Icon,
  ArrowLeft,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { supabase } from "@/utils/supabase";

// ─── Constants ────────────────────────────────────────────────────────────────
const TYPECLIENT_OPTIONS = ["New Client"] as const;
const TOTAL_STEPS = 3;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normalize company name for duplicate checking */
function cleanCompanyName(name: string): string {
  if (!name) return "";
  return name
    .toUpperCase()
    .replace(/[-_.@!$%]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\d+$/, "")
    .trim();
}

/** Validate email — returns true if valid or explicitly N/A */
function isValidEmail(email: string): boolean {
  if (!email) return false;
  const lower = email.trim().toLowerCase();
  if (["none", "n/a", "na"].includes(lower)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email);
}

/** Normalize PH phone number to 11-digit local format for comparison */
function normalizePHNumber(number: string): string {
  if (!number) return "";
  let n = number.replace(/\D/g, "");
  if (n.startsWith("63")) n = "0" + n.slice(2);
  if (n.length === 10 && n.startsWith("9")) n = "0" + n;
  return n;
}

/** Format local PH number → 0917-123-4567 */
function formatPH(val: string): string {
  val = val.replace(/\D/g, "").slice(0, 11);
  if (val.length <= 4) return val;
  if (val.length <= 7) return `${val.slice(0, 4)}-${val.slice(4)}`;
  return `${val.slice(0, 4)}-${val.slice(4, 7)}-${val.slice(7)}`;
}

/** Format landline number → (02) 8123-4567 or (043) 123-4567 */
function formatLandline(val: string): string {
  val = val.replace(/\D/g, "").slice(0, 10); // Max 10 digits for PH landline
  if (val.length === 0) return "";
  
  // Area code: 2 digits for NCR (02), 3 digits for others (043, 032, etc.)
  let areaCodeLen = val.startsWith("2") ? 2 : 3;
  
  if (val.length <= areaCodeLen) {
    return val.length === 2 && val.startsWith("2") ? `(${val})` : val;
  }
  
  const areaCode = val.slice(0, areaCodeLen);
  const rest = val.slice(areaCodeLen);
  
  if (rest.length <= 3) {
    return `(${areaCode}) ${rest}`;
  }
  
  return `(${areaCode}) ${rest.slice(0, 4)}-${rest.slice(4, 7)}${rest.slice(7) ? `-${rest.slice(7)}` : ""}`;
}

/** Format international number → +63 917 123 4567 */
function formatIntl(val: string): string {
  val = val.replace(/[^0-9+]/g, "");
  if (val.indexOf("+") > 0) val = "+" + val.replace(/\+/g, "");
  const digits = val.replace(/\D/g, "");
  if (digits.length < 4) return val;
  const country = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (rest.length <= 3) return `+${country} ${rest}`;
  if (rest.length <= 6) return `+${country} ${rest.slice(0, 3)} ${rest.slice(3)}`;
  if (rest.length <= 10)
    return `+${country} ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6)}`;
  return `+${country} ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6, 10)} ${rest.slice(10)}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface ContactEntry {
  person: string;
  numbers: string[];
}

interface AccountFormData {
  id?: string;
  company_name: string;
  contact_person: string[];
  contact_number: string[];
  email_address: string[];
  address: string;
  region: string;
  status: string;
  delivery_address: string;
  type_client: string;
  industry: string;
  date_created?: string;
  company_group: string;
  contacts?: ContactEntry[];
}

// Helper to convert legacy flat arrays to new contacts structure
function convertToContacts(persons: string[], numbers: string[]): ContactEntry[] {
  const contacts: ContactEntry[] = [];
  const maxLen = Math.max(persons.length, numbers.length);
  for (let i = 0; i < maxLen; i++) {
    const person = persons[i] || "";
    const numStr = numbers[i] || "";
    // Split by comma to get multiple numbers for this person
    const nums = numStr ? numStr.split(", ").map(n => n.trim()).filter(n => n) : [""];
    contacts.push({ person, numbers: nums.length > 0 ? nums : [""] });
  }
  return contacts.length > 0 ? contacts : [{ person: "", numbers: [""] }];
}

// Helper to convert contacts structure back to flat arrays for API
function convertFromContacts(contacts: ContactEntry[]): { persons: string[]; numbers: string[] } {
  const persons: string[] = [];
  const numbers: string[] = [];
  for (const contact of contacts) {
    if (contact.person.trim()) {
      persons.push(contact.person);
      // Join multiple numbers with comma for backward compatibility
      const validNumbers = contact.numbers.filter((n) => n.trim());
      numbers.push(validNumbers.length > 0 ? validNumbers.join(", ") : "");
    }
  }
  return { persons: persons.length > 0 ? persons : [""], numbers: numbers.length > 0 ? numbers : [""] };
}

interface Agent {
  referenceid: string;
  firstname: string;
}

interface UserDetails {
  referenceid: string;
  tsm: string;
  manager: string;
}

interface AccountDialogProps {
  mode: "create" | "edit";
  userDetails: UserDetails;
  initialData?: Partial<AccountFormData>;
  onSaveAction: (data: AccountFormData & UserDetails) => void;
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
}

interface DuplicateCompany {
  company_name: string;
  owner_referenceid: string;
  owner_firstname?: string;
  contact_person: string[];
  contact_number: string[];
}

// ─── Default form values ──────────────────────────────────────────────────────
const DEFAULT_FORM: AccountFormData = {
  company_name: "",
  contact_person: [""],
  contact_number: [""],
  email_address: [""],
  address: "",
  region: "",
  status: "Active",
  delivery_address: "",
  type_client: "New Client",
  industry: "OTHER",
  company_group: "",
};

// ─── Component ────────────────────────────────────────────────────────────────
export function AccountDialog({
  mode,
  initialData,
  userDetails,
  onSaveAction,
  open,
  onOpenChangeAction,
}: AccountDialogProps) {

  // ── Form state ──────────────────────────────────────────────────────────────
  const [formData, setFormData] = useState<AccountFormData>({
    ...DEFAULT_FORM,
    ...initialData,
  });

  const updateField = <K extends keyof AccountFormData>(
    key: K,
    value: AccountFormData[K],
  ) => setFormData((prev) => ({ ...prev, [key]: value }));

  // ── Stepper ─────────────────────────────────────────────────────────────────
  const [step, setStep] = useState(0);

  // ── Industry state (dynamic from Supabase) ──────────────────────────────────
  const [industries, setIndustries] = useState<string[]>([]);
  const [loadingIndustries, setLoadingIndustries] = useState(false);
  const [newIndustryInput, setNewIndustryInput] = useState("");
  const [addingIndustry, setAddingIndustry] = useState(false);
  const [showAddIndustry, setShowAddIndustry] = useState(false);

  // ── Regions ─────────────────────────────────────────────────────────────────
  const [regions, setRegions] = useState<string[]>([]);

  // ── Agents ──────────────────────────────────────────────────────────────────
  const [agents, setAgents] = useState<Agent[]>([]);

  // ── Duplicate check ─────────────────────────────────────────────────────────
  const [companyError, setCompanyError] = useState("");
  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateCompany[]>([]);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [showAllDuplicates, setShowAllDuplicates] = useState(false);

  const submitLock = useRef(false);
  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Reset form when dialog opens/closes ────────────────────────────────────
  useEffect(() => {
    if (open) {
      const initial = { ...DEFAULT_FORM, ...initialData };
      // Initialize contacts from existing flat arrays if present
      if (!initial.contacts && (initial.contact_person?.length || initial.contact_number?.length)) {
        initial.contacts = convertToContacts(
          initial.contact_person || [""],
          initial.contact_number || [""]
        );
      }
      setFormData(initial);
      setStep(0);
      setCompanyError("");
      setDuplicateInfo([]);
      setShowAllDuplicates(false);
      setNewIndustryInput("");
      setShowAddIndustry(false);
    }
  }, [open, initialData]);

  // ── Fetch regions ───────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("https://psgc.gitlab.io/api/regions")
      .then((res) => res.json())
      .then((data) => setRegions(data.map((r: any) => r.name)))
      .catch(console.error);
  }, []);

  // ── Fetch agents ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userDetails.referenceid) return;
    fetch("/api/fetch-all-user-transfer")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch agents");
        return res.json();
      })
      .then((data) =>
        setAgents(
          data.map((a: any) => ({
            referenceid: a.ReferenceID,
            firstname: `${a.Firstname} ${a.Lastname}`.trim(),
          })),
        ),
      )
      .catch(console.error);
  }, [userDetails.referenceid]);

  // ── Fetch industries from Supabase ──────────────────────────────────────────
  const fetchIndustries = useCallback(async () => {
    setLoadingIndustries(true);
    try {
      const { data, error } = await supabase
        .from("industry")
        .select("industry_name")
        .order("industry_name", { ascending: true });

      if (error) throw error;
      setIndustries((data ?? []).map((row) => row.industry_name as string).filter(Boolean));
    } catch (err) {
      console.error("Failed to fetch industries:", err);
    } finally {
      setLoadingIndustries(false);
    }
  }, []);

  useEffect(() => {
    fetchIndustries();
  }, [fetchIndustries]);

  // ── Add new industry to Supabase ────────────────────────────────────────────
  const handleAddIndustry = async () => {
    const name = newIndustryInput.trim().toUpperCase();
    if (!name) return;

    // Prevent duplicates locally before hitting DB
    if (industries.includes(name)) {
      sileo.error({
        title: "Duplicate",
        description: `"${name}" already exists in the industry list.`,
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
      return;
    }

    setAddingIndustry(true);
    try {
      const { error } = await supabase
        .from("industry")
        .insert({ industry_name: name });

      if (error) throw error;

      // Optimistically update local list + select it
      setIndustries((prev) => [...prev, name].sort());
      updateField("industry", name);
      setNewIndustryInput("");
      setShowAddIndustry(false);

      sileo.success({
        title: "Industry Added",
        description: `"${name}" has been added successfully.`,
        duration: 3000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    } catch (err: any) {
      sileo.error({
        title: "Failed",
        description: err?.message || "Failed to add industry.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    } finally {
      setAddingIndustry(false);
    }
  };

  // ── Duplicate check on company name change ──────────────────────────────────
  useEffect(() => {
    if (mode === "edit") {
      setCompanyError("");
      setDuplicateInfo([]);
      return;
    }

    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);

    debounceTimeout.current = setTimeout(() => {
      const name = formData.company_name.trim();

      if (!name || name.length < 3) {
        setCompanyError("Company Name must be at least 3 characters.");
        setDuplicateInfo([]);
        return;
      }

      const cleaned = cleanCompanyName(name);
      if (["NONE", "OTHER"].includes(cleaned)) {
        setCompanyError("Company Name Invalid.");
        setDuplicateInfo([]);
        return;
      }

      setIsCheckingDuplicate(true);
      const controller = new AbortController();

      fetch(
        `/api/com-check-duplicate-account?company_name=${encodeURIComponent(cleaned)}`,
        { signal: controller.signal },
      )
        .then((res) => {
          if (!res.ok) throw new Error("Failed to check duplicates");
          return res.json() as Promise<{ exists: boolean; companies: DuplicateCompany[] }>;
        })
        .then(({ exists, companies }) => {
          if (exists && companies.length > 0) {
            setDuplicateInfo(
              companies.map((company) => ({
                ...company,
                owner_firstname:
                  agents.find((a) => a.referenceid === company.owner_referenceid)
                    ?.firstname ?? company.owner_referenceid,
              })),
            );
          } else {
            setDuplicateInfo([]);
          }
          setCompanyError("");
        })
        .catch((err) => {
          if (err.name !== "AbortError") {
            setCompanyError("Failed to validate company name.");
            setDuplicateInfo([]);
          }
        })
        .finally(() => setIsCheckingDuplicate(false));

      return () => controller.abort();
    }, 500);

    return () => {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    };
  }, [formData.company_name, mode, agents]);

  // ── Duplicate contact check ─────────────────────────────────────────────────
  useEffect(() => {
    if (!duplicateInfo.length) {
      setCompanyError("");
      return;
    }

    const blocked = duplicateInfo.some((dup) => {
      const personMatch = dup.contact_person?.some((cp) =>
        formData.contact_person.some(
          (fcp) => fcp.trim().toUpperCase() === cp.trim().toUpperCase(),
        ),
      );
      const numberMatch = dup.contact_number?.some((cn) =>
        formData.contact_number.some(
          (fcn) => normalizePHNumber(fcn) === normalizePHNumber(cn),
        ),
      );
      return personMatch || numberMatch;
    });

    if (blocked) {
      const dup = duplicateInfo.find((d) => {
        const personMatch = d.contact_person?.some((cp) =>
          formData.contact_person.some(
            (fcp) => fcp.trim().toUpperCase() === cp.trim().toUpperCase(),
          ),
        );
        const numberMatch = d.contact_number?.some((cn) =>
          formData.contact_number.some(
            (fcn) => normalizePHNumber(fcn) === normalizePHNumber(cn),
          ),
        );
        return personMatch || numberMatch;
      });
      setCompanyError(
        `Duplicate contact person or number detected for company "${dup?.company_name}".`,
      );
    } else {
      setCompanyError("");
    }
  }, [formData.contact_person, formData.contact_number, duplicateInfo]);

  // ── Step validation ─────────────────────────────────────────────────────────
  const canProceedToNext = (): boolean => {
    switch (step) {
      case 0:
        return (
          formData.company_name.trim().length >= 3 &&
          formData.contact_person.length > 0 &&
          formData.contact_person.every((v) => v.trim() !== "") &&
          formData.contact_number.length > 0 &&
          formData.contact_number.every((v) => v.trim() !== "") &&
          !companyError &&
          formData.email_address.length > 0 &&
          formData.email_address.every((em) => em === "N/A" || isValidEmail(em))
        );
      case 1:
        return (
          formData.address.trim() !== "" &&
          (formData.delivery_address?.length ?? 0) > 0 &&
          formData.region !== ""
        );
      case 2:
        return (
          formData.type_client !== "" &&
          formData.industry !== "" &&
          formData.status !== ""
        );
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (step < TOTAL_STEPS - 1 && canProceedToNext()) setStep((s) => s + 1);
  };
  const handleBack = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  // ── Form submission ─────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (submitLock.current) return;
    submitLock.current = true;

    if (companyError) {
      sileo.error({
        title: "Failed",
        description: companyError,
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
      submitLock.current = false;
      return;
    }

    // Validate all emails
    for (const em of formData.email_address) {
      if (em.trim() && em.trim().toLowerCase() !== "n/a" && !isValidEmail(em)) {
        sileo.error({
          title: "Invalid Email",
          description: `Invalid email address: ${em}`,
          duration: 4000,
          position: "top-right",
          fill: "black",
          styles: { title: "text-white!", description: "text-white" },
        });
        submitLock.current = false;
        return;
      }
    }

    const cleanData = {
      ...formData,
      company_name: cleanCompanyName(formData.company_name),
      contact_person: formData.contact_person.map((v) => v.trim()).filter(Boolean),
      contact_number: formData.contact_number.map((v) => v.trim()).filter(Boolean),
      email_address: formData.email_address.map((v) => v.trim()).filter(Boolean),
      referenceid: userDetails.referenceid,
      tsm: userDetails.tsm,
      manager: userDetails.manager,
      status: mode === "create" ? "Active" : formData.status,
    };

    try {
      await onSaveAction(cleanData);
      sileo.success({
        title: "Success",
        description: "Saved successfully!",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
      onOpenChangeAction(false);
      setTimeout(() => {
        submitLock.current = false;
        window.location.reload();
      }, 500);
    } catch {
      sileo.error({
        title: "Failed",
        description: "Save failed. Please try again.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
      submitLock.current = false;
    }
  };

  // MultiValueField intentionally removed — inline inputs used instead
  // to prevent input focus loss caused by component re-mounting on every render.

  // ── Step content ────────────────────────────────────────────────────────────
  const renderStepContent = () => {
    switch (step) {
      // ── Step 0: Company Info ────────────────────────────────────────────────
      case 0:
        return (
          <>
            {/* Company Name */}
            <div className="mb-4">
              <FieldContent>
                <FieldLabel className="font-bold">Company Name</FieldLabel>
                <FieldDescription>
                  Enter the official registered name of the company.
                </FieldDescription>
              </FieldContent>
              <Input
                required
                value={formData.company_name}
                onChange={(e) => updateField("company_name", e.target.value)}
                placeholder="Company Name"
                className="uppercase rounded-none"
              />

              {isCheckingDuplicate && (
                <Alert className="mt-2">
                  <Loader2 className="animate-spin" />
                  <AlertTitle>Checking duplicates...</AlertTitle>
                </Alert>
              )}

              {duplicateInfo.length > 0 && (
                <>
                  {(showAllDuplicates ? duplicateInfo : duplicateInfo.slice(0, 2)).map(
                    (dup) => (
                      <Alert
                        key={dup.owner_referenceid + dup.company_name}
                        variant={companyError ? "destructive" : "default"}
                        className={`mt-2 ${!companyError ? "bg-yellow-100 text-yellow-800" : ""}`}
                      >
                        <AlertCircleIcon
                          className={`mr-2 h-5 w-5 ${companyError ? "text-red-500" : "text-yellow-500"}`}
                        />
                        <div>
                          <AlertTitle className="font-bold">
                            {companyError ? companyError : "Already Taken By"}
                          </AlertTitle>
                          <AlertDescription className="flex items-center gap-2">
                            <strong className="text-[10px]">{dup.company_name}</strong>
                            <span>—</span>
                            <span className="capitalize text-[10px]">
                              {dup.owner_firstname}
                            </span>
                          </AlertDescription>
                        </div>
                      </Alert>
                    ),
                  )}
                  {duplicateInfo.length > 2 && (
                    <button
                      type="button"
                      className="mt-2 text-blue-600 hover:underline text-xs"
                      onClick={() => setShowAllDuplicates((p) => !p)}
                    >
                      {showAllDuplicates
                        ? "View Less"
                        : `View More (${duplicateInfo.length - 2} more)`}
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Contact Information - Combined Grouped UI */}
            <div className="mb-4">
              <FieldGroup>
                <FieldSet>
                  <FieldContent>
                    <FieldLabel className="font-bold">Contact Information</FieldLabel>
                    <FieldDescription>
                      Enter the contact details for each person. Contact numbers can be separated by "/" for multiple numbers per person.
                    </FieldDescription>
                  </FieldContent>

                  {/* Determine the number of contact entries (max of all three arrays) */}
                  {(() => {
                    const maxLen = Math.max(
                      formData.contact_person.length,
                      formData.contact_number.length,
                      formData.email_address.length
                    );
                    const entries = [];
                    for (let i = 0; i < maxLen; i++) {
                      const person = formData.contact_person[i] || "";
                      const number = formData.contact_number[i] || "";
                      const email = formData.email_address[i] || "";
                      
                      // Number formatting logic
                      const isIntl = number.startsWith("+");
                      const digits = number.replace(/\D/g, "");
                      const isLandline = !isIntl && digits.startsWith("0") && !digits.startsWith("09") && digits.length >= 2;
                      const isMobile = !isIntl && digits.startsWith("09");
                      const isCustom = number.startsWith("#");
                      
                      let displayVal = number;
                      if (isCustom) displayVal = number.slice(1);
                      else if (isIntl) displayVal = formatIntl(number);
                      else if (isLandline) displayVal = formatLandline(number);
                      else displayVal = formatPH(number);

                      const emailError = email && email !== "N/A" && !isValidEmail(email) ? "Invalid email format" : "";

                      entries.push(
                        <div key={i} className="border border-gray-200 rounded-none p-4 mb-4 bg-gray-50/50">
                          {/* Contact Person */}
                          <div className="mb-3">
                            <label className="text-xs font-semibold text-gray-600 uppercase mb-1 block">
                              Contact Person {i + 1}
                            </label>
                            <div className="flex gap-2">
                              <Input
                                value={person}
                                onChange={(e) => {
                                  const copy = [...formData.contact_person];
                                  copy[i] = e.target.value;
                                  updateField("contact_person", copy);
                                }}
                                placeholder="Full Name"
                                className="uppercase rounded-none flex-1"
                              />
                            </div>
                          </div>

                          {/* Contact Number */}
                          <div className="mb-3">
                            <label className="text-xs font-semibold text-gray-600 uppercase mb-1 block">
                              Contact Number {i + 1}
                            </label>
                            <div className="flex items-center gap-2">
                              <Select
                                value={isCustom ? "custom" : isIntl ? "intl" : isLandline ? "landline" : "local"}
                                onValueChange={(v) => {
                                  const copy = [...formData.contact_number];
                                  const currentDigits = number.replace(/\D/g, "");
                                  
                                  if (v === "local") {
                                    copy[i] = currentDigits.startsWith("63")
                                      ? "0" + currentDigits.slice(2)
                                      : currentDigits.startsWith("0")
                                      ? currentDigits
                                      : "09";
                                  } else if (v === "intl") {
                                    copy[i] = currentDigits.startsWith("0")
                                      ? `+63${currentDigits.slice(1)}`
                                      : currentDigits.startsWith("63")
                                      ? "+" + currentDigits
                                      : "+63";
                                  } else if (v === "landline") {
                                    copy[i] = currentDigits.startsWith("63")
                                      ? "0" + currentDigits.slice(2, 3)
                                      : currentDigits.startsWith("0") && !currentDigits.startsWith("09")
                                      ? currentDigits.slice(0, 4)
                                      : "02";
                                  } else if (v === "custom") {
                                    copy[i] = "#" + (number.startsWith("#") ? number.slice(1) : number);
                                  }
                                  updateField("contact_number", copy);
                                }}
                              >
                                <SelectTrigger className="w-[100px] rounded-none">
                                  {isCustom ? "Custom" : isIntl ? "Intl" : isLandline ? "Landline" : "Phil"}
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="local">Phil</SelectItem>
                                  <SelectItem value="landline">Landline</SelectItem>
                                  <SelectItem value="intl">Intl</SelectItem>
                                  <SelectItem value="custom">Custom</SelectItem>
                                </SelectContent>
                              </Select>

                              <Input
                                value={displayVal}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  const copy = [...formData.contact_number];
                                  if (isCustom) {
                                    copy[i] = "#" + raw;
                                  } else {
                                    const cleaned = isIntl
                                      ? "+" + raw.replace(/[^0-9]/g, "")
                                      : raw.replace(/[^0-9\/\s]/g, "");
                                    copy[i] = cleaned;
                                  }
                                  updateField("contact_number", copy);
                                }}
                                placeholder={isCustom ? "Any format" : isIntl ? "+63 917 123 4567" : isLandline ? "(02) 1234-5678" : "0917-123-4567 / 0922-456-7890"}
                                className="rounded-none flex-1"
                              />
                            </div>
                            {/* Number validation */}
                            {isMobile && digits.length > 0 && digits.length !== 11 && (
                              <p className="text-red-500 text-xs mt-1">Mobile must be 11 digits.</p>
                            )}
                            {isLandline && digits.length > 0 && (digits.length < 9 || digits.length > 10) && (
                              <p className="text-red-500 text-xs mt-1">Landline must be 9-10 digits.</p>
                            )}
                          </div>

                          {/* Email Address */}
                          <div className="mb-3">
                            <label className="text-xs font-semibold text-gray-600 uppercase mb-1 block">
                              Email Address {i + 1}
                            </label>
                            <div className="flex gap-2">
                              <Input
                                type="email"
                                value={email}
                                onChange={(e) => {
                                  const copy = [...formData.email_address];
                                  copy[i] = e.target.value;
                                  updateField("email_address", copy);
                                }}
                                placeholder="email@example.com"
                                className={`rounded-none flex-1 ${emailError ? "border-red-500" : ""}`}
                              />
                            </div>
                            {emailError && (
                              <p className="text-red-500 text-xs mt-1">{emailError}</p>
                            )}
                          </div>

                          {/* Remove Contact Entry */}
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="rounded-none"
                              disabled={maxLen === 1}
                              onClick={() => {
                                const personCopy = [...formData.contact_person];
                                const numberCopy = [...formData.contact_number];
                                const emailCopy = [...formData.email_address];
                                personCopy.splice(i, 1);
                                numberCopy.splice(i, 1);
                                emailCopy.splice(i, 1);
                                updateField("contact_person", personCopy.length > 0 ? personCopy : [""]);
                                updateField("contact_number", numberCopy.length > 0 ? numberCopy : [""]);
                                updateField("email_address", emailCopy.length > 0 ? emailCopy : [""]);
                              }}
                            >
                              <MinusIcon className="h-4 w-4 mr-1" /> Remove Contact
                            </Button>
                          </div>
                        </div>
                      );
                    }
                    return entries;
                  })()}

                  {/* Add New Contact Entry */}
                  <div className="mt-2">
                    <Button
                      type="button"
                      className="rounded-none w-full"
                      onClick={() => {
                        updateField("contact_person", [...formData.contact_person, ""]);
                        updateField("contact_number", [...formData.contact_number, ""]);
                        updateField("email_address", [...formData.email_address, ""]);
                      }}
                    >
                      <PlusIcon className="h-4 w-4 mr-1" /> Add Contact Person
                    </Button>
                  </div>
                </FieldSet>
              </FieldGroup>
            </div>

          </>
        );

      // ── Step 1: Address ─────────────────────────────────────────────────────
      case 1:
        return (
          <>
            <div className="mb-4">
              <FieldGroup>
                <FieldSet>
                  <FieldContent>
                    <FieldLabel className="font-bold">Region</FieldLabel>
                    <FieldDescription>Select the region for the company address.</FieldDescription>
                  </FieldContent>
                  <Select
                    value={formData.region || ""}
                    onValueChange={(val) => updateField("region", val)}
                  >
                    <SelectTrigger className={`w-full rounded-none ${!formData.region && formData.address ? 'border-red-500' : ''}`}>
                      <span>{formData.region || "Select Region"}</span>
                    </SelectTrigger>
                    <SelectContent>
                      {regions.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!formData.region && (
                    <p className="text-red-500 text-xs mt-1">Region is required.</p>
                  )}
                </FieldSet>
              </FieldGroup>
            </div>

            <div className="mb-4">
              <FieldGroup>
                <FieldSet>
                  <FieldContent>
                    <FieldLabel className="font-bold">Address</FieldLabel>
                    <FieldDescription>
                      Enter the complete physical address of the company.
                    </FieldDescription>
                  </FieldContent>
                  <Textarea
                    value={formData.address}
                    onChange={(e) => updateField("address", e.target.value)}
                    placeholder="Address"
                    className={`rounded-none ${!formData.address.trim() && formData.region ? 'border-red-500' : ''}`}
                  />
                  {!formData.address.trim() && (
                    <p className="text-red-500 text-xs mt-1">Address is required.</p>
                  )}
                </FieldSet>
              </FieldGroup>
            </div>

            <div className="mb-4">
              <FieldGroup>
                <FieldSet>
                  <FieldContent>
                    <FieldLabel className="font-bold">Delivery Address</FieldLabel>
                    <FieldDescription>
                      Provide the full address where goods/services should be delivered.
                    </FieldDescription>
                  </FieldContent>
                  <Textarea
                    value={formData.delivery_address}
                    onChange={(e) => updateField("delivery_address", e.target.value)}
                    placeholder="Delivery Address"
                    className={`rounded-none ${!(formData.delivery_address?.trim()) && formData.address ? 'border-red-500' : ''}`}
                  />
                  {!(formData.delivery_address?.trim()) && (
                    <p className="text-red-500 text-xs mt-1">Delivery address is required.</p>
                  )}
                </FieldSet>
              </FieldGroup>
            </div>
          </>
        );

      // ── Step 2: Classification ──────────────────────────────────────────────
      case 2:
        return (
          <>
            {/* Type Client */}
            <div className="mb-4">
              <FieldGroup>
                <FieldSet>
                  <FieldContent>
                    <FieldLabel className="font-bold">Type Client</FieldLabel>
                    <FieldDescription>Select the type of client for this company.</FieldDescription>
                  </FieldContent>
                  <RadioGroup
                    value={formData.type_client}
                    onValueChange={(val) => updateField("type_client", val)}
                  >
                    {TYPECLIENT_OPTIONS.map((tc) => (
                      <FieldLabel key={tc}>
                        <Field orientation="horizontal">
                          <FieldContent>
                            <FieldTitle>{tc}</FieldTitle>
                            <FieldDescription>
                              {tc === "New Client" &&
                                "Client is new and receiving assistance for the first time."}
                            </FieldDescription>
                          </FieldContent>
                          <RadioGroupItem value={tc} />
                        </Field>
                      </FieldLabel>
                    ))}
                  </RadioGroup>
                </FieldSet>
              </FieldGroup>
            </div>

            {/* Industry — dynamic from Supabase */}
            <div className="mb-4">
              <FieldGroup>
                <FieldSet>
                  <FieldContent>
                    <FieldLabel className="font-bold">Industry</FieldLabel>
                    <FieldDescription>
                      Select the industry sector related to this company.
                    </FieldDescription>
                  </FieldContent>

                  {loadingIndustries ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                      <Loader2 className="animate-spin h-4 w-4" />
                      Loading industries...
                    </div>
                  ) : (
                    <Select
                      value={formData.industry}
                      onValueChange={(val) => updateField("industry", val)}
                    >
                      <SelectTrigger className="w-full rounded-none">
                        <span>{formData.industry || "Select Industry"}</span>
                      </SelectTrigger>
                      <SelectContent>
                        {industries.map((ind) => (
                          <SelectItem key={ind} value={ind}>
                            {ind.replace(/_/g, " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {/* Add new industry inline */}
                  <div className="mt-2">
                    {!showAddIndustry ? (
                      <button
                        type="button"
                        className="text-xs text-blue-600 hover:underline"
                        onClick={() => setShowAddIndustry(true)}
                      >
                        + Add new industry
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          value={newIndustryInput}
                          onChange={(e) =>
                            setNewIndustryInput(e.target.value.toUpperCase())
                          }
                          placeholder="NEW_INDUSTRY_NAME"
                          className="rounded-none uppercase text-xs flex-1"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddIndustry();
                            }
                          }}
                        />
                        <Button
                          type="button"
                          className="rounded-none text-xs"
                          disabled={!newIndustryInput.trim() || addingIndustry}
                          onClick={handleAddIndustry}
                        >
                          {addingIndustry ? (
                            <Loader2 className="animate-spin h-3 w-3" />
                          ) : (
                            "Save"
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-none text-xs"
                          onClick={() => {
                            setShowAddIndustry(false);
                            setNewIndustryInput("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                </FieldSet>
              </FieldGroup>
            </div>

            {/* Status */}
            <div>
              <FieldGroup>
                <FieldSet>
                  <FieldContent>
                    <FieldLabel className="font-bold">Action</FieldLabel>
                    <FieldDescription>
                      Select the current status of the company.
                    </FieldDescription>
                  </FieldContent>
                  <RadioGroup
                    value={formData.status}
                    onValueChange={(val) => updateField("status", val)}
                  >
                    <FieldLabel>
                      <Field orientation="horizontal">
                        <FieldContent>
                          <FieldTitle>Active</FieldTitle>
                          <FieldDescription>
                            Status is active and the client is currently valid.
                          </FieldDescription>
                        </FieldContent>
                        <RadioGroupItem value="Active" />
                      </Field>
                    </FieldLabel>
                  </RadioGroup>
                </FieldSet>
              </FieldGroup>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Sheet open={open} onOpenChange={onOpenChangeAction}>
      <SheetContent
        side="right"
        className="w-full sm:w-[600px] overflow-auto custom-scrollbar"
      >
        <SheetHeader>
          <SheetTitle>
            {mode === "edit" ? "Edit Account" : "Create New Account"}
          </SheetTitle>
          <SheetDescription>
            Step {step + 1} of {TOTAL_STEPS}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 mt-4 p-4">{renderStepContent()}</div>

        {/* Navigation */}
        <div className="p-4 grid gap-4">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={step === 0}
            type="button"
            className="rounded-none p-6 font-bold"
          >
            <ArrowLeft /> Back
          </Button>

          {step === TOTAL_STEPS - 1 ? (
            <Button
              onClick={handleSubmit}
              type="button"
              disabled={!canProceedToNext()}
              className="rounded-none p-10 font-bold"
            >
              <CheckCircle2Icon />
              {mode === "edit" ? "Save Changes" : "Create Account"}
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              disabled={!canProceedToNext()}
              type="button"
              className="rounded-none p-6 font-bold"
            >
              Next <ArrowRight />
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}