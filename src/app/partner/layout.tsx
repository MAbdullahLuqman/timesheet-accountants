import type { ReactNode } from "react";
import { requirePartner } from "@/lib/auth/guards";
import { AppShell } from "@/components/app-shell";

export default async function PartnerLayout({ children }: { children: ReactNode }) {
  await requirePartner();
  return <AppShell>{children}</AppShell>;
}
