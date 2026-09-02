import type { Metadata } from "next";
import "./globals.css";
import { PRODUCT_NAME, PROGRAM_SUBTITLE } from "@/lib/product-copy";

export const metadata: Metadata = {
  title: `${PRODUCT_NAME} — ${PROGRAM_SUBTITLE}`,
  description:
    "Cross-agency infrastructure coordination, government service requests, milestone Gantt tracking, and escalation paths.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
