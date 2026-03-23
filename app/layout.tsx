import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CardRank — Find Your Best Credit Card",
  description: "Connect your bank and see which credit card earns the most on your actual spending",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        {children}
      </body>
    </html>
  );
}
