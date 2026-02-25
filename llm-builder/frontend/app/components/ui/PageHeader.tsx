"use client";

import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        {title != null && <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{title}</h1>}
        {description && <p className={`text-sm text-slate-600 max-w-2xl ${title ? "mt-1" : ""}`}>{description}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
