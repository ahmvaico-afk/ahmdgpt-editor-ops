import type { Metadata } from "next";
import { Syne, Inter, JetBrains_Mono } from "next/font/google";
import { GrainOverlay } from "@/components/grain-overlay";
import "./globals.css";

const syne = Syne({
  variable: "--font-display-raw",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const inter = Inter({
  variable: "--font-sans-raw",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono-raw",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "AHMD.GPT Editor Ops",
  description: "Editor submission and payout tracking for AHMD.GPT",
};

/**
 * Adobe Fonts kit id, for Proxima Nova in the hook tool. Commercial font, so it
 * can't be committed — it is served by Adobe under the owner's own Creative
 * Cloud licence. Unset means the option simply isn't offered.
 */
const adobeKitId = process.env.NEXT_PUBLIC_ADOBE_FONTS_KIT_ID?.trim();

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
      {adobeKitId && (
        <head>
          <link rel="stylesheet" href={`https://use.typekit.net/${adobeKitId}.css`} />
        </head>
      )}
      <body className="min-h-full flex flex-col bg-bg text-text font-sans relative">
        <GrainOverlay />
        {children}
      </body>
    </html>
  );
}
