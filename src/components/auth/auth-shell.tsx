import { BrandLogo } from "@/components/shared/brand-logo";
import { t } from "@/lib/i18n";

/** Centered brand card used by /login and /register. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-md">
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <BrandLogo variant="mark" className="size-11" />
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/70 bg-[#fffdf8]/90 p-6 shadow-[0_24px_80px_rgba(18,48,35,0.16)] backdrop-blur-xl sm:p-8">
        {children}
      </div>

      {footer ? <div className="mt-4 text-center text-sm text-muted-foreground">{footer}</div> : null}

      <p className="mt-6 text-center text-xs text-muted-foreground/70">{t.tagline}</p>
    </div>
  );
}
