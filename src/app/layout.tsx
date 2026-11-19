import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Practice Workbench · Islamabad",
  description: "Timesheets, approvals, engagement budgets, and practice profitability.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
