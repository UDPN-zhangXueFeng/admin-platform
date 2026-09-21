'use client';

/**
 * User 模块筛选态 store（Zustand）。
 *
 * 对齐 sys/user 真实筛选（user.md §5.1：仅 userName/email 两字段）。
 * 列表页实际使用 react-hook-form 管理筛选表单（与 role 模块一致），
 * 此 store 保留供跨组件复用筛选态（如顶部全局搜索）的扩展点，非强制依赖。
 */

import { createUIStore } from '@myorg/shared/util-state';
import type { UserFilters } from '../user.model';

interface UserFilterState extends UserFilters {
  setUserName: (userName: string) => void;
  setEmail: (email: string) => void;
  resetFilters: () => void;
}

const DEFAULT_FILTERS: UserFilters = {
  userName: '',
  email: '',
};

export const useUserFilterStore = createUIStore<UserFilterState>(
  (set) => ({
    ...DEFAULT_FILTERS,
    setUserName: (userName) => set({ userName }),
    setEmail: (email) => set({ email }),
    resetFilters: () => set({ ...DEFAULT_FILTERS }),
  }),
  'UserFilterStore'
);
