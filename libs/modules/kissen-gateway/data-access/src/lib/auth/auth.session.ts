'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';

import type { LoginRespVO } from './auth.model';
import { getBankDetail, getBankOnboardStatus } from '../bank/bank.api';
import { bankKeys } from '../bank/bank.keys';

/**
 * 会话持久化（源 `src/store/user.ts` 的 TOKEN_KEY/USER_KEY 语义 + 目标
 * middleware 的 cookie 要求）。
 *
 * 源仅用 localStorage（`bankgw.token` / `bankgw.user`）；目标 Next.js
 * middleware 在服务端做路由守卫，只能读 cookie `kissen_gateway_token`
 * （见 apps/kissen-gateway-portal/src/middleware.ts），因此登录时双写：
 * - localStorage：axios 请求拦截器读 token、刷新后恢复 userInfo（源语义）
 * - cookie：middleware 服务端守卫（SameSite=Lax，与 shared util-auth 同策略）
 */

const TOKEN_KEY = 'bankgw.token';
const USER_KEY = 'bankgw.user';
/** middleware 读取的 cookie 名（apps/kissen-gateway-portal/src/middleware.ts）。 */
export const GATEWAY_TOKEN_COOKIE = 'kissen_gateway_token';

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

function readStoredUser(): LoginRespVO | null {
  try {
    const raw = window.localStorage.getItem(USER_KEY) ?? 'null';
    const parsed = JSON.parse(raw) as LoginRespVO | null;
    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

/** 读取 token（localStorage，源 store.token 初始化）。 */
export function getGatewayToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY) ?? null;
  } catch {
    return null;
  }
}

/** 读取本地会话用户（LoginRespVO 全字段，含 firstLogin/menuKeys/loginName）。 */
export function getGatewayUser(): LoginRespVO | null {
  if (typeof window === 'undefined') return null;
  return readStoredUser();
}

/** 是否首次登录（firstLogin === 0，源 store.firstLogin computed）。 */
export function isFirstLogin(): boolean {
  return getGatewayUser()?.firstLogin === 0;
}

/** 保存会话：localStorage 双写 + middleware cookie。 */
export function saveGatewaySession(user: LoginRespVO): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TOKEN_KEY, user.token);
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    document.cookie = `${GATEWAY_TOKEN_COOKIE}=${encodeURIComponent(
      user.token,
    )}; Path=/; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`;
    notifyGatewaySessionChanged();
  } catch {
    // 受限环境（如隐私模式）静默失败，与 shared util-auth 同策略
  }
}

/** 更新已存 userInfo（源 changePwd 成功后回写 firstLogin=1）。 */
export function updateGatewayUser(patch: Partial<LoginRespVO>): void {
  if (typeof window === 'undefined') return;
  const current = readStoredUser();
  if (!current) return;
  saveGatewaySession({ ...current, ...patch });
}

/**
 * 改密成功：firstLogin 置 1（源 store.changePwd 内
 * `userInfo.firstLogin = 1` + 回写 localStorage）。
 */
export function markFirstLoginDone(): void {
  updateGatewayUser({ firstLogin: 1 });
}

/** 清空本地会话（源 store.clear()：token/userInfo 全清 + 失效 cookie）。 */
export function clearGatewaySession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
    document.cookie = `${GATEWAY_TOKEN_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`;
    notifyGatewaySessionChanged();
  } catch {
    // 受限环境静默失败
  }
}

/* ── 会话响应性（目标特有补丁：源 store.token 是 Vue ref，天然响应；
 * localStorage 无同页变更事件，写路径手动广播，跨页签借 storage）── */

type GatewaySessionListener = () => void;

const gatewaySessionListeners = new Set<GatewaySessionListener>();

function notifyGatewaySessionChanged(): void {
  for (const listener of gatewaySessionListeners) listener();
}

function onGatewayStorageEvent(event: StorageEvent): void {
  // key 为 null（clear()）或本 token key 被他页改写时才广播。
  if (event.key === null || event.key === TOKEN_KEY) {
    for (const listener of gatewaySessionListeners) listener();
  }
}

/** 订阅会话变化（本页写路径 + 跨页签 storage）。返回退订函数。 */
export function subscribeGatewaySession(
  listener: GatewaySessionListener,
): () => void {
  const isFirst = gatewaySessionListeners.size === 0;
  gatewaySessionListeners.add(listener);
  if (typeof window !== 'undefined' && isFirst) {
    window.addEventListener('storage', onGatewayStorageEvent);
  }
  return () => {
    gatewaySessionListeners.delete(listener);
    if (typeof window !== 'undefined' && gatewaySessionListeners.size === 0) {
      window.removeEventListener('storage', onGatewayStorageEvent);
    }
  };
}

/**
 * hasSession 的响应式形态（token 存在即有会话）：挂载常驻的客户端
 * 守卫在登录写入 token 后立即重渲染并启用双门控查询——源 locked 为
 * computed，天然覆盖「先深链后登录」；目标用快照会在 SPA 跳转不重
 * 挂载时失效。SSR 侧快照恒 false，与水合首帧一致。
 */
export function useGatewayHasSession(): boolean {
  return React.useSyncExternalStore(
    subscribeGatewaySession,
    () => getGatewayToken() !== null,
    () => false,
  );
}

/* ── 入网/激活双门控（源 store/user.ts onboarded/instanceActive + MainLayout locked）──
 *
 * 源语义（store/user.ts:35-80）：
 * - onboarded = getBankOnboardStatus().status === 20；请求失败保持 null。
 * - instanceActive = bank/detail 按 instanceId 与 instances[] 匹配，任一匹配项
 *   activated；instanceId 空/匹配不到/失败保持 null。
 * - 39c8a2b 银行级纠偏：loadInstanceStatus 内 detail.onboardStatus === 20 时
 *   直接 onboarded = true——申请级审批流可能停留中间态（如 admin 工作流
 *   10=审核中），而银行主体已生效即视为已入网，防「页面显示已通过、菜单
 *   却被申请级状态锁死」；纠偏单向（仅置 true），不反向降级。
 * - null = 未知：不过滤菜单、不锁门户（防上行失败误锁），locked 仅在
 *   onboarded === false 或 instanceActive === false 时为 true。
 *
 * 目标实现为 TanStack Query 缓存上的派生 view（复用 bank 域 query key，
 * onboard 页 infoSubmit/激活成功后的 invalidateQueries 自动刷新门控）；
 * retry: false + placeholderData 保 null：失败态不上弹错误、不阻断导航。
 */

/** 入网完成判定（status===20；未知/失败 → null 不过滤）。源 loadOnboardStatus。 */
export function useGatewayOnboardedQuery(enabled = true) {
  return useQuery({
    queryKey: bankKeys.onboardStatus(),
    queryFn: ({ signal }) => getBankOnboardStatus({ signal }),
    enabled,
    retry: false,
    // 失败时沿用上一次已知值；从未成功过则为 undefined（视同 null 不锁）。
    placeholderData: (prev) => prev,
    select: (st) => st?.status === 20,
  });
}

/**
 * bank/detail 双门控派生（源 loadInstanceStatus 匹配口径 + 39c8a2b 纠偏）：
 * - instanceActive：instanceId 与 instances[].instanceId 相等的那条 activated；
 *   instanceId 为空/匹配不到 → null（防误锁）。
 * - bankApproved：detail.onboardStatus === 20（银行主体已生效），仅用于把
 *   onboarded 纠偏为 true，不参与未入网判定。
 */
interface DetailGating {
  /** true=本行实例已激活 / false=未激活 / null=未知（防误锁）。 */
  instanceActive: boolean | null;
  /** 银行级已入网（detail.onboardStatus === 20）。 */
  bankApproved: boolean;
}

function deriveDetailGating(
  d: {
    instanceId?: string;
    onboardStatus?: number;
    instances: { instanceId: string; activated: boolean }[];
  } | undefined,
): DetailGating | null {
  if (!d) return null;
  const matched = d.instanceId
    ? d.instances.filter((i) => i.instanceId === d.instanceId)
    : [];
  return {
    instanceActive: matched.length ? matched.some((i) => i.activated) : null,
    bankApproved: d.onboardStatus === 20,
  };
}

/**
 * 实例激活 + 银行级入网双派生查询（未知/失败 → null 不锁）。
 * 39c8a2b：detail 无条件拉取（源 MainLayout onMounted 不再仅 onboarded
 * === true 时）——除实例激活判定外，还用银行级 onboardStatus 纠偏申请级
 * 审批流中间态造成的误锁。
 */
export function useGatewayDetailGatingQuery(enabled = true) {
  return useQuery({
    queryKey: bankKeys.detail(),
    queryFn: ({ signal }) => getBankDetail({ signal }),
    enabled,
    retry: false,
    placeholderData: (prev) => prev,
    select: deriveDetailGating,
  });
}

/** 双门控聚合视图（源 MainLayout locked computed）。 */
export interface GatewayLockState {
  /** true=已入网（申请级 status 20，或银行级 detail.onboardStatus 20 纠偏）/ false=未入网 / null=未知。 */
  onboarded: boolean | null;
  /** true=本行实例已激活 / false=未激活 / null=未知。 */
  instanceActive: boolean | null;
  /** 门户锁定：仅明确 false 才锁（null 不锁，防上行失败误锁）。 */
  locked: boolean;
}

/**
 * 登录后自动拉取并聚合双门控状态（源 login→loadOnboardStatus、
 * MainLayout onMounted 的「status + 无条件 detail」链）。
 *
 * 首次挂载即发起请求（enabled 由调用方传会话存在性）；失败不弹错、
 * 不阻断导航（null 不锁），bank 域缓存失效后自动重判。
 */
export function useGatewayLockState(
  enabled = getGatewayToken() !== null,
): GatewayLockState {
  // 申请级入网判定（源 loadOnboardStatus）。
  const onboardStatus = useGatewayOnboardedQuery(enabled);
  // 39c8a2b：detail 无条件拉取，不再仅 onboarded === true 时（源 onMounted）。
  const detailGating = useGatewayDetailGatingQuery(enabled);
  // 银行级纠偏单向：detail.onboardStatus === 20 → onboarded = true（源
  // loadInstanceStatus 纠偏分支）；否则维持申请级口径（未知保持 null 不锁）。
  const onboarded = detailGating.data?.bankApproved
    ? true
    : (onboardStatus.data ?? null);
  const instanceActive = detailGating.data?.instanceActive ?? null;
  return {
    onboarded,
    instanceActive,
    locked: onboarded === false || instanceActive === false,
  };
}
