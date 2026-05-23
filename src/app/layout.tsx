import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono, Libre_Baskerville, Plus_Jakarta_Sans } from "next/font/google";
import { LocaleProvider } from "@/contexts/LocaleContext";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const libreBaskerville = Libre_Baskerville({
  variable: "--font-libre-baskerville",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Earnytics | Performance Affiliate Marketing Network",
  description:
    "Earnytics connects advertisers with high-quality affiliates to drive performance marketing results. Manage campaigns, track sales, and grow faster.",
  keywords: ["affiliate marketing", "performance marketing", "advertisers", "publishers", "Earnytics"],
  icons: {
    icon: [{ url: "/favicon.ico", sizes: "any" }],
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
  openGraph: {
    title: "Earnytics | Performance Affiliate Marketing Network",
    description: "Earnytics connects advertisers with high-quality affiliates to drive performance marketing results. Manage campaigns, track sales, and grow faster.",
  },
  verification: {
    google: "AMjBikCyQsL6-DwyFhxfdBZyWLfzUyZx-bmRbhrozZU",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${libreBaskerville.variable} ${plusJakartaSans.variable} antialiased bg-[var(--background)] text-[var(--foreground)]`}
        suppressHydrationWarning
      >
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-J0EZ3WR9XG"
          strategy="beforeInteractive"
        />
        <Script id="gtag-init" strategy="beforeInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-J0EZ3WR9XG');
          `}
        </Script>
        {/* Strip extension-injected attrs (password managers, form extensions) so hydration matches */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function stripExtensionAttrs() {
  try {
    var attrs = ['bis_skin_checked', 'fdprocessedid'];
    var strip = function() {
      attrs.forEach(function(attr) {
        document.querySelectorAll('[' + attr + ']').forEach(function(el) { el.removeAttribute(attr); });
      });
    };
    strip();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', strip);
    }
    document.addEventListener('DOMContentLoaded', function() {
      strip();
      var obs = new MutationObserver(function() { strip(); });
      obs.observe(document.documentElement, { attributes: true, attributeFilter: attrs, subtree: true });
      setTimeout(function() { obs.disconnect(); }, 5000);
    });
  } catch (e) {}
})();
            `.trim(),
          }}
        />
        <LocaleProvider>
          <div suppressHydrationWarning>
            {children}
          </div>
        </LocaleProvider>
      </body>
    </html>
  );
}
