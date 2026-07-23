'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ChevronDown, ChevronUp } from 'lucide-react';

import { Button, Checkbox, CopyableEllipsisText } from '@myorg/shared/ui';
import {
  ApprovalDetailGrid,
  type ApprovalDetailSection,
  ApprovalStatusBadge,
  type ApprovalComponentProps,
} from '@myorg/modules/approval-manage/ui';
import { downloadFile } from '@myorg/modules/approval-manage/data-access';
import {
  EMPTY_FIELD_VALUE,
  PRIVATE_KEY_CUSTODY_OPTIONS,
  RECONCILIATION_LABEL_MAP,
  TRANSACTION_POLICY_OPTIONS,
  formatTimestamp,
  parseCommaSelection,
  renderUpdatedValue,
} from '@myorg/modules/approval-manage/util';

/**
 * ServiceProviderApproval — 服务商注册/编辑审核详情（迁移自 td-manage
 * `src/pages/approval-manage/components/serviceProvider.tsx`，521 行）。
 *
 * 两类 busCode 命中（见 util BUS_CODE_MAP）：
 * - `td_register_sp` → type=1（注册）
 * - `td_edit_sp`     → type=2（编辑）
 *
 * **核心特性**：
 * - `type` 驱动顶部「Service Provider Type」文案（`service_provider_type_${type}`）。
 * - 编辑态（type=2，或后端返回 operation* 字段）显示新旧差异（renderUpdatedValue：
 *   「Updated from {old} to {new}」），对照源 spType/contactName/email/phone 四字段。
 * - Private Key Custody Model / Transaction Submission Policy：逗号分隔字符串 →
 *   parseCommaSelection → disabled Checkbox 群组（只读勾选回显，源 antd Checkbox.Group disabled）。
 * - Business License 文件下载：downloadFile（sftp/download Blob），busId/busType 双兜底；
 *   `NEXT_PUBLIC_FILE_ID` 未配置时下载会失败 → toast 提示不可用，组件不崩。
 * - tdList 折叠卡片：>2 项时默认收起（slice 0,2），点击 More/Collapse 展开/收起全部。
 * - 底部创建人/创建时间/状态区块（status 取派生值，由 detail-page 经 dispatcher 透传；
 *   源用 state 字段，此处从 detailInfo.state 读，与 detail-page STATE_FIELD_BUS_CODES 一致）。
 *
 * **字段访问**：detailInfo = approvedDetail.businessContent（宽松 Record，源 BCMP.ANY/Objects）。
 * 源用大量 `?.` 链式取值，此处统一封装为 record 访问，缺失返回 undefined（由 ApprovalDetailGrid
 * 渲染 EMPTY_FIELD_VALUE）。
 *
 * **i18n**：源跨 3 namespace（tokenized-deposit/approval-manage/sp-access），收敛到
 * `modules.approval-manage.*`（labelKey 无双重前缀，见迁移文档 §7.14）。
 */

/** tdList 单项的宽松类型（源 BCMP.Objects，字段全部可选）。 */
interface TokenItem {
  tokenType?: number | string;
  tdName?: string;
  blockchainName?: string;
  state?: number | string;
  walletAddress?: string;
  webhookUrl?: string;
  contractAddress?: string;
  txHash?: string;
  txTime?: number | string;
  accessList?: Array<{
    accessType?: number | string;
    transactionToggle?: number | string;
    typeAndPermissionList?: Array<{
      walletTypeList?: Array<{ name?: string }>;
    }>;
  }>;
}

/**
 * 解析 accessItem：从 token 的 accessList 按 accessType 取命中项（源 getAccessItem）。
 */
function getAccessItem(
  token: TokenItem,
  accessType: number
): TokenItem['accessList'] extends Array<infer T> ? T | undefined : unknown {
  return (token.accessList || []).find(
    (item) => Number(item?.accessType) === accessType
  ) as never;
}

/**
 * 取某 accessType 下的去重钱包名列表（源 getWalletNames）。
 */
function getWalletNames(token: TokenItem, accessType: number): string[] {
  const accessItem = getAccessItem(token, accessType);
  if (!accessItem) return [];
  const permissions = (accessItem as { typeAndPermissionList?: unknown })
    .typeAndPermissionList as
    | Array<{ walletTypeList?: Array<{ name?: string }> }>
    | undefined;
  return (permissions || [])
    .flatMap((permission) =>
      (permission?.walletTypeList || [])
        .map((wallet) => String(wallet?.name || '').trim())
        .filter(Boolean)
    )
    .filter((name, index, source) => source.indexOf(name) === index);
}

export function ServiceProviderApproval({
  detailInfo,
  type,
}: ApprovalComponentProps) {
  const t = useTranslations('modules.approval-manage');
  const [open, setOpen] = React.useState(false);
  const [downloadingBusinessLicense, setDownloadingBusinessLicense] =
    React.useState(false);

  // detailInfo 即 businessContent，源类型 BCMP.ANY。
  const d = (detailInfo ?? {}) as Record<string, any>;

  // ── 新旧差异文案（源 sp_access_0069/0070，收敛后 labelKey 无前缀重叠） ──────────
  const updatedLabels = React.useMemo(
    () => ({
      from: t('serviceProvider.updatedFrom'),
      to: t('serviceProvider.updatedTo'),
    }),
    [t]
  );
  const renderUpdated = React.useCallback(
    (origin?: string | number | null, latest?: string | number | null) =>
      renderUpdatedValue(
        origin == null ? undefined : String(origin),
        latest == null ? undefined : String(latest),
        updatedLabels
      ),
    [updatedLabels]
  );

  // ── Business License 下载（源 handleDownloadBusinessLicense） ──────────────────
  const handleDownloadBusinessLicense = React.useCallback(async () => {
    if (downloadingBusinessLicense) return;
    const busType = Number(d.busType || d.operationBusType);
    const busId = Number(d.spId || d.busId);
    if (!busType || !busId) {
      toast.error(t('serviceProvider.licenseUnavailable'));
      return;
    }
    setDownloadingBusinessLicense(true);
    try {
      await downloadFile({ busId, busType });
      toast.success(t('serviceProvider.licenseDownloadSuccess'));
    } catch {
      // NEXT_PUBLIC_FILE_ID 未配置或后端不可用 → 降级提示，组件不崩（迁移文档 §8）。
      toast.error(t('serviceProvider.licenseDownloadFailed'));
    } finally {
      setDownloadingBusinessLicense(false);
    }
  }, [downloadingBusinessLicense, d, t]);

  const businessLicenseFileName = d.fileName
    ? `${d.fileName}${d.fileType ? `.${d.fileType}` : ''}`
    : EMPTY_FIELD_VALUE;

  // ── 派生字段（源 metaType / reconciliationFrequency / 选中项） ──────────────────
  const metaType =
    d.operationMetaType !== undefined
      ? Number(d.operationMetaType)
      : Number(d.metaType);
  const reconciliationFrequency =
    d.operationReconciliationFrequency !== undefined
      ? Number(d.operationReconciliationFrequency)
      : Number(d.reconciliationFrequency);
  const selectedPrivateKeyCustodyModel = React.useMemo(
    () => parseCommaSelection(d.privateKeyCustodyModel),
    [d.privateKeyCustodyModel]
  );
  const selectedTransactionPolicy = React.useMemo(
    () =>
      parseCommaSelection(
        d.operationTransactionPolicy || d.transactionPolicy
      ),
    [d.operationTransactionPolicy, d.transactionPolicy]
  );

  // ── disabled Checkbox 群组渲染（源 renderCheckboxGroupValue） ───────────────────
  const renderCheckboxGroup = React.useCallback(
    (
      options: ReadonlyArray<{ value: string; label: string }>,
      selected: string[]
    ) => {
      if (!selected.length) return EMPTY_FIELD_VALUE;
      return (
        <div className="flex flex-col gap-1.5">
          {options.map((option) => (
            <label
              key={option.value}
              className="flex items-center gap-2 text-sm"
            >
              <Checkbox checked={selected.includes(option.value)} disabled />
              <span className="text-muted-foreground">{option.label}</span>
            </label>
          ))}
        </div>
      );
    },
    []
  );

  // ── 权限值渲染（源 renderPermissionValue） ─────────────────────────────────────
  const renderPermissionValue = React.useCallback(
    (token: TokenItem, accessType: number) => {
      const accessItem = getAccessItem(token, accessType);
      if (!accessItem) return EMPTY_FIELD_VALUE;
      const walletNames = getWalletNames(token, accessType);
      const enableTransactions =
        Number(
          (accessItem as { transactionToggle?: number | string })
            .transactionToggle
        ) === 2
          ? 'No'
          : 'Yes';
      return (
        <div className="text-sm">
          <div className="mb-1 font-semibold">
            {`${t('serviceProvider.wallets')} (${walletNames.length}):`}
          </div>
          <div className="rounded bg-muted px-2 py-1">
            {walletNames.length ? walletNames.join(', ') : EMPTY_FIELD_VALUE}
          </div>
          <div className="mt-1.5">
            <span className="font-semibold">
              {t('serviceProvider.enableTransactions')}:
            </span>{' '}
            {enableTransactions}
          </div>
        </div>
      );
    },
    [t]
  );

  const tdList = (d.tdList ?? []) as TokenItem[];

  // ── 主体详情区块（源 getDetailInfo） ────────────────────────────────────────────
  const sections = React.useMemo<ApprovalDetailSection[]>(() => {
    const spTypeValue =
      d.operationSpType == null
        ? t(`service_provider_types_${d.spType}`)
        : d.operationSpType == d.spType
        ? t(`service_provider_types_${d.operationSpType}`)
        : `${t('serviceProvider.updatedFrom')}${t(
            `service_provider_types_${d.spType}`
          )}${t('serviceProvider.updatedTo')}${t(
            `service_provider_types_${d.operationSpType}`
          )}`;

    return [
      {
        list: [
          {
            label: t('tokenized_deposit_0042'),
            value:
              type != null ? t(`service_provider_type_${type}`) : EMPTY_FIELD_VALUE,
          },
        ],
      },
      {
        title: t('sp_access_0052'),
        list: [
          { label: t('sp_access_0000'), value: d.spName },
          { label: t('sp_access_0065'), value: spTypeValue },
          {
            label: t('sp_access_0039'),
            value: renderUpdated(
              d.contactName,
              d.operationContactName || d.contactName
            ),
          },
          {
            label: t('PUB_Email'),
            value: renderUpdated(d.email, d.operationContactEmail || d.email),
          },
          {
            label: t('PUB_Phone'),
            value: renderUpdated(
              d.phone,
              d.operationContactPhone || d.phone
            ),
          },
          {
            label: t('sp_access_0041'),
            value:
              businessLicenseFileName !== EMPTY_FIELD_VALUE ? (
                <Button
                  variant="link"
                  className="h-auto px-0"
                  disabled={downloadingBusinessLicense}
                  onClick={handleDownloadBusinessLicense}
                >
                  {businessLicenseFileName}
                </Button>
              ) : (
                EMPTY_FIELD_VALUE
              ),
          },
          {
            label: t('serviceProvider.enableMetaTransactions'),
            value: metaType === 5 ? 'Yes' : 'No',
          },
          {
            label: t('serviceProvider.reconciliationFrequency'),
            value:
              RECONCILIATION_LABEL_MAP[reconciliationFrequency] ||
              (reconciliationFrequency
                ? String(reconciliationFrequency)
                : EMPTY_FIELD_VALUE),
          },
          {
            label: t('sp_access_0040'),
            value:
              d.operationSpDesc || d.spDesc ? (
                <div className="rounded bg-muted px-2 py-1 text-sm">
                  {d.operationSpDesc || d.spDesc}
                </div>
              ) : (
                EMPTY_FIELD_VALUE
              ),
            isTable: true,
          },
          {
            label: t('serviceProvider.privateKeyCustodyModel'),
            value: renderCheckboxGroup(
              PRIVATE_KEY_CUSTODY_OPTIONS,
              selectedPrivateKeyCustodyModel
            ),
          },
          {
            label: t('serviceProvider.transactionSubmissionPolicy'),
            value: renderCheckboxGroup(
              TRANSACTION_POLICY_OPTIONS,
              selectedTransactionPolicy
            ),
          },
        ],
      },
      {
        title: `${t('sp_access_0063')} (${tdList.length})`,
      },
    ];
  }, [
    d,
    type,
    businessLicenseFileName,
    downloadingBusinessLicense,
    handleDownloadBusinessLicense,
    metaType,
    reconciliationFrequency,
    renderUpdated,
    renderCheckboxGroup,
    selectedPrivateKeyCustodyModel,
    selectedTransactionPolicy,
    tdList.length,
    t,
  ]);

  // ── 底部创建人/时间/状态区块（源 getDetailInfo1） ──────────────────────────────
  const footerSections = React.useMemo<ApprovalDetailSection[]>(
    () => [
      {
        list: [
          { label: t('PUB_Creater'), value: d.createUser },
          {
            label: t('PUB_CreateTime'),
            value: formatTimestamp(Number(d.createTime)),
            showBorder: true,
          },
          {
            label: t('PUB_Status'),
            value: <ApprovalStatusBadge family="task" status={toNumber(d.state)} />,
            showBorder: true,
          },
        ],
      },
    ],
    [d.createUser, d.createTime, d.state, t]
  );

  const visibleTdList = open ? tdList : tdList.slice(0, 2);

  return (
    <div className="space-y-2">
      <ApprovalDetailGrid sections={sections} />

      {visibleTdList.map((el, key) => (
        <div key={key} className="rounded border border-border px-2">
          <div className="flex justify-between py-3">
            <div className="w-[40%]">
              <span className="text-sm">
                {el.tdName} ({el.blockchainName})
              </span>
            </div>
            <div className="w-[60%]">
              <ApprovalStatusBadge
                family="task"
                status={toNumber(el.state)}
              />
            </div>
          </div>
          <div className="flex justify-between py-3">
            <div className="w-[40%] text-sm text-muted-foreground">
              {t('sp_access_0045')}
            </div>
            <div className="w-[60%]">
              {el.walletAddress ? (
                <CopyableEllipsisText value={el.walletAddress} />
              ) : (
                EMPTY_FIELD_VALUE
              )}
            </div>
          </div>
          <div className="flex justify-between gap-4 py-3">
            <div className="w-[40%] shrink-0 text-sm text-muted-foreground">
              {t('sp_access_0064')}
            </div>
            <div className="w-[60%]">{renderPermissionValue(el, 1)}</div>
          </div>
          <div className="flex justify-between py-3">
            <div className="w-[40%] text-sm text-muted-foreground">
              {t('serviceProvider.webhookUrl')}
            </div>
            <div className="w-[60%]">
              {el.webhookUrl ? (
                <CopyableEllipsisText value={el.webhookUrl} />
              ) : (
                EMPTY_FIELD_VALUE
              )}
            </div>
          </div>
          <div className="flex justify-between py-3">
            <div className="w-[40%] text-sm text-muted-foreground">
              {t('sp_access_0048')}
            </div>
            <div className="w-[60%]">
              {el.contractAddress ? (
                <CopyableEllipsisText value={el.contractAddress} />
              ) : (
                EMPTY_FIELD_VALUE
              )}
            </div>
          </div>
          <div className="flex justify-between gap-4 py-3">
            <div className="w-[40%] shrink-0 text-sm text-muted-foreground">
              {t('sp_access_0047')}
            </div>
            <div className="w-[60%]">
              {el.contractAddress ? (
                renderPermissionValue(el, 5)
              ) : (
                EMPTY_FIELD_VALUE
              )}
            </div>
          </div>
          <div className="flex justify-between py-3">
            <div className="w-[40%] text-sm text-muted-foreground">
              {t('tokenized_deposit_0089')}
            </div>
            <div className="w-[60%] break-all text-sm">
              {el.txHash || EMPTY_FIELD_VALUE}
            </div>
          </div>
          <div className="flex justify-between border-t border-border py-3">
            <div className="w-[40%] text-sm text-muted-foreground">
              {t('tokenized_deposit_0086')}
            </div>
            <div className="w-[60%] break-all text-sm">
              {formatTimestamp(toNumber(el.txTime))}
            </div>
          </div>
        </div>
      ))}

      {tdList.length > 2 ? (
        <button
          type="button"
          className="text-primary flex items-center justify-end font-bold"
          onClick={() => setOpen(!open)}
        >
          <span className="mr-2 text-sm">
            {open ? t('PUB_Collapse') : t('PUB_More')}
          </span>
          {open ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
      ) : null}

      <ApprovalDetailGrid sections={footerSections} />
    </div>
  );
}

/** 安全 number 化（兼容字符串数字）。 */
function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}
