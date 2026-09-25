import type { SVGProps } from "react";

/** Minimal inline icon set (stroke-based, 24×24) to avoid an icon dependency. */

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const LogoMark = (p: IconProps) => (
  <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" {...p}>
    <defs>
      <linearGradient id="logo-g" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
        <stop stopColor="#6366f1" />
        <stop offset="1" stopColor="#a855f7" />
      </linearGradient>
    </defs>
    <rect width="32" height="32" rx="9" fill="url(#logo-g)" />
    <path d="M10 11h12M10 16h8M10 21h12" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);

export const ArrowRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
);
export const ArrowLeft = (p: IconProps) => (
  <Icon {...p}>
    <path d="M19 12H5M11 18l-6-6 6-6" />
  </Icon>
);
export const Check = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Icon>
);
export const X = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);
export const Lock = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
    <path d="M8 10.5V7.5a4 4 0 018 0v3" />
  </Icon>
);
export const Shield = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V6L12 3z" />
    <path d="M8.8 12.2l2.2 2.2 4.3-4.4" />
  </Icon>
);
export const Key = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="8" cy="15" r="4" />
    <path d="M11 12l8-8M16 7l2.5 2.5M14 9l2 2" />
  </Icon>
);
export const Eye = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);
export const Server = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="4" width="17" height="7" rx="2" />
    <rect x="3.5" y="13" width="17" height="7" rx="2" />
    <path d="M7 7.5h.01M7 16.5h.01" />
  </Icon>
);
export const Webhook = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 7.5a3 3 0 115 2.2L11 15" />
    <path d="M6 18a3 3 0 11.5-5.9" />
    <path d="M12 18h6a3 3 0 10-2.2-5" />
  </Icon>
);
export const Card = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
    <path d="M2.5 9.5h19M6.5 15h3" />
  </Icon>
);
export const Database = (p: IconProps) => (
  <Icon {...p}>
    <ellipse cx="12" cy="6" rx="7.5" ry="2.8" />
    <path d="M4.5 6v12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V6" />
    <path d="M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8" />
  </Icon>
);
export const Globe = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
  </Icon>
);
export const Zap = (p: IconProps) => (
  <Icon {...p}>
    <path d="M13 2.5L4.5 13.5H12l-1 8 8.5-11H12l1-8z" />
  </Icon>
);
export const Chart = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Icon>
);
export const Code = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8.5 7L3.5 12l5 5M15.5 7l5 5-5 5" />
  </Icon>
);
export const User = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="8" r="3.8" />
    <path d="M4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" />
  </Icon>
);
export const Smartphone = (p: IconProps) => (
  <Icon {...p}>
    <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
    <path d="M11 18.5h2" />
  </Icon>
);
export const Network = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="5" r="2.2" />
    <circle cx="5" cy="18" r="2.2" />
    <circle cx="19" cy="18" r="2.2" />
    <path d="M11 7l-5 9M13 7l5 9M7.2 18h9.6" />
  </Icon>
);
export const Sun = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" />
  </Icon>
);
export const Moon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" />
  </Icon>
);
export const Menu = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Icon>
);
export const Play = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 5l12 7-12 7V5z" />
  </Icon>
);
export const Pause = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 5v14M16 5v14" />
  </Icon>
);
export const Refresh = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 12a8 8 0 11-2.3-5.6M20 4v4.5h-4.5" />
  </Icon>
);
export const Alert = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.5l9.5 16.5h-19L12 3.5z" />
    <path d="M12 10v4.5M12 17.2h.01" />
  </Icon>
);
export const Info = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5M12 7.8h.01" />
  </Icon>
);
export const Clock = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.5 2" />
  </Icon>
);
export const Minus = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12h14" />
  </Icon>
);
export const Plus = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);
export const Spinner = ({ className, ...p }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" className={`animate-spin ${className ?? ""}`} {...p}>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
    <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

/** Checkmark whose stroke draws itself in (see .check-draw in globals.css). */
export const AnimatedCheck = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" className={className}>
    <path
      d="M5 12.5l4.5 4.5L19 7.5"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="check-draw"
    />
  </svg>
);
