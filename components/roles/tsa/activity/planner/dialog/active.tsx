"use client";

import React, { useState, useEffect, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, } from "@/components/ui/select";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldSet, FieldTitle, } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertCircleIcon, PlusIcon, MinusIcon, CheckCircle2Icon, } from "lucide-react";

// --- Clean & normalize company name for checks ---
function cleanCompanyName(name: string) {
  if (!name) return "";
  let n = name.toUpperCase();
  n = n.replace(/[-_.@!$%]/g, ""); // remove special chars
  n = n.replace(/\s+/g, " ").trim(); // remove extra spaces
  n = n.replace(/\d+$/g, ""); // trailing digits removal
  return n.trim();
}

const INDUSTRY_OPTIONS = [
  "ACCOMMODATION_AND_FOOD_SERVICE_ACTIVITIES",
  "ACTIVITIES_OF_EXTRATERRITORIAL_ORGANIZATIONS_AND_BODIES",
  "ACTIVITIES_OF_HOUSEHOLDS_AS_EMPLOYERS_UNDIFFERENTIATED_GOODS_AND_SERVICES_PRODUCING_ACTIVITIES_OF_HOUSEHOLDS_FOR_OWN_USE",
  "ADMINISTRATIVE_AND_SUPPORT_SERVICE_ACTIVITIES",
  "ADVERTISING_AND_MARKETING",
  "AGRICULTURE_FORESTRY_AND_FISHING",
  "ARTS_ENTERTAINMENT_AND_RECREATION",
  "AUTOMOTIVE",
  "B2C_BUSINESS_TO_CONSUMER",
  "B2G_BUSINESS_TO_GOVERNMENT",
  "CEMETERY_SERVICES",
  "COMMUNITY_MANAGEMENT",
  "CONSTRUCTION",
  "EDUCATION",
  "EDUCATION_AND_HUMAN_HEALTH_AND_SOCIAL_WORK_ACTIVITIES",
  "EDUCATION_AND_TRAINING",
  "ELECTRICITY_GAS_STEAM_AND_AIR_CONDITIONING_SUPPLY",
  "ENGINEERING",
  "FINANCIAL_AND_INSURANCE_ACTIVITIES",
  "FOOD_AND_BEVERAGE",
  "FORMATION_AND_COMMUNICATIO",
  "FUNERAL_SERVICES",
  "HEALTHCARE_AND_SERVICES",
  "HUMAN_HEALTH_AND_SOCIAL_WORK_ACTIVITIES",
  "INDIVIDUAL",
  "INDUSTRIAL_SAFETY",
  "INDUSTRY",
  "INFORMATION_AND_COMMUNICATION",
  "INSURANCE",
  "LOGISTICS_AND_TRANSPORTATION",
  "MANUFACTURING",
  "MINING_AND_QUARRYING",
  "OTHER_SERVICE_ACTIVITIES",
  "PAINTS_USED_IN_BUILDING",
  "PROFESSIONAL_SCIENTIFIC_AND_TECHNICAL_ACTIVITIES",
  "PUBLIC_ADMINISTRATION_AND_DEFENSE_COMPULSORY_SOCIAL_SECURITY",
  "REAL_ESTATE_ACTIVITIES",
  "RENEWABLE_ENERGY_HYDROPOWER",
  "SUPPORT_SERVICE_ACTIVITIES_OR_PROFESSIONAL_TECHNICAL_SERVICES",
  "TECHNICAL_ACTIVITIES",
  "TRADING",
  "TRANSPORTATION_AND_STORAGE",
  "WATER_SUPPLY_SEWERAGE_WASTE_MANAGEMENT_AND_REMEDIATION_ACTIVITIES",
  "WHOLESALE_AND_RETAIL_TRADE",
  "OTHER",
];

const TYPECLIENT_OPTIONS = ["TSA CLIENT", "New Client"];

// Simple email validation helper
function isValidEmail(email: string): boolean {
  if (!email) return false;

  const lower = email.trim().toLowerCase();

  if (["none", "n/a", "na"].includes(lower)) return false;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

  return emailRegex.test(email);
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

export function AccountDialog({
  mode,
  initialData,
  userDetails,
  onSaveAction,
  open,
  onOpenChangeAction,
}: AccountDialogProps) {
  // --- Form state ---
  const [formData, setFormData] = useState<AccountFormData>({
    company_name: "",
    contact_person: [""],
    contact_number: [""],
    email_address: [""],
    address: "",
    region: "",
    status: "Active",
    delivery_address: "",
    type_client: "TSA CLIENT",
    industry: "OTHER",
    company_group: "",
    ...initialData,
  });

  // --- Duplicate check ---
  const [companyError, setCompanyError] = useState("");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [agentsError, setAgentsError] = useState<string | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateCompany[]>([]);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [showAllDuplicates, setShowAllDuplicates] = useState(false);
  const displayedDuplicates = showAllDuplicates ? duplicateInfo : duplicateInfo.slice(0, 2);

  const submitLock = useRef(false);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  const [regions, setRegions] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedCity, setSelectedCity] = useState(""); // Add this line

  // --- Fetch agents on mount ---
  useEffect(() => {
    if (!userDetails.referenceid) return;

    async function fetchAgents() {
      setAgentsLoading(true);
      setAgentsError(null);
      try {
        const res = await fetch(`/api/fetch-all-user-transfer`);
        if (!res.ok) throw new Error("Failed to fetch agents");
        const data = await res.json();

        const normalizedAgents = data.map((agent: any) => ({
          referenceid: agent.ReferenceID,
          firstname: `${agent.Firstname} ${agent.Lastname}`.trim(),
        }));

        setAgents(normalizedAgents);
      } catch (err) {
        setAgentsError((err as Error).message || "Failed to load agents");
        setAgents([]);
      } finally {
        setAgentsLoading(false);
      }
    }

    fetchAgents();
  }, [userDetails.referenceid]);

  // --- Duplicate check on company_name change ---
  useEffect(() => {
    if (mode === "edit") {
      setCompanyError("");
      setDuplicateInfo([]);
      setIsCheckingDuplicate(false);
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
      const signal = controller.signal;

      fetch(
        `/api/com-check-duplicate-account?company_name=${encodeURIComponent(
          cleaned
        )}`,
        { signal }
      )
        .then(async (res) => {
          if (!res.ok) throw new Error("Failed to check duplicates");

          const data: {
            exists: boolean;
            companies: DuplicateCompany[];
          } = await res.json();

          if (data.exists && data.companies.length > 0) {
            // Add owner_firstname from agents
            const matchedCompanies = data.companies.map((company) => {
              const agent = agents.find(
                (a) => a.referenceid === company.owner_referenceid
              );
              return {
                ...company,
                owner_firstname: agent ? agent.firstname : company.owner_referenceid,
              };
            });

            setDuplicateInfo(matchedCompanies);
          } else {
            setDuplicateInfo([]);
          }
          setCompanyError(""); // Clear error here, actual contact duplicate check separate
        })
        .catch((err) => {
          if (err.name !== "AbortError") {
            setCompanyError("Failed to validate company name");
            setDuplicateInfo([]);
          }
        })
        .finally(() => setIsCheckingDuplicate(false));

      return () => controller.abort();
    }, 500);

    return () => {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    };
  }, [formData.company_name, userDetails.referenceid, mode, agents]);

  function normalizePHNumber(number: string): string {
    if (!number) return "";

    // Remove non-digit characters (spaces, dashes, +, etc)
    let n = number.replace(/\D/g, "");

    // Remove country code '63' if present at start
    if (n.startsWith("63")) {
      n = "0" + n.slice(2);
    }

    // If starts with 9 and length is 10 digits (like 9175615230), add leading zero
    if (n.length === 10 && n.startsWith("9")) {
      n = "0" + n;
    }

    return n;
  }

  // --- Check duplicate contact person & number reactively ---
  useEffect(() => {
    if (!duplicateInfo.length) {
      setCompanyError(""); // No duplicates, clear error
      return;
    }

    let blockCreation = false;
    let errorMsg = "";

    for (const dup of duplicateInfo) {
      const contactPersonMatch = dup.contact_person?.some((cp) =>
        formData.contact_person.some(
          (fcp) => fcp.trim().toUpperCase() === cp.trim().toUpperCase()
        )
      );

      const contactNumberMatch = dup.contact_number?.some((cn) =>
        formData.contact_number.some((fcn) =>
          normalizePHNumber(fcn) === normalizePHNumber(cn)
        )
      );

      if (contactPersonMatch || contactNumberMatch) {
        blockCreation = true;
        errorMsg = `Duplicate contact person or number detected for company "${dup.company_name}".`;
        break;
      }
    }


    if (blockCreation) {
      setCompanyError(errorMsg);
    } else {
      setCompanyError("");
    }
  }, [formData.contact_person, formData.contact_number, duplicateInfo, userDetails.referenceid]);

  // --- Stepper state ---
  const [step, setStep] = useState(0);
  const totalSteps = 3;

  function canProceedToNext() {
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
          formData.delivery_address.trim() !== "" &&
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
  }

  function handleNext() {
    if (step < totalSteps - 1 && canProceedToNext()) setStep((s) => s + 1);
  }
  function handleBack() {
    if (step > 0) setStep((s) => s - 1);
  }

  // --- Form submission ---
  async function handleSubmit() {
    if (submitLock.current) return;
    submitLock.current = true;

    if (companyError) {
      toast.error(companyError);
      submitLock.current = false;
      return;
    }

    for (const em of formData.email_address) {
      if (em.trim() && em.trim().toLowerCase() !== "n/a" && !isValidEmail(em)) {
        toast.error(`Invalid email address: ${em}`);
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
      await onSaveAction(cleanData);  // wait for save to complete
      toast.success("Saved successfully!");

      onOpenChangeAction(false);

      // Reload after a short delay to let UI update
      setTimeout(() => {
        submitLock.current = false;
        window.location.reload();
      }, 500);

    } catch (error) {
      toast.error("Save failed. Please try again.");
      submitLock.current = false;
    }
  }

  useEffect(() => {
    // Fetch regions on mount
    fetch("https://psgc.gitlab.io/api/regions")
      .then(res => res.json())
      .then(data => setRegions(data.map((r: any) => r.name)))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedRegion) {
      setCities([]);
      return;
    }

    // Fetch cities/provinces based on selectedRegion
    fetch(`https://psgc.gitlab.io/api/regions/${encodeURIComponent(selectedRegion)}/provinces`)
      .then(res => res.json())
      .then(data => setCities(data.map((c: any) => c.name)))
      .catch(console.error);
  }, [selectedRegion]);

  // --- UI for each step ---
  const renderStepContent = () => {
    switch (step) {
      case 0:
        return (
          <>
            {/* Company Name */}
            {/* Company Name */}
            <div>
              <FieldContent>
                <FieldLabel>Company Name</FieldLabel>
                <FieldDescription>
                  Enter the official registered name of the company.
                </FieldDescription>
              </FieldContent>


              <Input
                required
                value={formData.company_name}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    company_name: e.target.value,
                  }))
                }
                placeholder="Company Name"
                className="uppercase"
              />

              {isCheckingDuplicate && (
                <Alert>
                  <CheckCircle2Icon />
                  <AlertTitle>Checking duplicates...</AlertTitle>
                </Alert>
              )}

              {duplicateInfo.length > 0 && (
                <>
                  {displayedDuplicates.map((dup) => (
                    <Alert
                      key={dup.owner_referenceid + dup.company_name}
                      variant={companyError ? "destructive" : "default"}
                      className={`mt-2 ${!companyError ? "bg-yellow-100 text-yellow-800" : ""}`}
                    >
                      <AlertCircleIcon
                        className={`mr-2 h-5 w-5 ${companyError ? "text-red-500" : "text-yellow-500"}`}
                      />
                      <div>
                        <AlertTitle>
                          {companyError ? companyError : "Already Taken By"}
                        </AlertTitle>
                        <AlertDescription className="flex items-center gap-2">
                          <strong className="text-[10px]">{dup.company_name}</strong>
                          <span>—</span>
                          <span className="capitalize text-[10px]">{dup.owner_firstname}</span>
                        </AlertDescription>
                      </div>
                    </Alert>
                  ))}

                  {duplicateInfo.length > 2 && (
                    <button
                      type="button"
                      className="mt-2 text-blue-600 hover:underline text-xs"
                      onClick={() => setShowAllDuplicates((prev) => !prev)}
                    >
                      {showAllDuplicates
                        ? "View Less"
                        : `View More (${duplicateInfo.length - 2} more)`}
                    </button>
                  )}
                </>
              )}
            </div>
            {/* Contact Person(s) */}
            <div className="mt-4">
              <FieldGroup>
                <FieldSet>
                  <FieldContent>
                    <FieldLabel>Contact Person(s)</FieldLabel>
                    <FieldDescription>
                      Enter the full name(s) of the primary contact person(s) for this company.
                    </FieldDescription>
                  </FieldContent>

                  {formData.contact_person.map((cp, i) => (
                    <div key={i} className="flex items-center gap-2 mb-2">
                      <Input
                        value={cp}
                        onChange={(e) => {
                          const val = e.target.value;
                          const newCP = [...formData.contact_person];
                          newCP[i] = val;
                          setFormData((prev) => ({ ...prev, contact_person: newCP }));
                        }}
                        placeholder="Contact Person"
                        className="uppercase flex-grow"
                      />
                      <Button
                        type="button"
                        onClick={() => {
                          if (formData.contact_person.length > 1) {
                            const newCP = [...formData.contact_person];
                            newCP.splice(i, 1);
                            setFormData((prev) => ({ ...prev, contact_person: newCP }));
                          }
                        }}
                        disabled={formData.contact_person.length === 1}
                        variant="destructive"

                      >
                        <MinusIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            contact_person: [...prev.contact_person, ""],
                          }))
                        }
                        className="flex items-center gap-1"
                      >
                        <PlusIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                </FieldSet>
              </FieldGroup>
            </div>

            {/* Contact Number(s) */}
            <div className="mt-4">
              <FieldGroup>
                <FieldSet>
                  <FieldContent>
                    <FieldLabel>Contact Number(s)</FieldLabel>
                    <FieldDescription>
                      Enter the phone number(s) of the primary contact person(s) for this company.
                    </FieldDescription>
                  </FieldContent>

                  {formData.contact_number.map((cn, i) => {
                    const isIntl = cn.startsWith("+");

                    // --- AUTO-FORMATTERS ---

                    // Format Philippine Number → 0917-123-4567
                    const formatPH = (val: string) => {
                      val = val.replace(/\D/g, "").slice(0, 11);
                      if (val.length <= 4) return val;
                      if (val.length <= 7) return `${val.slice(0, 4)}-${val.slice(4)}`;
                      return `${val.slice(0, 4)}-${val.slice(4, 7)}-${val.slice(7)}`;
                    };

                    // Format International → +63 917 123 4567
                    const formatIntl = (val: string) => {
                      val = val.replace(/[^0-9+]/g, "");

                      // Ensure one "+" at start
                      if (val.indexOf("+") > 0) val = "+" + val.replace(/\+/g, "");

                      // Remove spaces for processing
                      const raw = val.replace(/\s+/g, "");
                      const digits = raw.replace(/\D/g, "");

                      // Return plain if too short
                      if (digits.length < 4) return val;

                      // Example formatting: +CC AAA BBB CCCC
                      const country = digits.slice(0, 2); // "63"
                      const rest = digits.slice(2);

                      if (rest.length <= 3) return `+${country} ${rest}`;
                      if (rest.length <= 6) return `+${country} ${rest.slice(0, 3)} ${rest.slice(3)}`;
                      if (rest.length <= 10)
                        return `+${country} ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6)}`;

                      return `+${country} ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6, 10)} ${rest.slice(10)}`;
                    };

                    const formattedValue = isIntl ? formatIntl(cn) : formatPH(cn);

                    return (
                      <div key={i} className="flex flex-col gap-2 mb-4">

                        <div className="flex items-center gap-2">
                          {/* Toggle Format */}
                          <Select
                            defaultValue={isIntl ? "intl" : "local"}
                            onValueChange={(v) => {
                              setFormData((prev) => {
                                const copy = [...prev.contact_number];

                                if (v === "local") {
                                  // Convert +63 917 123 4567 → 09171234567
                                  const digits = cn.replace(/\D/g, "");
                                  copy[i] = digits.startsWith("63")
                                    ? "0" + digits.slice(2)
                                    : "";
                                } else {
                                  // Convert 0917-123-4567 → +63 917 123 4567
                                  const digits = cn.replace(/\D/g, "");
                                  copy[i] = digits.startsWith("0")
                                    ? `+63${digits.slice(1)}`
                                    : "+";
                                }

                                return { ...prev, contact_number: copy };
                              });
                            }}
                          >
                            <SelectTrigger className="w-[140px]">
                              {isIntl ? "International" : "Philippines"}
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="local">Philippines</SelectItem>
                              <SelectItem value="intl">International</SelectItem>
                            </SelectContent>
                          </Select>

                          {/* Input Field */}
                          <Input
                            value={formattedValue}
                            onChange={(e) => {
                              let val = e.target.value;

                              // For internal storage, remove formatting
                              const raw = val.replace(/\D/g, "");
                              const storeVal = isIntl ? "+" + raw : raw;

                              setFormData((prev) => {
                                const copy = [...prev.contact_number];
                                copy[i] = storeVal;
                                return { ...prev, contact_number: copy };
                              });
                            }}
                            placeholder={isIntl ? "+63 917 123 4567" : "0917-123-4567"}
                            className="uppercase"
                          />

                          {/* Remove */}
                          <Button
                            type="button"
                            variant="destructive"
                            onClick={() => {
                              if (formData.contact_number.length > 1) {
                                setFormData((prev) => {
                                  const copy = [...prev.contact_number];
                                  copy.splice(i, 1);
                                  return { ...prev, contact_number: copy };
                                });
                              }
                            }}
                            disabled={formData.contact_number.length === 1}
                          >
                            <MinusIcon />
                          </Button>
                          <Button
                            type="button"
                            onClick={() =>
                              setFormData((prev) => ({
                                ...prev,
                                contact_number: [...prev.contact_number, ""],
                              }))
                            }
                          >
                            <PlusIcon />
                          </Button>
                        </div>

                        {/* Validation Text */}
                        {!isIntl && cn.replace(/\D/g, "").length !== 11 && (
                          <p className="text-red-500 text-xs">Local PH numbers must be exactly 11 digits.</p>
                        )}
                        {isIntl && !/^\+\d{5,15}$/.test(cn.replace(/\s+/g, "")) && (
                          <p className="text-red-500 text-xs">Invalid international number format.</p>
                        )}

                      </div>
                    );
                  })}
                </FieldSet>
              </FieldGroup>
            </div>
            {/* Email Address(es) */}
            <div>
              <FieldGroup>
                <FieldSet>
                  <FieldContent>
                    <FieldLabel>Email Address(es)</FieldLabel>
                    <FieldDescription>
                      Enter the email address(es) of the primary contact person(s) for this company.
                    </FieldDescription>
                  </FieldContent>
                  {formData.email_address.map((em, i) => {
                    const isNA = em === "N/A";
                    const emailError = em && !isNA && !isValidEmail(em) ? "Invalid email format or domain" : "";

                    return (
                      <div key={i} className="flex gap-2 mb-2">

                        <Input
                          type="email"
                          value={em}
                          disabled={isNA}
                          required={!isNA}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData((prev) => {
                              const copy = [...prev.email_address];
                              copy[i] = val;
                              return { ...prev, email_address: copy };
                            });
                          }}
                          placeholder="Email Address"
                          className={emailError ? "border-red-500" : ""}
                        />

                        {!isNA && emailError && (
                          <p className="text-red-500 text-sm">{emailError}</p>
                        )}

                        <Button
                          type="button"
                          variant="destructive"
                          onClick={() => {
                            if (formData.email_address.length > 1) {
                              setFormData((prev) => {
                                const copy = [...prev.email_address];
                                copy.splice(i, 1);
                                return { ...prev, email_address: copy };
                              });
                            }
                          }}
                          disabled={formData.email_address.length === 1 || isNA}
                        >
                          <MinusIcon />
                        </Button>
                        <Button
                          type="button"
                          disabled={formData.email_address[0] === "N/A"}
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              email_address: [...prev.email_address, ""],
                            }))
                          }
                        >
                          <PlusIcon />
                        </Button>
                      </div>
                    );
                  })}

                  {/* Checkbox: Check if no email */}
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      type="checkbox"
                      id="no-email-checkbox"
                      checked={formData.email_address[0] === "N/A"}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setFormData((prev) => ({
                          ...prev,
                          email_address: checked ? ["N/A"] : [""],
                        }));
                      }}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="no-email-checkbox" className="text-sm">
                      Check if no email
                    </Label>
                  </div>
                </FieldSet>
              </FieldGroup>
            </div>
          </>
        );
      case 1:
        return (
          <>
            <div className="mb-4">
              <FieldGroup>
                <FieldSet>
                  <FieldContent>
                    <FieldLabel>Region</FieldLabel>
                    <FieldDescription>
                      Select the region for the company address.
                    </FieldDescription>
                  </FieldContent>

                  <Select
                    value={formData.region || ""}
                    onValueChange={(val) => {
                      setFormData((prev) => ({
                        ...prev,
                        region: val,
                        selectedRegion: val,
                      }));
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <span>{formData.region || "Select Region"}</span>
                    </SelectTrigger>
                    <SelectContent>
                      {regions.map((region) => (
                        <SelectItem key={region} value={region}>
                          {region}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                </FieldSet>
              </FieldGroup>
            </div>

            <div className="mb-4">
              <FieldGroup>
                <FieldSet>
                  <FieldContent>
                    <FieldLabel>Address</FieldLabel>
                    <FieldDescription>
                      Enter the complete physical address of the company.
                    </FieldDescription>
                  </FieldContent>

                  <Textarea
                    value={formData.address}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, address: e.target.value }))
                    }
                    placeholder="Address"
                  />
                </FieldSet>
              </FieldGroup>
            </div>

            <div className="mb-4">
              <FieldGroup>
                <FieldSet>
                  <FieldContent>
                    <FieldLabel>Delivery Address</FieldLabel>
                    <FieldDescription>
                      Provide the full address where goods or services should be delivered.
                    </FieldDescription>
                  </FieldContent>

                  <Textarea
                    value={formData.delivery_address}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, delivery_address: e.target.value }))
                    }
                    placeholder="Delivery Address"
                  />
                </FieldSet>
              </FieldGroup>
            </div>
          </>

        );
      case 2:
        return (
          <>
            <div className="mb-4">
              <FieldGroup>
                <FieldSet>
                  <FieldContent>
                    <FieldLabel>Type Client</FieldLabel>
                    <FieldDescription>
                      Select the type of client for this company.
                    </FieldDescription>
                  </FieldContent>
                  <RadioGroup
                    value={formData.type_client}
                    onValueChange={(val) =>
                      setFormData((prev) => ({ ...prev, type_client: val }))
                    }
                  >
                    {TYPECLIENT_OPTIONS.map((typeClient) => (
                      <FieldLabel key={typeClient}>
                        <Field orientation="horizontal">
                          <FieldContent>
                            <FieldTitle>{typeClient}</FieldTitle>
                            <FieldDescription>
                              {typeClient === "TSA CLIENT" &&
                                "Client was assisted and provided with the needed information or support."}

                              {typeClient === "New Client" &&
                                "Client is new and is receiving assistance or information for the first time."}
                            </FieldDescription>
                          </FieldContent>

                          <RadioGroupItem value={typeClient} />
                        </Field>
                      </FieldLabel>
                    ))}
                  </RadioGroup>
                </FieldSet>
              </FieldGroup>
            </div>

            <div className="mb-4">
              <FieldGroup>
                <FieldSet>
                  <FieldContent>
                    <FieldLabel>Industry</FieldLabel>
                    <FieldDescription>
                      Select the industry sector related to this company.
                    </FieldDescription>
                  </FieldContent>
                  <Select
                    value={formData.industry}
                    onValueChange={(val) =>
                      setFormData((prev) => ({ ...prev, industry: val }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <span>{formData.industry || "Select Industry"}</span>
                    </SelectTrigger>
                    <SelectContent>
                      {INDUSTRY_OPTIONS.map((industry) => (
                        <SelectItem key={industry} value={industry}>
                          {industry}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldSet>
              </FieldGroup>
            </div>

            <div>
              <FieldGroup>
                <FieldSet>
                  <FieldContent>
                    <FieldLabel>Status</FieldLabel>
                    <FieldDescription>
                      Select the current status of the company.
                    </FieldDescription>
                  </FieldContent>
                  <RadioGroup
                    value={formData.status}
                    onValueChange={(val) => setFormData((prev) => ({ ...prev, status: val }))}
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

  return (
    <Sheet open={open} onOpenChange={onOpenChangeAction}>
      <SheetContent side="right" className="w-full sm:w-[600px] overflow-auto custom-scrollbar">
        <SheetHeader>
          <SheetTitle>
            {mode === "edit" ? "Edit Account" : "Create New Account"}
          </SheetTitle>
          <SheetDescription>
            Step {step + 1} of {totalSteps}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 mt-4 p-4">{renderStepContent()}</div>

        {/* Stepper Buttons */}
        <div className="p-4 grid gap-6">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={step === 0}
            type="button"
          >
            Back
          </Button>

          {step === totalSteps - 1 ? (
            <Button
              onClick={handleSubmit}
              type="button"
              disabled={!canProceedToNext()}
            >
              {mode === "edit" ? "Save Changes" : "Create Account"}
            </Button>
          ) : (
            <Button onClick={handleNext} disabled={!canProceedToNext()}>
              Next
            </Button>

          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
