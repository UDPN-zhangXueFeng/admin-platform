/** UDPN 字标，使用语义主题色以适配侧栏的亮色和暗色主题。 */
export function LogoMark() {
  return (
    <span
      className="relative inline-flex h-8 min-w-0 max-w-full items-center"
      aria-label="UDPN"
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

      <span
        className="relative inline-block whitespace-nowrap text-2xl font-extrabold leading-none tracking-[-0.08em]"
      >
        <span className="text-card-foreground">u</span>
        <span className="italic text-primary">dp</span>
        <span className="text-card-foreground">n</span>
        <span
          className="udpn-logo-shine pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_40%,hsl(var(--card))_50%,transparent_60%)] bg-[length:300%_100%] bg-clip-text text-transparent [-webkit-background-clip:text] motion-safe:animate-[udpn-logo-shine_5s_ease-in-out_infinite]"
          aria-hidden="true"
        >
          udpn
        </span>
      </span>
    </span>
  );
}
