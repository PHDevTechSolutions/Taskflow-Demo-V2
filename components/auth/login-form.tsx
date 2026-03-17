"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import { sileo } from "sileo";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel, FieldSeparator, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, } from "@/components/ui/dialog";
import { Globe, Calendar } from "lucide-react";
import Link from "next/link";
import { X, Check } from "lucide-react";
import { Progress } from "@/components/ui/progress"

// Firestore imports
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
// Supabase import
import { supabase } from "@/utils/supabase-ticket";

type Ticket = {
  ticket_id: string;
  department: string;
  requestor_name: string;
  mode: string;
  status: string;
  ticket_subject: string;
  date_created: string;
};

export function LoginForm({ className, ...props }: React.ComponentProps<"div">) {
  const [Email, setEmail] = useState("");
  const [Password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [pendingLoginData, setPendingLoginData] = useState<any | null>(null);

  const [loadingRedirect, setLoadingRedirect] = useState(false);
  const [showTicketDialog, setShowTicketDialog] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [ticketSubmitting, setTicketSubmitting] = useState(false);

  const [ticket, setTicket] = useState<Ticket[]>([]);

  const router = useRouter();
  const { setUserId } = useUser();

  // ---------------- Device ID ----------------
  const getDeviceId = () => {
    let deviceId = localStorage.getItem("deviceId");
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      localStorage.setItem("deviceId", deviceId);
    }
    return deviceId;
  };

  // ---------------- Location ----------------
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

  // ---------------- Fetch Tickets ----------------
  const fetchTicket = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("tickets")
        .select("*")
        .order("date_created", { ascending: false });
      if (error) throw error;
      setTicket(data ?? []);
    } catch (error: any) {
      sileo.error({
        title: "Failed",
        description: error.message || "Error fetching tickets",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: {
          title: "text-white!",
          description: "text-white",
        },
      });
    }
  }, []);

  useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  // ---------------- Generate Ticket ID ----------------
  function generateTicketID(existingTicketIds: string[]): string {
    const prefix = "DSI";
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const datePart = `${year}-${month}-${day}`;

    const todayIds = existingTicketIds.filter((id) => id.startsWith(`${prefix}-${datePart}`));

    let maxSeq = 0;
    for (const id of todayIds) {
      const parts = id.split("-");
      const seqStr = parts[3]; // format: DSI-YYYY-MM-DD-###
      const seqNum = parseInt(seqStr, 10);
      if (!isNaN(seqNum) && seqNum > maxSeq) maxSeq = seqNum;
    }

    const nextSeq = String(maxSeq + 1).padStart(3, "0");
    return `${prefix}-${datePart}-${nextSeq}`;
  }

  // ---------------- Submit Ticket ----------------
  const submitTicketFromDialog = async () => {
    if (!remarks.trim()) {
      sileo.error({
        title: "Failed",
        description: "Remarks is required.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: {
          title: "text-white!",
          description: "text-white",
        },
      });
      return;
    }

    setTicketSubmitting(true);

    try {
      const existingTicketIds = ticket.map((t) => t.ticket_id);
      let newTicketID = generateTicketID(existingTicketIds);

      const { error } = await supabase.from("tickets").insert([
        {
          ticket_id: newTicketID,
          department: "Sales",
          requestor_name: Email || "Taskflow User",
          mode: "System Directory",
          status: "Pending",
          ticket_subject: `Account Locked - ${Email}`,
          date_created: new Date().toISOString(),
        },
      ]);

      if (error) throw error;

      sileo.success({
        title: "Success",
        description: "Ticket submitted successfully.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: {
          title: "text-white!",
          description: "text-white",
        },
      });
      setRemarks("");
      fetchTicket();
      setShowTicketDialog(false);
    } catch (err: any) {
      sileo.error({
        title: "Success",
        description: err.message || "Failed to submit ticket.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: {
          title: "text-white!",
          description: "text-white",
        },
      });
    } finally {
      setTicketSubmitting(false);
    }
  };

  // ---------------- Login Handler ----------------
  const handleLoginSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!Email || !Password) {
        sileo.warning({
          title: "Warning",
          description: "All fields are required!",
          duration: 4000,
          position: "top-right",
          fill: "black",
          styles: {
            title: "text-white!",
            description: "text-white",
          },
        });
        return;
      }

      setLoading(true);
      try {
        const deviceId = getDeviceId();
        const response = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ Email, Password, deviceId }),
        });

        const result = await response.json();

        if (!response.ok) {
          // <-- IF ACCOUNT LOCKED
          if (result.locked) {
            setShowTicketDialog(true); // show the ticket submission dialog
          } else {
            sileo.error({
              title: "Failed",
              description: result.message || "Login failed.",
              duration: 4000,
              position: "top-right",
              fill: "black",
              styles: {
                title: "text-white!",
                description: "text-white",
              },
            });
          }
          setLoading(false);
          return;
        }

        setPendingLoginData({ Email, deviceId, result });
        setShowLocationDialog(true);
      } catch (error) {
        console.error(error);
        sileo.error({
          title: "Failed",
          description: "Login error occurred.",
          duration: 4000,
          position: "top-right",
          fill: "black",
          styles: {
            title: "text-white!",
            description: "text-white",
          },
        });
      } finally {
        setLoading(false);
      }
    },
    [Email, Password]
  );

  // ---------------- After Location Permission ----------------
  const handlePostLogin = async (location: any) => {
    if (!pendingLoginData) return;
    setLoadingRedirect(true); // start loading

    const { Email, deviceId, result } = pendingLoginData;

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

    setUserId(result.userId);

    // simulate small delay for animation (optional)
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Redirect based on role
if (result.Department === "CSR") {
  router.push(`/roles/csr/activity/quotation/quotation-list?id=${result.userId}`);
  return;
}

switch (result.Role) {
  case "Territory Sales Manager":
    router.push(`/roles/tsm/agent?id=${result.userId}`);
    break;
  case "Manager":
    router.push(`/roles/manager/agent?id=${result.userId}`);
    break;
  case "Staff":
    router.push(`/roles/csr/activity/quotation/quotation-list?id=${result.userId}`);
    break;  
  case "Admin":
    router.push(`/roles/csr/activity/quotation/quotation-list?id=${result.userId}`);
    break;  
  case "Super Admin":
    router.push(`/roles/admin/dashboard?id=${result.userId}`);
    break;
  default:
    router.push(`/roles/tsa/activity/planner?id=${result.userId}`);
}

    setPendingLoginData(null);
    setLoadingRedirect(false); // stop loading (just in case)
  };

  const onAllowLocation = async () => {
    setShowLocationDialog(false);
    const location = await getLocation();
    await handlePostLogin(location);
  };

  const onDenyLocation = async () => {
    setShowLocationDialog(false);
    await handlePostLogin(null);
  };

  function ProgressBar() {
    const [progress, setProgress] = React.useState(0);

    React.useEffect(() => {
      let start = 0;
      const interval = setInterval(() => {
        start += 2; // slower increment
        if (start >= 100) {
          start = 100;
          clearInterval(interval);
        }
        setProgress(start);
      }, 100); // 100ms per increment
      return () => clearInterval(interval);
    }, []);

    return (
      <div className="w-64">
        <Progress
          value={progress}
          className="h-4 rounded-full transition-all duration-200 ease-in-out"
        />
      </div>
    );
  }

  // ---------------- Render ----------------
  return (
    <>
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <div
          className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] 
                 bg-[size:24px_24px] z-10 pointer-events-none"
        />

        <Card className="overflow-hidden p-0 rounded-none z-20 shadow-md">
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
                    className="rounded-xs p-6"
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>

                <Field>
                  <div className="flex items-center">
                    <FieldLabel htmlFor="password">Password</FieldLabel>
                    <a
                      href="/auth/forgot-password"
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
                    className="rounded-xs p-6"
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </Field>

                <Field>
                  <Button type="submit" disabled={loading} className="w-full rounded-none p-6">
                    {loading ? "Signing in..." : "Login"}
                  </Button>
                </Field>
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
                    href="https://acculog-hris.vercel.app/"
                    className="underline text-green-700 hover:text-green-800"
                  >
                    Acculog
                  </Link>
                </p>
              </div>

              {/* ---------------- Ticket Submission ---------------- */}
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
          By clicking continue, you agree to our{" "}
          <Link
            href="/terms"
            className="underline text-green-700 hover:text-green-800"
          >
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link
            href="/privacy"
            className="underline text-green-700 hover:text-green-800"
          >
            Privacy Policy
          </Link>.
        </FieldDescription>

      </div>

      {/* ---------------- Wait Dialog ---------------- */}
      <Dialog open={showTicketDialog} onOpenChange={setShowTicketDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Account Locked</DialogTitle>
            <DialogDescription>
              Your account has been locked due to (5) failed login attempts. Submit a ticket to IT Department.
            </DialogDescription>
          </DialogHeader>

          <Field className="mt-4">
            <FieldLabel htmlFor="remarks">Remarks</FieldLabel>
            <Input
              id="remarks"
              type="text"
              placeholder="Enter remarks..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </Field>

          <Button
            onClick={submitTicketFromDialog}
            disabled={ticketSubmitting || !remarks.trim()}
            className="mt-4 w-full"
          >
            {ticketSubmitting ? "Submitting..." : "Submit Ticket"}
          </Button>

          <DialogFooter>
            <Button onClick={() => setShowTicketDialog(false)} className="w-full mt-2">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------- Location Permission Dialog ---------------- */}
      <Dialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
        <DialogContent className="rounded-none">
          <DialogHeader>
            <DialogTitle>Allow Location Access?</DialogTitle>

            {/* GIF */}
            <div className="flex justify-center my-4">
              <iframe src="https://lottie.host/embed/2cbdf7c4-ad28-4a75-8bfd-68e4cd759a26/9PTYn6qNh6.lottie"></iframe>
            </div>

            <DialogDescription className="text-center">
              Would you like to share your location for login activity tracking?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex justify-end gap-2">
            <Button variant="outline" className="rounded-none p-6" onClick={onDenyLocation}>
              <X /> Deny
            </Button>
            <Button className="rounded-none p-6" onClick={onAllowLocation}>
              Allow <Check />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {loadingRedirect && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          {/* Blurred background overlay */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-500" />

          {/* Progress card */}
          <div className="relative z-[10000] flex flex-col items-center gap-6 bg-white dark:bg-gray-800 p-8 rounded-xl shadow-2xl animate-fadeIn">

            {/* Animated progress bar */}
            <ProgressBar />

            {/* Status text with subtle bounce */}
            <p className="text-gray-900 dark:text-white font-semibold animate-bounceSlow">
              Logging in...
            </p>

            {/* Animated dots */}
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-green-500 rounded-full animate-pingSlow"></span>
              <span className="w-3 h-3 bg-green-500 rounded-full animate-pingSlow animation-delay-200"></span>
              <span className="w-3 h-3 bg-green-500 rounded-full animate-pingSlow animation-delay-400"></span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
