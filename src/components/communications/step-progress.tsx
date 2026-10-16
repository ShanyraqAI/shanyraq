export function StepProgress({ step, labels }: { step: number; labels: readonly string[] }) {
  return (
    <ol aria-label="Шаги" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {labels.map((label, i) => (
        <li key={label} aria-current={step === i + 1 ? "step" : undefined} className={`flex items-center gap-1.5 ${step === i + 1 ? "font-medium text-primary" : ""}`}>
          <span className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] ${step === i + 1 ? "bg-primary/10 text-primary" : "bg-muted"}`}>{i + 1}</span>
          <span>{label}</span>
        </li>
      ))}
    </ol>
  );
}
