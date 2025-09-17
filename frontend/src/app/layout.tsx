import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppProviders from "@/providers/AppProviders";
import { config } from "@/config";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Trakshya – AI-Powered Railway Digital Twin",
  description: "Enterprise-grade railway operations management with AI-powered insights and real-time monitoring",
  metadataBase: new URL(config.app.siteUrl || "https://trakshya-sih.vercel.app"),
  manifest: "/manifest.json",
  keywords: [
    "railway",
    "digital twin",
    "AI",
    "operations",
    "management",
    "real-time",
    "monitoring",
    "Indian Railways",
    "predictive analytics",
    "optimization"
  ],
  authors: [{ name: "Trakshya Team" }],
  creator: "Trakshya",
  publisher: "Trakshya",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: config.app.siteUrl,
    title: 'Trakshya – AI-Powered Railway Digital Twin',
    description: 'Enterprise-grade railway operations management with AI-powered insights',
    siteName: 'Trakshya',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Trakshya – AI-Powered Railway Digital Twin',
    description: 'Enterprise-grade railway operations management with AI-powered insights',
  },
};

export function generateViewport() {
  return {
    themeColor: "#111827",
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  } as const;
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-neutral-950 text-neutral-100`}>
        <AppProviders>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
