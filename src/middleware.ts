import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookies) {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  const isLogin = request.nextUrl.pathname === "/login";
  if (!user && !isLogin) return NextResponse.redirect(new URL("/login", request.url));
  if (!user) return response;

  const { data: profile, error } = await supabase.from("profiles").select("role,is_active").eq("id", user.id).maybeSingle();
  if (error || !profile || !profile.is_active) {
    await supabase.auth.signOut();
    const url = new URL("/login", request.url);
    url.searchParams.set("error", profile?.is_active === false ? "deactivated" : "profile");
    const redirectResponse = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  }
  const role = profile.role;
  if (!['PARTNER', 'STAFF', 'HEAD'].includes(role)) return NextResponse.redirect(new URL('/login?error=profile', request.url));
  if (isLogin || request.nextUrl.pathname === '/') return NextResponse.redirect(new URL(role === 'PARTNER' ? '/partner/review' : '/accountant/timesheet', request.url));
  if (role === 'PARTNER' && request.nextUrl.pathname.startsWith('/accountant')) return NextResponse.redirect(new URL('/partner/review', request.url));
  if (role !== 'PARTNER' && request.nextUrl.pathname.startsWith('/partner')) return NextResponse.redirect(new URL('/accountant/timesheet', request.url));
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"] };
