import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FraudLens | Live Fraud Monitoring",
  description: "Real-time credit card fraud monitoring dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
