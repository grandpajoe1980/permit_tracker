import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Critical Path — SpaceX Louisiana Project Operations",
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
