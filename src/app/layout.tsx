import type { Metadata } from "next";
import localFont from "next/font/local";
import { GrainOverlay } from "@/components/grain-overlay";
import "./globals.css";

/*
 * Self-hosted variable fonts (OFL, from Fontsource) rather than next/font/google:
 * Turbopack's Google Fonts download fails at random during builds, which was
 * failing deploys. Committed files can't fail to download.
 */
const syne = localFont({
  src: "../fonts/syne-latin-variable.woff2",
  variable: "--font-display-raw",
  weight: "400 800",
});

const inter = localFont({
  src: "../fonts/inter-latin-variable.woff2",
  variable: "--font-sans-raw",
  weight: "100 900",
});

const jetbrainsMono = localFont({
  src: "../fonts/jetbrains-mono-latin-variable.woff2",
  variable: "--font-mono-raw",
  weight: "100 800",
});

export const metadata: Metadata = {
  title: "AHMD.GPT Editor Ops",
  description: "Editor submission and payout tracking for AHMD.GPT",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${syne.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg text-text font-sans relative">
        <GrainOverlay />
        {children}
      </body>
    </html>
  );
}
