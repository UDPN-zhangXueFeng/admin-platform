/**
 * TokenizedDepositViewPage — 单币种详情运营页（view.tsx 717 行迁移）。
 *
 * 迁移自 td-manage `src/pages/tokenized-deposit/view.tsx`（组件名源 `STABLECOINView`，
 * 拷贝 stablecoin 模块痕迹 → 重命名 `TDView`，见第 8.20 章「拷贝痕迹清理」）。
 *
 * ## 路由 / 币种判定
 *
 * 被 manifest 注册为 detail page（路由 `/tokenized-deposit/view`，slug[0]='view' → detail）。
 * 读 `?current=0|1` 定币种：`'0'` → HSBCoin，`'1'` → CBCoin（源 query.current）。
 * 币种标识回填进 Mint/Melt Modal 的 disabled 名称输入框。
 *
 * ## 3 Tab（对齐源 getItem 三项）
 *
 * 1. **Tab1 铸销记录**（tokenized_deposit_0014「Minting & Melting」）：
 *    useStablecoinRecordQuery + UI 筛选表单（txHash/type/createTime 范围/state/reviewerTime 范围）。
 *    列：txHash / type / name / stablecoinCount(+symbol) / createUserName /
 *        createTime / reviewerUserName / reviewerTime / state。
 *    标题区 Mint / Melt 按钮（权限 VIEW_MINT_MELT_TITLE）→ 打开 MintMeltModal。
 * 2. **Tab2 合约部署**（Router_047「合约管理」）：**保留 mock 表**（源全 mock，无后端）。
 *    3 行合约 + Update / Details 行操作 → 两个 Dialog。
 * 3. **Tab3 角色钱包**（role_wallets）：嵌入 `<RoleWallets />`（td-22）。
 *
 * ## Mint / Melt Modal（修复源 actionClick Melt 分支 bug）
 *
 * 源 view.tsx 第 237-251 行 `actionClick` 的 `case 'Melt'` 分支误设 `modalInfo` 为
 * **Issuance / Router_018 / manage_013 / manage_014**（即铸造文案），与按钮 onClick
 * 第 191-213 行正确设 Destruction 的逻辑冲突。源 actions 返回 `[]`（表无行操作），
 * 故 actionClick 死路径不触发——但 bug 仍在。本页**不复制 actionClick**，仅保留
 * 标题按钮两条分支（均文案正确）：Mint→Issuance，Melt→Destruction。
 *
 * Melt tips 文案 `manage_016`（"资金池钱包余额：****"）的 `****` 占位 → surplusCount
 * （useStablecoinInfoQuery，可销毁余额）。
 *
 * ## 提交后刷新
 *
 * 源 onFinish 注释 `// customTable1.ref.current?.mutate();`（提交后不刷新记录表）。
 * 新架构 mutations（useIssueStablecoinMutation / useRemoveStablecoinMutation）的
 * onSuccess 已 `invalidateQueries({ queryKey: tdKeys.view() })`，含 stablecoin-record-list
 * + stablecoin-info —— **提交后自动刷新**，无需本页补 invalidate。
 *
 * ## 已知数据契约 gap（归因 td-6，本页不修）
 *
 * - `getStablecoinRecordList` 仅透传 `txHash` 一个筛选字段（type/state/createTime/reviewerTime
 *   组合字段未透传）。本页保留 UI 筛选表单（忠于源交互），筛选值塞进
 *   `StablecoinRecordListParams`（BaseListParams 含 index signature）；后端是否消费未知。
 * - 行类型复用 `TDRecordItem`（字段 recordType/amount/createUser/transactionHash/status），
 *   与源 view 列字段（type/name/stablecoinCount/createUserName/reviewerUserName/reviewerTime/state）
 *   不一致。本页定义 `ViewRecordRow`（index signature 兜底）按源字段名读取，渲染安全降级 '--'。
 *
 * i18n namespace: `modules.tokenized-deposit`。
 */
'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import {
  Button,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@myorg/shared/ui';
import {
  FormDatePicker,
  FormSelect,
} from '@myorg/shared/ui-forms';
import { PermissionGuard } from '@myorg/shared/util-auth';
import { formatDate } from '@myorg/shared/util-dates';
import {
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
  REVIEW_SUBMIT_STATE_KEY_PREFIX,
  TD_PERMISSIONS,
} from '@myorg/modules/tokenized-deposit/util';
import {
  useIssueStablecoinMutation,
  useRemoveStablecoinMutation,
  useStablecoinInfoQuery,
  useStablecoinListQuery,
  useStablecoinRecordQuery,
  type StablecoinRecordListParams,
  type TDRecordItem,
} from '@myorg/modules/tokenized-deposit/data-access';

import { RoleWallets } from './role-wallets';

// ─────────────────────────────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────────────────────────────

/** 时间戳格式（对齐源 formatTimestamp → 'YYYY-MM-DD HH:mm:ss'）。 */
const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';

/** Mint 数量上限（对齐源 InputNumber max 999999999999）。 */
const MINT_MAX = 999999999999;

/** 金额校验正则：整数或最多 6 位小数（对齐源 /^[0-9]+(.[0-9]{1,6})?$/）。 */
const DECIMAL_6_RE = /^[0-9]+(\.[0-9]{1,6})?$/;

/**
 * 审批提交状态文案 key 映射（对齐源 settingsStatus）。
 *
 * 源用 Record<number,string> 显式列出 1/2/4/5/6/7（跳过 3），value 为 i18n key。
 * 这里保留同集合（review_submit_state_ 前缀）。
 */
const REVIEW_SUBMIT_STATES = [1, 2, 4, 5, 6, 7] as const;

/**
 * Mint / Melt 操作类型（modalInfo.key，源用 Issuance / Destruction 区分分支）。
 *
 * - `Issuance` → 调 useIssueStablecoinMutation（铸造）。
 * - `Destruction` → 调 useRemoveStablecoinMutation（销毁）。
 */
type MintMeltMode = 'Issuance' | 'Destruction';

// ─────────────────────────────────────────────────────────────────────
// 本地行类型（字段契约 gap 兜底，见文件头注释）
// ─────────────────────────────────────────────────────────────────────

/**
 * View 铸销记录行类型（源 view 表列字段）。
 *
 * `getStablecoinRecordList` 复用 `TDRecordItem`（字段名不匹配源列），这里以 index
 * signature 兜底按源字段名（type/name/stablecoinCount/createUserName/reviewerUserName/
 * reviewerTime/state）安全读取，渲染时统一 `|| EMPTY_DISPLAY` 降级。
 */
type ViewRecordRow = TDRecordItem & {
  [key: string]: unknown;
};

/** 稳定币列表项（useStablecoinListQuery 返回 unknown[]，按业务断言取 [0]）。 */
interface StablecoinListItem {
  stablecoinId?: number | string;
  name?: string;
  symbol?: string;
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────
// Mint / Melt Modal 表单值
// ─────────────────────────────────────────────────────────────────────

interface MintMeltFormValues {
  /** 数量（源 stablecoinCount，InputNumber）。 */
  stablecoinCount: string;
}

// ═════════════════════════════════════════════════════════════════════
// 主组件
// ═════════════════════════════════════════════════════════════════════

/**
 * TokenizedDepositViewPage — 单币种详情运营页。
 *
 * 用法：被 module-registry detail page 懒加载。
 * ```tsx
 * <TokenizedDepositViewPage />
 * ```
 */
export function TokenizedDepositViewPage(): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');
  const searchParams = useSearchParams();
  const current = searchParams.get('current') ?? '0';
  // '0' → HSBCoin，'1' → CBCoin（源 query.current === '0' ? 'HSBCoin' : 'CBCoin'）。
  const coinName = current === '0' ? 'HSBCoin' : 'CBCoin';

  // ── 稳定币列表（取 [0]，提交 Mint/Melt 时用 stablecoinId/name/symbol）──
  const stablecoinListQuery = useStablecoinListQuery();
  const stablecoinList = (stablecoinListQuery.data ?? []) as StablecoinListItem[];
  const currentStablecoin = stablecoinList[0];
  const stablecoinId = currentStablecoin?.stablecoinId;

  // ── 稳定币信息（surplusCount 可销毁余额）──
  const stablecoinInfoQuery = useStablecoinInfoQuery(stablecoinId);
  const surplusCount = stablecoinInfoQuery.data?.surplusCount;

  // ── Mint / Melt Modal 状态 ──
  const [mintMeltOpen, setMintMeltOpen] = React.useState(false);
  const [mintMeltMode, setMintMeltMode] = React.useState<MintMeltMode>('Issuance');

  const openMintMelt = React.useCallback((mode: MintMeltMode) => {
    setMintMeltMode(mode);
    setMintMeltOpen(true);
  }, []);

  return (
    <div className="space-y-4">
      {/* 当前币种标识（源 query.current === '0' ? 'HSBCoin' : 'CBCoin'） */}
      <div className="text-base font-medium">{coinName}</div>

      <Tabs defaultValue="1">
        <TabsList>
          <TabsTrigger value="1">{t('tokenized_deposit_0014')}</TabsTrigger>
          <TabsTrigger value="2">{t('Router_047')}</TabsTrigger>
          <TabsTrigger value="3">{t('role_wallets')}</TabsTrigger>
        </TabsList>

        <TabsContent value="1" className="mt-4">
          <MintingMeltingTab onOpenMintMelt={openMintMelt} />
        </TabsContent>

        <TabsContent value="2" className="mt-4">
          <ContractDeploymentTab />
        </TabsContent>

        <TabsContent value="3" className="mt-4">
          <RoleWallets />
        </TabsContent>
      </Tabs>

      {/* Mint / Melt Modal */}
      <MintMeltModal
        open={mintMeltOpen}
        mode={mintMeltMode}
        coinName={coinName}
        surplusCount={surplusCount}
        stablecoin={currentStablecoin}
        onCancel={() => setMintMeltOpen(false)}
        onSuccess={() => setMintMeltOpen(false)}
      />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Tab1：铸销记录 + Mint / Melt 按钮
// ═════════════════════════════════════════════════════════════════════

/** Tab1 筛选表单值（对齐源 form1 items）。 */
interface RecordFilterFormValues {
  /** 交易 hash（源 name 'txHash'）。 */
  txHash: string;
  /** 类型（源 name 'type'，'1'=发行/'2'=销毁，空='all'）。 */
  type: string;
  /** 创建时间起（源 startCreateTime）。 */
  startCreateTime: string;
  /** 创建时间止（源 endCreateTime）。 */
  endCreateTime: string;
  /** 状态（源 name 'state'，1/2/4/5/6/7，空='all'）。 */
  state: string;
  /** 审核时间起（源 startReviewerTime）。 */
  startReviewerTime: string;
  /** 审核时间止（源 endReviewerTime）。 */
  endReviewerTime: string;
}

const EMPTY_FILTER: RecordFilterFormValues = {
  txHash: '',
  type: 'all',
  startCreateTime: '',
  endCreateTime: '',
  state: 'all',
  startReviewerTime: '',
  endReviewerTime: '',
};

interface MintingMeltingTabProps {
  onOpenMintMelt: (mode: MintMeltMode) => void;
}

/**
 * 铸销记录表 + Mint / Melt 标题按钮。
 *
 * endpoint: POST /api/manage/v1/stablecoin/record/query
 * rowKey: recordId（DataTable id 注入）。
 */
function MintingMeltingTab({
  onOpenMintMelt,
}: MintingMeltingTabProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');

  const [pagination, setPagination] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [filterValues, setFilterValues] =
    React.useState<RecordFilterFormValues>(EMPTY_FILTER);

  const { control, handleSubmit, reset } = useForm<RecordFilterFormValues>({
    defaultValues: EMPTY_FILTER,
  });

  const params = React.useMemo<StablecoinRecordListParams>(
    () => ({
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
      // txHash 为 api 唯一透传筛选字段（见文件头 gap 注释）。
      txHash: filterValues.txHash || undefined,
      // 以下字段源 customTable 会拼进 body，本页保留契约（后端是否消费未知）。
      type: filterValues.type === 'all' ? undefined : filterValues.type,
      state: filterValues.state === 'all' ? undefined : filterValues.state,
      startCreateTime: filterValues.startCreateTime || undefined,
      endCreateTime: filterValues.endCreateTime || undefined,
      startReviewerTime: filterValues.startReviewerTime || undefined,
      endReviewerTime: filterValues.endReviewerTime || undefined,
    }),
    [pagination.pageNum, pagination.pageSize, filterValues],
  );

  const query = useStablecoinRecordQuery(params);
  const rows = (query.data?.rows ?? []) as ViewRecordRow[];
  const total = query.data?.page?.total ?? 0;
  const isLoading = query.isLoading || query.isFetching;

  // ── 列定义（对齐源 customTable1 columns，逐列）──
  const columns = React.useMemo<ColumnDef<ViewRecordRow>[]>(
    () => [
      {
        // stablecoin_settings_002：txHash
        accessorKey: 'txHash',
        header: t('stablecoin_settings_002'),
        cell: ({ row }) => (
          <span>{(row.original.txHash as string) || EMPTY_DISPLAY}</span>
        ),
      },
      {
        // PUB_Type → stablecoin_record_type_{type}
        accessorKey: 'type',
        header: t('PUB_Type'),
        cell: ({ row }) => {
          const type = row.original.type as number | string | undefined;
          if (type == null || type === '') return <span>{EMPTY_DISPLAY}</span>;
          return <span>{t(`stablecoin_record_type_${type}`)}</span>;
        },
      },
      {
        // stablecoin_settings_003：name
        accessorKey: 'name',
        header: t('stablecoin_settings_003'),
        cell: ({ row }) => (
          <span>{(row.original.name as string) || EMPTY_DISPLAY}</span>
        ),
      },
      {
        // stablecoin_manage_004：reSet(stablecoinCount) + symbol
        accessorKey: 'stablecoinCount',
        header: t('stablecoin_manage_004'),
        cell: ({ row }) => (
          <span>
            {(row.original.stablecoinCount as string | number) ||
              EMPTY_DISPLAY}{' '}
            {(row.original.symbol as string) ?? ''}
          </span>
        ),
      },
      {
        // PUB_Creater：createUserName
        accessorKey: 'createUserName',
        header: t('PUB_Creater'),
        cell: ({ row }) => (
          <span>{(row.original.createUserName as string) || EMPTY_DISPLAY}</span>
        ),
      },
      {
        // PUB_CreateTime：createTime（源为时间戳，formatDate）
        accessorKey: 'createTime',
        header: t('PUB_CreateTime'),
        cell: ({ row }) => {
          const val = row.original.createTime as number | undefined;
          return (
            <span>{val ? formatDate(val, DATETIME_FMT) : EMPTY_DISPLAY}</span>
          );
        },
      },
      {
        // stablecoin_settings_031：reviewerUserName
        accessorKey: 'reviewerUserName',
        header: t('stablecoin_settings_031'),
        cell: ({ row }) => (
          <span>
            {(row.original.reviewerUserName as string) || EMPTY_DISPLAY}
          </span>
        ),
      },
      {
        // PUB_ReviewTime：reviewerTime
        accessorKey: 'reviewerTime',
        header: t('PUB_ReviewTime'),
        cell: ({ row }) => {
          const val = row.original.reviewerTime as number | undefined;
          return (
            <span>{val ? formatDate(val, DATETIME_FMT) : EMPTY_DISPLAY}</span>
          );
        },
      },
      {
        // PUB_Status：review_submit_state_{state}
        accessorKey: 'state',
        header: t('PUB_Status'),
        cell: ({ row }) => {
          const state = row.original.state as number | string | undefined;
          if (state == null || state === '') return <span>{EMPTY_DISPLAY}</span>;
          return <span>{t(`${REVIEW_SUBMIT_STATE_KEY_PREFIX}${state}`)}</span>;
        },
      },
    ],
    [t],
  );

  // ── 筛选提交 / 重置 ──
  const onFilterSubmit = (values: RecordFilterFormValues) => {
    setFilterValues(values);
    setPagination((prev) => ({ ...prev, pageNum: 1 }));
  };
  const onFilterReset = () => {
    reset(EMPTY_FILTER);
    setFilterValues(EMPTY_FILTER);
    setPagination((prev) => ({ ...prev, pageNum: 1 }));
  };

  return (
    <div className="space-y-4">
      {/* 筛选表单（源 form1 items） */}
      <form
        onSubmit={handleSubmit(onFilterSubmit)}
        className="grid grid-cols-1 gap-4 rounded-lg border bg-card p-4 md:grid-cols-2 lg:grid-cols-3"
      >
        <div>
          <label
            htmlFor="view-filter-txHash"
            className="mb-1.5 block text-sm font-medium"
          >
            {t('stablecoin_settings_002')}
          </label>
          <Input
            id="view-filter-txHash"
            {...control.register('txHash')}
            placeholder={t('stablecoin_settings_002')}
          />
        </div>

        <FormSelect
          name="type"
          control={control}
          label={t('PUB_Type')}
          options={[
            { value: 'all', label: t('PUB_All') },
            { value: '1', label: t('stablecoin_record_type_1') },
            { value: '2', label: t('stablecoin_record_type_2') },
          ]}
        />

        <FormSelect
          name="state"
          control={control}
          label={t('PUB_Status')}
          options={[
            { value: 'all', label: t('PUB_All') },
            ...REVIEW_SUBMIT_STATES.map((s) => ({
              value: String(s),
              label: t(`${REVIEW_SUBMIT_STATE_KEY_PREFIX}${s}`),
            })),
          ]}
        />

        <div>
          <span className="mb-1.5 block text-sm font-medium">
            {t('PUB_CreateTime')}
          </span>
          <div className="flex items-center gap-2">
            <FormDatePicker
              name="startCreateTime"
              control={control}
              label=""
              max={filterValues.endCreateTime || undefined}
            />
            <span className="text-muted-foreground">~</span>
            <FormDatePicker
              name="endCreateTime"
              control={control}
              label=""
              min={filterValues.startCreateTime || undefined}
            />
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium">
            {t('PUB_ReviewTime')}
          </span>
          <div className="flex items-center gap-2">
            <FormDatePicker
              name="startReviewerTime"
              control={control}
              label=""
              max={filterValues.endReviewerTime || undefined}
            />
            <span className="text-muted-foreground">~</span>
            <FormDatePicker
              name="endReviewerTime"
              control={control}
              label=""
              min={filterValues.startReviewerTime || undefined}
            />
          </div>
        </div>

        <div className="flex items-end gap-2">
          <Button type="submit">{t('PUB_Query')}</Button>
          <Button type="button" variant="outline" onClick={onFilterReset}>
            {t('PUB_Reset')}
          </Button>
        </div>
      </form>

      {/* 标题区 + Mint / Melt 按钮（源 CustomTableTitle，tokenized_deposit_0015） */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-medium">{t('tokenized_deposit_0015')}</h3>
        <div className="flex gap-2">
          {/* Mint → Issuance 文案（源按钮 onClick 第 174-190 行） */}
          <PermissionGuard permission={TD_PERMISSIONS.VIEW_MINT_MELT_TITLE}>
            <Button onClick={() => onOpenMintMelt('Issuance')}>
              {t('Mint')}
            </Button>
          </PermissionGuard>
          {/* Melt → Destruction 文案（源按钮 onClick 第 191-213 行，正确分支）。
              注：源 actionClick Melt 分支（第 237-251 行）误设 Issuance 文案，
              本页不复制 actionClick（表无行操作），仅保留此正确分支 —— 见文件头注释。 */}
          <PermissionGuard permission={TD_PERMISSIONS.VIEW_MINT_MELT_TITLE}>
            <Button variant="outline" onClick={() => onOpenMintMelt('Destruction')}>
              {t('Melt')}
            </Button>
          </PermissionGuard>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        emptyMessage={t('empty')}
        pagination={{
          page: pagination.pageNum,
          pageSize: pagination.pageSize,
          total,
          onPageChange: (p) => setPagination((prev) => ({ ...prev, pageNum: p })),
        }}
      />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Mint / Melt Modal
// ═════════════════════════════════════════════════════════════════════

interface MintMeltModalProps {
  open: boolean;
  mode: MintMeltMode;
  coinName: string;
  surplusCount: number | undefined;
  stablecoin: StablecoinListItem | undefined;
  onCancel: () => void;
  onSuccess: () => void;
}

/**
 * Mint / Melt Modal（源 isMintModalOpen + CustomForms）。
 *
 * - mode==='Issuance' → 标题 Router_018、subTitle manage_013、tips manage_014、
 *   useIssueStablecoinMutation（body stablecoinCount/stablecoinId/stablecoinName/unit）。
 * - mode==='Destruction' → 标题 Router_019、subTitle manage_015、tips manage_016
 *   （**** → surplusCount）、useRemoveStablecoinMutation（body stablecoinCount/stablecoinId）。
 *
 * 金额校验（对齐源 validator）：>0、≤6 位小数；Mint ≤ MINT_MAX，Melt ≤ surplusCount。
 */
function MintMeltModal({
  open,
  mode,
  coinName,
  surplusCount,
  stablecoin,
  onCancel,
  onSuccess,
}: MintMeltModalProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');
  const issueMutation = useIssueStablecoinMutation();
  const removeMutation = useRemoveStablecoinMutation();
  const isMint = mode === 'Issuance';
  const isSubmitting = issueMutation.isPending || removeMutation.isPending;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MintMeltFormValues>({
    defaultValues: { stablecoinCount: '' },
  });

  // 打开时重置数量（对齐源 form.resetFields()）。
  React.useEffect(() => {
    if (open) {
      reset({ stablecoinCount: '' });
    }
  }, [open, reset, mode]);

  const title = isMint ? t('Router_018') : t('Router_019');
  const subTitle = isMint ? t('stablecoin_manage_013') : t('stablecoin_manage_015');
  // Mint tips 固定文案；Melt tips 含 **** 占位 → surplusCount（源 .replace('****', ...)）。
  const tips = isMint
    ? t('stablecoin_manage_014')
    : t('stablecoin_manage_016').replace('****', String(surplusCount ?? 0));

  // ── 金额校验（对齐源 validator + max）──
  const validateAmount = React.useCallback(
    (raw: string): string | undefined => {
      if (raw === '' || raw == null) {
        return t('PUB_Pleased').replace('****', t('stablecoin_manage_004'));
      }
      const num = Number(raw);
      if (Number.isNaN(num) || num <= 0) {
        return t('PUB_Pleased').replace('****', t('stablecoin_manage_004'));
      }
      if (!DECIMAL_6_RE.test(raw)) {
        return t('stablecoin_manage_025');
      }
      if (isMint && num > MINT_MAX) {
        return t('PUB_Pleased').replace('****', t('stablecoin_manage_004'));
      }
      if (!isMint && surplusCount != null && num > surplusCount) {
        return t('PUB_Pleased').replace('****', t('stablecoin_manage_004'));
      }
      return undefined;
    },
    [t, isMint, surplusCount],
  );

  const onValid = (values: MintMeltFormValues) => {
    if (isMint) {
      issueMutation.mutate(
        {
          stablecoinCount: values.stablecoinCount,
          stablecoinId: stablecoin?.stablecoinId,
          stablecoinName: stablecoin?.name,
          unit: stablecoin?.symbol,
        },
        {
          onSuccess: () => onSuccess(),
        },
      );
    } else {
      removeMutation.mutate(
        {
          stablecoinCount: values.stablecoinCount,
          stablecoinId: stablecoin?.stablecoinId,
        },
        {
          onSuccess: () => onSuccess(),
        },
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="max-w-[700px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{subTitle}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onValid)} noValidate className="space-y-4">
          {/* 稳定币名称（标识）—— 源 selectIndex disabled Input，回填币种名 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              {t('stablecoin_manage_003')}
            </label>
            <Input value={coinName} disabled readOnly />
          </div>

          {/* 数量 + tips */}
          <div>
            <label
              htmlFor="mint-melt-count"
              className="mb-1.5 block text-sm font-medium"
            >
              {t('stablecoin_manage_004')}
            </label>
            <Input
              id="mint-melt-count"
              type="number"
              step="0.000001"
              min={0}
              max={isMint ? MINT_MAX : surplusCount}
              aria-invalid={!!errors.stablecoinCount}
              {...register('stablecoinCount', {
                validate: validateAmount,
              })}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">{tips}</p>
            {errors.stablecoinCount ? (
              <p className="mt-1 text-xs text-destructive" role="alert">
                {errors.stablecoinCount.message}
              </p>
            ) : null}
          </div>

          <DialogFooter className="flex-row justify-end gap-4 sm:justify-end">
            <Button type="button" variant="outline" onClick={onCancel}>
              {t('PUB_Cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {t('PUB_Submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Tab2：合约部署（全 mock，保留源骨架）
// ═════════════════════════════════════════════════════════════════════

/** 合约部署行（源 mock dataSource）。 */
interface ContractRow {
  /** DataTable 契约 id（= key）。 */
  id: string;
  key: string;
  contractName: string;
  version: string;
  contractType: string;
  proxyContractAddress: string;
  createdTime: string;
  status: string;
}

const CONTRACT_ROWS: ContractRow[] = [
  {
    id: '1',
    key: '1',
    contractName: 'Tokenized Deposit Contract',
    version: '1.0.0',
    contractType: 'Proxy Contract',
    proxyContractAddress: '0x000580a716cf548c5e8520218cf78d0e04052299',
    createdTime: 'Feb 10, 2024, 10:14:41 UTC+08:00',
    status: 'Success',
  },
  {
    id: '2',
    key: '2',
    contractName: 'Pool Management Contract',
    version: '1.0.0',
    contractType: 'Proxy Contract',
    proxyContractAddress: '0x000580a716cf548c5e8520218cf78d0e04050000',
    createdTime: 'Feb 10, 2024, 10:14:41 UTC+08:00',
    status: 'Success',
  },
  {
    id: '3',
    key: '3',
    contractName: 'Wallet Contract',
    version: '1.0.0',
    contractType: 'Proxy Contract',
    proxyContractAddress: '0x000580a716cf548c5e8520218cf78d0e04051111',
    createdTime: 'Feb 10, 2024, 10:14:41 UTC+08:00',
    status: 'Success',
  },
];

/**
 * 合约部署 Tab（全 mock，无后端）。
 *
 * 源 view.tsx 第 265-356 行 mock 表 + Update / Details 行操作。本组件保留 mock 骨架，
 * 两个 Dialog（Update 表单 / Details 列表）亦保留 mock 数据。
 */
function ContractDeploymentTab(): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');

  const [updateOpen, setUpdateOpen] = React.useState(false);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  // Details Modal 中「Contract Initialisation List」显隐（源 hide = data.key === '2'）。
  const [hideInitList, setHideInitList] = React.useState(false);

  const columns = React.useMemo<ColumnDef<ContractRow>[]>(
    () => [
      { accessorKey: 'contractName', header: 'Contract Name' },
      { accessorKey: 'version', header: 'Version' },
      { accessorKey: 'contractType', header: 'Contract Type' },
      { accessorKey: 'proxyContractAddress', header: t('contract_manage_004') },
      { accessorKey: 'createdTime', header: t('PUB_CreatedTime') },
      { accessorKey: 'status', header: 'Status' },
      {
        id: 'actions',
        header: 'Action',
        cell: ({ row }) => (
          <div className="flex text-primary">
            <Button
              variant="link"
              className="mr-4 h-auto p-0"
              onClick={() => setUpdateOpen(true)}
            >
              Update
            </Button>
            <Button
              variant="link"
              className="h-auto p-0"
              onClick={() => {
                setHideInitList(row.original.key === '2');
                setDetailsOpen(true);
              }}
            >
              Details
            </Button>
          </div>
        ),
      },
    ],
    [t],
  );

  return (
    <div className="space-y-4">
      <DataTable
        columns={columns}
        data={CONTRACT_ROWS}
        emptyMessage={t('empty')}
        pagination={undefined}
      />

      {/* Details Modal（源 isModalOpen） */}
      <Dialog open={detailsOpen} onOpenChange={(next) => !next && setDetailsOpen(false)}>
        <DialogContent className="max-w-[60%]">
          <DialogHeader>
            <DialogTitle>Contract Deployment List</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <ContractDeploymentTable />
            {!hideInitList ? <ContractInitialisationTable /> : null}
          </div>
          <DialogFooter className="flex-row justify-end sm:justify-end">
            <Button variant="outline" onClick={() => setDetailsOpen(false)}>
              Back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Modal（源 updateIsModalOpen） */}
      <Dialog open={updateOpen} onOpenChange={(next) => !next && setUpdateOpen(false)}>
        <DialogContent className="max-w-[30%]">
          <DialogHeader>
            <DialogTitle>Update Pool Management Contract</DialogTitle>
          </DialogHeader>
          <UpdateContractForm onCancel={() => setUpdateOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Details Modal 上表（源 Contract Deployment List，mock）。 */
function ContractDeploymentTable(): React.JSX.Element {
  const rows = [
    {
      id: '1',
      key: '1',
      contractType: 'Proxy Contract',
      version: '1.0.0',
      type: 'Deployment',
      contractAddress: '0x9f8f...79a2',
      transactionHash: '0x30ef866295...',
      status: 'Success',
    },
    {
      id: '2',
      key: '2',
      contractType: 'Logical Contract',
      version: '1.0.0',
      type: 'Deployment',
      contractAddress: '0x9f8f...79a2',
      transactionHash: '0x30ef866295...',
      status: 'Success',
    },
    {
      id: '3',
      key: '3',
      contractType: 'TD Contract Relationship Deployment',
      version: '1.0.0',
      type: 'Deployment',
      contractAddress: '0x9f8f...79a2',
      transactionHash: '0x30ef866295...',
      status: 'Success',
    },
  ];
  const columns: ColumnDef<(typeof rows)[number]>[] = [
    { accessorKey: 'contractType', header: 'Contract Type' },
    { accessorKey: 'version', header: 'Version' },
    { accessorKey: 'type', header: 'Type' },
    { accessorKey: 'contractAddress', header: 'Contract Address' },
    { accessorKey: 'transactionHash', header: 'Transaction Hash' },
    { accessorKey: 'status', header: 'Status' },
  ];
  return <DataTable columns={columns} data={rows} pagination={undefined} />;
}

/** Details Modal 下表（源 Contract Initialisation List，mock）。 */
function ContractInitialisationTable(): React.JSX.Element {
  const rows = [
    {
      id: '1',
      key: '1',
      administratorWalletAddress: '0x000580a716cf548c5e8520218cf78d0e04051010',
      description: 'TD Managed Operations Wallet',
      transactionHash: '0x30ef866295...',
      status: 'Success',
    },
    {
      id: '2',
      key: '2',
      administratorWalletAddress: '0x000580a716cf548c5e8520218cf78d0e04051212',
      description: 'TD Sales Operating Wallet',
      transactionHash: '0x30ef866295...',
      status: 'Success',
    },
  ];
  const columns: ColumnDef<(typeof rows)[number]>[] = [
    {
      accessorKey: 'administratorWalletAddress',
      header: 'Administrator Wallet Address',
    },
    { accessorKey: 'description', header: 'Description' },
    { accessorKey: 'transactionHash', header: 'Transaction Hash' },
    { accessorKey: 'status', header: 'Status' },
  ];
  return <DataTable columns={columns} data={rows} pagination={undefined} />;
}

/** Update Modal 表单（源 bin / abi，mock）。 */
function UpdateContractForm({
  onCancel,
}: {
  onCancel: () => void;
}): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="update-bin" className="mb-1.5 block text-sm font-medium">
          {t('BIN')}
        </label>
        <Input
          id="update-bin"
          defaultValue="poolManagementContracts.bin (49KB)"
          readOnly
        />
      </div>
      <div>
        <label htmlFor="update-abi" className="mb-1.5 block text-sm font-medium">
          {t('ABI')}
        </label>
        <Input
          id="update-abi"
          defaultValue="poolManagementContracts.abi (49KB)"
          readOnly
        />
      </div>
      <DialogFooter className="flex-row justify-end gap-4 sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('Cancel')}
        </Button>
        <Button type="button" onClick={onCancel}>
          {t('Submit')}
        </Button>
      </DialogFooter>
    </div>
  );
}
