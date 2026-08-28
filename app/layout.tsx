import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PATH — Permit Application Tracker",
  description:
    "An accessible demonstration of permit status, milestone, deadline, and next-step tracking for applicants.",
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
