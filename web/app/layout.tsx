import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ethfund — ETH Up/Down signals",
  description:
    "Live temporal mispricing signals across Polymarket ETH Up/Down markets (4H/1H/15M/5M).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
