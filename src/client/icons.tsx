type IconProps = {
  size?: number;
};

const baseProps = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true
});

export function DotIcon({ size = 16 }: IconProps) {
  return (
    <svg {...baseProps(size)}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}

export function PlayIcon({ size = 16 }: IconProps) {
  return (
    <svg {...baseProps(size)}>
      <polygon points="8 5 19 12 8 19 8 5" fill="currentColor" stroke="currentColor" />
    </svg>
  );
}

export function CheckIcon({ size = 16 }: IconProps) {
  return (
    <svg {...baseProps(size)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.5 2.5L16 9" />
    </svg>
  );
}

export function ArchiveIcon({ size = 16 }: IconProps) {
  return (
    <svg {...baseProps(size)}>
      <path d="M4 7h16" />
      <path d="M6 7v12h12V7" />
      <path d="M9 11h6" />
      <path d="M5 4h14v3H5z" />
    </svg>
  );
}

export function EyeIcon({ size = 16 }: IconProps) {
  return (
    <svg {...baseProps(size)}>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function ShieldIcon({ size = 16 }: IconProps) {
  return (
    <svg {...baseProps(size)}>
      <path d="M12 3l8 3v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6l8-3z" />
      <path d="M12 8v5" />
      <path d="M12 17h.01" />
    </svg>
  );
}

