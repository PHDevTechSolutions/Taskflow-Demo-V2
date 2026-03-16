"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { UserProvider } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SidebarLeft } from "@/components/sidebar-left";
import { SidebarRight } from "@/components/sidebar-right";
import Image from "next/image";
import SignatureCanvas from "react-signature-canvas";

import {
  Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset, SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { type DateRange } from "react-day-picker";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";

import {
  Eye, EyeOff, WandSparkles, ImagePlus, Save,
  PenTool, Eraser, UploadCloud, X, User, Phone,
  Mail, MapPin, KeyRound, ShieldCheck, Loader2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserDetails {
  id: string;
  Firstname: string;
  Lastname: string;
  Email: string;
  Role: string;
  Department: string;
  Status: string;
  ContactNumber: string;
  profilePicture: string;
  signatureImage?: string;
  Password?: string;
  ContactPassword?: string;
  OtherEmail: string;
  AnotherNumber: string;
  Address: string;
  Birthday: string;
  Gender: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const generatePassword = (): string => {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
  return Array.from({ length: 10 }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join("");
};

const calcPasswordStrength = (
  pw: string
): "weak" | "medium" | "strong" | "" => {
  if (!pw) return "";
  if (pw.length < 4) return "weak";
  if (/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/.test(pw)) return "strong";
  if (/^(?=.*[a-z])(?=.*\d).{6,}$/.test(pw)) return "medium";
  return "weak";
};

const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dhczsyzcz/image/upload";
const UPLOAD_PRESET = "Xchire";

// ─── Section wrapper ──────────────────────────────────────────────────────────

const Section = ({
  icon: Icon,
  title,
  children,
  className = "",
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={`border border-gray-200 bg-white ${className}`}>
    <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
      <Icon className="w-3.5 h-3.5 text-gray-500" />
      <span className="text-[11px] font-black uppercase tracking-widest text-gray-600">
        {title}
      </span>
    </div>
    <div className="p-4">{children}</div>
  </div>
);

// ─── Field wrapper ────────────────────────────────────────────────────────────

const Field = ({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={`flex flex-col gap-1.5 ${className}`}>
    <Label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
      {label}
    </Label>
    {children}
  </div>
);

// ─── Strength bar ─────────────────────────────────────────────────────────────

const StrengthBar = ({ strength }: { strength: "weak" | "medium" | "strong" | "" }) => {
  if (!strength) return null;
  const levels = { weak: 1, medium: 2, strong: 3 };
  const colors = {
    weak: "bg-red-500",
    medium: "bg-amber-500",
    strong: "bg-emerald-500",
  };
  const labels = { weak: "Weak", medium: "Medium", strong: "Strong" };

  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex gap-1 flex-1">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all ${
              i <= levels[strength] ? colors[strength] : "bg-gray-200"
            }`}
          />
        ))}
      </div>
      <span
        className={`text-[10px] font-bold ${
          strength === "strong"
            ? "text-emerald-600"
            : strength === "medium"
            ? "text-amber-600"
            : "text-red-600"
        }`}
      >
        {labels[strength]}
      </span>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProfileClient() {
  const searchParams = useSearchParams();
  const userId = searchParams?.get("id") ?? "";
  const sigCanvas = useRef<SignatureCanvas>(null);

  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);

  const [sigMethod, setSigMethod] = useState<"pad" | "upload">("pad");
  const [sigFilePreview, setSigFilePreview] = useState<string | null>(null);
  const [selectedSigFile, setSelectedSigFile] = useState<File | null>(null);

  const [passwordStrength, setPasswordStrength] = useState<
    "weak" | "medium" | "strong" | ""
  >("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [dateCreatedFilterRange, setDateCreatedFilterRangeAction] =
    useState<DateRange | undefined>(undefined);

  // ─── Fetch user ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!userId) {
      setError("User ID missing in URL");
      setLoading(false);
      return;
    }

    const fetchUser = async () => {
      try {
        const res = await fetch(`/api/user?id=${encodeURIComponent(userId)}`);
        if (!res.ok) throw new Error("Failed to fetch user");
        const data = await res.json();

        setUserDetails({
          id: data._id || "",
          Firstname: data.Firstname || "",
          Lastname: data.Lastname || "",
          Email: data.Email || "",
          Role: data.Role || "",
          Department: data.Department || "",
          Status: data.Status || "",
          ContactNumber: data.ContactNumber || "",
          profilePicture: data.profilePicture || "",
          signatureImage: data.signatureImage || "",
          Password: "",
          ContactPassword: "",
          OtherEmail: data.OtherEmail || "",
          AnotherNumber: data.AnotherNumber || "",
          Address: data.Address || "",
          Birthday: data.Birthday || "",
          Gender: data.Gender || "",
        });
      } catch (e) {
        console.error(e);
        setError("Error loading user data");
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [userId]);

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!userDetails) return;
    const { name, value } = e.target;
    setUserDetails((prev) => prev ? { ...prev, [name]: value } : prev);
    if (name === "Password") setPasswordStrength(calcPasswordStrength(value));
  };

  const handleGeneratePassword = () => {
    const pw = generatePassword();
    setUserDetails((prev) =>
      prev ? { ...prev, Password: pw, ContactPassword: pw } : prev
    );
    setPasswordStrength(calcPasswordStrength(pw));
  };

  // Upload to Cloudinary — accepts File or data URL string
  const handleImageUpload = useCallback(
    async (file: File | string, isSignature = false) => {
      if (isSignature) setUploadingSignature(true);
      else setUploading(true);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", UPLOAD_PRESET);

      try {
        const res = await fetch(CLOUDINARY_URL, { method: "POST", body: formData });
        if (!res.ok) throw new Error("Cloudinary upload failed");
        const json = await res.json();

        if (json.secure_url) {
          setUserDetails((prev) =>
            prev
              ? {
                  ...prev,
                  [isSignature ? "signatureImage" : "profilePicture"]: json.secure_url,
                }
              : prev
          );
          toast.success(`${isSignature ? "Signature" : "Photo"} uploaded`);
          if (isSignature) {
            setSigFilePreview(null);
            setSelectedSigFile(null);
          }
        } else {
          throw new Error("No secure_url in response");
        }
      } catch (err) {
        console.error(err);
        toast.error("Upload failed — please try again");
      } finally {
        if (isSignature) setUploadingSignature(false);
        else setUploading(false);
      }
    },
    []
  );

  const onImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleImageUpload(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const onSignatureFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedSigFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setSigFilePreview(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const saveSignatureFromPad = () => {
    if (sigCanvas.current?.isEmpty()) {
      toast.error("Please draw your signature first");
      return;
    }
    const dataUrl = sigCanvas.current?.getTrimmedCanvas().toDataURL("image/png");
    if (dataUrl) handleImageUpload(dataUrl, true);
  };

  // ─── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userDetails) return;

    if (userDetails.Password && userDetails.Password.length > 10) {
      toast.error("Password must be at most 10 characters");
      return;
    }
    if (userDetails.Password !== userDetails.ContactPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setSaving(true);

    try {
      const { Password, ContactPassword, id, ...rest } = userDetails;
      const payload = {
        ...rest,
        id,
        ...(Password ? { Password } : {}),
        profilePicture: userDetails.profilePicture,
        signatureImage: userDetails.signatureImage,
      };

      const res = await fetch("/api/profile-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to update profile");

      toast.success("Profile saved successfully");
      setUserDetails((prev) =>
        prev ? { ...prev, Password: "", ContactPassword: "" } : prev
      );
      setPasswordStrength("");
    } catch (err) {
      console.error(err);
      toast.error("Error saving profile");
    } finally {
      setSaving(false);
    }
  };

  // ─── Loading / error states ───────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen gap-2 text-gray-500 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading profile…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen text-red-500 text-sm">
        {error}
      </div>
    );
  }

  if (!userDetails) return null;

  const isBusy = saving || uploading;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <ProtectedPageWrapper>
      <UserProvider>
        <FormatProvider>
          <SidebarProvider>
            <SidebarLeft />

            <SidebarInset>
              {/* ── Page header ─────────────────────────────────────── */}
              <header className="bg-background sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b border-gray-100">
                <div className="flex flex-1 items-center gap-2 px-3">
                  <SidebarTrigger />
                  <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
                  <Breadcrumb>
                    <BreadcrumbList>
                      <BreadcrumbItem>
                        <BreadcrumbPage className="text-xs font-semibold uppercase tracking-wide">
                          Profile Settings
                        </BreadcrumbPage>
                      </BreadcrumbItem>
                    </BreadcrumbList>
                  </Breadcrumb>
                </div>

                {/* Role badge */}
                {userDetails.Role && (
                  <div className="pr-4">
                    <span className="text-[10px] font-black uppercase tracking-widest bg-gray-900 text-white px-2.5 py-1">
                      {userDetails.Role}
                    </span>
                  </div>
                )}
              </header>

              {/* ── Content ─────────────────────────────────────────── */}
              <div className="flex flex-col gap-6 p-5 max-w-5xl mx-auto w-full">

                {/* Avatar + form side-by-side on md+ */}
                <div className="flex flex-col md:flex-row gap-5 items-start">

                  {/* ── Left: Avatar ─────────────────────────────────── */}
                  <div className="w-full md:w-56 shrink-0 flex flex-col items-center gap-3">
                    {/* Avatar display */}
                    <div className="w-full aspect-square relative overflow-hidden border-2 border-gray-200 bg-gray-100">
                      {userDetails.profilePicture ? (
                        <Image
                          src={userDetails.profilePicture}
                          alt={`${userDetails.Firstname} ${userDetails.Lastname}`}
                          fill
                          className="object-cover"
                          sizes="224px"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-300">
                          <User className="w-12 h-12" />
                          <span className="text-[10px] uppercase tracking-wide font-semibold">
                            No Photo
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Upload button */}
                    <input
                      type="file"
                      id="profilePicture"
                      accept="image/*"
                      onChange={onImageChange}
                      disabled={uploading}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full rounded-none text-[10px] font-bold uppercase tracking-wider h-8 gap-1.5"
                      onClick={() => document.getElementById("profilePicture")?.click()}
                      disabled={uploading}
                    >
                      {uploading ? (
                        <><Loader2 className="w-3 h-3 animate-spin" /> Uploading…</>
                      ) : (
                        <><ImagePlus className="w-3 h-3" /> Change Photo</>
                      )}
                    </Button>

                    {/* Identity chip */}
                    <div className="w-full text-center">
                      <p className="text-sm font-black text-gray-800 uppercase tracking-tight leading-tight">
                        {userDetails.Firstname} {userDetails.Lastname}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{userDetails.Email}</p>
                    </div>
                  </div>

                  {/* ── Right: Form ───────────────────────────────────── */}
                  <form
                    onSubmit={handleSubmit}
                    className="flex-1 flex flex-col gap-4"
                    noValidate
                  >
                    {/* Personal Info */}
                    <Section icon={User} title="Personal Information">
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="First Name">
                          <Input
                            name="Firstname"
                            value={userDetails.Firstname}
                            onChange={handleChange}
                            autoComplete="given-name"
                            required
                            className="rounded-none h-8 text-xs"
                          />
                        </Field>
                        <Field label="Last Name">
                          <Input
                            name="Lastname"
                            value={userDetails.Lastname}
                            onChange={handleChange}
                            autoComplete="family-name"
                            required
                            className="rounded-none h-8 text-xs"
                          />
                        </Field>
                        <Field label="Gender">
                          <Input
                            name="Gender"
                            value={userDetails.Gender}
                            onChange={handleChange}
                            className="rounded-none h-8 text-xs capitalize"
                          />
                        </Field>
                        <Field label="Birthday">
                          <Input
                            type="date"
                            name="Birthday"
                            value={userDetails.Birthday}
                            onChange={handleChange}
                            className="rounded-none h-8 text-xs"
                          />
                        </Field>
                      </div>
                    </Section>

                    {/* Contact Details */}
                    <Section icon={Phone} title="Contact Details">
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Email Address">
                          <Input
                            type="email"
                            name="Email"
                            value={userDetails.Email}
                            disabled
                            className="rounded-none h-8 text-xs bg-gray-50 text-gray-400"
                          />
                        </Field>
                        <Field label="Other Email (Gmail, Yahoo)">
                          <Input
                            type="email"
                            name="OtherEmail"
                            value={userDetails.OtherEmail || ""}
                            onChange={handleChange}
                            autoComplete="email"
                            className="rounded-none h-8 text-xs"
                          />
                        </Field>
                        <Field label="Contact Number">
                          <Input
                            type="tel"
                            name="ContactNumber"
                            value={userDetails.ContactNumber}
                            onChange={handleChange}
                            autoComplete="tel"
                            className="rounded-none h-8 text-xs"
                          />
                        </Field>
                        <Field label="Another Number (Viber etc)">
                          <Input
                            type="tel"
                            name="AnotherNumber"
                            value={userDetails.AnotherNumber || ""}
                            onChange={handleChange}
                            autoComplete="tel"
                            className="rounded-none h-8 text-xs"
                          />
                        </Field>
                        <Field label="Address / Location" className="col-span-2">
                          <Input
                            name="Address"
                            value={userDetails.Address || ""}
                            onChange={handleChange}
                            autoComplete="street-address"
                            className="rounded-none h-8 text-xs capitalize"
                          />
                        </Field>
                      </div>
                    </Section>

                    {/* Signature */}
                    <Section icon={PenTool} title="Digital Signature">
                      <div className="space-y-3">

                        {/* Tab toggle */}
                        <div className="flex border-b border-gray-200">
                          {(["pad", "upload"] as const).map((method) => (
                            <button
                              key={method}
                              type="button"
                              onClick={() => setSigMethod(method)}
                              className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-colors ${
                                sigMethod === method
                                  ? "border-b-2 border-gray-900 text-gray-900"
                                  : "text-gray-400 hover:text-gray-600"
                              }`}
                            >
                              {method === "pad" ? "Draw Pad" : "Upload File"}
                            </button>
                          ))}
                        </div>

                        {/* Draw pad */}
                        {sigMethod === "pad" && (
                          <div className="space-y-3">
                            <div className="border border-dashed border-gray-300 bg-white">
                              <SignatureCanvas
                                ref={sigCanvas}
                                penColor="#121212"
                                canvasProps={{
                                  className: "w-full h-28 cursor-crosshair block",
                                }}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="rounded-none text-[10px] font-bold uppercase gap-1.5 h-8"
                                onClick={() => sigCanvas.current?.clear()}
                              >
                                <Eraser className="w-3 h-3" />
                                Clear
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                className="rounded-none text-[10px] font-bold uppercase gap-1.5 h-8 bg-gray-900 hover:bg-gray-800"
                                onClick={saveSignatureFromPad}
                                disabled={uploadingSignature}
                              >
                                {uploadingSignature ? (
                                  <><Loader2 className="w-3 h-3 animate-spin" /> Saving…</>
                                ) : (
                                  <><PenTool className="w-3 h-3" /> Save Signature</>
                                )}
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Upload file */}
                        {sigMethod === "upload" && (
                          <div className="space-y-3">
                            <Field label="Select Signature File (PNG recommended)">
                              <Input
                                type="file"
                                accept="image/*"
                                onChange={onSignatureFileSelect}
                                disabled={uploadingSignature}
                                className="rounded-none h-8 text-xs"
                              />
                            </Field>

                            {sigFilePreview && (
                              <div className="space-y-2">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                                  Preview
                                </p>
                                <div className="relative w-48 h-24 border-2 border-blue-200 bg-white flex items-center justify-center overflow-hidden">
                                  <button
                                    type="button"
                                    onClick={() => { setSigFilePreview(null); setSelectedSigFile(null); }}
                                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 z-10 hover:bg-red-600 transition-colors"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                  <Image
                                    src={sigFilePreview}
                                    alt="Signature preview"
                                    fill
                                    className="object-contain p-2"
                                  />
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  className="rounded-none text-[10px] font-bold uppercase gap-1.5 h-8 bg-blue-600 hover:bg-blue-700"
                                  onClick={() => selectedSigFile && handleImageUpload(selectedSigFile, true)}
                                  disabled={uploadingSignature || !selectedSigFile}
                                >
                                  {uploadingSignature ? (
                                    <><Loader2 className="w-3 h-3 animate-spin" /> Uploading…</>
                                  ) : (
                                    <><UploadCloud className="w-3 h-3" /> Upload Signature</>
                                  )}
                                </Button>
                              </div>
                            )}

                            {!sigFilePreview && (
                              <p className="text-[10px] italic text-gray-400 flex items-center gap-1.5">
                                <UploadCloud className="w-3 h-3 shrink-0" />
                                Transparent PNG recommended for best quality on documents
                              </p>
                            )}
                          </div>
                        )}

                        {/* Active signature preview */}
                        {userDetails.signatureImage && (
                          <div className="pt-3 border-t border-gray-100">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">
                              Active Signature
                            </p>
                            <div className="relative w-44 h-20 border border-gray-200 bg-white shadow-sm">
                              <Image
                                src={userDetails.signatureImage}
                                alt="Current signature"
                                fill
                                className="object-contain p-1"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </Section>

                    {/* Password */}
                    <Section icon={KeyRound} title="Password Credentials">
                      <div className="space-y-4">
                        {/* New password */}
                        <Field label="New Password">
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <Input
                                type={showPassword ? "text" : "password"}
                                name="Password"
                                value={userDetails.Password || ""}
                                onChange={handleChange}
                                maxLength={10}
                                autoComplete="new-password"
                                className="rounded-none h-8 text-xs pr-8"
                                placeholder="Leave blank to keep current"
                              />
                              <button
                                type="button"
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                onClick={() => setShowPassword((v) => !v)}
                              >
                                {showPassword
                                  ? <EyeOff className="w-3.5 h-3.5" />
                                  : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="rounded-none text-[10px] font-bold uppercase gap-1.5 h-8 shrink-0"
                              onClick={handleGeneratePassword}
                            >
                              <WandSparkles className="w-3 h-3" />
                              Generated
                            </Button>
                          </div>
                          <StrengthBar strength={passwordStrength} />
                        </Field>

                        {/* Confirm password */}
                        <Field label="Confirm Password">
                          <div className="relative">
                            <Input
                              type={showConfirmPassword ? "text" : "password"}
                              name="ContactPassword"
                              value={userDetails.ContactPassword || ""}
                              onChange={handleChange}
                              maxLength={10}
                              autoComplete="new-password"
                              className="rounded-none h-8 text-xs pr-8"
                              placeholder="Re-enter new password"
                            />
                            <button
                              type="button"
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                              onClick={() => setShowConfirmPassword((v) => !v)}
                            >
                              {showConfirmPassword
                                ? <EyeOff className="w-3.5 h-3.5" />
                                : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          {/* Match indicator */}
                          {userDetails.Password && userDetails.ContactPassword && (
                            <p className={`text-[10px] font-bold mt-1 ${
                              userDetails.Password === userDetails.ContactPassword
                                ? "text-emerald-600"
                                : "text-red-500"
                            }`}>
                              {userDetails.Password === userDetails.ContactPassword
                                ? "✓ Passwords match"
                                : "✗ Passwords do not match"}
                            </p>
                          )}
                        </Field>
                      </div>
                    </Section>

                    {/* Submit */}
                    <div className="flex justify-end pt-1">
                      <Button
                        type="submit"
                        disabled={isBusy}
                        className="rounded-none h-9 px-6 text-[11px] font-black uppercase tracking-wider bg-gray-900 hover:bg-gray-800 gap-2"
                      >
                        {saving ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
                        ) : (
                          <><Save className="w-3.5 h-3.5" /> Save Changes</>
                        )}
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            </SidebarInset>

            <SidebarRight
              userId={userId || undefined}
              dateCreatedFilterRange={dateCreatedFilterRange}
              setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction}
            />
          </SidebarProvider>
        </FormatProvider>
      </UserProvider>
    </ProtectedPageWrapper>
  );
}