import Link from "next/link";

type CardProps = {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "blue" | "wave";
  href?: string;
};

export function Card({
  children,
  className = "",
  variant = "default",
  href,
}: CardProps) {
  const base =
    "rounded-3xl p-8 transition-all duration-300 shadow-card hover:shadow-card-hover hover:-translate-y-1";
  const variants = {
    default:
      "bg-white/90 backdrop-blur border border-white/60",
    blue:
      "bg-gradient-to-br from-primary-dark via-primary to-primary-light text-white border border-white/20 shadow-glow",
    wave:
      "bg-gradient-to-br from-white via-white to-accent-light/40 border border-white/80 backdrop-blur",
  };
  const cls = `${base} ${variants[variant]} ${className}`;

  const content = <div className={cls}>{children}</div>;
  if (href) return <Link href={href}>{content}</Link>;
  return content;
}
