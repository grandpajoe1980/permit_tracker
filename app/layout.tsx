import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PATH | Project and Permit Tracking",
  description:
    "Secure project and permit tracking for customers and participating government organizations.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
