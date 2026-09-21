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
 * 2. primaryColor 仅作为品牌配置数据保留，不注入运行时主题。
 *    当前门户主题完全由 configs/kissen-gateway.json + 本地外观偏好控制，
 *    避免公开 brand 接口返回的颜色覆盖系统调色板。
 * 失败回退默认值由 useBrandQuery 保证（源 getBrand catch → DEFAULT）。
 */
export function BrandProvider() {
  const { brand } = useBrandQuery(KISSEN_GATEWAY_PROJECT_ID);

  React.useEffect(() => {
    document.title = brand.name;
  }, [brand.name]);

  return null;
}
