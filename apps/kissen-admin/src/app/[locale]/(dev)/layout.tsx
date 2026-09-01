import type { ReactNode } from 'react';

/**
 * (dev) route group —— 仅承载开发期工具页（UI showcase 等），不进菜单树。
 * 生产构建下页面自行 notFound()，该 layout 只提供最小排版。
 */
export default function DevLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-background text-foreground">{children}</div>;
}
