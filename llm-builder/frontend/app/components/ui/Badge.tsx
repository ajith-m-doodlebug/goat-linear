"use client";

type Variant = "default" | "success" | "warning" | "error";

export function Badge({ children, variant = "default" }: { children: React.ReactNode; variant?: Variant }) {
  const classes: Record<Variant, string> = {
    default: "bg-slate-100 text-slate-700",
    success: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-700",
    error: "bg-red-50 text-red-700",
  };
  return (
    <span
      className={"inline-flex items-center px-2 py-0.5 rounded text-xs font-medium " + classes[variant]}
    >
      {children}
    </span>
  );
}
