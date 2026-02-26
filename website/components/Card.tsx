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
  const base = "rounded-2xl p-6 transition-shadow hover:shadow-lg";
  const variants = {
    default: "bg-white border border-gray-100",
    blue: "bg-primary-dark text-white",
    wave: "bg-white bg-[linear-gradient(135deg,rgba(224,242,254,0.5)_0%,rgba(255,255,255,1)_70%)]",
  };
  const cls = `${base} ${variants[variant]} ${className}`;

  const content = <div className={cls}>{children}</div>;
  if (href) return <Link href={href}>{content}</Link>;
  return content;
}
