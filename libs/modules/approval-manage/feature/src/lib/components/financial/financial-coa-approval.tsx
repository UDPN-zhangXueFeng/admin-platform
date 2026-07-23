/**
 * FinancialCoaApproval — COA（科目表）审批详情（迁移自 td-manage
 * `src/pages/approval-manage/components/financial-coa.tsx`，541 行）。
 *
 * 业务语义：审批「财务账本激活」请求，展示 operationType（三级推断）+ 账本基本信息
 * + Chart of Account 的 assets / liabilities 分组（变化表或纯列表两种模式）。
 *
 * 迁移要点（文档 §7 步骤 11）：
 * - mapOperationType 三级推断 → 复用 util `inferOperationType`（recordType→oldItem/newItem→busCode）。
 * - extractAccountItems 递归拍平 + 多别名兜底（accountCode/accountName 判定 + type/accountType/sectionType）。
 * - 原生 `<table>` 渲染 assets/liabilities 分组（变化表 3 列 / 纯列表 2 列）。
 * - 复用 util `formatCodeName`（formatAccountDisplay 合并版）。
 *
 * 只读展示组件（不调 API）。复用 ui `ApprovalDetailGrid`（CustomInformation 迁移壳）
 * 组装 detailsInfo 两层嵌套结构；COA 段用 isTable=true 纵向态（label 上 table 下）。
 *
 * i18n：状态用 `common_task_status_` + `approval_task_status_color_`（已补全）；
 * tokenType 用 `token_type_`（缺 key 回退 key 本身，见 useFinancialT）。
 */
'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { ApprovalDetailGrid } from '@myorg/modules/approval-manage/ui';
import {
  EMPTY_FIELD_VALUE,
  formatCodeName,
  formatTimestamp,
  inferCoaRowChangeType,
  inferOperationType,
} from '@myorg/modules/approval-manage/util';

/** COA 组件 props（detailInfo=businessContent + 可选 busCode）。 */
export interface FinancialCoaApprovalProps {
  /** approvedDetail.businessContent（宽松类型，不重建业务实体）。 */
  detailInfo?: Record<string, unknown>;
  /** busCode（operationType 三级推断用，模糊匹配 startsWith('fin_coa_')）。 */
  busCode?: string;
}

/** 变化表行（迁移自源 CoaAccountRow）。 */
interface CoaChangeRow {
  key: string;
  operationType: 'Add' | 'Edit' | 'Delete' | string;
  oldAccount: string;
  newAccount: string;
  type?: number | string;
}

/** 纯列表行（迁移自源 CoaAccountListRow）。 */
interface CoaListRow {
  key: string;
  accountCode: string;
  accountName: string;
  type?: number | string;
}

/** 账目对象（宽松判定：含 accountCode 或 accountName 即视为账目）。 */
type AccountLike = {
  accountCode?: string;
  accountName?: string;
  bookAccountId?: string | number;
  type?: number | string;
  accountType?: number | string;
  sectionType?: number | string;
  [k: string]: unknown;
};

/** 判定是否为「账目对象」（迁移自源 isAccountLike）。 */
function isAccountLike(value: unknown): value is AccountLike {
  return (
    !!value &&
    typeof value === 'object' &&
    (((value as Record<string, unknown>).accountCode !== undefined) ||
      ((value as Record<string, unknown>).accountName !== undefined))
  );
}

/**
 * 递归拍平账目数组（迁移自源 extractAccountItems）。
 *
 * 后端 COA 结构嵌套不一（changes/oldItem/newItem/accounts 可能是对象/数组/嵌套对象），
 * 此函数递归遍历，命中「账目对象」即收集，并沿 key 名推断 fallbackType
 * （含 'asset' →1，含 'liabilit' →2）。
 */
function extractAccountItems(
  payload: unknown,
  fallbackType?: number
): AccountLike[] {
  if (!payload) return [];
  if (Array.isArray(payload)) {
    return payload.flatMap((item) => extractAccountItems(item, fallbackType));
  }
  if (typeof payload !== 'object') return [];

  if (isAccountLike(payload)) {
    return [
      {
        ...payload,
        type:
          (payload.type ??
            payload.accountType ??
            payload.sectionType ??
            fallbackType) as number | string | undefined,
      },
    ];
  }

  return Object.entries(payload as Record<string, unknown>).flatMap(
    ([key, value]) => {
      const normalizedKey = key.toLowerCase();
      const nextFallbackType = normalizedKey.includes('asset')
        ? 1
        : normalizedKey.includes('liabilit')
        ? 2
        : fallbackType;
      return extractAccountItems(value, nextFallbackType);
    }
  );
}

/** 账目类型归一（迁移自源 mapAccountType）：1/asset→'assets'，2/liability→'liabilities'。 */
function mapAccountType(value?: number | string): 'assets' | '' {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  if (normalized === '1' || normalized === 'asset' || normalized === 'assets') {
    return 'assets';
  }
  return '';
}

/** 变化对象 → 变化表行（迁移自源 buildChangeRows）。 */
function toChangeRow(
  oldItem: AccountLike | null,
  newItem: AccountLike | null,
  type: number | string | undefined,
  index: number
): CoaChangeRow {
  return {
    key: String(
      newItem?.bookAccountId ||
        oldItem?.bookAccountId ||
        newItem?.accountCode ||
        oldItem?.accountCode ||
        index
    ),
    operationType: inferCoaRowChangeType(oldItem, newItem),
    oldAccount: oldItem
      ? formatCodeName(oldItem.accountCode, oldItem.accountName)
      : EMPTY_FIELD_VALUE,
    newAccount: newItem
      ? formatCodeName(newItem.accountCode, newItem.accountName)
      : EMPTY_FIELD_VALUE,
    type,
  };
}

/** changes 数组 → 变化表行（迁移自源 normalizeChanges）。 */
function normalizeChanges(changes: unknown): CoaChangeRow[] {
  if (!Array.isArray(changes)) return [];
  return changes.map((change, index) => {
    const c = (change ?? {}) as Record<string, unknown>;
    const oldItem = (c.oldItem as AccountLike) || null;
    const newItem = (c.newItem as AccountLike) || null;
    const type =
      (c.type as number | string | undefined) ??
      newItem?.type ??
      newItem?.accountType ??
      newItem?.sectionType ??
      oldItem?.type ??
      oldItem?.accountType ??
      oldItem?.sectionType;
    return toChangeRow(oldItem, newItem, type, index);
  });
}

/** oldItem/newItem → 变化表行（迁移自源 normalizeChangeItems，changes 缺失时兜底）。 */
function normalizeChangeItems(
  oldItem: unknown,
  newItem: unknown
): CoaChangeRow[] {
  const oldItems = extractAccountItems(oldItem);
  const newItems = extractAccountItems(newItem);
  const maxLength = Math.max(oldItems.length, newItems.length);
  return Array.from({ length: maxLength }).map((_, index) => {
    const currentOld = oldItems[index] || null;
    const currentNew = newItems[index] || null;
    const type =
      currentNew?.type ??
      currentNew?.accountType ??
      currentNew?.sectionType ??
      currentOld?.type ??
      currentOld?.accountType ??
      currentOld?.sectionType;
    return toChangeRow(currentOld, currentNew, type, index);
  });
}

/** accounts → 纯列表行（迁移自源 normalizeAccountListRows）。 */
function normalizeListRows(accounts: unknown): CoaListRow[] {
  return extractAccountItems(accounts).map((item, index) => ({
    key: String(item.bookAccountId || item.accountCode || index),
    accountCode: item.accountCode || EMPTY_FIELD_VALUE,
    accountName: item.accountName || EMPTY_FIELD_VALUE,
    type: item.type ?? item.accountType ?? item.sectionType,
  }));
}

/** 渲染变化表（迁移自源 renderCoaChangeTable，3 列）。 */
function ChangeTable({ rows }: { rows: CoaChangeRow[] }) {
  if (!rows.length) return <div>{EMPTY_FIELD_VALUE}</div>;
  return (
    <table className="w-full table-fixed border-collapse text-sm">
      <colgroup>
        <col className="w-[18%]" />
        <col className="w-[44%]" />
        <col className="w-[38%]" />
      </colgroup>
      <thead>
        <tr>
          <th className="border border-border bg-muted px-2 py-3 text-left font-normal">
            Operation Type
          </th>
          <th className="border border-border bg-muted px-2 py-3 text-left font-normal">
            Old Account
          </th>
          <th className="border border-border bg-muted px-2 py-3 text-left font-normal">
            New Account
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <td className="border border-border px-2 py-3">
              {row.operationType}
            </td>
            <td className="border border-border px-2 py-3">{row.oldAccount}</td>
            <td className="border border-border px-2 py-3">{row.newAccount}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** 渲染纯列表表（迁移自源 renderCoaAccountTable，2 列）。 */
function ListTable({ rows }: { rows: CoaListRow[] }) {
  if (!rows.length) return <div>{EMPTY_FIELD_VALUE}</div>;
  return (
    <table className="w-full table-fixed border-collapse text-sm">
      <colgroup>
        <col className="w-[50%]" />
        <col className="w-[50%]" />
      </colgroup>
      <thead>
        <tr>
          <th className="border border-border bg-muted px-2 py-3 text-left font-normal">
            Account Code
          </th>
          <th className="border border-border bg-muted px-2 py-3 text-left font-normal">
            Account Name
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <td className="border border-border px-2 py-3">{row.accountCode}</td>
            <td className="border border-border px-2 py-3">{row.accountName}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function FinancialCoaApproval({
  detailInfo,
  busCode,
}: FinancialCoaApprovalProps) {
  const t = useTranslations('modules.approval-manage');
  const info = (detailInfo ?? {}) as Record<string, unknown>;

  const createdBy =
    (info.createUserName as string) ||
    (info.createdBy as string) ||
    (info.operator as string) ||
    (info.createUserId !== undefined
      ? String(info.createUserId)
      : EMPTY_FIELD_VALUE);
  const createdOn =
    info.createTime && Number(info.createTime) > 0
      ? formatTimestamp(Number(info.createTime))
      : EMPTY_FIELD_VALUE;

  const tokenTypeText =
    info.tokenType !== undefined && info.tokenType !== null
      ? safeT(t, `token_type_${info.tokenType}`)
      : EMPTY_FIELD_VALUE;

  const operationType = inferOperationType(
    busCode,
    info.recordType as number | string | undefined,
    {
      oldItem: info.oldItem,
      newItem: info.newItem,
    }
  );

  const {
    isListMode,
    assetChangeRows,
    liabilityChangeRows,
    assetListRows,
    liabilityListRows,
  } = React.useMemo(() => {
    const changeRows = normalizeChanges(info.changes);
    const fallbackRows = normalizeChangeItems(info.oldItem, info.newItem);
    const rows = changeRows.length ? changeRows : fallbackRows;
    const listRows = rows.length ? [] : normalizeListRows(info.accounts);
    return {
      isListMode: !rows.length && !!listRows.length,
      assetChangeRows: rows.filter((r) => mapAccountType(r.type) === 'assets'),
      liabilityChangeRows: rows.filter(
        (r) => mapAccountType(r.type) !== 'assets'
      ),
      assetListRows: listRows.filter(
        (r) => mapAccountType(r.type) === 'assets'
      ),
      liabilityListRows: listRows.filter(
        (r) => mapAccountType(r.type) !== 'assets'
      ),
    };
  }, [info.changes, info.oldItem, info.newItem, info.accounts]);

  const statusValue =
    info.status !== undefined && info.status !== null
      ? Number(info.status)
      : undefined;

  const sections = React.useMemo(
    () => [
      {
        list: [
          { label: 'Operation Type', value: operationType },
        ],
      },
      {
        title: 'Financial Book Activation Request Detail',
        list: [
          {
            label: 'Status',
            value:
              statusValue && Number.isFinite(statusValue) ? (
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusToneClass(
                    safeT(t, `approval_task_status_color_${statusValue}`)
                  )}`}
                >
                  {safeT(t, `common_task_status_${statusValue}`)}
                </span>
              ) : (
                EMPTY_FIELD_VALUE
              ),
          },
          {
            label: 'Financial Book Name',
            value: (info.bookName as string) || EMPTY_FIELD_VALUE,
          },
          { label: 'Book ID', value: (info.bookNo as string) || EMPTY_FIELD_VALUE },
          {
            label: 'Reserve Asset Name',
            value: (info.reserveAssetName as string) || EMPTY_FIELD_VALUE,
          },
          {
            label: 'Currency',
            value: (info.currencyCode as string) || EMPTY_FIELD_VALUE,
          },
          { label: 'Token Type', value: tokenTypeText },
          {
            label: 'EOD Cut-off Time',
            value: (info.eodCutoffTime as string) || EMPTY_FIELD_VALUE,
          },
          { label: 'Created by', value: createdBy },
          { label: 'Created on', value: createdOn, showBorder: true },
        ],
      },
      {
        title: 'Chart of Account (COA)',
        list: [
          {
            label: (
              <span className="text-base font-semibold text-primary">
                Assets
              </span>
            ),
            isTable: true,
            value: isListMode ? (
              <ListTable rows={assetListRows} />
            ) : (
              <ChangeTable rows={assetChangeRows} />
            ),
          },
          {
            label: (
              <span className="text-base font-semibold text-destructive">
                Liabilities
              </span>
            ),
            isTable: true,
            value: isListMode ? (
              <ListTable rows={liabilityListRows} />
            ) : (
              <ChangeTable rows={liabilityChangeRows} />
            ),
            showBorder: true,
          },
        ],
      },
    ],
    [
      operationType,
      statusValue,
      t,
      info.bookName,
      info.bookNo,
      info.reserveAssetName,
      info.currencyCode,
      tokenTypeText,
      info.eodCutoffTime,
      createdBy,
      createdOn,
      isListMode,
      assetListRows,
      assetChangeRows,
      liabilityListRows,
      liabilityChangeRows,
    ]
  );

  return <ApprovalDetailGrid sections={sections} />;
}

/** 安全翻译：缺 key 回退 key 本身（financial 组件 token_type_ 等可能未补全）。 */
function safeT(t: ReturnType<typeof useTranslations>, key: string): string {
  try {
    return t(key);
  } catch {
    return key;
  }
}

/** antd 色名 → Tailwind badge class（与 approval-status-badge 同构，本地自洽）。 */
function statusToneClass(tone?: string): string {
  const map: Record<string, string> = {
    red: 'border-red-200 bg-red-50 text-red-700',
    orange: 'border-orange-200 bg-orange-50 text-orange-700',
    green: 'border-green-200 bg-green-50 text-green-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    processing: 'border-blue-200 bg-blue-50 text-blue-700',
    success: 'border-green-200 bg-green-50 text-green-700',
    error: 'border-red-200 bg-red-50 text-red-700',
    default: 'border-gray-200 bg-gray-50 text-gray-600',
  };
  return (tone && map[tone]) || map.default;
}
