"use client";
import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";
export const INPUT = "min-h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60";
export const SECONDARY_TEXT = "text-sm text-[#52645a] dark:text-muted-foreground";
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  const id = useId();
  const control = isValidElement(children) ? cloneElement(children as ReactElement<{ id?: string; "aria-describedby"?: string }>, { id, "aria-describedby": hint ? `${id}-hint` : undefined }) : children;
  return <div className="space-y-1.5"><label htmlFor={id} className="block text-sm font-semibold">{label}</label>{control}{hint ? <span id={`${id}-hint`} className={`block font-normal ${SECONDARY_TEXT}`}>{hint}</span> : null}</div>;
}
export function ErrorNotice({ message }: { message: string | null }) {
  return message ? <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{message}</p> : null;
}
