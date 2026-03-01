import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-slate-200/60 bg-white/60 backdrop-blur-xl mt-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <Link
            href="/"
            className="font-bold text-foreground text-lg tracking-tight hover:text-primary transition-colors"
          >
            RAGline
          </Link>
          <nav className="flex items-center gap-8 text-sm">
            <Link href="/about" className="text-muted hover:text-foreground font-medium transition-colors">
              About
            </Link>
            <Link href="/how-to-use" className="text-muted hover:text-foreground font-medium transition-colors">
              How to use
            </Link>
            <Link href="/why-use" className="text-muted hover:text-foreground font-medium transition-colors">
              Why use
            </Link>
            <Link href="/contact" className="text-muted hover:text-foreground font-medium transition-colors">
              Contact
            </Link>
          </nav>
        </div>
        <p className="mt-6 text-center sm:text-left text-sm text-muted">
          © {new Date().getFullYear()} RAGline. Self-hosted AI infrastructure.
        </p>
      </div>
    </footer>
  );
}
