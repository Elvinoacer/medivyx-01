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
    images: [{ url: "/images/sphere_pharmacy_banner_url.webp", width: 1200, height: 630, alt: "Sphere Pharmacy" }],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f766e",
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
          <style>{`
            @keyframes sphere-catalog-card-enter {
              from {
                opacity: 0;
                transform: translateY(18px) scale(0.985);
              }
              to {
                opacity: 1;
                transform: translateY(0) scale(1);
              }
            }

            section[aria-live="polite"] article {
              animation: sphere-catalog-card-enter 520ms cubic-bezier(0.22, 1, 0.36, 1) both;
              will-change: opacity, transform;
            }

            @media (prefers-reduced-motion: reduce) {
              section[aria-live="polite"] article {
                animation: none;
                will-change: auto;
              }
            }
          `}</style>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
