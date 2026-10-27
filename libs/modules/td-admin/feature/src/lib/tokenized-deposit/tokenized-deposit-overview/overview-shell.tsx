/**
 * OverviewShell — 运营总览页主壳组件。
 *
 * 迁移自 td-manage src/pages/tokenized-deposit/index.tsx 主组件（2666 行）的：
 * - 顶部 state 50+（activeKey/active/getUsablePrice/showMelt/modal×5 open state 等）
 * - CustomTab TD 切换（自建，源 libs/components/CustomTabs.tsx）
 * - 概览卡（OverviewInfoCard，td-14）
 * - 9 操作按钮（OverviewActionButtons，td-14）
 * - 4 Tab 容器占位（td-15/16/17 实现 content）
 * - 5 Modal 容器占位（td-18 实现）
 * - applyListApi 标题列表联动（mount + active/activeKey 变化 → useApplyListQuery）
 *
 * 本任务（td-14）只搭骨架 + 联动 + 占位，Tab content 与 Modal 内部逻辑由后续任务实现。
 *
 * ## applyList 联动时序（文档 8.18）
 *
 * 1. mount：useApplyListQuery 自动拉取 applyList。
 * 2. 数据回来后按 activeKey 取当前 TD（getUsablePrice），并按 state/applyStatus 决定 active Tab：
 *    - state===0 && applyStatus===5||15 → active '4'（待部署/审批中→合约 Tab）
 *    - state===0 && applyStatus===20 → active '2'（待部署→合约 Tab）
 *    - 否则 → active '1'（默认铸销记录 Tab）
 * 3. mintMethod===1/type===1 时拉 useHasPendingMeltQuery 决定 Melt 按钮可用性（showMelt）。
 * 4. 无数据（applyList 为空/undefined 且非 loading）→ 渲染 Empty 空页（含 Onboard 按钮）。
 *
 * ## Tab key 映射（源码 active '1'/'2'/'3'/'4'）
 *
 * '1' = records（铸销记录/SP/MMF Summary）
 * '2' = contracts（合约部署）
 * '3' = wallets（角色钱包 customTable2）
 * '4' = operation-records（操作记录）
 *
 * ## 死代码不迁移（文档 8.21）
 *
 * - customTable `to` 列注释
 * - customTable2 `Examine` action 注释（TD_PERMISSIONS.EXAMINE 权限码保留）
 * - Force Transfer 行
 * - GeneratemodalInfo/table2InitialValues/table2Form/walletAttribute/stepOneProgress 死 state
 * - actionClick 'Approval' 死分支
 *
 * i18n namespace: `modules.tokenized-deposit`。
 */
'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useRouter } from '@myorg/shared/util-i18n';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@myorg/shared/ui';
import {
  TD_STATE,
  useApplyListQuery,
  useContractDeployHistoryQuery,
  useDeleteTDMutation,
  useHasPendingMeltQuery,
  useReserveBalanceQuery,
  useUpdateTDStatusMutation,
  type ApplyListItem,
} from '@myorg/modules/td-admin/data-access';
import { OverviewInfoCard } from './overview-info-card';
import {
  OverviewActionButtons,
  type OverviewActionButtonKey,
} from './overview-action-buttons';
import {
  MintMeltModal,
  type MintMeltModalInfo,
  type MintMeltType,
} from './mint-melt-modal';
import { OverviewRecordsTab } from './tab-records';
import { OverviewContractsTab } from './tab-contracts';
import {
  OverviewWalletsTab,
  type AdminWalletModalActionContext,
} from './tab-wallets';
import { OverviewOperationRecordsTab } from './tab-operation-records';
import { DeployContractModal } from './deploy-contract-modal';
import { DeployHistoryModal } from './deploy-history-modal';
import {
  AdminWalletModal,
  type AdminWalletCtx,
} from './admin-wallet-modal';
import { OverviewGenerateWalletModal } from './generate-wallet-modal';
import { OverviewRigsecWalletModal } from './rigsec-wallet-modal';
// 辅助组件 / 工具 / 常量抽到独立文件，避免本文件 >800 行触发 nx lazy 误报。
import {
  TAB_DEFS,
  ONBOARD_ROUTE,
  EDIT_ROUTE,
  decideActiveTab,
  TdSwitcher,
  OverviewEmpty,
  formatBalance,
  type OverviewTabKey,
} from './overview-shell-helpers';


/**
 * 运营总览页主壳。
 *
 * 用法：
 * ```tsx
 * <OverviewShell />
 * ```
 *
 * 路由挂载由 module-registry（td-24）的 `list` pageKey → TokenizedDepositOverviewPage 完成。
 */
export function OverviewShell(): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');
  const router = useRouter();

  // ── state（源 index.tsx 50+ state 的活集，死 state 不迁移）──
  // activeCode：选中 TD 的稳定标识（code/id 快照）。源用数组索引 activeKey，
  // 但 applyList refetch（mutation 后 invalidate）可能重排/收缩列表，索引会指向
  // 另一资产行 → 以 code 保身份，索引仅用于切换条高亮回推。
  const [activeCode, setActiveCode] = React.useState<string | null>(null);
  // active：4 Tab 选中 key（源 useState('1')）。
  const [active, setActive] = React.useState<OverviewTabKey>('1');

  // ── 5 Modal open state 聚合（源分散 5 个 useState，这里集中）──
  // Mint/Melt（已接线，td-18）。
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  // MintMeltModal 上下文（源 modalInfo，getReservBalance 组装后写入）。
  const [mintMeltInfo, setMintMeltInfo] =
    React.useState<MintMeltModalInfo | null>(null);
  // Mint=1 / Melt=2（源 modalInfo.key）。
  const [mintMeltType, setMintMeltType] = React.useState<MintMeltType>(1);
  // Mint/Melt 点击时的资产快照（code/symbol/tokenTypeLabel）：余额请求与 Modal
  // 展示一律用快照，切换 TD/refetch 不会污染打开中的 Modal（防错资产提交）。
  const [mintMeltAsset, setMintMeltAsset] = React.useState<{
    code: string;
    symbol: string;
    tokenTypeLabel: string;
  } | null>(null);

  // ── DeployContractModal（源 isModalOpenDelopy）──
  // {taskCode, state} 点击时快照（源 1252-1256：首行三元 taskCode + data.state）。
  const [deployModal, setDeployModal] = React.useState<{
    taskCode: string;
    state?: number;
  } | null>(null);

  // ── DeployHistoryModal（源 isModalOpenHistory）──
  const [isModalOpenHistory, setIsModalOpenHistory] = React.useState(false);

  // ── AdminWalletModal（源 adminWalletModalOpen + adminWalletModalInfo 4 态）──
  const [adminWalletModalOpen, setAdminWalletModalOpen] = React.useState(false);
  const [adminWalletCtx, setAdminWalletCtx] =
    React.useState<AdminWalletCtx | null>(null);
  // 触发行原始数据（GenerateWallet/RigsecWallet 子 Modal 入参 chainType/blockchainCode/
  // tokenName/walletType 等从 row 衍生，AdminWalletCtx 类型不含这些字段）。
  const [adminWalletRow, setAdminWalletRow] =
    React.useState<AdminWalletModalActionContext['row'] | null>(null);
  // 生成钱包结果快照（keystore/walletAddress/password），回填 AdminWalletModal 表单
  // （源 generateForm onSuccess → formAdminWallet.setFieldsValue，td-18 回填增强）。
  const [generatedWallet, setGeneratedWallet] = React.useState<{
    keystore?: string;
    walletAddress?: string;
    password?: string;
  } | null>(null);

  // ── GenerateWalletModal / RigsecWalletModal（源 generateIsModalOpen + isRigsecModalOpen）──
  // 由 admin-wallet-modal 的「生成钱包」入口触发，按当前 adminWalletCtx.storageType 决定开哪个。
  const [generateIsModalOpen, setGenerateIsModalOpen] = React.useState(false);
  const [isRigsecModalOpen, setIsRigsecModalOpen] = React.useState(false);

  // ── Disable/Enable/Delete 二次确认（收口 td-14 gap，替代源 antd modal.confirm）──
  // code 在打开确认框时快照：对话框打开期间 applyList 可能 refetch，提交必须
  // 作用于确认时的目标，而非 refetch 后的 currentTd。
  const [statusConfirm, setStatusConfirm] = React.useState<{
    open: boolean;
    /** 目标 TD code 快照（提交 body.code）。 */
    code: string;
    /** 启用 1 / 禁用 0（源 enable: state===1 ? 0 : 1）。 */
    enable: number;
    /** title（Router_036 禁用 / Router_0003_6 启用）。 */
    title: string;
    /** content 文案（0044 禁用 / 0045 启用 / 0046 删除，已 replace name）。 */
    content: string;
    /** 提交后 toast 文案占位词（PUB_Submit / PUB_Delete）。 */
    toastWord: string;
  } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = React.useState<{
    open: boolean;
    /** 目标 TD code 快照。 */
    code: string;
    content: string;
  } | null>(null);

  // ── 写操作 mutations（Disable/Enable/Delete）──
  const { mutateAsync: updateStatusAsync, isPending: statusPending } =
    useUpdateTDStatusMutation();
  const { mutateAsync: deleteAsync, isPending: deletePending } =
    useDeleteTDMutation();

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

  // ── Mint/Melt 储备余额（点 Mint/Melt 按钮时按需拉，组装 modalInfo）──
  // mintMeltAsset 非空时启用 useReserveBalanceQuery（code-only body）。
  // 源 getReservBalance(code, el)：拉余额 → setModalInfo → setIsModalOpen(true)。
  const reserveParams = React.useMemo(() => {
    if (!mintMeltAsset?.code) return undefined;
    return { stablecoinCode: mintMeltAsset.code };
  }, [mintMeltAsset?.code]);
  const { data: reserveBalance } = useReserveBalanceQuery(reserveParams);

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

  // ── 9 按钮分发（OverviewActionButtons onAction）──
  const handleAction = React.useCallback(
    (key: OverviewActionButtonKey) => {
      switch (key) {
        case 'Mint':
        case 'Melt': {
          // 触发 useReserveBalanceQuery（按需拉余额，effect 内组装 modalInfo 开 Modal）。
          // 资产三元组在点击时快照：余额请求与 Modal 展示均用快照，防切换 TD/refetch
          // 后错资产提交（源在点击闭包内捕获 getUsablePrice，等价）。
          const type: MintMeltType = key === 'Mint' ? 1 : 2;
          const code = currentTd?.code ?? '';
          setMintMeltType(type);
          setMintMeltAsset({
            code,
            symbol: currentTd?.symbol ?? '',
            tokenTypeLabel:
              currentTd?.mintMethod == null
                ? ''
                : t(`token_type_${currentTd.mintMethod}`),
          });
          break;
        }
        case 'Contracts':
          setActive('2');
          break;
        case 'Edit':
          router.push(`${EDIT_ROUTE}?code=${currentTd?.code ?? ''}`);
          break;
        case 'Transactions':
          router.push(
            `/transaction-flow?stablecoinId=${currentTd?.stablecoinId ?? ''}`,
          );
          break;
        case 'Wallets':
          router.push(
            `/wallet/user-wallet?stablecoinId=${
              currentTd?.stablecoinId ?? ''
            }`,
          );
          break;
        case 'Disable':
        case 'Enable': {
          // 源 confirm：title=state===1?Router_036:Router_0003_6，
          // content=state===1?0044:0045（replace name），enable=state===1?0:1。
          // code 快照：提交作用于确认时的目标 TD。
          const isEnabled = currentTd?.state === TD_STATE.ENABLED;
          const name = currentTd?.name ?? '';
          setStatusConfirm({
            open: true,
            code: currentTd?.code ?? '',
            enable: isEnabled ? 0 : 1,
            title: isEnabled ? t('Router_036') : t('Router_0003_6'),
            content: (isEnabled
              ? t('tokenized_deposit_0044')
              : t('tokenized_deposit_0045')
            ).replace('****', name),
            toastWord: t('PUB_Submit'),
          });
          break;
        }
        case 'Delete': {
          // 源 confirm：title=PUB_Delete，content=0046（replace name）。
          const name = currentTd?.name ?? '';
          setDeleteConfirm({
            open: true,
            code: currentTd?.code ?? '',
            content: t('tokenized_deposit_0046').replace('****', name),
          });
          break;
        }
        default:
          break;
      }
    },
    [router, currentTd, t],
  );

  // ── Mint/Melt modalInfo 组装（reserveBalance 回来后，源 getReservBalance 1713-1734）──
  // 余额响应对应 mintMeltAsset.code 快照；symbol 优先取快照（点击行），响应兜底。
  React.useEffect(() => {
    if (!mintMeltAsset?.code || !reserveBalance) return;
    const {
      reserveBalance: rb,
      currencySymbol,
      availableBalance,
      symbol,
      surplusCount,
    } = reserveBalance;
    const isMint = mintMeltType === 1;
    const limit = isMint ? Number(availableBalance) : Number(surplusCount);
    const balanceStr = isMint
      ? `${formatBalance(availableBalance)} ${symbol ?? ''}`
      : `${formatBalance(surplusCount)} ${symbol ?? ''}`;
    setMintMeltInfo({
      title: t(isMint ? 'Router_0003_2' : 'Router_0003_3'),
      availableBalance: limit,
      reserveBalance: `${t('tokenized_deposit_0072')}: ${formatBalance(rb)} ${
        currencySymbol ?? ''
      }`,
      tips: (isMint
        ? t('tokenized_deposit_0073')
        : t('tokenized_deposit_0074')
      ).replace('****', balanceStr),
    });
    setIsModalOpen(true);
  }, [mintMeltAsset, reserveBalance, mintMeltType, t]);

  // Mint/Melt Modal 关闭：清快照 + 上下文（下次点击重新组装）。
  const handleMintMeltClose = React.useCallback(() => {
    setIsModalOpen(false);
    setMintMeltInfo(null);
    setMintMeltAsset(null);
  }, []);


  // ── DeployHistoryModal 数据（源 smartHistory = getContractHistoryApi data[0]）──
  const { data: deployHistory } = useContractDeployHistoryQuery(
    currentTd?.code,
    isModalOpenHistory,
  );

  // ── Tab 回调：tab-contracts 打开部署/升级 Modal ──
  // 源 1252/1279：taskCode=首行三元(upgraded===1?upgradeTaskCode:taskCode)，
  // state=触发行合约包 state（Modal 标题用）。均在此快照，Modal 内部自行拉步骤详情。
  const handleOpenDeployModal = React.useCallback(
    (payload: { taskCode: string; state?: number }) => {
      if (!payload.taskCode) return;
      setDeployModal(payload);
    },
    [],
  );

  const handleDeployModalClose = React.useCallback(() => {
    setDeployModal(null);
  }, []);

  // ── Tab 回调：tab-contracts 打开部署历史 Modal ──
  const handleOpenDeployHistoryModal = React.useCallback(() => {
    setIsModalOpenHistory(true);
  }, []);

  // ── Tab 回调：tab-wallets 打开管理员钱包 Modal ──
  // 源 actionClick 按分支组装 adminWalletModalInfo（id/title/type/walletType/walletAddress/
  // chainType/storageType/blockchainCode/tokenName/confirmType）。WalletItem 行含这些字段，
  // 这里从 row 组装 AdminWalletCtx（modal props 类型）。chainType 等子 Modal 入参由
  // adminWalletCtx 衍生（modal 自身不消费 chainType，仅 generate/rigsec 子 Modal 需要）。
  const handleOpenAdminWalletModal = React.useCallback(
    ({ action, row }: AdminWalletModalActionContext) => {
      const t0 = t;
      // 源 4 态 title/type 映射：Update/Details/History（Approval 走死代码 Examine，不上报）。
      const type: AdminWalletCtx['type'] =
        action === 'Update' ? 'Update' : action;
      const walletTypeText =
        row.type == null ? '' : t0(`admin_wallet_type_${row.type}`);
      const title =
        action === 'Update'
          ? t0('tokenized_deposit_0076').replace(
              '{type}',
              t0('tokenized_deposit_0122'),
            )
          : action === 'History'
            ? t0('tokenized_deposit_0077')
            : `${t0('tokenized_deposit_0145')} ${t0('PUB_Detail')}`;
      // id：Update 用 accountId（源 data.accountId），Details/History 用 stablecoinId（源 data.stablecoinId）。
      const id =
        action === 'Update'
          ? (row.accountId ?? '')
          : (row.stablecoinId ?? '');
      const ctx: AdminWalletCtx = {
        type,
        title,
        id,
        walletType: walletTypeText,
        accountType: row.type,
        stablecoinId: row.stablecoinId,
        walletAddress: row.walletAddress,
        storageType: row.storageType,
      };
      setAdminWalletCtx(ctx);
      setAdminWalletRow(row);
      setAdminWalletModalOpen(true);
    },
    [t],
  );

  // ── AdminWalletModal 「生成钱包」入口 → 按 storageType 开子 Modal（源 onGenerateWallet）──
  // keystore 路径 → GenerateWalletModal；rigsec/fireblocks → RigsecWalletModal。
  const handleGenerateWallet = React.useCallback(() => {
    const isKeystore = adminWalletCtx?.storageType === 'key_keystore';
    if (isKeystore) {
      setGenerateIsModalOpen(true);
    } else {
      setIsRigsecModalOpen(true);
    }
  }, [adminWalletCtx?.storageType]);

  // 子生成 Modal 结果消费完成（AdminWalletModal 回填后清快照）。
  const consumeGeneratedWallet = React.useCallback(() => {
    setGeneratedWallet(null);
  }, []);


  // ── Disable/Enable 提交（源 statusUpdateApi onOk 1937-1957）──
  // code 用确认框打开时的快照，不取 currentTd（refetch 后可能已换资产）。
  const handleStatusConfirm = React.useCallback(() => {
    const ctx = statusConfirm;
    if (!ctx?.code) return;
    setStatusConfirm((prev) => (prev ? { ...prev, open: false } : prev));
    void updateStatusAsync({ code: ctx.code, enable: ctx.enable })
      .then(() => {
        toast.success(t('PUB_Success').replace('****', ctx.toastWord));
      })
      .catch(() => {
        toast.error(t('td_toast_submit_failed'));
      });
  }, [statusConfirm, updateStatusAsync, t]);
  const handleStatusCancel = React.useCallback(() => {
    setStatusConfirm(null);
  }, []);

  // ── Delete 提交（源 deleteApi onOk 1969-1985）──
  const handleDeleteConfirm = React.useCallback(() => {
    const ctx = deleteConfirm;
    if (!ctx?.code) return;
    setDeleteConfirm(null);
    void deleteAsync({ code: ctx.code })
      .then(() => {
        toast.success(t('PUB_Success').replace('****', t('PUB_Delete')));
        // 源 setActiveKey(0) + getTilteList(0)：切回首项。
        setActiveCode(null);
      })
      .catch(() => {
        toast.error(t('td_toast_submit_failed'));
      });
  }, [deleteConfirm, deleteAsync, t]);
  const handleDeleteCancel = React.useCallback(() => {
    setDeleteConfirm(null);
  }, []);

  // ── 渲染 ──
  // loading 态：applyList 拉取中（避免空数据误判为 Empty）；骨架块，不写死文案。
  if (applyListLoading && !hasData) {
    return (
      <div className="w-full space-y-4">
        <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
        <div className="h-32 w-full animate-pulse rounded-lg bg-muted" />
        <div className="h-12 w-2/3 animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  // 错误态：拉取失败且无数据（react-query 有旧数据时保留旧数据继续展示）。
  if (applyListError && !hasData) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <p className="text-sm text-muted-foreground">
          {t('td_query_load_failed')}
        </p>
        <button
          type="button"
          className="rounded-md border px-4 py-1.5 text-sm hover:bg-accent"
          onClick={() => void refetchApplyList()}
        >
          {t('td_retry')}
        </button>
      </div>
    );
  }

  // 空页：无数据 → Empty（含 Onboard 按钮）。
  if (!hasData) {
    return <OverviewEmpty onOnboard={handleOnboard} />;
  }

  return (
    <div className="w-full">
      {/* TD 切换条（自建 CustomTab 等价） */}
      <TdSwitcher
        tdList={applyList ?? []}
        activeKey={activeIndex}
        onSelect={handleSelectTd}
        onOnboard={handleOnboard}
      />

      {/* 顶部概览卡 */}
      <OverviewInfoCard td={currentTd} />

      {/* 9 操作按钮 */}
      <OverviewActionButtons
        td={currentTd}
        showMelt={showMelt}
        onAction={handleAction}
      />

      {/* 4 Tab 容器（content 由 td-15/16/17 实现，本任务占位） */}
      <Tabs value={active} onValueChange={(v) => setActive(v as OverviewTabKey)}>
        <TabsList>
          {TAB_DEFS.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key}>
              {t(tab.labelKey)}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Tab1：铸销记录 / SP / MMF Summary（td-15） */}
        <TabsContent value="1">
          {currentTd ? (
            <OverviewRecordsTab key={currentTd.code} td={currentTd} />
          ) : null}
        </TabsContent>

        {/* Tab2：合约部署（td-16） */}
        <TabsContent value="2">
          {currentTd ? (
            <OverviewContractsTab
              key={currentTd.code}
              td={currentTd}
              onOpenDeployModal={handleOpenDeployModal}
              onOpenDeployHistoryModal={handleOpenDeployHistoryModal}
            />
          ) : null}
        </TabsContent>

        {/* Tab3：角色钱包 customTable2（td-17） */}
        <TabsContent value="3">
          {currentTd ? (
            <OverviewWalletsTab
              key={currentTd.code}
              td={currentTd}
              onOpenAdminWalletModal={handleOpenAdminWalletModal}
            />
          ) : null}
        </TabsContent>

        {/* Tab4：操作记录（td-17） */}
        <TabsContent value="4">
          {currentTd ? (
            <OverviewOperationRecordsTab
              key={currentTd.code}
              td={currentTd}
            />
          ) : null}
        </TabsContent>
      </Tabs>

      {/* 5 Modal 容器（td-18）：MintMeltModal 已接线，其余 4 Modal 占位 */}
      <MintMeltModal
        open={isModalOpen}
        modalInfo={
          mintMeltInfo ?? {
            title: '',
            availableBalance: 0,
            reserveBalance: '',
            tips: '',
          }
        }
        type={mintMeltType}
        // 点击时快照（mintMeltAsset），非实时 currentTd：Modal 打开期间切换 TD/refetch
        // 不影响展示与提交 body（防错资产铸销）。
        stablecoinCode={mintMeltAsset?.code ?? ''}
        stablecoinCodeLabel={mintMeltAsset?.symbol ?? ''}
        tokenTypeLabel={mintMeltAsset?.tokenTypeLabel ?? ''}
        onCancel={handleMintMeltClose}
      />

      {/* DeployContractModal（部署/升级，步骤进度）—— taskCode/state 为点击时快照，
          tdType 取当前资产（Modal 仅在 Tab2 内打开，切换 TD 时 Modal 阻塞 UI 无风险）；
          步骤详情由 Modal 内部 useDeployStepDetailQuery(taskCode) 拉取（源 getDeployInfo）。 */}
      <DeployContractModal
        open={deployModal != null}
        taskCode={deployModal?.taskCode ?? ''}
        tdType={currentTd?.type}
        contractState={deployModal?.state}
        onCancel={handleDeployModalClose}
      />

      {/* DeployHistoryModal（部署历史，useContractDeployHistoryQuery 取 data[0]） */}
      <DeployHistoryModal
        open={isModalOpenHistory}
        history={deployHistory ?? undefined}
        onCancel={() => setIsModalOpenHistory(false)}
      />

      {/* AdminWalletModal（4 态），onGenerateWallet 按 storageType 开子 Modal */}
      <AdminWalletModal
        open={adminWalletModalOpen}
        ctx={
          adminWalletCtx ?? {
            type: 'Details',
            title: '',
            id: '',
            walletType: '',
          }
        }
        onCancel={() => {
          setAdminWalletModalOpen(false);
          setGeneratedWallet(null);
        }}
        onGenerateWallet={handleGenerateWallet}
        generatedWallet={generatedWallet}
        onGeneratedConsumed={consumeGeneratedWallet}
      />

      {/* GenerateWalletModal（keystore 路径）—— chainType 来自触发行 virtualMachineCode（源 chainType: data.virtualMachineCode） */}
      <OverviewGenerateWalletModal
        open={generateIsModalOpen}
        chainType={adminWalletRow?.virtualMachineCode ?? ''}
        walletType={adminWalletRow?.type}
        roleName={adminWalletRow?.type}
        blockchainCode={adminWalletRow?.blockchainCode ?? ''}
        tokenName={adminWalletRow?.tdName}
        onCancel={() => setGenerateIsModalOpen(false)}
        onGenerated={setGeneratedWallet}
      />

      {/* RigsecWalletModal（rigsec/fireblocks 路径）—— 入参从触发行衍生 */}
      <OverviewRigsecWalletModal
        open={isRigsecModalOpen}
        chainType={adminWalletRow?.virtualMachineCode ?? ''}
        storageType={adminWalletRow?.storageType ?? 'key_rigsec'}
        roleName={String(adminWalletRow?.type ?? '')}
        walletType={adminWalletRow?.type}
        blockchainCode={adminWalletRow?.blockchainCode ?? ''}
        tokenName={adminWalletRow?.tdName ?? ''}
        onCancel={() => setIsRigsecModalOpen(false)}
        onGenerated={({ walletAddress }) => setGeneratedWallet({ walletAddress })}
      />

      {/* Disable/Enable 二次确认（收口 td-14 gap，替代源 antd modal.confirm） */}
      <AlertDialog
        open={statusConfirm?.open ?? false}
        onOpenChange={(next) => {
          if (!next) handleStatusCancel();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{statusConfirm?.title ?? ''}</AlertDialogTitle>
            <AlertDialogDescription>
              {statusConfirm?.content ?? ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleStatusCancel}>
              {t('PUB_Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={statusPending}
              onClick={handleStatusConfirm}
            >
              {t('PUB_Confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete 二次确认（源 deleteApi + setActiveKey(0)） */}
      <AlertDialog
        open={deleteConfirm?.open ?? false}
        onOpenChange={(next) => {
          if (!next) handleDeleteCancel();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('PUB_Delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm?.content ?? ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCancel}>
              {t('PUB_Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deletePending}
              onClick={handleDeleteConfirm}
            >
              {t('PUB_Confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
