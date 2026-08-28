/** Gateway 登录页插画：inline SVG，使颜色跟随当前主题。 */
export function LoginIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 720 560"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <style>{`.gateway-float-a{animation:gateway-float-a 5s ease-in-out infinite}.gateway-float-b{animation:gateway-float-b 6s ease-in-out infinite}.gateway-pulse{animation:gateway-pulse 3.2s ease-in-out infinite}.gateway-flow{animation:gateway-flow 6s linear infinite}@keyframes gateway-float-a{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}@keyframes gateway-float-b{0%,100%{transform:translateY(0)}50%{transform:translateY(8px)}}@keyframes gateway-pulse{0%,100%{opacity:.35}50%{opacity:.9}}@keyframes gateway-flow{to{stroke-dashoffset:-80}}@media(prefers-reduced-motion:reduce){.gateway-float-a,.gateway-float-b,.gateway-pulse,.gateway-flow{animation:none}}`}</style>
      <defs>
        <linearGradient id="gateway-arch" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="var(--illus-mid, #2AA6B0)" />
          <stop offset="1" stopColor="var(--illus-deep, #103F63)" />
        </linearGradient>
        <linearGradient id="gateway-floor" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="var(--illus-soft, #B9F3EA)" stopOpacity=".55" />
          <stop offset="1" stopColor="var(--illus-deep, #103F63)" stopOpacity=".5" />
        </linearGradient>
        <radialGradient id="gateway-glow">
          <stop stopColor="var(--illus-soft, #B9F3EA)" stopOpacity=".8" />
          <stop offset="1" stopColor="var(--illus-mid, #2AA6B0)" stopOpacity="0" />
        </radialGradient>
        <filter id="gateway-shadow" x="-30%" y="-30%" width="160%" height="180%">
          <feDropShadow dx="0" dy="14" stdDeviation="10" floodColor="var(--illus-deep, #103F63)" floodOpacity=".3" />
        </filter>
      </defs>

      <ellipse cx="360" cy="346" rx="290" ry="170" stroke="var(--illus-line, #0B1F3A)" strokeOpacity=".5" strokeWidth="2" />
      <ellipse className="gateway-pulse" cx="360" cy="346" rx="236" ry="132" stroke="var(--illus-accent, #F2C66D)" strokeOpacity=".55" strokeWidth="2" strokeDasharray="10 14" />
      <ellipse className="gateway-pulse" cx="360" cy="300" rx="92" ry="138" fill="url(#gateway-glow)" />

      <g className="gateway-float-a" filter="url(#gateway-shadow)">
        <path d="M142 430 360 520 578 430 360 344 142 430Z" fill="url(#gateway-floor)" stroke="var(--illus-line, #0B1F3A)" strokeOpacity=".55" strokeWidth="3" />
        <path d="M224 406V178H310V406M410 406V178H496V406" fill="url(#gateway-arch)" stroke="var(--illus-line, #0B1F3A)" strokeWidth="4" />
        <path d="M196 178 222 148H498L524 178H196Z" fill="var(--illus-mid, #2AA6B0)" stroke="var(--illus-line, #0B1F3A)" strokeWidth="4" />
        <path d="M196 178H524V218H196V178Z" fill="url(#gateway-arch)" stroke="var(--illus-line, #0B1F3A)" strokeWidth="4" />
        <path d="M310 406V218H410V406" fill="url(#gateway-glow)" stroke="var(--illus-line, #0B1F3A)" strokeWidth="4" />
        <path d="M256 214V374M464 214V374" stroke="var(--illus-accent, #F2C66D)" strokeOpacity=".9" strokeWidth="4" strokeLinecap="round" />
        <path d="M278 198H442" stroke="var(--illus-soft, #B9F3EA)" strokeWidth="4" strokeLinecap="round" />
        <path className="gateway-flow" d="M360 242V376" stroke="var(--illus-soft, #B9F3EA)" strokeWidth="4" strokeDasharray="8 12" strokeLinecap="round" />
        <path d="M342 260 360 242 378 260 360 278 342 260Z" fill="var(--illus-accent, #F2C66D)" stroke="var(--illus-soft, #B9F3EA)" strokeWidth="2" />
      </g>

      <g fill="var(--illus-accent, #F2C66D)">
        <circle className="gateway-pulse" cx="148" cy="222" r="5" />
        <circle className="gateway-pulse" cx="572" cy="258" r="5" />
        <circle className="gateway-pulse" cx="360" cy="108" r="5" />
      </g>
      <path className="gateway-flow" d="M116 302C192 244 258 242 326 274" stroke="var(--illus-soft, #B9F3EA)" strokeOpacity=".7" strokeWidth="3" strokeDasharray="8 12" strokeLinecap="round" />
      <path className="gateway-flow" d="M394 274C468 308 526 304 604 252" stroke="var(--illus-soft, #B9F3EA)" strokeOpacity=".7" strokeWidth="3" strokeDasharray="8 12" strokeLinecap="round" />
    </svg>
  );
}
