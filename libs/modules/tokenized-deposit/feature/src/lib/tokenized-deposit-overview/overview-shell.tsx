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
} from '@myorg/modules/tokenized-deposit/util';
import {
  useApplyListQuery,
  useContractDeployHistoryQuery,
  useDeleteTDMutation,
  useDeployStepDetailQuery,
  useHasPendingMeltQuery,
  useReserveBalanceQuery,
  useUpdateTDStatusMutation,
  type ApplyListItem,
} from '@myorg/modules/tokenized-deposit/data-access';
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

export interface OverviewShellProps {
  /** 可选初始 activeKey（默认 0）。 */
  initialActiveKey?: number;
}

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
export function OverviewShell({
  initialActiveKey = 0,
}: OverviewShellProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');
  const router = useRouter();

  // ── state（源 index.tsx 50+ state 的活集，死 state 不迁移）──
  // activeKey：TD 切换条选中索引（源 useState(0)）。
  const [activeKey, setActiveKey] = React.useState<number>(initialActiveKey);
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

  // ── DeployContractModal（源 isModalOpenDelopy + deployInfo）──
  // taskCode 来自 tab-contracts 的 onOpenDeployModal（部署/升级分支透传首行 taskCode）。
  const [isModalOpenDelopy, setIsModalOpenDelopy] = React.useState(false);
  const [deployTaskCode, setDeployTaskCode] = React.useState<string>('');

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

  // ── GenerateWalletModal / RigsecWalletModal（源 generateIsModalOpen + isRigsecModalOpen）──
  // 由 admin-wallet-modal 的「生成钱包」入口触发，按当前 adminWalletCtx.storageType 决定开哪个。
  const [generateIsModalOpen, setGenerateIsModalOpen] = React.useState(false);
  const [isRigsecModalOpen, setIsRigsecModalOpen] = React.useState(false);

  // ── Disable/Enable/Delete 二次确认（收口 td-14 gap，替代源 antd modal.confirm）──
  const [statusConfirm, setStatusConfirm] = React.useState<{
    open: boolean;
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
  } = useApplyListQuery();

  const hasData = !!applyList && applyList.length > 0;

  // 当前选中 TD（getUsablePrice 等价，源 setGetUsablePrice(res.data.data[activeKey])）。
  const currentTd: ApplyListItem | undefined = applyList?.[activeKey];

  // isShowMelt：Melt 按钮可用性（源 showMelt，仅 stablecoin type===1 有意义）。
  // useHasPendingMeltQuery 内部 enabled 守卫 stablecoinCode 非空。
  const stablecoinCodeForMelt =
    currentTd?.type === 1 ? currentTd?.code : undefined;
  const { data: hasPendingMeltData } = useHasPendingMeltQuery(
    stablecoinCodeForMelt,
  );
  // 源 isShowMeltApi 返回 data（true 表示可销毁）。无数据时默认 true（不影响首次）。
  const showMelt = hasPendingMeltData == null ? true : hasPendingMeltData;

  // ── Mint/Melt 储备余额（点 Mint/Melt 按钮时按需拉，组装 modalInfo）──
  // pendingMintMeltKey 形如 `${code}|${type}`，非空时启用 useReserveBalanceQuery。
  // 源 getReservBalance(code, el)：拉余额 → setModalInfo → setIsModalOpen(true)。
  const [pendingMintMeltKey, setPendingMintMeltKey] = React.useState<
    string | null
  >(null);
  const reserveParams = React.useMemo(() => {
    if (!pendingMintMeltKey) return undefined;
    return { stablecoinCode: currentTd?.code ?? '', symbol: '' };
  }, [pendingMintMeltKey, currentTd?.code]);
  const { data: reserveBalance } = useReserveBalanceQuery(reserveParams);

  // ── active Tab 决策（数据回来/activeKey 变化时）──
  React.useEffect(() => {
    if (!hasData) return;
    setActive(decideActiveTab(currentTd));
  }, [hasData, currentTd]);

  // ── 切换 TD（CustomTab onSelect 等价）──
  const handleSelectTd = React.useCallback((index: number) => {
    setActiveKey(index);
  }, []);

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
          const type: MintMeltType = key === 'Mint' ? 1 : 2;
          setMintMeltType(type);
          setPendingMintMeltKey(`${currentTd?.code ?? ''}|${type}`);
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
            `/transaction-flow/stablecoin?stablecoinId=${
              currentTd?.stablecoinId ?? ''
            }`,
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
          const isEnabled = currentTd?.state === TD_STATE.ENABLED;
          const name = currentTd?.name ?? '';
          setStatusConfirm({
            open: true,
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
  React.useEffect(() => {
    if (!pendingMintMeltKey || !reserveBalance) return;
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
    setPendingMintMeltKey(null);
  }, [pendingMintMeltKey, reserveBalance, mintMeltType, t]);

  // ── DeployContractModal 数据（源 getDeployInfo 取 data[0]）──
  // 打开部署 Modal 时按 taskCode 拉步骤详情，响应含 tdName/blockchainName/packageName/
  // contractVersion/deployState/deployType/stepDetailList（model.ts DeployStepDetail 字段不全，
  // 这里按实际响应断言读取，避免改 model——surgical scope）。
  const { data: deployStepDetail } = useDeployStepDetailQuery(
    isModalOpenDelopy && deployTaskCode
      ? { taskCode: deployTaskCode }
      : undefined,
  );
  // 实际响应含 tdName 等，断言为带额外字段的形状。
  const deployInfoPayload = deployStepDetail
    ? (deployStepDetail as unknown as {
        tdName?: string;
        blockchainName?: string;
        packageName?: string;
        contractVersion?: string;
        deployState?: number;
        deployType?: number;
        upgradeTaskCode?: string;
      })
    : undefined;

  // ── DeployHistoryModal 数据（源 smartHistory = getContractHistoryApi data[0]）──
  const { data: deployHistory } = useContractDeployHistoryQuery(
    currentTd?.code,
    isModalOpenHistory,
  );

  // ── Tab 回调：tab-contracts 打开部署/升级 Modal ──
  // 源 1252/1279：onOpenDeployModal(首行 upgradeTaskCode 或 taskCode)。
  const handleOpenDeployModal = React.useCallback((taskCode: string) => {
    if (!taskCode) return;
    setDeployTaskCode(taskCode);
    setIsModalOpenDelopy(true);
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


  // ── Disable/Enable 提交（源 statusUpdateApi onOk 1937-1957）──
  const handleStatusConfirm = React.useCallback(() => {
    const ctx = statusConfirm;
    if (!ctx || !currentTd?.code) return;
    setStatusConfirm((prev) => (prev ? { ...prev, open: false } : prev));
    void updateStatusAsync({ code: currentTd.code, enable: ctx.enable }).then(
      () => {
        toast.success(t('PUB_Success').replace('****', ctx.toastWord));
      },
    );
  }, [statusConfirm, currentTd?.code, updateStatusAsync, t]);
  const handleStatusCancel = React.useCallback(() => {
    setStatusConfirm(null);
  }, []);

  // ── Delete 提交（源 deleteApi onOk 1969-1985）──
  const handleDeleteConfirm = React.useCallback(() => {
    if (!currentTd?.code) return;
    setDeleteConfirm(null);
    void deleteAsync({ code: currentTd.code }).then(() => {
      toast.success(t('PUB_Success').replace('****', t('PUB_Delete')));
      // 源 setActiveKey(0) + getTilteList(0)：切回首项（applyList invalidate 后刷新）。
      setActiveKey(0);
    });
  }, [currentTd?.code, deleteAsync, t]);
  const handleDeleteCancel = React.useCallback(() => {
    setDeleteConfirm(null);
  }, []);

  // ── 渲染 ──
  // loading 态：applyList 拉取中（避免空数据误判为 Empty）。
  if (applyListLoading && !hasData) {
    return (
      <div className="flex h-64 animate-pulse items-center justify-center text-sm text-muted-foreground">
        Loading...
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
        activeKey={activeKey}
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
          {currentTd ? <OverviewRecordsTab td={currentTd} /> : null}
        </TabsContent>

        {/* Tab2：合约部署（td-16） */}
        <TabsContent value="2">
          {currentTd ? (
            <OverviewContractsTab
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
              td={currentTd}
              onOpenAdminWalletModal={handleOpenAdminWalletModal}
            />
          ) : null}
        </TabsContent>

        {/* Tab4：操作记录（td-17） */}
        <TabsContent value="4">
          {currentTd ? (
            <OverviewOperationRecordsTab td={currentTd} />
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
        stablecoinCode={currentTd?.code ?? ''}
        stablecoinCodeLabel={currentTd?.symbol ?? ''}
        tokenTypeLabel={
          currentTd?.mintMethod == null
            ? ''
            : t(`token_type_${currentTd.mintMethod}`)
        }
        onCancel={() => setIsModalOpen(false)}
      />

      {/* DeployContractModal（部署/升级，步骤进度）—— deployInfo 从 useDeployStepDetailQuery
          取 data[0]（含 tdName/blockchainName/packageName/contractVersion/deployState/deployType/
          upgradeTaskCode），modal 内部另调同 key query 取 stepDetailList（命中缓存无额外请求）。 */}
      <DeployContractModal
        open={isModalOpenDelopy}
        taskCode={deployTaskCode}
        deployType={deployInfoPayload?.deployType ?? 0}
        deployInfo={{
          tdName: deployInfoPayload?.tdName,
          blockchainName: deployInfoPayload?.blockchainName,
          packageName: deployInfoPayload?.packageName,
          contractVersion: deployInfoPayload?.contractVersion,
        }}
        deployState={deployInfoPayload?.deployState}
        upgradeTaskCode={deployInfoPayload?.upgradeTaskCode}
        onCancel={() => setIsModalOpenDelopy(false)}
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
        onCancel={() => setAdminWalletModalOpen(false)}
        onGenerateWallet={handleGenerateWallet}
      />

      {/* GenerateWalletModal（keystore 路径）—— chainType 来自触发行 virtualMachineCode（源 chainType: data.virtualMachineCode） */}
      <OverviewGenerateWalletModal
        open={generateIsModalOpen}
        chainType={adminWalletRow?.virtualMachineCode ?? ''}
        onCancel={() => setGenerateIsModalOpen(false)}
        onGenerated={() => {
          /* 源 setFieldsValue 回填 adminWallet 表单；admin-wallet-modal 内部 form 受控，
             跨组件回填需 form ref 透传——本任务接线先关闭子 Modal，回填属增强项。 */
          setGenerateIsModalOpen(false);
        }}
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
        onGenerated={() => {
          setIsRigsecModalOpen(false);
        }}
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
