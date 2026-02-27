import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Redirect Analytics Dashboard",
  description: "Short links, routing rules, redirect tracking, and Rebrandly-like analytics cards."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
