import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

/** Shared quiet rows, sections and statuses. No fixed positioning or nested cards. */
export function WorkflowSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="space-y-3"><h2 className="text-base font-semibold">{title}</h2><div className="divide-y rounded-2xl border bg-card">{children}</div></section>;
}
export function WorkflowRow({ href, title, detail }: { href: string; title: string; detail?: string }) {
  return <Link href={href} className="flex min-h-14 min-w-0 items-center gap-3 rounded-xl px-4 py-3 focus-visible:outline-2 focus-visible:outline-primary"><span className="min-w-0 flex-1"><span className="block break-words text-base font-medium">{title}</span>{detail ? <span className="mt-0.5 block break-words text-sm text-muted-foreground">{detail}</span> : null}</span><ChevronRight aria-hidden className="size-5 shrink-0" /></Link>;
}
export function WorkflowStatus({ children }: { children: ReactNode }) {
  return <span className="inline-flex min-h-8 items-center rounded-lg bg-secondary px-2 py-1 text-sm">{children}</span>;
}
