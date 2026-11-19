import type { ReactNode } from "react";
import { requireAccountant } from "@/lib/auth/guards";
import { AppShell } from "@/components/app-shell";

export default async function AccountantLayout({ children }: { children: ReactNode }) {
  await requireAccountant();
  return <AppShell>{children}</AppShell>;
}
