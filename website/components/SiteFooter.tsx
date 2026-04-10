import Link from "next/link";

const links = [
  { href: "#", label: "Privacy Policy" },
  { href: "#", label: "Terms of Service" },
  { href: "#", label: "Security Architecture" },
  { href: "#", label: "Status" },
  { href: "#", label: "Contact" },
];

export function SiteFooter() {
  return (
    <footer className="w-full border-t border-outline-variant/5 bg-[#131b2e] py-16">
      <div className="mx-auto flex max-w-screen-2xl flex-col items-center gap-8 px-6 md:flex-row md:justify-between md:px-12">
        <div className="space-y-4 text-center md:text-left">
          <div className="text-lg font-bold text-[#b9c7df]">LLM Builder On-Premise</div>
          <p className="max-w-xs text-sm tracking-wide text-[#3c4a5e]">
            © {new Date().getFullYear()} LLM Builder. On-premises AI infrastructure you control.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-6 md:gap-8">
          {links.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="text-sm text-[#3c4a5e] transition-all hover:text-[#00D2FF]"
            >
              {l.label}
            </Link>
          ))}
        </div>
        <div className="flex gap-4">
          <div className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-surface-container-high text-secondary transition-colors hover:text-primary">
            <span className="material-symbols-outlined text-sm">terminal</span>
          </div>
          <div className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-surface-container-high text-secondary transition-colors hover:text-primary">
            <span className="material-symbols-outlined text-sm">code</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
