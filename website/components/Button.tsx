import Link from "next/link";

type ButtonProps = {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  className?: string;
  type?: "button" | "submit";
};

export function Button({
  children,
  href,
  onClick,
  variant = "primary",
  className = "",
  type = "button",
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3 font-semibold transition-all duration-300";
  const variants = {
    primary:
      "bg-gradient-to-r from-primary-dark via-primary to-primary-light text-white shadow-lg shadow-primary/30 hover:shadow-glow hover:scale-[1.02] active:scale-[0.98]",
    secondary:
      "bg-white/90 text-primary-dark border-2 border-primary/20 hover:border-primary/40 hover:bg-white shadow-card backdrop-blur",
    outline:
      "border-2 border-primary text-primary bg-transparent hover:bg-primary hover:text-white",
    ghost:
      "text-foreground hover:bg-white/80 hover:shadow-card rounded-xl",
  };
  const cls = `${base} ${variants[variant]} ${className}`;

  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} className={cls}>
      {children}
    </button>
  );
}
