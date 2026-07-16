/** Decorative active-menu background, adapted from the sidebar reference. */
export function SidebarActiveBackdrop() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 right-0 h-full w-32 overflow-visible text-primary-foreground"
      viewBox="0 0 128 44"
      fill="none"
      preserveAspectRatio="xMidYMid slice"
    >
      <circle
        className="origin-center animate-ping motion-reduce:animate-none"
        cx="104"
        cy="22"
        r="13"
        stroke="currentColor"
        strokeOpacity="0.13"
      />
      <g className="origin-[104px_22px] animate-spin motion-reduce:animate-none [animation-duration:9s]">
        <circle cx="104" cy="22" r="26" stroke="currentColor" strokeOpacity="0.14" strokeDasharray="22 14" />
        <circle cx="104" cy="22" r="18" stroke="currentColor" strokeOpacity="0.2" strokeDasharray="3 9" />
        <circle cx="104" cy="-4" r="2" fill="currentColor" fillOpacity="0.55" />
      </g>
    </svg>
  );
}
