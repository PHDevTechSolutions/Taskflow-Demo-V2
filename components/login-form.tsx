"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel, FieldSeparator, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Globe, Calendar } from "lucide-react";
import Link from "next/link";

export function LoginForm({ className, ...props }: React.ComponentProps<"div">) {
  const [Email, setEmail] = useState("");
  const [Password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const { setUserId } = useUser();

  // Optional: get deviceId from localStorage
  const getDeviceId = () => {
    let deviceId = localStorage.getItem("deviceId");
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      localStorage.setItem("deviceId", deviceId);
    }
    return deviceId;
  };

  const handleLoginSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      if (!Email || !Password) {
        toast.error("All fields are required!");
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
          toast.error(result.message || "Login failed.");
          setLoading(false);
          return;
        }

        toast.success("Login successful!");
        setUserId(result.userId);

        // redirect based on role
        switch (result.Role) {
          case "Territory Sales Manager":
            router.push(`/roles/tsm/agent?id=${result.userId}`);
            break;
          case "Manager":
            router.push(`/roles/manager/agent?id=${result.userId}`);
            break;
          case "Super Admin":
            router.push(`/roles/admin/dashboard?id=${result.userId}`);
            break;
          default:
            router.push(`/roles/tsa/activity/planner?id=${result.userId}`);
        }
      } catch (error) {
        console.error(error);
        toast.error("Login error occurred.");
      } finally {
        setLoading(false);
      }
    },
    [Email, Password, router, setUserId]
  );

  return (
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
  );
}
