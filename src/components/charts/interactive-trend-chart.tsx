"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";

const CHART_WIDTH = 100;
const CHART_HEIGHT = 42;
const CHART_TOP = 3;
const CHART_BASELINE = 36;

export interface TrendChartPoint {
  key: string;
  label: string;
  value: number;
  valueLabel: string;
  detail?: string;
}

interface CurvePoint {
  x: number;
  y: number;
}

export function InteractiveTrendChart({
  points,
  maxValue,
  ariaLabel,
  stroke = "var(--primary)",
  className,
}: {
  points: TrendChartPoint[];
  maxValue: number;
  ariaLabel: string;
  stroke?: string;
  className?: string;
}) {
  const gradientId = useId().replaceAll(":", "");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const geometry = createCurveGeometry(points.map((point) => point.value), maxValue);
  const fallbackIndex = lastMeaningfulIndex(points.map((point) => point.value));
  const selectedIndex = activeIndex ?? fallbackIndex;
  const selected = points[selectedIndex];
  const marker = geometry.points[selectedIndex];
  const labels = dateLabelIndexes(points.length);
  const markerTop = marker ? marker.y / CHART_HEIGHT * 144 : 0;
  const tooltipTop = clamp(markerTop, 32, 110);

  function selectFromPointer(clientX: number, element: HTMLDivElement) {
    if (points.length === 0) return;
    const bounds = element.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width));
    setActiveIndex(Math.round(ratio * (points.length - 1)));
  }

  return (
    <div
      className={cn("relative h-44 touch-pan-y outline-none", className)}
      role="img"
      aria-label={ariaLabel}
      tabIndex={0}
      onPointerMove={(event) => selectFromPointer(event.clientX, event.currentTarget)}
      onPointerLeave={() => setActiveIndex(null)}
      onFocus={() => setActiveIndex((current) => current ?? fallbackIndex)}
      onBlur={() => setActiveIndex(null)}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const direction = event.key === "ArrowRight" ? 1 : -1;
        setActiveIndex((current) => Math.min(points.length - 1, Math.max(0, (current ?? fallbackIndex) + direction)));
      }}
    >
      <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} preserveAspectRatio="none" className="absolute inset-x-0 top-0 h-36 w-full overflow-visible" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.18" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {[9, 18, 27, 36].map((y) => <line key={y} x1="0" x2={CHART_WIDTH} y1={y} y2={y} stroke="var(--border)" strokeWidth="0.6" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />)}
        <path d={geometry.areaPath} fill={`url(#${gradientId})`} />
        <path d={geometry.linePath} fill="none" stroke={stroke} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {activeIndex !== null && marker ? <line x1={marker.x} x2={marker.x} y1={CHART_TOP} y2={CHART_BASELINE} stroke="var(--primary)" strokeWidth="1" strokeDasharray="2 2" opacity="0.42" vectorEffect="non-scaling-stroke" /> : null}
      </svg>

      {marker && selected ? (
        <>
          <span
            className={cn("pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-card bg-primary shadow-sm", activeIndex === null && "size-2.5")}
            style={{ left: `${marker.x}%`, top: `${markerTop}px` }}
          />
          {activeIndex !== null ? (
            <div
              className={cn(
                "pointer-events-none absolute z-10 min-w-32 -translate-y-1/2 rounded-lg border border-primary/15 bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg",
                marker.x > 58 ? "-ml-3 -translate-x-full" : "ml-3",
              )}
              style={{ left: `${marker.x}%`, top: `${tooltipTop}px` }}
            >
              <p className="text-muted-foreground">{selected.label}</p>
              <p className="mt-0.5 font-semibold tabular-nums">{selected.valueLabel}</p>
              {selected.detail ? <p className="mt-0.5 text-[11px] text-muted-foreground">{selected.detail}</p> : null}
            </div>
          ) : null}
        </>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 flex justify-between text-[10px] text-muted-foreground" aria-hidden="true">
        {labels.map((index) => <span key={points[index].key}>{points[index].label}</span>)}
      </div>
      {selected ? <span className="sr-only" aria-live="polite">{selected.label}: {selected.valueLabel}{selected.detail ? `, ${selected.detail}` : ""}</span> : null}
    </div>
  );
}

function createCurveGeometry(values: number[], maxValue: number) {
  if (values.length === 0) return { areaPath: "", linePath: "", points: [] as CurvePoint[] };
  const usableHeight = CHART_BASELINE - CHART_TOP;
  const denominator = Math.max(1, maxValue);
  const points = values.map((value, index) => ({
    x: values.length === 1 ? CHART_WIDTH / 2 : index / (values.length - 1) * CHART_WIDTH,
    y: CHART_BASELINE - Math.min(1, Math.max(0, value / denominator)) * usableHeight,
  }));
  const linePath = smoothPath(points, CHART_TOP, CHART_BASELINE);
  const first = points[0];
  const last = points.at(-1) ?? first;
  return {
    points,
    linePath,
    areaPath: `${linePath} L ${round(last.x)} ${CHART_BASELINE} L ${round(first.x)} ${CHART_BASELINE} Z`,
  };
}

function smoothPath(points: CurvePoint[], minY: number, maxY: number): string {
  if (points.length === 1) return `M ${round(points[0].x)} ${round(points[0].y)}`;
  let path = `M ${round(points[0].x)} ${round(points[0].y)}`;
  for (let index = 0; index < points.length - 1; index++) {
    const previous = points[index - 1] ?? points[index];
    const current = points[index];
    const next = points[index + 1];
    const after = points[index + 2] ?? next;
    const control1 = { x: current.x + (next.x - previous.x) / 6, y: clamp(current.y + (next.y - previous.y) / 6, minY, maxY) };
    const control2 = { x: next.x - (after.x - current.x) / 6, y: clamp(next.y - (after.y - current.y) / 6, minY, maxY) };
    path += ` C ${round(control1.x)} ${round(control1.y)}, ${round(control2.x)} ${round(control2.y)}, ${round(next.x)} ${round(next.y)}`;
  }
  return path;
}

function dateLabelIndexes(length: number): number[] {
  if (length === 0) return [];
  if (length === 1) return [0];
  return Array.from(new Set([0, Math.round((length - 1) / 3), Math.round((length - 1) * 2 / 3), length - 1]));
}

function lastMeaningfulIndex(values: number[]): number {
  for (let index = values.length - 1; index >= 0; index--) if (values[index] > 0) return index;
  return Math.max(0, values.length - 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
