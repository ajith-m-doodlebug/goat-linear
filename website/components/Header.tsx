"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Button } from "./Button";
import { useState } from "react";

const navLinks = [
  { href: "/about", label: "About" },
  { href: "/how-to-use", label: "How to use" },
  { href: "/why-use", label: "Why use" },
  { href: "/contact", label: "Contact" },
];

export function Header() {
  const { loading, signOut, isAuthenticated } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-18 min-h-[4.5rem]">
        <Link
          href="/"
          className="flex items-center gap-3 text-xl font-bold text-foreground group"
        >
          <span className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary-dark to-primary flex items-center justify-center text-white font-bold shadow-lg shadow-primary/30 group-hover:shadow-glow transition-shadow">
            R
          </span>
          <span className="tracking-tight">RAGline</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-muted hover:text-foreground font-medium transition-colors relative after:absolute after:left-0 after:bottom-[-2px] after:h-0.5 after:bg-primary after:rounded-full after:transition-all after:origin-left hover:after:w-full after:w-0"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {loading ? (
            <span className="text-sm text-muted">...</span>
          ) : isAuthenticated ? (
            <>
              <Link
                href="/download"
                className="text-muted hover:text-primary font-semibold transition-colors text-sm"
              >
                Download
              </Link>
              <Button variant="ghost" onClick={() => signOut()}>
                Log out
              </Button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-muted hover:text-foreground font-semibold transition-colors text-sm"
              >
                Log In
              </Link>
              <Button href="/register" variant="primary">
                Sign Up
              </Button>
            </>
          )}

          <button
            type="button"
            className="md:hidden p-2.5 rounded-xl hover:bg-slate-100 transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-slate-200/60 bg-white/95 backdrop-blur-xl px-4 py-4 flex flex-col gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="py-3 px-3 rounded-xl text-muted hover:text-foreground hover:bg-slate-50 font-medium transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
