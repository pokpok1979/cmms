import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter, IBM_Plex_Sans_Thai } from "next/font/google";
import PwaSupport from "./PwaSupport";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const thai = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-thai",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AGE CMMS | ศูนย์งานซ่อมบำรุง",
  description: "ระบบบริหารงานแจ้งซ่อมอาคารและเครื่องจักร AGE",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "AGE CMMS" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#059669",
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="th" className={`${inter.variable} ${thai.variable}`}>
      <body>{children}<PwaSupport /></body>
    </html>
  );
}
