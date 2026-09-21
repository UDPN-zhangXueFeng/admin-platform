/**
 * Kissen Admin 登录页品牌锁定区。
 *
 * 参考 udpn Kissen 原始字标的双色关系，将「udpn」与「Kissen」拆成两个
 * 清晰的视觉单元；颜色仍绑定主题 token，避免亮色主题切换时品牌区失配。
 */
export function KissenBrandMark() {
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-baseline whitespace-nowrap leading-none tracking-[-0.08em]">
        <span className="text-[clamp(3.5rem,5.4vw,5.25rem)] font-extrabold italic text-[var(--brand-deep,#0B1F3A)]">
          udpn
        </span>
        <span className="ml-2 text-[clamp(3.5rem,5.4vw,5.25rem)] font-extrabold italic text-[var(--brand-accent,#2DD4BF)]">
          Kissen
        </span>
      </div>

      <div className="mt-4 flex items-center gap-3 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep,#0B1F3A)] opacity-80">
        <span
          className="h-px w-8 bg-[var(--brand-accent,#2DD4BF)]"
          aria-hidden="true"
        />
        <span>Network Management System</span>
        <span
          className="h-px w-8 bg-[var(--brand-accent,#2DD4BF)]"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

/**
 * 深色顶部 banner 使用的紧凑字标；标题和副标题仍由 shared Header 负责。
 */
export function KissenHeaderMark() {
  return (
    <span
      role="img"
      aria-label="udpn Kissen"
      className="inline-flex shrink-0 items-baseline whitespace-nowrap leading-none tracking-[-0.08em]"
    >
      <span className="text-[1.65rem] font-extrabold italic text-white min-[1600px]:text-[1.9rem]">
        udpn
      </span>
      <span className="ml-1 text-[1.65rem] font-extrabold italic text-[var(--brand-accent,#2DD4BF)] min-[1600px]:text-[1.9rem]">
        Kissen
      </span>
    </span>
  );
}
