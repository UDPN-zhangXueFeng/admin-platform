/**
 * Admin-only top header background: "brand light field".
 *
 * Builds directly on the project primary (#5d5ae8) with lavender/white light
 * and a fine dot lattice. The banner is static apart from a click-triggered
 * one-shot left→right light sweep that parks at its end position. No dark navy
 * veil, no cyan. Purely decorative; the brand accents live in globals.css.
 */
export interface AdminHeaderBannerProps {
  /** Increment to replay the one-shot sweep; 0 = never fired. */
  sweepRun?: number;
}

export function AdminHeaderBanner({ sweepRun = 0 }: AdminHeaderBannerProps) {
  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="none"
      viewBox="0 0 1600 112"
    >
      <defs>
        <linearGradient id="admin-banner-base" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--admin-banner-accent)" />
          <stop offset="0.3" stopColor="#6461ec" />
          <stop offset="0.55" stopColor="#6b68f0" />
          <stop offset="0.8" stopColor="#5c59e7" />
          <stop offset="1" stopColor="#4f4bd9" />
        </linearGradient>
        <linearGradient id="admin-banner-tone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.07" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#4a46d0" stopOpacity="0.08" />
        </linearGradient>
        <radialGradient id="admin-banner-glow-white" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.26" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="admin-banner-glow-lavender" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="var(--admin-banner-light)" stopOpacity="0.32" />
          <stop offset="1" stopColor="#d5d3ff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="admin-banner-fade" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.16" stopColor="#ffffff" stopOpacity="0.7" />
          <stop offset="0.78" stopColor="#ffffff" stopOpacity="0.7" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <pattern
          id="admin-banner-dots"
          width="32"
          height="32"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="2" cy="2" r="1" fill="#ffffff" fillOpacity="0.45" />
        </pattern>
        <mask
          id="admin-banner-dots-mask"
          x="0"
          y="0"
          width="1600"
          height="112"
          maskUnits="userSpaceOnUse"
          maskContentUnits="userSpaceOnUse"
        >
          <rect
            width="1600"
            height="112"
            fill="url(#admin-banner-fade)"
            opacity="0.5"
          />
        </mask>
        <linearGradient id="admin-banner-hairline" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.25" stopColor="var(--admin-banner-line)" stopOpacity="0.35" />
          <stop offset="0.75" stopColor="var(--admin-banner-line)" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient
          id="admin-banner-sheen"
          x1="-500"
          x2="-140"
          y1="0"
          y2="0"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.12" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect width="1600" height="112" fill="url(#admin-banner-base)" />
      <rect
        width="1600"
        height="112"
        fill="url(#admin-banner-dots)"
        mask="url(#admin-banner-dots-mask)"
      />

      <ellipse
        cx="420"
        cy="-54"
        rx="560"
        ry="140"
        fill="url(#admin-banner-glow-white)"
      />
      <ellipse
        cx="1390"
        cy="116"
        rx="430"
        ry="140"
        fill="url(#admin-banner-glow-lavender)"
      />

      <path
        d="M-60 10C300 34 520-8 860 6S1320 34 1660 8"
        fill="none"
        stroke="url(#admin-banner-hairline)"
        strokeWidth="1"
        opacity="0.55"
      />

      {sweepRun > 0 ? (
        <g key={sweepRun} className="admin-banner-sheen">
          <path
            d="M-300 -60L-140 -60L-340 172L-500 172Z"
            fill="url(#admin-banner-sheen)"
          />
          <path
            d="M-180 -60L-168 -60L-368 172L-380 172Z"
            fill="#ffffff"
            opacity="0.24"
          />
        </g>
      ) : null}

      <rect width="1600" height="112" fill="url(#admin-banner-tone)" />
      <rect
        y="0.5"
        width="1600"
        height="1"
        fill="url(#admin-banner-hairline)"
        opacity="0.5"
      />
      <rect
        y="110.5"
        width="1600"
        height="1"
        fill="url(#admin-banner-hairline)"
        opacity="0.8"
      />
    </svg>
  );
}
