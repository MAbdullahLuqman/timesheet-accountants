"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, ArrowRight } from "lucide-react";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    const { data: profile, error: profileError } = user ? await supabase.from("profiles").select("role,is_active").eq("id", user.id).maybeSingle() : { data: null, error: null };
    if (!profile || profile.is_active !== true || !["PARTNER", "STAFF", "HEAD"].includes(profile.role)) {
      await supabase.auth.signOut();
      setError(profile?.is_active === false ? "Your account is inactive. Please contact the Managing Partner." : profileError?.message ?? "Your account does not have an active firm profile. Contact the Managing Partner.");
      setLoading(false);
      return;
    }
    router.replace(profile.role === "PARTNER" ? "/partner/review" : "/accountant/timesheet");
    router.refresh();
  }

  return <main className="min-h-screen bg-[var(--background)] p-3 sm:p-5 lg:p-6">
    <div className="mx-auto grid min-h-[calc(100vh-24px)] max-w-[1600px] overflow-hidden rounded-[28px] bg-white shadow-[0_16px_48px_rgba(24,24,27,0.10)] sm:min-h-[calc(100vh-40px)] lg:min-h-[calc(100vh-48px)] lg:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)] lg:rounded-[36px]">
      <section aria-label="Forest view" className="relative flex min-h-[240px] flex-col justify-between overflow-hidden bg-[#111a16] bg-cover bg-center p-7 text-white sm:min-h-[300px] sm:p-10 lg:min-h-[640px] lg:p-14" style={{ backgroundImage: "linear-gradient(180deg, rgba(7, 16, 12, .46), rgba(7, 16, 12, .22) 42%, rgba(7, 16, 12, .70)), url('/images/login-forest.webp')" }}>
        <p className="text-sm font-semibold tracking-[-0.02em]">Practice Workbench</p>
        <div className="max-w-xl pb-1 lg:pb-10"><h2 className="text-[clamp(2.3rem,4.5vw,5rem)] font-semibold leading-[1.03] tracking-[-0.04em]">Work with<br />perspective.</h2><p className="mt-4 max-w-sm text-sm leading-6 text-white/85 sm:text-base">Timesheets, expenses, and leave in one place for your firm.</p></div>
        <p className="hidden text-xs text-white/65 lg:block">A focused space for the work behind every client.</p>
      </section>
      <section className="flex min-h-[580px] flex-col bg-white px-7 py-8 sm:px-12 sm:py-10 lg:px-[clamp(2.5rem,6vw,7rem)] lg:py-12">
        <div className="flex items-center gap-3 text-sm font-semibold tracking-[-0.02em]"><span aria-hidden="true" className="size-3 rounded-full bg-[#426b51] shadow-[0_0_0_5px_#edf3ea]" />Practice Workbench</div>
        <div className="my-auto w-full max-w-[440px] self-center py-12 lg:py-6">
          <h1 className="text-[clamp(2.5rem,4vw,4.1rem)] font-semibold leading-[1.05] tracking-[-0.04em] text-[#142019]">Welcome back.</h1>
          <p className="mt-4 text-sm leading-6 text-zinc-600">Sign in with the User ID and password issued by your Managing Partner.</p>
          {error && <div role="alert" className="mt-7 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
          <form onSubmit={handleLogin} className="mt-9 space-y-6">
            <div><label htmlFor="login-email" className="block text-sm font-medium text-[#26332b]">User ID (Email)</label><input id="login-email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@firm.pk" className="mt-2 h-14 w-full rounded-2xl border border-[#d9ded8] bg-white px-5 text-base text-[#142019] outline-none transition-colors placeholder:text-zinc-500 focus:border-[#426b51] focus:ring-2 focus:ring-[#426b51]/15" /></div>
            <div><label htmlFor="login-password" className="block text-sm font-medium text-[#26332b]">Password</label><div className="relative mt-2"><input id="login-password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" className="h-14 w-full rounded-2xl border border-[#d9ded8] bg-white px-5 pr-14 text-base text-[#142019] outline-none transition-colors placeholder:text-zinc-500 focus:border-[#426b51] focus:ring-2 focus:ring-[#426b51]/15" /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 flex w-14 items-center justify-center text-zinc-600 hover:text-[#26332b]">{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div></div>
            <button type="submit" disabled={loading} className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[var(--accent)] px-5 text-base font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60">{loading ? "Signing in…" : "Sign In"}{!loading && <ArrowRight size={18} aria-hidden="true" />}</button>
          </form>
        </div>
        <p className="text-xs text-zinc-500">Access is managed by your firm’s Managing Partner.</p>
      </section>
    </div>
  </main>;
}
