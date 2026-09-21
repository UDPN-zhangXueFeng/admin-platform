/**
 * LoginIllustration — inline theme-following replacement for
 * public/login-illustration.svg.
 *
 * Inline so fills/strokes can track the active brand palette
 * (`--illus-*` tokens from configs/lp-portal.json theme.themes) with the
 * original violet hexes as fallbacks. Near-white details (#efe9ff waves) stay
 * fixed — they read as highlights in every palette. Original SMIL-free CSS
 * animations preserved verbatim, incl. the prefers-reduced-motion guard.
 */
export function LoginIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 720 560"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <style>{`.li-float-a{animation:li-float-a 5s ease-in-out infinite}.li-float-b{animation:li-float-b 6s ease-in-out infinite}.li-pulse{animation:li-pulse 3.2s ease-in-out infinite}.li-flow{animation:li-flow 6s linear infinite}@keyframes li-float-a{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}@keyframes li-float-b{0%,100%{transform:translateY(0)}50%{transform:translateY(8px)}}@keyframes li-pulse{0%,100%{opacity:.35}50%{opacity:.9}}@keyframes li-flow{to{stroke-dashoffset:-80}}@media(prefers-reduced-motion:reduce){.li-float-a,.li-float-b,.li-pulse,.li-flow{animation:none}}`}</style>
      <defs>
        <linearGradient id="li-basin" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="var(--illus-mid, #7c66e8)" />
          <stop offset="1" stopColor="var(--illus-deep, #4333a6)" />
        </linearGradient>
        <linearGradient id="li-rim" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="var(--illus-soft, #c9b8ff)" />
          <stop offset="1" stopColor="var(--illus-mid, #9d8bf5)" />
        </linearGradient>
        <linearGradient id="li-water" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="var(--illus-soft, #c9b8ff)" />
          <stop offset="1" stopColor="var(--illus-mid, #9b86f0)" />
        </linearGradient>
        <linearGradient id="li-drop" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="var(--illus-accent, #f0abfc)" />
          <stop offset="1" stopColor="var(--illus-accent-deep, #c026d3)" />
        </linearGradient>
        <filter
          id="li-shadow"
          x="-30%"
          y="-30%"
          width="160%"
          height="180%"
        >
          <feDropShadow
            dx="0"
            dy="14"
            stdDeviation="10"
            floodColor="var(--illus-deep, #2e1065)"
            floodOpacity=".28"
          />
        </filter>
      </defs>

      <ellipse
        cx="360"
        cy="330"
        rx="300"
        ry="172"
        stroke="var(--illus-line, #372a94)"
        strokeOpacity=".55"
        strokeWidth="2"
      />
      <ellipse
        className="li-pulse"
        cx="360"
        cy="330"
        rx="246"
        ry="136"
        stroke="var(--illus-accent, #f0abfc)"
        strokeOpacity=".55"
        strokeWidth="2"
      />

      <g filter="url(#li-shadow)">
        <path
          d="M230 452V486C230 514 296 528 385 528C474 528 540 514 540 486V452Z"
          fill="url(#li-basin)"
          stroke="var(--illus-line, #372a94)"
          strokeWidth="3"
        />
        <ellipse
          cx="385"
          cy="452"
          rx="155"
          ry="44"
          fill="url(#li-rim)"
          stroke="var(--illus-line, #372a94)"
          strokeWidth="3"
        />
        <ellipse cx="385" cy="452" rx="134" ry="36" fill="url(#li-water)" />
        <path
          d="M317 450q14 -7 28 0t28 0t28 0t28 0t28 0"
          stroke="#efe9ff"
          strokeOpacity=".85"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M337 463q14 -6 28 0t28 0t28 0"
          stroke="#efe9ff"
          strokeOpacity=".5"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <ellipse
          className="li-pulse"
          cx="385"
          cy="452"
          rx="98"
          ry="25"
          stroke="var(--illus-soft, #67e8f9)"
          strokeOpacity=".6"
          strokeWidth="2"
        />
      </g>

      <g filter="url(#li-shadow)">
        <path
          d="M167 318V346C167 370 216 382 285 382C354 382 403 370 403 346V318Z"
          fill="url(#li-basin)"
          stroke="var(--illus-line, #372a94)"
          strokeWidth="3"
        />
        <ellipse
          cx="285"
          cy="318"
          rx="118"
          ry="32"
          fill="url(#li-rim)"
          stroke="var(--illus-line, #372a94)"
          strokeWidth="3"
        />
        <ellipse cx="285" cy="318" rx="100" ry="25" fill="url(#li-water)" />
        <path
          d="M225 316q13 -6 26 0t26 0t26 0t26 0"
          stroke="#efe9ff"
          strokeOpacity=".85"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>

      <g filter="url(#li-shadow)">
        <path
          d="M268 150V172C268 190 306 200 360 200C414 200 452 190 452 172V150Z"
          fill="url(#li-basin)"
          stroke="var(--illus-line, #372a94)"
          strokeWidth="3"
        />
        <ellipse
          cx="360"
          cy="150"
          rx="92"
          ry="25"
          fill="url(#li-rim)"
          stroke="var(--illus-line, #372a94)"
          strokeWidth="3"
        />
        <ellipse cx="360" cy="150" rx="76" ry="19" fill="url(#li-water)" />
        <path
          d="M312 148q12 -5 24 0t24 0t24 0"
          stroke="#efe9ff"
          strokeOpacity=".85"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>

      <path
        d="M356 196C332 228 302 250 289 294"
        stroke="var(--illus-soft, #b7a4ff)"
        strokeOpacity=".35"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        className="li-flow"
        d="M356 196C332 228 302 250 289 294"
        stroke="var(--illus-accent, #f5d0fe)"
        strokeOpacity=".85"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="3 15"
      />
      <path
        d="M295 380C325 416 352 424 378 420"
        stroke="var(--illus-soft, #b7a4ff)"
        strokeOpacity=".35"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        className="li-flow"
        d="M295 380C325 416 352 424 378 420"
        stroke="var(--illus-accent, #f5d0fe)"
        strokeOpacity=".85"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="3 15"
      />

      <g transform="translate(150 215)">
        <g className="li-float-a" filter="url(#li-shadow)">
          <path
            d="M0 -16C7 -5 11 1 11 8A11 11 0 1 1 -11 8C-11 1 -7 -5 0 -16Z"
            fill="url(#li-drop)"
            stroke="var(--illus-accent, #f5d0fe)"
            strokeWidth="2"
          />
        </g>
      </g>
      <g transform="translate(560 250) scale(.85)">
        <g className="li-float-b" filter="url(#li-shadow)">
          <path
            d="M0 -16C7 -5 11 1 11 8A11 11 0 1 1 -11 8C-11 1 -7 -5 0 -16Z"
            fill="url(#li-drop)"
            stroke="var(--illus-accent, #f5d0fe)"
            strokeWidth="2"
          />
        </g>
      </g>
      <g transform="translate(505 385) scale(.7)">
        <g className="li-float-a" filter="url(#li-shadow)">
          <path
            d="M0 -16C7 -5 11 1 11 8A11 11 0 1 1 -11 8C-11 1 -7 -5 0 -16Z"
            fill="url(#li-drop)"
            stroke="var(--illus-accent, #f5d0fe)"
            strokeWidth="2"
          />
        </g>
      </g>
      <g transform="translate(215 108) scale(.6)">
        <g className="li-float-b" filter="url(#li-shadow)">
          <path
            d="M0 -16C7 -5 11 1 11 8A11 11 0 1 1 -11 8C-11 1 -7 -5 0 -16Z"
            fill="url(#li-drop)"
            stroke="var(--illus-accent, #f5d0fe)"
            strokeWidth="2"
          />
        </g>
      </g>

      <g
        stroke="var(--illus-accent, #f5d0fe)"
        strokeWidth="3"
        strokeLinecap="round"
      >
        <path className="li-pulse" d="M95 344V356M89 350H101" />
        <path className="li-pulse" d="M628 384V396M622 390H634" />
      </g>
      <g
        stroke="var(--illus-soft, #c4b5fd)"
        strokeWidth="3"
        strokeLinecap="round"
      >
        <path className="li-pulse" d="M480 84V96M474 90H486" />
      </g>
      <g fill="var(--illus-accent, #e9d5ff)">
        <circle className="li-pulse" cx="86" cy="180" r="4" />
        <circle className="li-pulse" cx="640" cy="150" r="4" />
      </g>
    </svg>
  );
}
