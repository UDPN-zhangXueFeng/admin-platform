'use client';

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ColumnDef } from '@tanstack/react-table';
import { endOfDay, parseISO, startOfDay } from 'date-fns';
import { Info } from 'lucide-react';
import {
  Button,
  DataTable,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@myorg/shared/ui';
import { FormDatePicker } from '@myorg/shared/ui-forms';
import { formatDate } from '@myorg/shared/util-dates';
import {
  useApplyAccrualMutation,
  useBatchApplyListMutation,
  useFundListQuery,
  type AccrualApplyReqVO,
  type SingleApplyPreviewItem,
} from '@myorg/modules/mmf/data-access';
import { EMPTY_DISPLAY } from '@myorg/modules/mmf/util';
import {
  buildBatchApplyPayload,
  computeBatchSelection,
  type BatchSelectionRow,
} from './batch-apply-selection';

const DATE_FMT = 'YYYY-MM-DD';

/**
 * 本地带 id 的批量申报行（DataTable 契约要求 `{ id: string }`）。
 * 后端 `BatchApplyListItem` 无 id，注入 `id = String(accrualRecordId)`。
 */
type BatchRow = BatchSelectionRow;

/**
 * reSet 的本地等价：value >= 0 → 千分位 + 2 位小数；否则 '--'。
 * 迁移自 td-manage libs/utils 的 reSet（len=2 默认）。
 *
 * 与源码实现一致：先 `toFixed(2)` 再对小数点前的整数部分插入千分位。
 */
function reSet(value: number | undefined | null, symbol?: string): string {
  if (value == null || Number.isNaN(value) || value < 0) {
    return symbol ? `${EMPTY_DISPLAY} ${symbol}` : EMPTY_DISPLAY;
  }
  // toFixed(2) 保证小数部分固定 2 位，正则仅在整数部分插入千分位分隔符。
  const formatted = value
    .toFixed(2)
    .replace(/(\d)(?=(\d{3})+\.)/g, '$1,');
  return symbol ? `${formatted} ${symbol}` : formatted;
}

// ── 批量申报查询表单 ──
interface BatchFilterForm {
  ruleId: string;
  applyDateFrom: string;
  applyDateTo: string;
}

// ======================================================================
// 公共：信息提示区（两个 Modal 共用 mmf_0004 + mmf_0024 两行文案）
// ======================================================================
function ApplyNotice({ t }: { t: (k: string) => string }) {
  return (
    <div className="mt-2 flex items-start gap-2 rounded-md bg-blue-50 p-2 text-blue-700 dark:bg-blue-950 dark:text-blue-200">
      <Info className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="flex-1 text-sm">
        <div>{t('modal.noticeLine1')}</div>
        <div>{t('modal.noticeLine2')}</div>
      </div>
    </div>
  );
}

// ======================================================================
// 批量申报 Modal
// ======================================================================
export interface AccrualBatchApplyModalProps {
  open: boolean;
  /** 默认基金 ruleId（来自列表页 fundList[0].ruleId），打开时回填查询表单。 */
  defaultRuleId?: number | string;
  onOpenChange: (open: boolean) => void;
}

function BatchApplyModal({
  open,
  defaultRuleId,
  onOpenChange,
}: AccrualBatchApplyModalProps) {
  const t = useTranslations('modules.mmf');

  const fundList = useFundListQuery();
  const batchListMutation = useBatchApplyListMutation();
  const applyMutation = useApplyAccrualMutation();

  const fundOptions = React.useMemo(
    () =>
      (fundList.data ?? []).map((el) => ({
        label: el.fundName ?? '',
        value: String(el.ruleId ?? ''),
      })),
    [fundList.data],
  );

  const [selectedFundLabel, setSelectedFundLabel] = React.useState('');
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  const { control, handleSubmit, reset, watch } =
    useForm<BatchFilterForm>({
      defaultValues: {
        ruleId: defaultRuleId != null ? String(defaultRuleId) : '',
        applyDateFrom: '',
        applyDateTo: '',
      },
    });

  // ── 查询（在 effect 之前定义，保证 effect 可引用稳定引用）──
  const doQuery = React.useCallback(
    (ruleId: string, from: string, to: string) => {
      if (!ruleId) return;
      batchListMutation.mutate({
        ruleId: Number(ruleId),
        accrualTimeStartDate: from
          ? startOfDay(parseISO(from)).getTime()
          : 0,
        accrualTimeEndDate: to ? endOfDay(parseISO(to)).getTime() : 0,
      });
    },
    [batchListMutation],
  );

  // 打开时重置表单 + 清空选择 + 预查默认基金
  React.useEffect(() => {
    if (!open) return;
    reset({
      ruleId: defaultRuleId != null ? String(defaultRuleId) : '',
      applyDateFrom: '',
      applyDateTo: '',
    });
    setSelectedIds([]);
    setSelectedFundLabel('');
    if (defaultRuleId != null) {
      doQuery(String(defaultRuleId), '', '');
    }
  }, [open, defaultRuleId, reset, doQuery]);

  // 表格数据（本地静态，非分页）：注入 id 满足 DataTable 契约
  const rows = React.useMemo<BatchRow[]>(
    () =>
      (batchListMutation.data ?? []).map((r) => ({
        ...r,
        id: String(r.accrualRecordId ?? ''),
      })),
    [batchListMutation.data],
  );

  // 聚合 + payload（委托给纯函数 batch-apply-selection.ts，便于单测边界）
  const aggregate = React.useMemo(
    () => computeBatchSelection(rows, selectedIds),
    [rows, selectedIds],
  );

  // mutation 显式 payload（重构点：消除源码 Object.assign 副作用）
  const batchPayload = React.useMemo<AccrualApplyReqVO>(
    () => buildBatchApplyPayload(rows, selectedIds, watch('ruleId')),
    [rows, selectedIds, watch],
  );

  const onQuery = handleSubmit((f) => {
    setSelectedIds([]);
    doQuery(f.ruleId, f.applyDateFrom, f.applyDateTo);
  });

  const onResetQuery = () => {
    const firstRuleId =
      defaultRuleId != null ? String(defaultRuleId) : (fundOptions[0]?.value ?? '');
    reset({
      ruleId: firstRuleId,
      applyDateFrom: '',
      applyDateTo: '',
    });
    setSelectedIds([]);
    setSelectedFundLabel('');
    doQuery(firstRuleId, '', '');
  };

  // ── 确认（批量）──
  const onConfirm = () => {
    if (aggregate.selectLength === 0) {
      toast.error(t('noSelection'));
      return;
    }
    applyMutation.mutate(batchPayload, {
      onSuccess: () => {
        toast.success(t('batchApplySuccess'));
        onOpenChange(false);
      },
      onError: () => toast.error(t('batchApplySuccess')),
    });
  };

  const columns = React.useMemo<ColumnDef<BatchRow>[]>(
    () => [
      {
        accessorKey: 'fundName',
        header: t('field.fundName'),
        cell: ({ row }) => (
          <TooltipCell
            text={row.original.fundName}
            tooltip={row.original.fundName}
          />
        ),
      },
      {
        accessorKey: 'accrualDate',
        header: t('field.accrualDate'),
        cell: ({ row }) => {
          const text = row.original.accrualDate
            ? formatDate(row.original.accrualDate, DATE_FMT)
            : EMPTY_DISPLAY;
          return <TooltipCell text={text} tooltip={text} />;
        },
      },
      {
        accessorKey: 'dividendMethod',
        header: t('field.dividendMethod'),
        cell: ({ row }) => (
          <TooltipCell
            text={row.original.dividendMethod}
            tooltip={row.original.dividendMethod}
          />
        ),
      },
      {
        accessorKey: 'accrualUnits',
        header: t('field.accrualUnits'),
        cell: ({ row }) => {
          const text = reSet(
            row.original.accrualUnits,
            row.original.tokenSymbol,
          );
          return <TooltipCell text={text} tooltip={text} />;
        },
      },
      {
        accessorKey: 'totalWalletBalance',
        header: t('field.totalWalletBalance'),
        cell: ({ row }) => {
          const text = reSet(
            row.original.totalWalletBalance,
            row.original.tokenSymbol,
          );
          return <TooltipCell text={text} tooltip={text} />;
        },
      },
      {
        accessorKey: 'totalWallets',
        header: t('field.totalWallets'),
        cell: ({ row }) => (
          <span>{row.original.totalWallets ?? EMPTY_DISPLAY}</span>
        ),
      },
    ],
    [t],
  );

  const spinning = applyMutation.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (spinning) return; // 提交中禁止关闭
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t('modal.batchTitle')}</DialogTitle>
        </DialogHeader>

        <div className={spinning ? 'pointer-events-none opacity-60' : ''}>
          {/* 查询表单 */}
          <form
            onSubmit={onQuery}
            className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
          >
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {t('field.fundName')}
              </label>
              <Controller
                control={control}
                name="ruleId"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      field.onChange(v);
                      const opt = fundOptions.find((o) => o.value === v);
                      setSelectedFundLabel(opt?.label ?? '');
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t('filter.all')} />
                    </SelectTrigger>
                    <SelectContent>
                      {fundOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <FormDatePicker
              name="applyDateFrom"
              control={control}
              label={t('modal.appliedDate')}
            />
            <FormDatePicker
              name="applyDateTo"
              control={control}
              label={t('modal.appliedDate')}
            />
            <div className="flex gap-2 md:col-start-2 xl:col-start-3">
              <Button type="submit" disabled={batchListMutation.isPending}>
                {t('filter.query')}
              </Button>
              <Button type="button" variant="outline" onClick={onResetQuery}>
                {t('filter.reset')}
              </Button>
            </div>
          </form>

          {/* 可选静态表格 */}
          <div className="mt-4 max-h-96 overflow-y-auto">
            <DataTable
              columns={columns}
              data={rows}
              isLoading={batchListMutation.isPending}
              emptyMessage={t('empty')}
              selection={{
                selectedIds,
                onSelectionChange: setSelectedIds,
              }}
            />
          </div>

          {/* 汇总 */}
          <div className="mt-4 text-sm">
            {t('modal.applyRecordsSummary', {
              total: rows.length,
              select: aggregate.selectLength,
            })}
          </div>
          <div className="mt-2 text-blue-600">{t('modal.reviewNotice')}</div>
          <div className="my-2 text-sm">
            {t('field.fundName')}: {selectedFundLabel || EMPTY_DISPLAY}
          </div>
          <div className="flex text-sm">
            <div className="w-1/2">
              <span>{t('field.dividendMethod')}: </span>
              <span>{reSet(aggregate.totalAccrualUnits) || EMPTY_DISPLAY}</span>
            </div>
            <div className="w-1/2">
              <span>{t('field.totalWallets')}: </span>
              <span>{aggregate.selectTotalWallets || EMPTY_DISPLAY}</span>
            </div>
          </div>

          <ApplyNotice t={t} />

          <div className="mt-6 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t('action.cancel')}
            </Button>
            <Button
              type="button"
              disabled={selectedIds.length === 0 || spinning}
              onClick={onConfirm}
            >
              {t('action.confirm')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ======================================================================
// 单条申报 Modal
// ======================================================================
export interface AccrualSingleApplyModalProps {
  open: boolean;
  /** 预填数据（来自列表行 currentData）。 */
  currentData: SingleApplyPreviewItem | null;
  onOpenChange: (open: boolean) => void;
}

function SingleApplyModal({
  open,
  currentData,
  onOpenChange,
}: AccrualSingleApplyModalProps) {
  const t = useTranslations('modules.mmf');
  const applyMutation = useApplyAccrualMutation();

  // 预填 6 字段（源 items useMemo）
  const items = React.useMemo(() => {
    if (!currentData) return [];
    return [
      { label: t('field.fundName'), value: currentData.fundName ?? EMPTY_DISPLAY },
      {
        label: t('field.accrualDate'),
        value: currentData.accrualDate
          ? formatDate(currentData.accrualDate, DATE_FMT)
          : EMPTY_DISPLAY,
      },
      { label: t('field.dividendMethod'), value: currentData.dividendMethod ?? EMPTY_DISPLAY },
      {
        label: t('field.accrualUnits'),
        value: reSet(currentData.accrualUnits, currentData.tokenSymbol),
      },
      {
        label: t('field.totalWalletBalance'),
        value: reSet(currentData.totalWalletBalance, currentData.tokenSymbol),
      },
      {
        label: t('field.totalWallets'),
        value: String(currentData.totalWallets ?? EMPTY_DISPLAY),
      },
    ];
  }, [currentData, t]);

  // mutation 显式 payload（重构点：单条 applyReqVOList）
  const singlePayload = React.useMemo<AccrualApplyReqVO>(() => {
    if (!currentData) return { applyReqVOList: [] };
    return {
      applyReqVOList: [
        {
          accrualRecordId: currentData.accrualRecordId,
          accrualUnits: currentData.accrualUnits,
        },
      ],
      ruleId: currentData.ruleId,
      totalAccrualUnits: currentData.accrualUnits,
    };
  }, [currentData]);

  const onConfirm = () => {
    if (!currentData) return;
    applyMutation.mutate(singlePayload, {
      onSuccess: () => {
        toast.success(t('applySuccess'));
        onOpenChange(false);
      },
      onError: () => toast.error(t('applySuccess')),
    });
  };

  const spinning = applyMutation.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (spinning) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('modal.singleTitle')}</DialogTitle>
        </DialogHeader>

        <div className={spinning ? 'pointer-events-none opacity-60' : ''}>
          <div className="space-y-3">
            {items.map((el, index) => (
              <div key={index} className="flex gap-2 text-sm">
                <span className="w-2/5 text-muted-foreground">{el.label}</span>
                <span className="flex-1">{el.value}</span>
              </div>
            ))}
          </div>

          <ApplyNotice t={t} />

          <div className="mt-6 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t('action.cancel')}
            </Button>
            <Button
              type="button"
              disabled={spinning}
              onClick={onConfirm}
            >
              {t('action.confirm')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ======================================================================
// 内部：Tooltip 包裹的单元格（源码 6 列均 Tooltip 包裹）
// ======================================================================
function TooltipCell({ text, tooltip }: { text?: string; tooltip?: string }) {
  if (!text) return <span>{EMPTY_DISPLAY}</span>;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="block max-w-[220px] truncate">{text}</span>
        </TooltipTrigger>
        <TooltipContent>{tooltip ?? text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ======================================================================
// 公共导出：聚合两个 Modal（共用 spinning 由内部 mutation.isPending 推导）
// ======================================================================
export interface AccrualApplyModalProps {
  /** 批量申报 Modal。 */
  batchOpen: boolean;
  /** 单条申报 Modal。 */
  singleOpen: boolean;
  /** 批量默认基金 ruleId（fundList[0].ruleId）。 */
  defaultRuleId?: number | string;
  /** 单条预填数据。 */
  currentData: SingleApplyPreviewItem | null;
  onBatchOpenChange: (open: boolean) => void;
  onSingleOpenChange: (open: boolean) => void;
}

/**
 * AccrualApplyModal — 计提申报（批量 + 单条）双 Modal 聚合组件。
 *
 * 迁移自 td-manage src/pages/mmf/accrual/index.tsx 的两个 CustomModal。
 *
 * 关键重构（mmf.md 第8章风险点「params 模块级可变引用」）：
 * 源码用模块顶层 `params` 对象 + `Object.assign` 在 useMemo 内副作用写入，
 * 再在 onFinish 读取。本组件改为：
 *   - 两个 Modal 各自用 `useMemo` 从 `selectedRows` / `currentData` 计算
 *     显式的 `AccrualApplyReqVO` payload；
 *   - 提交时直接传 payload 给 `useApplyAccrualMutation`，无共享可变状态。
 *
 * 两个 Modal 共用同一 mutation（`useApplyAccrualMutation`），spinning
 * 由各自 `applyMutation.isPending` 推导（提交中禁止关闭 + 置灰遮罩）。
 */
export function AccrualApplyModal({
  batchOpen,
  singleOpen,
  defaultRuleId,
  currentData,
  onBatchOpenChange,
  onSingleOpenChange,
}: AccrualApplyModalProps) {
  return (
    <>
      <BatchApplyModal
        open={batchOpen}
        defaultRuleId={defaultRuleId}
        onOpenChange={onBatchOpenChange}
      />
      <SingleApplyModal
        open={singleOpen}
        currentData={currentData}
        onOpenChange={onSingleOpenChange}
      />
    </>
  );
}

// 显式导出两个子 Modal，供列表页按需直接使用。
export { BatchApplyModal, SingleApplyModal };
