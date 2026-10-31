import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://medivyx.co.ke"),
  alternates: { canonical: "/" },
  title: "Medivyx — Your community pharmacy on Lumumba Drive, Roysambu",
  description:
    "Browse medicines, health products and devices at Medivyx. Order online with M-Pesa or card, upload prescriptions for pharmacist review, and choose delivery or pickup in Roysambu, Nairobi.",
  keywords: [
    "Medivyx", "Lumumba Drive pharmacy", "Roysambu pharmacy", "Nairobi pharmacy",
    "online pharmacy Kenya", "prescription delivery Nairobi", "M-Pesa pharmacy",
  ],
  authors: [{ name: "Medivyx" }],
  openGraph: {
    title: "Medivyx",
    description: "Your community pharmacy on Lumumba Drive, Roysambu — browse, order, upload prescriptions, choose delivery or pickup.",
    siteName: "Medivyx",
    type: "website",
    images: [{ url: "/images/medivyx_logo.svg", width: 1200, height: 630, alt: "Medivyx" }],
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
