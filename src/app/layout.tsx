import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://spherepharmacy.co.ke"),
  alternates: { canonical: "/" },
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
      <body className="antialiased bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          {children}
          <Toaster position="bottom-left" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
