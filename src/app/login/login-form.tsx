"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [portal, setPortal] = useState<"accountant" | "partner">("accountant");
  const [error, setError] = useState<string | null>(searchParams.get("error") === "deactivated" ? "Your account has been deactivated by the firm administrator." : searchParams.get("error") === "profile" ? "Your account does not have an active firm profile. Contact the firm administrator." : null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data: { user }, error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }
    const { data: profile } = user ? await supabase.from("profiles").select("role,is_active").eq("id", user.id).maybeSingle() : { data: null };
    const target = profile?.role === "PARTNER" ? "/partner/review" : "/accountant/timesheet";
    const mismatch = portal === "partner" ? profile?.role !== "PARTNER" : !profile || !["STAFF", "HEAD"].includes(profile.role);
    if (!profile || profile.is_active !== true || mismatch) {
      await supabase.auth.signOut();
      setError(!profile || profile.is_active !== true ? "Account suspended. Contact the Managing Partner." : "Access denied for this portal. Switch to the appropriate login tab for your role.");
      setLoading(false);
      return;
    }
    router.replace(target);
    router.refresh();
  }

  return <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4"><div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
    <div className="mb-6"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Practice Management Portal</p><h1 className="mt-1 text-xl font-semibold text-slate-900">Sign in to your account</h1><p className="mt-1 text-xs text-slate-500">Use the firm User ID and password issued by your administrator.</p></div>
    <div className="mb-4 grid grid-cols-2 rounded-md border border-slate-200 p-1" role="tablist" aria-label="Choose portal"><button type="button" role="tab" aria-selected={portal === "accountant"} onClick={() => setPortal("accountant")} className={`rounded px-2 py-2 text-xs ${portal === "accountant" ? "bg-slate-900 text-white" : "text-slate-600"}`}>Accountant Workspace</button><button type="button" role="tab" aria-selected={portal === "partner"} onClick={() => setPortal("partner")} className={`rounded px-2 py-2 text-xs ${portal === "partner" ? "bg-slate-900 text-white" : "text-slate-600"}`}>Managing Partner Portal</button></div>
    <p className="mb-4 text-xs text-slate-600">{portal === "partner" ? "Access restricted to the Managing Partner." : "Access restricted to authorized firm personnel. User IDs are provisioned exclusively by the Managing Partner."}</p>
    {error && <div role="alert" className="mb-4 rounded border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}
    <form onSubmit={handleLogin} className="space-y-4"><label className="block text-xs font-medium text-slate-700">User ID (email)<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@firm.pk" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" /></label><label className="block text-xs font-medium text-slate-700">Password<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" /></label><button type="submit" disabled={loading} className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50">{loading ? "Signing in…" : "Sign in"}</button></form>
  </div></div>;
}
