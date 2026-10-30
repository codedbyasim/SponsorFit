import type { Metadata } from "next";
import { Barlow_Condensed, Literata, Outfit } from "next/font/google";
import "./globals.css";

const display = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

const sans = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
});

const serif = Literata({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: "SponsorFit — sponsorship scout",
  description:
    "An agentic sponsorship desk. Qloo Taste AI ranks the brands an audience over-indexes on, then SponsorFit writes the pitch from those signals.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${display.variable} ${sans.variable} ${serif.variable}`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
