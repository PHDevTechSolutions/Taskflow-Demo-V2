"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { UserProvider } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SidebarLeft } from "@/components/sidebar-left";
import { SidebarRight } from "@/components/sidebar-right";
import Image from "next/image";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { type DateRange } from "react-day-picker";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";

import { Eye, WandSparkles, ImagePlus } from "lucide-react";

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
  Password?: string;
  ContactPassword?: string;
}

export default function ProfileClient() {
  const searchParams = useSearchParams();
  const userId = searchParams?.get("id") ?? "";

  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<
    "weak" | "medium" | "strong" | ""
  >("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [dateCreatedFilterRange, setDateCreatedFilterRangeAction] =
    useState<DateRange | undefined>(undefined);

  useEffect(() => {
    if (!userId) {
      setError("User ID missing in URL");
      setLoading(false);
      return;
    }

    async function fetchUser() {
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
          Password: "",
          ContactPassword: "",
        });
      } catch (e) {
        console.error(e);
        setError("Error loading user data");
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
  }, [userId]);

  const calculatePasswordStrength = (
    password: string
  ): "weak" | "medium" | "strong" | "" => {
    if (!password) return "";
    if (password.length < 4) return "weak";
    if (/^(?=.*[a-z])(?=.*\d).{6,}$/.test(password)) return "medium";
    if (
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/.test(password)
    )
      return "strong";
    return "weak";
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!userDetails) return;
    const { name, value } = e.target;

    setUserDetails({
      ...userDetails,
      [name]: value,
    });

    if (name === "Password") {
      setPasswordStrength(calculatePasswordStrength(value));
    }
  };

  const generatePassword = () => {
    const chars =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
    let pass = "";
    for (let i = 0; i < 10; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pass;
  };

  const handleGeneratePassword = () => {
    const newPass = generatePassword();
    setUserDetails((prev) =>
      prev ? { ...prev, Password: newPass, ContactPassword: newPass } : prev
    );
    setPasswordStrength(calculatePasswordStrength(newPass));
  };

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    const data = new FormData();
    data.append("file", file);
    data.append("upload_preset", "Xchire");

    try {
      const res = await fetch(
        "https://api.cloudinary.com/v1_1/dhczsyzcz/image/upload",
        {
          method: "POST",
          body: data,
        }
      );
      const json = await res.json();
      if (json.secure_url) {
        setUserDetails((prev) =>
          prev ? { ...prev, profilePicture: json.secure_url } : prev
        );
        toast.success("Image uploaded successfully");
      } else {
        toast.error("Failed to upload image");
      }
    } catch (error) {
      toast.error("Error uploading image");
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const onImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    handleImageUpload(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userDetails) return;

    if (userDetails.Password && userDetails.Password.length > 10) {
      toast.error("Password must be at most 10 characters");
      return;
    }
    if (userDetails.Password !== userDetails.ContactPassword) {
      toast.error("Password and Confirm Password do not match");
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
      };

      const res = await fetch("/api/profile-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to update profile");

      toast.success("Profile updated successfully");

      setUserDetails((prev) =>
        prev
          ? {
            ...prev,
            Password: "",
            ContactPassword: "",
          }
          : prev
      );
      setPasswordStrength("");
    } catch (err) {
      console.error(err);
      toast.error("Error updating profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Loading user data...</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!userDetails) return null;

  return (
    <>
      <ProtectedPageWrapper>
        <UserProvider>
          <FormatProvider>
            <SidebarProvider>
              <SidebarLeft />
              <SidebarInset>
                <header className="bg-background sticky top-0 flex h-14 shrink-0 items-center gap-2">
                  <div className="flex flex-1 items-center gap-2 px-3">
                    <SidebarTrigger />
                    <Separator
                      orientation="vertical"
                      className="mr-2 data-[orientation=vertical]:h-4"
                    />
                    <Breadcrumb>
                      <BreadcrumbList>
                        <BreadcrumbItem>
                          <BreadcrumbPage className="line-clamp-1">
                            Profile Information
                          </BreadcrumbPage>
                        </BreadcrumbItem>
                      </BreadcrumbList>
                    </Breadcrumb>
                  </div>
                </header>

                <div className="flex flex-1 flex-col gap-2 p-4">
                  <h1 className="text-2xl font-semibold mb-4">Update Profile</h1>

                  <div className="flex flex-col md:flex-row gap-2">
                    <div className="w-full md:w-1/2 flex flex-col items-center space-y-4 border rounded p-4">
                      <AspectRatio
                        ratio={16 / 14}
                        className="w-full bg-muted rounded-lg overflow-hidden border border-gray-300"
                      >
                        {userDetails.profilePicture ? (
                          <Image
                            src={userDetails.profilePicture}
                            alt="Profile"
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                            No photo
                          </div>
                        )}
                      </AspectRatio>

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
                        className="w-auto"
                        onClick={() =>
                          document.getElementById("profilePicture")?.click()
                        }
                        disabled={uploading}
                      >
                        <ImagePlus /> {uploading ? "Uploading..." : "Change Photo"}
                      </Button>
                    </div>

                    <div className="flex-1">
                      <form
                        onSubmit={handleSubmit}
                        className="space-y-6 border rounded p-2"
                        noValidate
                      >
                        <fieldset className="flex flex-col md:flex-row space-x-0 md:space-x-4 border border-gray-300 rounded-md p-4">
                          <legend className="text-sm font-semibold px-2">Name</legend>

                          <div className="flex flex-col flex-1 space-y-2">
                            <Label htmlFor="Firstname">First Name</Label>
                            <Input
                              type="text"
                              id="Firstname"
                              name="Firstname"
                              value={userDetails.Firstname}
                              onChange={handleChange}
                              autoComplete="given-name"
                              required
                            />
                          </div>

                          <div className="flex flex-col flex-1 space-y-2">
                            <Label htmlFor="Lastname">Last Name</Label>
                            <Input
                              type="text"
                              id="Lastname"
                              name="Lastname"
                              value={userDetails.Lastname}
                              onChange={handleChange}
                              autoComplete="family-name"
                              required
                            />
                          </div>
                        </fieldset>

                        <fieldset className="flex flex-col md:flex-row space-x-0 md:space-x-4 border border-gray-300 rounded-md p-4">
                          <legend className="text-sm font-semibold px-2">
                            Contact Details
                          </legend>

                          <div className="flex flex-col flex-1 space-y-2">
                            <Label htmlFor="Email">Email Address</Label>
                            <Input
                              type="email"
                              id="Email"
                              name="Email"
                              value={userDetails.Email}
                              onChange={handleChange}
                              autoComplete="email"
                              disabled
                            />
                          </div>

                          <div className="flex flex-col flex-1 space-y-2">
                            <Label htmlFor="ContactNumber">Contact Number</Label>
                            <Input
                              type="text"
                              id="ContactNumber"
                              name="ContactNumber"
                              value={userDetails.ContactNumber}
                              onChange={handleChange}
                              autoComplete="tel"
                            />
                          </div>
                        </fieldset>

                        <fieldset className="flex flex-col md:flex-row border border-gray-300 rounded-md p-4">
                          <legend className="text-sm font-semibold px-2 mb-4 md:mb-0 md:mr-8 self-start">
                            Password Credentials
                          </legend>

                          <div className="flex flex-col flex-1 space-y-4">
                            {/* Password row */}
                            <div className="flex items-center space-x-4">
                              {/* Label */}
                              <Label
                                htmlFor="Password"
                                className="flex-shrink-0 w-24"
                              >
                                Password
                              </Label>

                              {/* Input */}
                              <Input
                                type={showPassword ? "text" : "password"}
                                id="Password"
                                name="Password"
                                value={userDetails.Password || ""}
                                onChange={handleChange}
                                maxLength={10}
                                autoComplete="new-password"
                                className="flex-1"
                              />

                              {/* Buttons */}
                              <div className="flex space-x-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => setShowPassword(!showPassword)}
                                >
                                  <Eye /> {showPassword ? "Hide" : "Show"}
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={handleGeneratePassword}
                                >
                                  <WandSparkles /> Generate
                                </Button>
                              </div>
                            </div>


                            {/* Password strength message */}
                            {passwordStrength && (
                              <p
                                className={`text-sm ${passwordStrength === "strong"
                                  ? "text-green-600"
                                  : passwordStrength === "medium"
                                    ? "text-yellow-600"
                                    : "text-red-600"
                                  }`}
                              >
                                Password strength: {passwordStrength}
                              </p>
                            )}

                            {/* Confirm Password row */}
                            <div className="flex items-center space-x-4">
                              {/* Label */}
                              <Label
                                htmlFor="ContactPassword"
                                className="flex-shrink-0 w-24"
                              >
                                Confirm Password
                              </Label>

                              {/* Input */}
                              <Input
                                type={showConfirmPassword ? "text" : "password"}
                                id="ContactPassword"
                                name="ContactPassword"
                                value={userDetails.ContactPassword || ""}
                                onChange={handleChange}
                                maxLength={10}
                                autoComplete="new-password"
                                className="flex-1"
                              />

                              {/* Button */}
                              <div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                >
                                  <Eye /> {showConfirmPassword ? "Hide" : "Show"}
                                </Button>
                              </div>
                            </div>

                          </div>
                        </fieldset>

                        <Button
                          type="submit"
                          disabled={saving || uploading}
                          className="w-full md:w-auto"
                        >
                          {saving
                            ? "Saving..."
                            : uploading
                              ? "Uploading..."
                              : "Save Changes"}
                        </Button>
                      </form>
                    </div>
                  </div>
                </div>
              </SidebarInset>
              <SidebarRight
                userId={userId ?? undefined}
                dateCreatedFilterRange={dateCreatedFilterRange}
                setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction}
              />
            </SidebarProvider>
          </FormatProvider>
        </UserProvider>
      </ProtectedPageWrapper>
    </>
  );
}
