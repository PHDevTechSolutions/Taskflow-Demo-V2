"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import Link from "next/link";
import { v4 as uuidv4 } from "uuid";

import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { Globe, Calendar } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

import { supabase } from "@/utils/supabase-ticket";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@radix-ui/react-label";

export function LoginForm({ className, ...props }: React.ComponentProps<"div">) {
  const [Email, setEmail] = useState("");
  const [Password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [lockUntil, setLockUntil] = useState<string | null>(null);
  const [formattedLockUntil, setFormattedLockUntil] = useState<string | null>(null);

  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  const [showLockDialog, setShowLockDialog] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [ticketSubmitting, setTicketSubmitting] = useState(false);
  const [showWaitDialog, setShowWaitDialog] = useState(false);

  const [ticket, setTicket] = useState<any[]>([]); // Holds tickets fetched
  const [ticket_id, setTicketId] = useState<string>(""); // Current ticket ID

  const { setUserId } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (lockUntil) {
      setFormattedLockUntil(new Date(lockUntil).toLocaleString());
    }
  }, [lockUntil]);

  const playSound = (file: string) => {
    const audio = new Audio(file);
    audio.play().catch(() => { });
  };

  const getDeviceId = () => {
    let deviceId = localStorage.getItem("deviceId");
    if (!deviceId) {
      deviceId = uuidv4();
      localStorage.setItem("deviceId", deviceId);
    }
    return deviceId;
  };

  const getLocation = async () => {
    if (!navigator.geolocation) return null;
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject)
      );
      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
    } catch {
      console.warn("User denied location access");
      return null;
    }
  };

  const isLoginAllowed = () => {
    const now = new Date();
    const phTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
    const hour = phTime.getHours();
    return hour >= 7 && hour < 19;
  };

  // Fetch tickets without referenceid filtering
  const fetchTicket = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("tickets")
        .select("*")
        .order("date_created", { ascending: false });

      if (error) throw error;

      setTicket(data ?? []);
    } catch (error: any) {
      toast.error(error.message || "Error fetching tickets");
    }
  }, []);

  // Placeholder: implement or import fetchActivities accordingly
  const fetchActivities = useCallback(() => {
    // Your fetchActivities logic here if needed
  }, []);

  useEffect(() => {
    fetchTicket();
    fetchActivities();
  }, [fetchTicket, fetchActivities]);

  function generateTicketID(existingTicketIds: string[]): string {
    const prefix = "DSI";

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const datePart = `${year}-${month}-${day}`;

    const todayIds = existingTicketIds.filter((id) =>
      id.startsWith(`${prefix}-${datePart}`)
    );

    let maxSeq = 0;
    for (const id of todayIds) {
      const parts = id.split("-");
      const seqStr = parts[4];
      const seqNum = parseInt(seqStr, 10);
      if (!isNaN(seqNum) && seqNum > maxSeq) {
        maxSeq = seqNum;
      }
    }

    const nextSeq = String(maxSeq + 1).padStart(3, "0");

    return `${prefix}-${datePart}-${nextSeq}`;
  }

  const submitTicket = async () => {
    if (!remarks.trim()) {
      toast.error("Remarks is required.");
      return;
    }

    setTicketSubmitting(true);

    try {
      const existingTicketIds = ticket.map((t) => t.ticket_id);
      let newTicketID = ticket_id;

      if (!newTicketID || !existingTicketIds.includes(newTicketID)) {
        newTicketID = generateTicketID(existingTicketIds);
        setTicketId(newTicketID);
      }

      const { error } = await supabase.from("tickets").insert([
        {
          ticket_id: newTicketID,
          department: "Sales",
          requestor_name: "Taskflow User",
          mode: "System Directory",
          status: "Pending",
          ticket_subject: `Account Locked of ${Email}`,
          date_created: new Date().toISOString(),
        },
      ]);

      if (error) throw error;

      toast.success("Ticket submitted successfully.");
      setShowLockDialog(false);
      setRemarks("");
      fetchTicket();

      // Show the wait dialog after successful submission
      setShowWaitDialog(true);
    } catch (error: any) {
      toast.error(error.message || "Failed to submit ticket.");
    } finally {
      setTicketSubmitting(false);
    }
  };

  const proceedLogin = useCallback(
    async (location: { latitude: number; longitude: number } | null) => {
      setLoading(true);

      try {
        const response = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ Email, Password }),
        });

        const result = await response.json();

        if (!response.ok) {
          if (result.locked) {
            toast.error("Account Is Locked. Submit your ticket to IT Department.");
            setShowLockDialog(true);
          } else {
            toast.error(result.message || "Login failed.");
          }

          playSound("/login-failed.mp3");
          setLoading(false);
          return;
        }

        const deviceId = getDeviceId();

        await addDoc(collection(db, "activity_logs"), {
          email: Email,
          status: "login",
          deviceId,
          location,
          browser: navigator.userAgent,
          os: navigator.platform,
          userId: result.userId,
          ReferenceID: result.ReferenceID,
          TSM: result.TSM ?? null,
          Manager: result.Manager ?? null,
          date_created: serverTimestamp(),
        });

        toast.success("Login successful!");
        playSound("/login.mp3");
        setUserId(result.userId);

        if (result.Role === "Territory Sales Manager") {
          router.push(`/roles/tsm/agent?id=${result.userId}`);
        } else if (result.Role === "Manager") {
          router.push(`/roles/manager/agent?id=${result.userId}`);
        } else {
          router.push(`/roles/tsa/dashboard?id=${result.userId}`);
        }
      } catch {
        toast.error("Login error occurred.");
      } finally {
        setLoading(false);
      }
    },
    [Email, Password, router, setUserId]
  );

  const handleLoginSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      if (!Email || !Password) {
        toast.error("All fields are required!");
        return;
      }

      if (!isLoginAllowed()) {
        toast.error("⏰ Login allowed only from 7:00 AM to 7:00 PM (PH time).");
        return;
      }

      const location = await getLocation();
      if (location) {
        setPendingLocation(location);
        setShowLocationDialog(true);
      } else {
        proceedLogin(null);
      }
    },
    [Email, Password, proceedLogin]
  );

  const onAllowLocation = () => {
    setShowLocationDialog(false);
    proceedLogin(pendingLocation);
    setPendingLocation(null);
  };

  const onDenyLocation = () => {
    setShowLocationDialog(false);
    proceedLogin(null);
    setPendingLocation(null);
  };

  return (
    <>
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <Card className="overflow-hidden p-0">
          <CardContent className="grid p-0 md:grid-cols-2">
            <form onSubmit={handleLoginSubmit} className="p-6 md:p-8">
              <FieldGroup>
                <div className="flex flex-col items-center gap-2 text-center">
                  <h1 className="text-2xl font-bold">Welcome back</h1>
                  <p className="text-muted-foreground text-balance">
                    Login to your Taskflow account
                  </p>
                </div>
                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    placeholder="m@taskflow.com"
                    required
                    value={Email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>
                <Field>
                  <div className="flex items-center">
                    <FieldLabel htmlFor="password">Password</FieldLabel>
                    <a
                      href="/reset-password"
                      className="ml-auto text-sm underline-offset-2 hover:underline"
                    >
                      Forgot your password?
                    </a>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    required
                    value={Password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </Field>
                <Field>
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? "Signing in..." : "Login"}
                  </Button>
                </Field>
                <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                  Or continue with
                </FieldSeparator>
                <FieldDescription className="text-center">
                  Don&apos;t have an account? <a href="#">Sign up</a>
                </FieldDescription>
              </FieldGroup>
              <div className="text-xs space-y-2 mt-4 text-center">
                <p className="flex items-center justify-center gap-1">
                  <Globe size={16} />
                  Official Website:{" "}
                  <Link
                    href="https://www.ecoshiftcorp.com/"
                    className="underline text-green-700 hover:text-green-800"
                  >
                    ecoshiftcorp.com
                  </Link>
                </p>
                <p className="flex items-center justify-center gap-1">
                  <Calendar size={16} />
                  For Site & Client Visit:{" "}
                  <Link
                    href="https://acculog.vercel.app/Login"
                    className="underline text-green-700 hover:text-green-800"
                  >
                    Acculog
                  </Link>
                </p>
              </div>
            </form>
            <div className="bg-muted relative hidden md:block">
              <img
                src="/ecoshift-wallpaper.jpg"
                alt="Image"
                className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
              />
            </div>
          </CardContent>
        </Card>
        <FieldDescription className="px-6 text-center">
          By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
          and <a href="#">Privacy Policy</a>.
        </FieldDescription>
      </div>

      <Dialog open={showLockDialog} onOpenChange={setShowLockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Account Locked</DialogTitle>
            <DialogDescription>
              Account Is Locked. Submit your ticket to IT Department.
            </DialogDescription>
          </DialogHeader>

          <Label className="text-xs">Subject for Resetting Password</Label>
          <Input disabled value={Email} className="mb-2" />
          <Input
            placeholder="Enter Message"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />

          <DialogFooter>
            <Button
              className="w-full"
              disabled={ticketSubmitting}
              onClick={submitTicket}
            >
              {ticketSubmitting ? "Submitting..." : "Submit Ticket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Wait for IT associates dialog */}
      <Dialog open={showWaitDialog} onOpenChange={setShowWaitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ticket Submitted</DialogTitle>
            <DialogDescription>
              Please wait for a message or call from IT Associates from the IT Department.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowWaitDialog(false)} className="w-full">
              Okay
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Location Permission Dialog */}
      <Dialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Allow Location Access?</DialogTitle>
            <DialogDescription>
              We detected your location. Would you like to share your location for login activity tracking?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={onDenyLocation}>
              Deny
            </Button>
            <Button onClick={onAllowLocation}>Allow</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
