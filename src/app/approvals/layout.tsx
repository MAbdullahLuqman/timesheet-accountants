import { redirect } from "next/navigation";
import type { ReactNode } from "react";
export default function LegacyApprovalsLayout({ children }: { children: ReactNode }): ReactNode { void children; redirect("/partner/review"); }
