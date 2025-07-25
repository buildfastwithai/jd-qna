import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "JD Q&A Generator - Create Interview Questions from Job Descriptions",
  description:
    "Upload job descriptions and generate relevant interview questions with AI",
  keywords:
    "interview questions, job description, ai, question generator, pdf parser",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} w-full`}>
        <div className="mx-auto max-w-7xl">{children}</div>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
