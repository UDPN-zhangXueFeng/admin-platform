/**
 * UDPN 主品牌字标 + Bank Portal 产品名称。
 *
 * 这里刻意使用 JSX/CSS 而不是 SVG：`dp` 可以直接读取门户的主题变量，
 * 同时避免 SVG 文本在不同字体环境下产生额外的 viewBox 裁切问题。
 */
interface LogoMarkProps {
  className?: string;
  productName?: string;
}

export function LogoMark({ className, productName }: LogoMarkProps) {
  const resolvedProductName = productName || 'UDPN Kissen Bank Portal';
  const rootClassName = [
    'relative inline-flex h-14 min-w-0 max-w-full items-end pb-1',
    'min-[1600px]:h-16',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span
      className={rootClassName}
      aria-label={resolvedProductName}
      role="img"
    >
      <style>{`
        @keyframes udpn-logo-shine {
          0%, 12% { background-position: 130% 0; }
          42%, 100% { background-position: -30% 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          .udpn-logo-shine { animation: none; }
        }
      `}</style>

      <span className="relative inline-block whitespace-nowrap text-[3rem] font-extrabold leading-none tracking-[-0.08em] min-[1600px]:text-[3.5rem]">
        <span className="text-white">u</span>
        <span className="italic text-[var(--brand-accent,#45D0A0)]">dp</span>
        <span className="text-white">n</span>
        <span
          className="udpn-logo-shine pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_40%,rgba(255,255,255,0.95)_50%,transparent_60%)] bg-[length:300%_100%] bg-clip-text text-transparent [-webkit-background-clip:text] motion-safe:animate-[udpn-logo-shine_5s_ease-in-out_infinite]"
          aria-hidden="true"
        >
          udpn
        </span>
      </span>

      <span className="absolute bottom-1 left-[104px] right-0 min-w-0 truncate text-[clamp(0.95rem,1.25vw,1.5rem)] font-semibold leading-none tracking-[-0.02em] text-white/85 sm:left-32 min-[1600px]:left-36">
        {resolvedProductName}
      </span>
    </span>
  );
}
