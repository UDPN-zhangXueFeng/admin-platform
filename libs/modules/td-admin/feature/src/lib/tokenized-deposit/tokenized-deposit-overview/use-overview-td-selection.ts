/**
 * OverviewShell 的 applyList 联动与 TD 选择 hook：activeCode/active state、
 * currentTd/activeIndex 推导、Melt 可用性（useHasPendingMeltQuery）、初始 Tab
 * 决策与切换/Onboard 回调（原主壳内联 state/query/回调，纯搬运）。
 * 源: overview-shell.tsx 122-130、208-283
 */
'use client';

import * as React from 'react';
import { useRouter } from '@myorg/shared/util-i18n';
import {
  useApplyListQuery,
  useHasPendingMeltQuery,
  type ApplyListItem,
} from '@myorg/modules/td-admin/data-access';
import {
  ONBOARD_ROUTE,
  decideActiveTab,
  type OverviewTabKey,
} from './overview-shell-helpers';

/** 运营总览页主壳的 TD 选择联动。 */
export function useOverviewTdSelection() {
  const router = useRouter();

  // ── state（源 index.tsx 50+ state 的活集，死 state 不迁移）──
  // activeCode：选中 TD 的稳定标识（code/id 快照）。源用数组索引 activeKey，
  // 但 applyList refetch（mutation 后 invalidate）可能重排/收缩列表，索引会指向
  // 另一资产行 → 以 code 保身份，索引仅用于切换条高亮回推。
  const [activeCode, setActiveCode] = React.useState<string | null>(null);
  // active：4 Tab 选中 key（源 useState('1')）。
  const [active, setActive] = React.useState<OverviewTabKey>('1');

  // ── applyList 标题列表联动 ──
  // useApplyListQuery：mount 自动拉取，返回 ApplyListItem[]。
  const {
    data: applyList,
    isLoading: applyListLoading,
    isError: applyListError,
    refetch: refetchApplyList,
  } = useApplyListQuery();

  const hasData = !!applyList && applyList.length > 0;

  // 当前选中 TD（getUsablePrice 等价）：按 activeCode 匹配；未选/失配时回落首项。
  const currentTd: ApplyListItem | undefined = React.useMemo(() => {
    if (!applyList || applyList.length === 0) return undefined;
    if (activeCode != null) {
      const found = applyList.find(
        (item) => (item.code ?? item.id ?? '') === activeCode,
      );
      if (found) return found;
    }
    return applyList[0];
  }, [applyList, activeCode]);

  // 切换条高亮索引（由 currentTd 身份回推，refetch 重排后仍指向同一资产）。
  const activeIndex = applyList
    ? Math.max(
        0,
        applyList.findIndex((item) => item === currentTd),
      )
    : 0;

  // isShowMelt：Melt 按钮可用性（仅 stablecoin type===1 有意义）。
  // useHasPendingMeltQuery 内部 enabled 守卫 stablecoinCode 非空。
  const stablecoinCodeForMelt =
    currentTd?.type === 1 ? currentTd?.code : undefined;
  const { data: hasPendingMeltData } = useHasPendingMeltQuery(
    stablecoinCodeForMelt,
  );
  // 定版语义（parent）：pending=true → Melt 禁用；无数据 null → 启用。
  const showMelt = !hasPendingMeltData;

  // ── active Tab 决策（源 getTilteList 单 token 分支）──
  // 源仅在列表长度===1 且命中 state/applyStatus 组合时重定向 Tab（'4'/'2'），
  // 多 token 保持当前 Tab（含切换 TD / refetch 后）。首次数据到达决策一次。
  const didInitialTabDecide = React.useRef(false);
  React.useEffect(() => {
    if (!hasData || didInitialTabDecide.current) return;
    didInitialTabDecide.current = true;
    if (applyList.length === 1) {
      setActive(decideActiveTab(applyList[0]));
    }
  }, [hasData, applyList]);

  // ── 切换 TD（CustomTab onSelect 等价）：仅换资产身份，Tab 保持（源一致）──
  const handleSelectTd = React.useCallback(
    (index: number) => {
      const item = applyList?.[index];
      if (!item) return;
      setActiveCode(item.code ?? item.id ?? String(index));
    },
    [applyList],
  );

  // ── Onboard（CustomTab / Empty 按钮）──
  const handleOnboard = React.useCallback(() => {
    router.push(ONBOARD_ROUTE);
  }, [router]);

  return {
    applyList,
    applyListLoading,
    applyListError,
    refetchApplyList,
    hasData,
    currentTd,
    activeIndex,
    active,
    setActive,
    setActiveCode,
    showMelt,
    handleSelectTd,
    handleOnboard,
  };
}
