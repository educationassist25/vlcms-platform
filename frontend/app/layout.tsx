import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Virtual LC-MS | Metabolomics Simulator",
  description: "Commercial-grade LC-MS method development and metabolomics simulation platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
