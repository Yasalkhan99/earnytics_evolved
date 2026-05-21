"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

/* ─── Nav data ─────────────────────────────────────────── */
const overviewNav = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: "M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75",
  },
  {
    href: "/admin/support",
    label: "Support inbox",
    icon: "M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75",
  },
];


const impactNav = [
  { href: "/admin/impact/connection",     label: "Connection",           icon: "M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" },
  { href: "/admin/impact/campaigns",      label: "Campaigns",            icon: "M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" },
  { href: "/admin/impact/actions",        label: "Sales / actions",      icon: "M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" },
  { href: "/admin/impact/all-actions",    label: "All actions (assign)", icon: "M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" },
  { href: "/admin/impact/manage",         label: "Sync & rebuild",       icon: "M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" },
  { href: "/admin/impact/tracking-links", label: "Tracking links",       icon: "M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" },
  { href: "/admin/impact/applications",   label: "Applications",         icon: "M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" },
];

const tradeTrackerNav = [
  { href: "/admin/tradetracker/connection",   label: "Connection",     icon: "M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" },
  { href: "/admin/tradetracker/campaigns",    label: "Campaigns",      icon: "M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" },
  { href: "/admin/tradetracker/transactions", label: "Transactions",   icon: "M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" },
  { href: "/admin/tradetracker/manage",       label: "Sync & rebuild", icon: "M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" },
  { href: "/admin/tradetracker/applications", label: "Applications",   icon: "M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" },
];

const porNav = [
  { href: "/admin/por/connection",   label: "Connection",     icon: "M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" },
  { href: "/admin/por/merchants",    label: "Merchants",      icon: "M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" },
  { href: "/admin/por/transactions", label: "Transactions",   icon: "M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" },
  { href: "/admin/por/manage",       label: "Sync & manage",  icon: "M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" },
  { href: "/admin/por/applications", label: "Applications",   icon: "M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" },
];

const yieldkitNav = [
  { href: "/admin/yieldkit/connection",   label: "Connection",    icon: "M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" },
  { href: "/admin/yieldkit/campaigns",    label: "Campaigns",     icon: "M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" },
  { href: "/admin/yieldkit/transactions", label: "Transactions",  icon: "M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" },
  { href: "/admin/yieldkit/manage",       label: "Sync & manage", icon: "M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" },
  { href: "/admin/yieldkit/applications", label: "Applications",  icon: "M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" },
];

/* ─── Earnytics logo inline ─────────────────────────────── */
function EarnyticsLogo({ size = "md" }: { size?: "sm" | "md" }) {
  const iconSize = size === "sm" ? 28 : 34;
  const textClass = size === "sm" ? "text-[15px]" : "text-[18px]";
  return (
    <span className="flex items-center gap-2.5">
      <span
        className="flex shrink-0 items-center justify-center rounded-xl shadow-lg"
        style={{
          width: iconSize, height: iconSize,
          background: "linear-gradient(135deg, #0d9488 0%, #059669 100%)",
          boxShadow: "0 4px 12px rgba(13,148,136,.35)",
        }}
      >
        <svg width={iconSize * 0.5} height={iconSize * 0.5} viewBox="0 0 18 18" fill="none">
          <path d="M3 9.5 L9 3.5 L15 9.5" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M3 13.5 L9 7.5 L15 13.5" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.45"/>
        </svg>
      </span>
      <span className={`font-extrabold tracking-tight text-gray-900 ${textClass}`} style={{ letterSpacing: "-0.025em" }}>
        earn<span className="text-teal-600">ytics</span>
      </span>
    </span>
  );
}

/* ─── Sidebar link ─────────────────────────────────────── */
function SidebarLink({
  href, label, active, icon, accentActive = "teal",
}: {
  href: string; label: string; active: boolean; icon?: string;
  accentActive?: "teal" | "blue" | "orange" | "purple";
}) {
  const activeGrad = accentActive === "blue"   ? "from-blue-600 to-indigo-600 shadow-blue-200/60"
                   : accentActive === "orange" ? "from-orange-500 to-red-500 shadow-orange-200/60"
                   : accentActive === "purple" ? "from-indigo-500 to-violet-600 shadow-indigo-200/60"
                   : "from-teal-600 to-emerald-600 shadow-teal-200/60";
  const hoverCls = accentActive === "blue"   ? "hover:bg-blue-50 hover:text-blue-700"
                 : accentActive === "orange" ? "hover:bg-orange-50 hover:text-orange-700"
                 : accentActive === "purple" ? "hover:bg-indigo-50 hover:text-indigo-700"
                 : "hover:bg-teal-50 hover:text-teal-700";
  return (
    <Link
      href={href}
      className={`group relative flex items-center gap-2.5 rounded-xl px-3 py-[7px] text-[12.5px] font-medium transition-all duration-150 ${
        active
          ? `bg-gradient-to-r ${activeGrad} text-white shadow-md`
          : `text-gray-500 ${hoverCls}`
      }`}
    >
      {icon && (
        <svg className={`h-[14px] w-[14px] shrink-0 ${active ? "opacity-90" : "opacity-60"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
      )}
      <span className="truncate">{label}</span>
      {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white/70" />}
    </Link>
  );
}

/* ─── Platform group card ─────────────────────────────── */
function PlatformGroup({
  label, accent, logoChar, children,
}: {
  label: string;
  accent: "teal" | "blue" | "orange" | "purple";
  logoChar: string;
  children: React.ReactNode;
}) {
  const borderColor = accent === "blue" ? "border-blue-100" : accent === "orange" ? "border-orange-100" : accent === "purple" ? "border-indigo-100" : "border-teal-100";
  const bgBadge    = accent === "blue"   ? "from-blue-500 to-indigo-600"
                   : accent === "orange" ? "from-orange-500 to-red-500"
                   : accent === "purple" ? "from-indigo-500 to-violet-600"
                   : "from-teal-500 to-emerald-600";
  const textLabel  = accent === "blue" ? "text-blue-700" : accent === "orange" ? "text-orange-700" : accent === "purple" ? "text-indigo-700" : "text-teal-700";
  return (
    <div className={`overflow-hidden rounded-2xl border ${borderColor} bg-white shadow-sm`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-[10px] font-black text-white shadow-sm ${bgBadge}`}>
          {logoChar}
        </span>
        <span className={`text-[10px] font-black uppercase tracking-[0.12em] ${textLabel}`}>{label}</span>
      </div>
      {/* Links */}
      <div className="px-2 pb-2 space-y-0.5">
        {children}
      </div>
    </div>
  );
}

/* ─── Main component ───────────────────────────────────── */
export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const bodyRef = useRef<HTMLBodyElement | null>(null);

  useEffect(() => {
    const check = async () => {
      const res = await fetch("/api/admin/me", { credentials: "include" });
      if (res.status === 401) { router.replace("/admin/login"); return; }
      setReady(true);
    };
    check();
  }, [router]);

  useEffect(() => {
    // add admin-page class to body for custom scrollbar
    const body = document.body;
    body.classList.add("admin-page");
    bodyRef.current = body as HTMLBodyElement;
    return () => { body.classList.remove("admin-page"); };
  }, []);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
    router.replace("/admin/login");
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gradient-to-br from-slate-50 via-white to-teal-50/40">
        <div className="relative">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-teal-100 border-t-teal-600" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-5 w-5 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600" />
          </div>
        </div>
        <p className="text-sm font-medium text-gray-400">Loading admin panel…</p>
      </div>
    );
  }

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Nav */}
      <nav className="admin-scroll flex-1 overflow-y-auto px-3 py-5 space-y-6">
        {/* Overview */}
        <div>
          <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">Overview</p>
          <div className="space-y-0.5">
            {overviewNav.map((item) => (
              <SidebarLink key={item.href} href={item.href} label={item.label}
                active={pathname === item.href} icon={item.icon} />
            ))}
          </div>
        </div>

        {/* Impact */}
        <PlatformGroup label="Impact" accent="teal" logoChar="I">
          {impactNav.map((item) => (
            <SidebarLink key={item.href} href={item.href} label={item.label}
              active={pathname === item.href} icon={item.icon} accentActive="teal" />
          ))}
        </PlatformGroup>

        {/* TradeTracker */}
        <PlatformGroup label="TradeTracker" accent="blue" logoChar="T">
          {tradeTrackerNav.map((item) => (
            <SidebarLink key={item.href} href={item.href} label={item.label}
              active={pathname === item.href} icon={item.icon} accentActive="blue" />
          ))}
        </PlatformGroup>

        {/* PaidOnResults */}
        <PlatformGroup label="PaidOnResults" accent="orange" logoChar="P">
          {porNav.map((item) => (
            <SidebarLink key={item.href} href={item.href} label={item.label}
              active={pathname === item.href} icon={item.icon} accentActive="orange" />
          ))}
        </PlatformGroup>

        {/* Yieldkit */}
        <PlatformGroup label="Yieldkit" accent="purple" logoChar="Y">
          {yieldkitNav.map((item) => (
            <SidebarLink key={item.href} href={item.href} label={item.label}
              active={pathname === item.href} icon={item.icon} accentActive="purple" />
          ))}
        </PlatformGroup>
      </nav>

      {/* Bottom user area */}
      <div className="border-t border-gray-100 p-3 space-y-1.5">
        <Link href="/dashboard"
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[12px] font-semibold text-gray-500 hover:bg-teal-50 hover:text-teal-700 transition-colors">
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
          Publisher dashboard
        </Link>
        <button type="button" onClick={handleLogout}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[12px] font-semibold text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors">
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
          </svg>
          Log out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f5f7fa]"
      style={{ fontFamily: "var(--font-jakarta), var(--font-geist-sans), sans-serif" }}>

      {/* ── Top header ── */}
      <header className="fixed left-0 right-0 top-0 z-50 bg-white/95 backdrop-blur-md"
        style={{ borderBottom: "1px solid #e8ecf0", boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
        {/* Teal top accent line */}
        <div className="h-[3px] w-full" style={{ background: "linear-gradient(90deg,#0d9488,#059669,#0891b2)" }} />
        <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-4 sm:px-6">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <Link href="/admin" className="hidden md:block">
              <EarnyticsLogo size="sm" />
            </Link>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-600">
              Admin
            </span>
          </div>

          {/* Center breadcrumb hint */}
          <p className="hidden text-xs font-medium text-gray-400 sm:block">
            {pathname === "/admin" ? "Dashboard overview" : pathname.replace("/admin/", "").replace(/\//g, " › ")}
          </p>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <Link href="/dashboard"
              className="hidden items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 shadow-sm transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700 sm:flex">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              Publisher site
            </Link>
            <button type="button" onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-600">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
              </svg>
              Log out
            </button>

            {/* Mobile hamburger */}
            <button type="button" onClick={() => setMobileOpen((o) => !o)}
              className="ml-1 flex h-9 w-9 flex-col items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white text-gray-600 shadow-sm hover:bg-gray-50 md:hidden"
              aria-label="Toggle menu">
              <span className={`block h-0.5 w-4.5 bg-current transition-all duration-200 ${mobileOpen ? "translate-y-2 rotate-45" : ""}`} />
              <span className={`block h-0.5 w-4.5 bg-current transition-all duration-200 ${mobileOpen ? "opacity-0" : ""}`} />
              <span className={`block h-0.5 w-4.5 bg-current transition-all duration-200 ${mobileOpen ? "-translate-y-2 -rotate-45" : ""}`} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="mx-auto flex max-w-[1600px]" style={{ paddingTop: "59px" }}>
        {/* Desktop sidebar */}
        <aside className="hidden w-56 shrink-0 md:block lg:w-60"
          style={{ borderRight: "1px solid #e8ecf0", background: "#fff" }}>
          <div className="sticky" style={{ top: "59px", height: "calc(100vh - 59px)" }}>
            {sidebarContent}
          </div>
        </aside>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-40 flex md:hidden" style={{ top: "59px" }}>
            <div className="fixed inset-0 bg-black/25 backdrop-blur-[2px]" onClick={() => setMobileOpen(false)} />
            <aside className="relative flex w-64 flex-col overflow-hidden bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()} style={{ borderRight: "1px solid #e8ecf0" }}>
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <EarnyticsLogo size="sm" />
                <button type="button" onClick={() => setMobileOpen(false)}
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {sidebarContent}
            </aside>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 min-h-[calc(100vh-3.75rem)] px-5 py-8 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
