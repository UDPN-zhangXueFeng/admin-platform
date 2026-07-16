'use client';

import * as React from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { parseISO, startOfDay } from 'date-fns';
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@myorg/shared/ui';
import { formatDate } from '@myorg/shared/util-dates';
import {
  usePostingEventAccountsQuery,
  usePostingEventDetailQuery,
  useUpdatePostingEventMutation,
  type PostingAccountOption,
} from '@myorg/modules/posting-engine/data-access';
import {
  DIRECTION,
  EMPTY_DISPLAY,
  MAPPING_METHOD,
  formatAccountLabel,
  getSourceEventTypeMessageKey,
  parseAccountLabel,
  toMillis,
} from '@myorg/modules/posting-engine/util';

const DATE_FMT = 'YYYY-MM-DD';
const DEFAULT_AMOUNT_EXPRESSION = 'Transaction Amount';

interface MatrixEntry {
  drCr: 'Dr' | 'Cr';
  account: string;
  method: 'DIRECT' | 'CONSTANT';
  value: string;
}

interface EditFormValues {
  /** `YYYY-MM-DD` 字符串。 */
  effectiveDate: string;
  entries: MatrixEntry[];
}

interface Option {
  label: string;
  value: string;
}

function parseId(raw?: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** 由科目列表去重构建选项（label = "code - name"，迁移自源 buildAccountOptions）。 */
function buildAccountOptions(accounts: PostingAccountOption[]): Option[] {
  const labels = new Set<string>();
  accounts.forEach((account) => {
    const label = formatAccountLabel(account.accountCode, account.accountName);
    if (label) labels.add(label);
  });
  return Array.from(labels).map((label) => ({ label, value: label }));
}

/**
 * PostingEngineFormPage — 事件矩阵编辑页。
 *
 * 迁移自 td-manage `src/pages/financial/posting-engine/edit.tsx`（748 行）。
 * 保留：
 *   - 加载事件详情（detail API）+ Dr/Cr 科目选项（event-accounts API）。
 *   - Dr/Cr 科目按 direction 联动：源在 mount 即同时拉 Dr+Cr（ref 防重复），
 *     onDropdownVisibleChange 为兜底；此处用 TanStack 双查询（key 自动去重）
 *     前置加载，功能等价且更简洁（Rule 2/7）。API 空时回退到现有 entry 账户。
 *   - 矩阵 4 列：Dr/Cr（只读）/ Account（可编辑 Select，按 direction 选项）/
 *     Method（只读 DIRECT/CONSTANT）/ Value（只读，来源 transactionEventFields + 现有值）。
 *   - 保存：update API，payload 解析 accountCode/accountName + direction + mappingMethod
 *     + sortOrder(1-based) + effectiveDate(startOf day)。
 */
export function PostingEngineFormPage() {
  const t = useTranslations('modules.posting-engine');
  const router = useRouter();
  const searchParams = useSearchParams();
  const postingEventId = parseId(searchParams.get('id'));

  const { data: event, isLoading } =
    usePostingEventDetailQuery(postingEventId);
  const drAccounts = usePostingEventAccountsQuery(
    postingEventId,
    DIRECTION.Debit,
    Boolean(postingEventId)
  );
  const crAccounts = usePostingEventAccountsQuery(
    postingEventId,
    DIRECTION.Credit,
    Boolean(postingEventId)
  );
  const updateMutation = useUpdatePostingEventMutation();

  const { control, handleSubmit, reset, formState } = useForm<EditFormValues>({
    defaultValues: { effectiveDate: '', entries: [] },
  });
  const { fields } = useFieldArray({ control, name: 'entries' });

  /** 事务事件字段（来自 normalizedTargetFields 的 targetField/sourceField）。 */
  const transactionEventFields = React.useMemo(() => {
    return (event?.normalizedTargetFields ?? [])
      .map((field) => field.targetField || field.sourceField)
      .filter((field): field is string => Boolean(field));
  }, [event?.normalizedTargetFields]);

  /** 矩阵初始行（来自 mappings，按 sortOrder / direction 排序）。 */
  const initialEntries = React.useMemo<MatrixEntry[]>(
    () =>
      (event?.mappings ?? [])
        .slice()
        .sort(
          (a, b) =>
            (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
            (a.direction ?? 0) - (b.direction ?? 0)
        )
        .map((mapping) => ({
          drCr: mapping.direction === DIRECTION.Credit ? 'Cr' : 'Dr',
          account: formatAccountLabel(mapping.accountCode, mapping.accountName),
          method:
            mapping.mappingMethod === MAPPING_METHOD.Constant
              ? 'CONSTANT'
              : 'DIRECT',
          value: mapping.amountExpression || DEFAULT_AMOUNT_EXPRESSION,
        })),
    [event?.mappings]
  );

  const drOptions = React.useMemo(
    () => buildAccountOptions(drAccounts.data ?? []),
    [drAccounts.data]
  );
  const crOptions = React.useMemo(
    () => buildAccountOptions(crAccounts.data ?? []),
    [crAccounts.data]
  );

  /** 某 direction 的账户选项；API 空时回退到现有 entry 账户。 */
  const accountOptionsFor = React.useCallback(
    (drCr: 'Dr' | 'Cr'): Option[] => {
      const apiOptions = drCr === 'Dr' ? drOptions : crOptions;
      if (apiOptions.length) return apiOptions;
      const labels = new Set<string>();
      initialEntries.forEach((entry) => {
        if (entry.drCr === drCr && entry.account) labels.add(entry.account);
      });
      return Array.from(labels).map((label) => ({ label, value: label }));
    },
    [drOptions, crOptions, initialEntries]
  );

  const methodOptions = React.useMemo<Option[]>(
    () => [
      { label: t('mappingMethod.direct'), value: 'DIRECT' },
      { label: t('mappingMethod.constant'), value: 'CONSTANT' },
    ],
    [t]
  );

  const valueOptions = React.useMemo<Option[]>(() => {
    const values = new Set<string>();
    transactionEventFields.forEach((field) => values.add(field));
    initialEntries.forEach((entry) => {
      if (entry.value) values.add(entry.value);
    });
    return Array.from(values).map((value) => ({ label: value, value }));
  }, [transactionEventFields, initialEntries]);

  React.useEffect(() => {
    reset({
      effectiveDate: event?.effectiveDate
        ? formatDate(toMillis(event.effectiveDate) ?? event.effectiveDate, DATE_FMT)
        : '',
      entries: initialEntries,
    });
  }, [event, initialEntries, reset]);

  const sourceEventTypeLabel = React.useMemo(() => {
    if (event?.eventTypeName) return event.eventTypeName;
    const key = getSourceEventTypeMessageKey(event?.eventType);
    return key ? t(key) : EMPTY_DISPLAY;
  }, [event?.eventTypeName, event?.eventType, t]);

  const onSubmit = handleSubmit((values) => {
    if (!postingEventId || !event) return;

    const mappings = values.entries.map((entry, index) => {
      const { accountCode, accountName } = parseAccountLabel(entry.account);
      return {
        postingEventId,
        accountCode,
        accountName,
        direction:
          entry.drCr === 'Cr' ? DIRECTION.Credit : DIRECTION.Debit,
        mappingMethod:
          entry.method === 'CONSTANT'
            ? MAPPING_METHOD.Constant
            : MAPPING_METHOD.Direct,
        amountExpression: entry.value,
        sortOrder: index + 1,
      };
    });

    updateMutation.mutate(
      {
        postingEventId,
        eventCode: event.eventCode,
        eventType: event.eventType,
        versionId: event.versionId,
        effectiveDate: values.effectiveDate
          ? startOfDay(parseISO(values.effectiveDate)).getTime()
          : undefined,
        remarks: event.remarks,
        mappings,
      },
      { onSuccess: () => router.back() }
    );
  });

  if (!postingEventId) {
    return (
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">{t('detail.invalidId')}</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.back()}
        >
          {t('action.back')}
        </Button>
      </div>
    );
  }

  const submitting = updateMutation.isPending;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Basic information */}
      <section className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <div className="mb-6 text-base font-semibold">{t('edit.title')}</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              {t('detail.sourceEventType')}
            </label>
            <Input disabled value={sourceEventTypeLabel} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              {t('edit.effectiveDate')}
              <span className="ml-0.5 text-red-500">*</span>
            </label>
            <Controller
              control={control}
              name="effectiveDate"
              rules={{ required: true }}
              render={({ field }) => (
                <Input type="date" {...field} />
              )}
            />
            {formState.errors.effectiveDate ? (
              <p className="text-xs text-red-500">{t('edit.effectiveDate')}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('field.bookName')}</label>
            <Input disabled value={event?.bookName || EMPTY_DISPLAY} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('field.currency')}</label>
            <Input disabled value={event?.currencyCode || EMPTY_DISPLAY} />
          </div>
        </div>
      </section>

      {/* Transaction event fields */}
      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="mb-4 text-sm font-semibold">
          {t('detail.transactionEventFields')}
        </div>
        <div className="flex flex-wrap gap-2">
          {transactionEventFields.length ? (
            transactionEventFields.map((fieldKey) => (
              <span
                key={fieldKey}
                className="inline-flex items-center rounded-md border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground"
              >
                {fieldKey}
              </span>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">{t('empty')}</span>
          )}
        </div>
      </section>

      {/* Entry template (matrix) */}
      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="mb-4 text-sm font-semibold">
          {t('edit.entryTemplate')}
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[760px] overflow-hidden rounded-md border">
            <div className="grid grid-cols-[120px_1.5fr_1fr_1fr] bg-muted/30">
              <div className="px-4 py-3 text-sm font-medium">{t('edit.drCr')}</div>
              <div className="border-l px-4 py-3 text-sm font-medium">
                {t('edit.account')}
              </div>
              <div className="border-l px-4 py-3 text-sm font-medium">
                {t('edit.method')}
              </div>
              <div className="border-l px-4 py-3 text-sm font-medium">
                {t('edit.value')}
              </div>
            </div>

            {isLoading && !fields.length ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                {t('empty')}
              </div>
            ) : (
              fields.map((entry, index) => (
                <div
                  key={entry.id}
                  className={`grid grid-cols-[120px_1.5fr_1fr_1fr] ${
                    index === 0 ? '' : 'border-t'
                  }`}
                >
                  <div className="px-4 py-3">
                    <Input disabled value={entry.drCr} />
                  </div>
                  <div className="border-l px-4 py-3">
                    <Controller
                      control={control}
                      name={`entries.${index}.account`}
                      rules={{ required: true }}
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t('edit.account')} />
                          </SelectTrigger>
                          <SelectContent>
                            {accountOptionsFor(entry.drCr).map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div className="border-l px-4 py-3">
                    <Controller
                      control={control}
                      name={`entries.${index}.method`}
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t('edit.method')} />
                          </SelectTrigger>
                          <SelectContent>
                            {methodOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div className="border-l px-4 py-3">
                    <Controller
                      control={control}
                      name={`entries.${index}.value`}
                      rules={{ required: true }}
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled
                        >
                          <SelectValue placeholder={t('edit.value')} />
                          <SelectContent>
                            {valueOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={submitting}
        >
          {t('action.cancel')}
        </Button>
        <Button type="submit" disabled={submitting}>
          {t('action.save')}
        </Button>
      </div>
    </form>
  );
}
