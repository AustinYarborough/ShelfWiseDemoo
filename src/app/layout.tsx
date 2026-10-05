import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Shelfwise — Retail Merchandising", description: "Plan smarter shelves with Shelfwise." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
