'use client';

import * as React from 'react';

import {
  KISSEN_GATEWAY_PROJECT_ID,
  useBrandQuery,
} from '@myorg/modules/kissen-gateway/data-access';

/**
 * 品牌应用（源 `store/brand.ts` apply() + main.ts 启动加载语义）。
 *
 * 挂在 [locale]/layout（覆盖 login / change-pwd / 壳层全部页面），
 * query key 与登录页 useBrandQuery 一致（authKeys.brand(projectId)，
 * staleTime Infinity），TanStack Query 缓存天然去重不会重复请求。
 *
 * 应用内容：
 * 1. document.title = 品牌名（源 apply() 同名行为）；
 * 2. primaryColor 注入 CSS 变量 ——
 *    - 源 setProperty 原变量原样保留：--ks-clearing / --el-color-primary /
 *      --el-color-success（Element Plus 主题通道，本项目无对应消费但保持
 *      源语义完整）；
 *    - 映射到本项目主题变量：--primary 与 --ring。本项目 Tailwind 主题变量
 *      是 HSL 通道三元组（如 `241.268 75.532% 63.137%`，经 hsl(var(--primary))
 *      消费），因此需把品牌 hex 转 "H S% L%" 后注入；--ring 与 --primary
 *      在主题中同值（焦点环随主色），一并覆盖。
 * 失败回退默认值由 useBrandQuery 保证（源 getBrand catch → DEFAULT）。
 */
export function BrandProvider() {
  const { brand } = useBrandQuery(KISSEN_GATEWAY_PROJECT_ID);

  React.useEffect(() => {
    document.title = brand.name;
    const root = document.documentElement.style;
    // 源 setProperty 目标变量（原样保留）
    root.setProperty('--ks-clearing', brand.primaryColor);
    root.setProperty('--el-color-primary', brand.primaryColor);
    root.setProperty('--el-color-success', brand.primaryColor);
    // 本项目主题映射（hex → HSL 通道三元组，见组件注释）。
    // 主题系统激活时让位：config theme.themes 非空时 layout 防闪脚本
    // 会在首帧前写 documentElement.dataset.theme，此刻以它为开关——
    // --primary/--ring 归主题块接管（内联样式会压过任何 CSS 块，若
    // 无条件注入则切主题对主色不生效）；无主题配置的部署保持源行为。
    if (document.documentElement.dataset.theme) return;
    const hsl = hexToHslChannels(brand.primaryColor);
    root.setProperty('--primary', hsl);
    root.setProperty('--ring', hsl);
  }, [brand]);

  return null;
}

/** #RRGGBB → "H S% L%"（本项目 Tailwind 主题变量的通道格式）。 */
function hexToHslChannels(hex: string): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return hex; // 非预期格式：原样返回，交由 CSS 回退
  const value = Number.parseInt(match[1]!, 16);
  const r = ((value >> 16) & 0xff) / 255;
  const g = ((value >> 8) & 0xff) / 255;
  const b = (value & 0xff) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) {
      h = (g - b) / d + (g < b ? 6 : 0);
    } else if (max === g) {
      h = (b - r) / d + 2;
    } else {
      h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
