/**
 * LogoMark —— gateway 品牌字标（public/logo.svg 的内联版，几何逐项一致）。
 *
 * `<img>` 加载的 SVG 是隔离文档，解析不了页面 CSS 变量；主题跟随要求品牌
 * 资产内联并绑定 `--brand-deep` / `--brand-accent`（LP 06 §2.3 技术硬约束）。
 * fallback 取默认主题 jade 的值，脱离主题上下文仍按品牌绿渲染。
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 246 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Kissen Gateway"
      role="img"
    >
      {/* Gateway mark: bank arch + clearing flow arrow */}
      <rect
        x="0"
        y="4"
        width="40"
        height="40"
        rx="9"
        fill="var(--brand-deep, #0B6B53)"
      />
      <path
        d="M12 33V23a8 8 0 0 1 16 0v10"
        stroke="#FFFFFF"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="M9 36h22"
        stroke="#FFFFFF"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="M17 28h7m0 0-2.5-2.5M24 28l-2.5 2.5"
        stroke="var(--brand-accent, #45D0A0)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Wordmark */}
      <text
        x="50"
        y="31"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="24"
        fontWeight="700"
        letterSpacing="0.5"
        fill="var(--brand-deep, #0B6B53)"
      >
        Kissen
      </text>
      <text
        x="138"
        y="31"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="24"
        fontWeight="700"
        letterSpacing="0.5"
        fill="var(--brand-accent, #45D0A0)"
      >
        Gateway
      </text>
    </svg>
  );
}
