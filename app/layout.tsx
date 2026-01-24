import React from "react";

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import RootLayoutClient from "./root"; // <-- client component wrapper

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Taskflow - Sales Activity Planner and Tracker",
  description: "Developed by IT Team and Leroux Y Xchire",
  icons: {
    icon: "/Taskflow.png",
    shortcut: "/Taskflow.png",
    apple: "/Taskflow.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased font-mono`}>
        <RootLayoutClient>{children}</RootLayoutClient>
      </body>
    </html>
  );
}
