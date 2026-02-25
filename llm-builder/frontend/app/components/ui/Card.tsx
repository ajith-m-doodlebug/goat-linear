"use client";

import type { HTMLAttributes } from "react";

export function Card({ className = "", children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={"bg-[var(--card)] rounded-[var(--radius-lg)] border border-[var(--border)] shadow-[var(--shadow)] " + className}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className = "", children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={"px-5 py-4 border-b border-[var(--border)] " + className} {...props}>{children}</div>;
}

export function CardBody({ className = "", children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={"p-5 " + className} {...props}>{children}</div>;
}
