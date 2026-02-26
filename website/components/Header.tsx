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
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <span className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold">
            L
          </span>
          LLM Builder
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-muted hover:text-foreground transition-colors"
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
                className="text-muted hover:text-foreground transition-colors text-sm font-medium"
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
                className="text-muted hover:text-foreground transition-colors text-sm font-medium"
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
            className="md:hidden p-2 rounded-lg hover:bg-gray-100"
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
        <div className="md:hidden border-t border-gray-100 bg-white px-4 py-3 flex flex-col gap-2">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="py-2 text-muted hover:text-foreground"
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
