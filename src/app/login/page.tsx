import { Suspense } from "react";
import LoginForm from "./login-form";

export default function LoginPage() {
  return <Suspense fallback={<div className="grid min-h-screen place-items-center text-sm text-slate-500">Loading sign in…</div>}><LoginForm /></Suspense>;
}
