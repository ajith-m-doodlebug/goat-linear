"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  {
    href: "/",
    label: "Product",
    isActive: (p: string) =>
      p === "/" || p.startsWith("/how-it-works") || p.startsWith("/product"),
  },
  {
    href: "/getting-started",
    label: "Getting started",
    isActive: (p: string) => p.startsWith("/getting-started"),
  },
  {
    href: "/solutions",
    label: "Solutions",
    isActive: (p: string) => p.startsWith("/solutions"),
  },
  {
    href: "/pricing",
    label: "Pricing",
    isActive: (p: string) => p.startsWith("/pricing"),
  },
  {
    href: "/help",
    label: "Help",
    isActive: (p: string) => p.startsWith("/help"),
  },
] as const;

export function SiteHeader() {
  const pathname = usePathname() ?? "/";

  return (
    <header className="sticky top-0 z-50 w-full border-none bg-[#0b1326] shadow-[0_4px_24px_rgba(218,226,253,0.05)]">
      <nav className="mx-auto flex max-w-screen-2xl items-center justify-between px-6 py-6 md:px-12">
        <Link
          href="/"
          className="font-headline text-2xl font-black tracking-tighter text-[#00D2FF]"
        >
          LLM Builder
        </Link>
        <div className="hidden items-center gap-8 md:flex md:gap-10">
          {navItems.map((item) => {
            const active = item.isActive(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`font-headline text-sm font-bold tracking-tight transition-colors duration-200 md:text-base ${
                  active
                    ? "border-b-2 border-[#00D2FF] pb-1 text-[#00D2FF]"
                    : "font-medium text-[#b9c7df] hover:text-[#a5e7ff]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
        <div className="flex items-center gap-4 md:gap-6">
          <button
            type="button"
            className="hidden font-medium text-[#b9c7df] transition-all hover:text-[#00D2FF] active:scale-95 sm:block"
          >
            Login
          </button>
          <button
            type="button"
            className="kinetic-gradient rounded-lg px-4 py-2 text-sm font-bold tracking-tight text-on-primary shadow-lg shadow-primary/10 transition-transform duration-150 active:scale-95 md:px-6 md:py-2.5"
          >
            Register
          </button>
        </div>
      </nav>
    </header>
  );
}
