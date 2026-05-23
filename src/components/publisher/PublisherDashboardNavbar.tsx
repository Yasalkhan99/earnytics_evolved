"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import brandLogo from "@/assets/earnytics-logo.png";

/* ── tiny SVG icons ── */
function ChevronDown({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NavIcon({ path }: { path: string }) {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}

/* ── logo (bundled from src/assets/earnytics-logo.png) ── */
function EarnyticsLogo() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0">
      <Image
        src={brandLogo}
        alt="Earnytics"
        width={40}
        height={40}
        unoptimized
        className="h-10 w-10 shrink-0 rounded-lg object-contain"
        priority
      />
      <span
        className="text-[18px] font-extrabold tracking-tight text-gray-900 leading-none"
        style={{ fontFamily: "var(--font-jakarta), var(--font-geist-sans), sans-serif", letterSpacing: "-0.02em" }}
      >
        earn<span className="text-teal-600">ytics</span>
      </span>
    </Link>
  );
}

/* ── dropdown items ── */
const BRANDS_ITEMS = [
  {
    href: "/dashboard/brands",
    icon: "M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z",
    label: "All brands",
    desc: "Browse all Impact campaigns",
  },
  {
    href: "/dashboard/brands?filter=approved",
    icon: "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    label: "My brands",
    desc: "Your approved campaigns",
  },
];

const REPORTS_ITEMS = [
  {
    href: "/dashboard/reports/advertiser-performance",
    icon: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z",
    label: "Advertiser performance",
    desc: "Clicks, sales & commissions",
  },
];

export default function PublisherDashboardNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [openMenu, setOpenMenu] = useState<null | "brands" | "reports">(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [avatarInitial, setAvatarInitial] = useState("?");
  const [userEmail, setUserEmail] = useState("");
  const [impersonating, setImpersonating] = useState(false);
  const [backLoading, setBackLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const dashboardActive = pathname === "/dashboard";
  const detailedActive = pathname === "/dashboard/detailed";
  const brandsActive = pathname?.startsWith("/dashboard/brands") ?? false;
  const reportsActive = pathname?.startsWith("/dashboard/reports") ?? false;

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/publisher/session", { credentials: "include" });
        if (!res.ok) return;
        const data = (await res.json().catch(() => ({}))) as { username?: string; email?: string; impersonating?: boolean };
        const label = (typeof data.username === "string" && data.username.trim()) || (typeof data.email === "string" ? data.email.split("@")[0] : "") || "?";
        setAvatarInitial((label[0] || "?").toUpperCase());
        if (data.email) setUserEmail(data.email);
        setImpersonating(Boolean(data.impersonating));
      } catch { /* ignore */ }
    })();
  }, []);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  useEffect(() => { setOpenMenu(null); setMobileOpen(false); }, [pathname]);

  const logout = async () => { router.replace("/login"); };
  const backToAdmin = async () => {
    setBackLoading(true);
    try { await fetch("/api/admin/impersonate/clear", { method: "POST", credentials: "include" }); }
    finally { window.location.href = "/admin"; }
  };

  /* nav link base styles */
  const link = (active: boolean) =>
    `relative flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13.5px] font-semibold transition-all duration-150 ${
      active
        ? "bg-teal-50 text-teal-700"
        : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
    }`;

  return (
    <header
      className="fixed left-0 right-0 top-0 z-[100] border-b border-gray-100 bg-white/95 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-white/90"
      style={{ fontFamily: "var(--font-jakarta), var(--font-geist-sans), sans-serif" }}
    >
      {impersonating && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 text-sm sm:px-6">
            <p className="text-amber-700">Admin view — publisher impersonation active.</p>
            <button type="button" onClick={() => void backToAdmin()} disabled={backLoading}
              className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-60">
              {backLoading ? "Returning…" : "Back to admin"}
            </button>
          </div>
        </div>
      )}

      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* ── Left: logo + nav links ── */}
        <div className="flex min-w-0 flex-1 items-center gap-6">
          <EarnyticsLogo />

          {/* Desktop nav */}
          <div ref={menuRef} className="hidden items-center gap-0.5 lg:flex">
            <Link href="/dashboard" className={link(dashboardActive)}>
              <NavIcon path="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
              Dashboard
              {dashboardActive && <span className="absolute -bottom-px left-3 right-3 h-0.5 rounded-full bg-teal-500" />}
            </Link>

            <Link href="/dashboard/detailed" className={link(detailedActive)}>
              <NavIcon path="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
              Detailed
              {detailedActive && <span className="absolute -bottom-px left-3 right-3 h-0.5 rounded-full bg-teal-500" />}
            </Link>

            {/* Brands dropdown */}
            <div className="relative">
              <button type="button" onClick={() => setOpenMenu((o) => (o === "brands" ? null : "brands"))}
                className={link(brandsActive)} aria-expanded={openMenu === "brands"} aria-haspopup="true">
                <NavIcon path="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016 2.993 2.993 0 002.25-1.016 3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
                Brands
                <ChevronDown className={`h-3 w-3 opacity-50 transition-transform duration-200 ${openMenu === "brands" ? "rotate-180" : ""}`} />
                {brandsActive && <span className="absolute -bottom-px left-3 right-3 h-0.5 rounded-full bg-teal-500" />}
              </button>
              {openMenu === "brands" && (
                <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-64 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl shadow-gray-200/60">
                  <div className="p-1.5">
                    {BRANDS_ITEMS.map((item) => (
                      <Link key={item.href} href={item.href} onClick={() => setOpenMenu(null)}
                        className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-teal-50">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-teal-600 group-hover:bg-teal-200">
                          <NavIcon path={item.icon} />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-gray-800">{item.label}</p>
                          <p className="text-[11px] text-gray-400">{item.desc}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Reports dropdown */}
            <div className="relative">
              <button type="button" onClick={() => setOpenMenu((o) => (o === "reports" ? null : "reports"))}
                className={link(reportsActive)} aria-expanded={openMenu === "reports"} aria-haspopup="true">
                <NavIcon path="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                Reports
                <ChevronDown className={`h-3 w-3 opacity-50 transition-transform duration-200 ${openMenu === "reports" ? "rotate-180" : ""}`} />
                {reportsActive && <span className="absolute -bottom-px left-3 right-3 h-0.5 rounded-full bg-teal-500" />}
              </button>
              {openMenu === "reports" && (
                <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-72 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl shadow-gray-200/60">
                  <div className="p-1.5">
                    {REPORTS_ITEMS.map((item) => (
                      <Link key={item.href} href={item.href} onClick={() => setOpenMenu(null)}
                        className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-teal-50">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 group-hover:bg-emerald-200">
                          <NavIcon path={item.icon} />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-gray-800">{item.label}</p>
                          <p className="text-[11px] text-gray-400">{item.desc}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                  <div className="border-t border-gray-50 px-4 py-2.5">
                    <p className="text-[11px] text-gray-400">More reports coming soon</p>
                  </div>
                </div>
              )}
            </div>

            {/* Disabled items */}
            {(["Creatives", "Tools", "Payments"] as const).map((label) => (
              <span key={label}
                className="flex cursor-default items-center gap-1 rounded-xl px-3 py-2 text-[13.5px] font-semibold text-gray-300 select-none"
                title="Coming soon">
                {label}
                {label !== "Payments" && <ChevronDown className="h-3 w-3 opacity-40" />}
              </span>
            ))}
          </div>
        </div>

        {/* ── Right: actions + avatar ── */}
        <div className="flex shrink-0 items-center gap-1">
          {/* Bell */}
          <button type="button" title="Notifications (coming soon)"
            className="hidden h-9 w-9 items-center justify-center rounded-xl text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 sm:flex">
            <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
          </button>

          {/* Help */}
          <button type="button" title="Help (coming soon)"
            className="hidden h-9 w-9 items-center justify-center rounded-xl text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 sm:flex">
            <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
            </svg>
          </button>

          <div className="mx-1 hidden h-5 w-px bg-gray-200 sm:block" aria-hidden />

          {/* Avatar + user info + logout */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-[13px] font-bold text-white shadow-md shadow-teal-200/60">
              {avatarInitial}
            </div>
            {userEmail && (
              <div className="hidden flex-col md:flex">
                <span className="text-[12px] font-semibold leading-tight text-gray-700">{userEmail.split("@")[0]}</span>
                <span className="text-[10px] leading-tight text-gray-400 truncate max-w-[120px]">{userEmail}</span>
              </div>
            )}
            <button type="button" onClick={() => void logout()}
              className="hidden items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-1.5 text-[12.5px] font-semibold text-gray-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 sm:flex">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
              </svg>
              Logout
            </button>
          </div>

          {/* Mobile hamburger */}
          <button type="button" onClick={() => setMobileOpen((o) => !o)}
            className="ml-1 flex h-9 w-9 flex-col items-center justify-center gap-1.5 rounded-xl text-gray-600 hover:bg-gray-100 lg:hidden"
            aria-label="Toggle menu" aria-expanded={mobileOpen}>
            <span className={`block h-0.5 w-5 bg-current transition-all duration-200 ${mobileOpen ? "translate-y-2 rotate-45" : ""}`} />
            <span className={`block h-0.5 w-5 bg-current transition-all duration-200 ${mobileOpen ? "opacity-0" : ""}`} />
            <span className={`block h-0.5 w-5 bg-current transition-all duration-200 ${mobileOpen ? "-translate-y-2 -rotate-45" : ""}`} />
          </button>
        </div>
      </nav>

      {/* ── Mobile menu ── */}
      {mobileOpen && (
        <div className="border-t border-gray-100 bg-white px-4 pb-4 pt-2 lg:hidden">
          <div className="flex flex-col gap-0.5">
            {impersonating && (
              <button type="button" onClick={() => void backToAdmin()} disabled={backLoading}
                className="mb-2 rounded-xl bg-amber-500 px-4 py-2.5 text-left text-sm font-bold text-white">
                {backLoading ? "Returning…" : "← Back to admin"}
              </button>
            )}
            {[
              { href: "/dashboard", label: "Dashboard" },
              { href: "/dashboard/detailed", label: "Detailed" },
              { href: "/dashboard/brands", label: "All brands" },
              { href: "/dashboard/brands?filter=approved", label: "My brands" },
              { href: "/dashboard/reports/advertiser-performance", label: "Advertiser performance" },
            ].map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${pathname === item.href ? "bg-teal-50 text-teal-700" : "text-gray-700 hover:bg-gray-50"}`}>
                {item.label}
              </Link>
            ))}
            <p className="px-4 pt-3 text-[11px] font-medium uppercase tracking-wider text-gray-300">Coming soon</p>
            {["Creatives", "Tools", "Payments"].map((l) => (
              <span key={l} className="rounded-xl px-4 py-2 text-sm text-gray-300 select-none">{l}</span>
            ))}
            <button type="button" onClick={() => void logout()}
              className="mt-3 flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-red-50 hover:text-red-600">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
              </svg>
              Logout
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
