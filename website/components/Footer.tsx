import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-gray-100 bg-card mt-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="font-semibold text-foreground">
            LLM Builder
          </Link>
          <nav className="flex items-center gap-6 text-sm text-muted">
            <Link href="/about" className="hover:text-foreground">
              About
            </Link>
            <Link href="/how-to-use" className="hover:text-foreground">
              How to use
            </Link>
            <Link href="/why-use" className="hover:text-foreground">
              Why use
            </Link>
            <Link href="/contact" className="hover:text-foreground">
              Contact
            </Link>
          </nav>
        </div>
        <p className="mt-4 text-center sm:text-left text-sm text-muted">
          © {new Date().getFullYear()} LLM Builder. Self-hosted AI infrastructure.
        </p>
      </div>
    </footer>
  );
}
