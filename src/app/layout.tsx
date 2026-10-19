import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const space = Space_Grotesk({ subsets: ["latin"], variable: "--font-space" });
const jbmono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jbmono" });

export const metadata: Metadata = {
  title: {
    default: "BRICCS VAS Revenue Console",
    template: "%s · BRICCS VAS Console",
  },
  description:
    "BRICCS International Ideal Limited — MTN VAS unreconciled logs processing and automated partner report distribution.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${space.variable} ${jbmono.variable}`}>
      <body className="bg-surface font-sans text-slate-800">
        {children}
        <Toaster richColors position="top-right" closeButton toastOptions={{ style: { fontFamily: "var(--font-inter)" } }} />
      </body>
    </html>
  );
}
