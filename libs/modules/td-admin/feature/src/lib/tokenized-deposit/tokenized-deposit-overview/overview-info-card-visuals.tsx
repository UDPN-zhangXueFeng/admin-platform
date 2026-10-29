/**
 * 概览卡视觉子组件：StateIcon（Token Name 行尾 state 图标）与
 * AnimatedOverviewBackground（左栏主题渐变背景，复用 Header 动效类）。
 * 源: overview-info-card.tsx 202-324
 */
'use client';

import * as React from 'react';
import { TD_STATE_ICON_COLOR } from '@myorg/modules/td-admin/data-access';

/**
 * state 图标（概览卡 Token Name 行尾）。
 *
 * 0=ClockIcon(#d4865f) / 1=CheckCircleIcon(#87ca87) / 2=NoSymbolIcon(#fe5945)。
 * 色走 TD_STATE_ICON_COLOR 常量（与 util 一致，勿硬编码）。
 */
export function StateIcon({ state }: { state?: number }): React.JSX.Element | null {
  if (state == null) return null;
  const color = TD_STATE_ICON_COLOR[state] ?? '#666666';
  // heroicons outline 24×24 等价（Clock/CheckCircle/NoSymbol）。
  if (state === 0) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="ml-1 inline-block h-4 w-4 align-middle"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <polyline points="12 7 12 12 15 14" />
      </svg>
    );
  }
  if (state === 1) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="ml-1 inline-block h-4 w-4 align-middle"
        aria-hidden="true"
      >
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    );
  }
  // state === 2（禁用）
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="ml-1 inline-block h-4 w-4 align-middle"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <line x1="5.6" y1="5.6" x2="18.4" y2="18.4" />
    </svg>
  );
}

/** 复用 Header 的主题色与低频动画类，避免为概览卡引入额外位图资源。 */
export function AnimatedOverviewBackground(): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      preserveAspectRatio="none"
      viewBox="0 0 800 340"
    >
      <defs>
        <linearGradient id="token-overview-base" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="var(--banner-start)" />
          <stop offset="0.52" stopColor="var(--banner-mid)" />
          <stop offset="1" stopColor="var(--banner-end)" />
        </linearGradient>
        <radialGradient id="token-overview-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="var(--banner-glow)" stopOpacity="0.52" />
          <stop offset="1" stopColor="var(--banner-glow)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="token-overview-highlight" cx="50%" cy="50%" r="50%">
          <stop
            offset="0"
            stopColor="var(--banner-highlight)"
            stopOpacity="0.38"
          />
          <stop
            offset="1"
            stopColor="var(--banner-highlight)"
            stopOpacity="0"
          />
        </radialGradient>
      </defs>
      <rect width="800" height="340" fill="url(#token-overview-base)" />
      <ellipse
        className="app-banner-orb-one"
        cx="120"
        cy="75"
        rx="260"
        ry="160"
        fill="url(#token-overview-glow)"
      />
      <ellipse
        className="app-banner-orb-two"
        cx="670"
        cy="290"
        rx="280"
        ry="175"
        fill="url(#token-overview-highlight)"
      />
      <path
        className="app-banner-wave"
        d="M-80 240C70 195 180 295 350 236C500 183 615 280 880 184V340H-80Z"
        fill="var(--banner-wave)"
        opacity="0.2"
      />
    </svg>
  );
}
