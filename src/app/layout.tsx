import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "next-themes";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sphere Pharmacy — Your community pharmacy on Lumumba Drive, Roysambu",
  description:
    "Browse medicines, health products and devices at Sphere Pharmacy. Order online with M-Pesa or card, upload prescriptions for pharmacist review, and choose delivery or pickup in Roysambu, Nairobi.",
  keywords: [
    "Sphere Pharmacy", "Lumumba Drive pharmacy", "Roysambu pharmacy", "Nairobi pharmacy",
    "online pharmacy Kenya", "prescription delivery Nairobi", "M-Pesa pharmacy",
  ],
  authors: [{ name: "Sphere Pharmacy" }],
  openGraph: {
    title: "Sphere Pharmacy",
    description: "Your community pharmacy on Lumumba Drive, Roysambu — browse, order, upload prescriptions, choose delivery or pickup.",
    siteName: "Sphere Pharmacy",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0d9488",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
