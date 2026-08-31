import type { CSSProperties } from "react";

const frames = {
  full: { x: 216, y: 195, width: 1632, height: 340 },
  mark: { x: 216, y: 195, width: 345, height: 340 },
  wordmark: { x: 619, y: 270, width: 1229, height: 226 },
};

/** Displays the approved artwork unchanged, excluding its transparent outer margin. */
export function BrandLogo({
  variant = "full",
  inverse = false,
  className,
  style,
}: {
  variant?: keyof typeof frames;
  inverse?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const frame = frames[variant];
  return (
    <svg
      viewBox={`${frame.x} ${frame.y} ${frame.width} ${frame.height}`}
      width={frame.width}
      height={frame.height}
      role="img"
      aria-label="Shanyraq AI"
      className={className}
      style={{ display: "block", flexShrink: 0, ...style, ...(inverse ? { filter: "brightness(0) invert(1)" } : {}) }}
    >
      <image href="/brand/shanyraq-logo.png" width="2073" height="758" />
    </svg>
  );
}
