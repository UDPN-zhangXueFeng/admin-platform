'use client';

import * as React from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { toast } from 'sonner';
import { Button } from '@myorg/shared/ui';
import {
  useBillRuleDetailQuery,
  useBillSubjectListQuery,
  useBillTokenListQuery,
  useInterestTxTypeQuery,
  useSaveBillRuleMutation,
  useSaveBillSubjectMutation,
  type LoanRule,
  type SaveBillRuleDTO,
  type TxTypeRule,
} from '@myorg/modules/td-admin/data-access';
import {
  EMPTY_DISPLAY,
  getTxTypesByTokenType,
  resolveLendingTypeMessageKey,
  resolveTxTypeMessageKey,
} from '.';

function parseId(raw: string | null | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

interface FormValues {
  ledgerName: string;
  stablecoinId: string;
  txTypeItems: TxTypeRule[];
}

/** 按 tokenType 构建初始 txTypeItems（每 txType 含 Dr/Cr 两行）。 */
function buildInitialTxTypeItems(tokenType?: number): TxTypeRule[] {
  return getTxTypesByTokenType(tokenType).map((tx) => ({
    txType: tx,
    loanRuleList: [
      makeEmptyLoanRule(tx, 1),
      makeEmptyLoanRule(tx, 2),
    ],
  }));
}

function makeEmptyLoanRule(txType: number, loanType: number): LoanRule {
  return {
    txType,
    loanType,
    subjectCode: '',
    subjectTitle: '',
    subjectCategory: '',
    amountDesc: '',
  };
}

/**
 * JournalEntriesForm — 记账规则表单（edit.tsx 896 行，迄今最复杂动态表单）。
 *
 * 迁移自 td-manage edit.tsx。antd Form.List 嵌套 → RHF useFieldArray 嵌套
 * （txTypeItems 外层 + loanRuleList 内层 Dr/Cr）。token 选择联动 txTypeItems 初始化；
 * 科目 Select 联动 subjectTitle/subjectCategory；edit 回显；add/edit 保存。
 *
 * 科目编码可直接输入并通过 subjectSave 保存；保存成功后刷新科目下拉。
 */
export function JournalEntriesForm({
  ruleIdRaw,
}: {
  ruleIdRaw?: string | null;
}) {
  const t = useTranslations('modules.journal-entries');
  const tc = useTranslations('common');
  const router = useRouter();
  const ruleId = parseId(ruleIdRaw);
  const isEdit = Boolean(ruleId);

  const detailQuery = useBillRuleDetailQuery(ruleId, isEdit);
  const tokenListQuery = useBillTokenListQuery();
  const saveMutation = useSaveBillRuleMutation();
  const saveSubjectMutation = useSaveBillSubjectMutation();

  const { control, register, handleSubmit, reset, watch, setValue } =
    useForm<FormValues>({
      defaultValues: { ledgerName: '', stablecoinId: '', txTypeItems: [] },
    });
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'txTypeItems',
  });

  const currentStablecoinId = watch('stablecoinId');
  const interestTxTypeQuery = useInterestTxTypeQuery(
    currentStablecoinId || undefined,
    Boolean(currentStablecoinId),
  );
  const subjectListQuery = useBillSubjectListQuery(
    currentStablecoinId || undefined,
    Boolean(currentStablecoinId),
  );

  const tokenOptions = tokenListQuery.data ?? [];

  /** token 选择 → 初始化 txTypeItems（按 tokenType）。 */
  const onTokenChange = (value: string) => {
    setValue('stablecoinId', value);
    const token = tokenOptions.find((t) => String(t.stablecoinId) === value);
    if (token) {
      setValue('txTypeItems', buildInitialTxTypeItems(token.tokenType));
    }
  };

  // edit 回显 / create 默认选第一个 token。
  React.useEffect(() => {
    if (isEdit && detailQuery.data) {
      const d = detailQuery.data;
      reset({
        ledgerName: d.ledgerName ?? '',
        stablecoinId: String(d.stablecoinId ?? ''),
        txTypeItems: d.txBillRuleList ?? [],
      });
    } else if (!isEdit && tokenOptions.length && !watch('stablecoinId')) {
      const first = tokenOptions[0];
      reset({
        ledgerName: '',
        stablecoinId: String(first.stablecoinId ?? ''),
        txTypeItems: buildInitialTxTypeItems(first.tokenType),
      });
    }
  }, [isEdit, detailQuery.data, tokenOptions.length, reset]);

  const subjectOptions = (subjectListQuery.data ?? []).map((s) => ({
    value: s.subjectCode ?? '',
    label: `${s.subjectCode ?? ''} - ${s.subjectTitle ?? ''}`,
  }));

  const onSubjectChange = (index: number, j: number, code: string) => {
    const subject = (subjectListQuery.data ?? []).find(
      (s) => s.subjectCode === code,
    );
    setValue(`txTypeItems.${index}.loanRuleList.${j}.subjectCode`, code);
    setValue(
      `txTypeItems.${index}.loanRuleList.${j}.subjectTitle`,
      subject?.subjectTitle ?? '',
    );
    setValue(
      `txTypeItems.${index}.loanRuleList.${j}.subjectCategory`,
      subject?.subjectCategory ?? '',
    );
  };

  const onSubjectSave = async (index: number, j: number) => {
    const rule = watch(`txTypeItems.${index}.loanRuleList.${j}`);
    const stablecoinId =
      currentStablecoinId || String(detailQuery.data?.stablecoinId ?? '');
    const subjectCode = (rule?.subjectCode ?? '').trim();
    const subjectTitle = (rule?.subjectTitle ?? '').trim();

    if (
      !stablecoinId ||
      !/^[0-9]+(\.[0-9]{1,100})?$/.test(subjectCode) ||
      !subjectTitle
    ) {
      toast.error(t('subjectSaveInvalid'));
      return;
    }

    try {
      await saveSubjectMutation.mutateAsync({
        stablecoinId,
        subjectCode,
        subjectTitle,
        subjectCategory: (rule?.subjectCategory ?? '').trim(),
      });
      await subjectListQuery.refetch();
      toast.success(t('operateSuccess'));
    } catch {
      toast.error(tc('common_task_status_40'));
    }
  };

  const onSubmit = (v: FormValues) => {
    const dto: SaveBillRuleDTO = {
      ruleId: ruleId,
      ledgerName: v.ledgerName,
      stablecoinId: v.stablecoinId,
      txBillRuleList: v.txTypeItems,
    };
    saveMutation.mutate(dto, {
      onSuccess: () => {
        toast.success(t('operateSuccess'));
        router.back();
      },
      onError: () => toast.error(tc('common_task_status_40')),
    });
  };

  if (isEdit && detailQuery.isLoading) {
    return (
      <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground shadow-sm">
        {t('detail.title')}
      </div>
    );
  }

  const detail = detailQuery.data;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* 基本信息 */}
      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="mb-4 text-base font-semibold">
          {isEdit ? t('action.edit') : t('action.add')}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              {t('field.ledgerName')}
              <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              {...register('ledgerName', { required: true })}
              disabled={isEdit}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              {t('field.tokenName')}
              <span className="text-red-500">*</span>
            </label>
            {isEdit ? (
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                disabled
                value={detail?.tokenName ?? ''}
              />
            ) : (
              <Controller
                control={control}
                name="stablecoinId"
                rules={{ required: true }}
                render={({ field }) => (
                  <select
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    value={field.value}
                    onChange={(e) => onTokenChange(e.target.value)}
                  >
                    {tokenOptions.map((tk) => (
                      <option
                        key={tk.stablecoinId}
                        value={String(tk.stablecoinId)}
                      >
                        {tk.tokenName}
                      </option>
                    ))}
                  </select>
                )}
              />
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('field.tokenType')}</label>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              disabled
              value={
                isEdit
                  ? detail?.tokenType != null
                    ? t(resolveTxTypeMessageKey(detail.tokenType) ?? '')
                    : ''
                  : ''
              }
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('field.currency')}</label>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              disabled
              value={
                isEdit
                  ? detail?.currencySymbol ?? ''
                  : tokenOptions.find(
                      (tk) => String(tk.stablecoinId) === currentStablecoinId,
                    )?.currencySymbol ?? ''
              }
            />
          </div>
        </div>
      </section>

      {/* txTypeItems 动态（外层 useFieldArray）*/}
      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="mb-4 text-base font-semibold">{t('field.txType')}</div>
        <div className="space-y-4">
          {fields.map((item, i) => (
            <TxTypeSection
              key={item.id}
              index={i}
              control={control}
              register={register}
              watch={watch}
              onSubjectChange={onSubjectChange}
              onSubjectSave={onSubjectSave}
              subjectSavePending={saveSubjectMutation.isPending}
              subjectOptions={subjectOptions}
              removeSection={() => remove(i)}
            />
          ))}
        </div>
        {interestTxTypeQuery.data?.length ? (
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={() => {
              const tx = interestTxTypeQuery.data?.[0];
              if (tx) {
                append({
                  txType: tx.transactionType ?? 0,
                  loanRuleList: [
                    makeEmptyLoanRule(tx.transactionType ?? 0, 1),
                    makeEmptyLoanRule(tx.transactionType ?? 0, 2),
                  ],
                });
              }
            }}
          >
            {t('action.add')}
          </Button>
        ) : null}
      </section>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          {t('action.back')}
        </Button>
        <Button type="submit" disabled={saveMutation.isPending}>
          {t('action.submit')}
        </Button>
      </div>
    </form>
  );
}

interface TxTypeSectionProps {
  index: number;
  control: ReturnType<typeof useForm<FormValues>>['control'];
  register: ReturnType<typeof useForm<FormValues>>['register'];
  watch: ReturnType<typeof useForm<FormValues>>['watch'];
  onSubjectChange: (index: number, j: number, code: string) => void;
  onSubjectSave: (index: number, j: number) => void;
  subjectSavePending: boolean;
  subjectOptions: { value: string; label: string }[];
  removeSection: () => void;
}

/** 单个 txType 区块（内层 loanRuleList useFieldArray，Dr/Cr 行）。 */
function TxTypeSection({
  index,
  control,
  register,
  watch,
  onSubjectChange,
  onSubjectSave,
  subjectSavePending,
  subjectOptions,
  removeSection,
}: TxTypeSectionProps) {
  const t = useTranslations('modules.journal-entries');
  const { fields, append, remove } = useFieldArray({
    control,
    name: `txTypeItems.${index}.loanRuleList` as const,
  });

  const txType = watch(`txTypeItems.${index}.txType`);
  const txTypeLabel = txType != null ? t(resolveTxTypeMessageKey(txType) ?? '') : '';

  return (
    <div className="rounded-md border p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-medium">
          {t('field.txType')}: {txTypeLabel || EMPTY_DISPLAY}
        </div>
        {index >= 6 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-red-600"
            onClick={removeSection}
          >
            ✕
          </Button>
        ) : null}
      </div>
      <div className="space-y-2">
        {fields.map((f, j) => (
          <div key={f.id} className="grid grid-cols-6 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">
                {t('field.loanType')}
              </label>
              <Controller
                control={control}
                name={`txTypeItems.${index}.loanRuleList.${j}.loanType` as const}
                render={({ field }) => (
                  <select
                    className="w-full rounded-md border px-2 py-1.5 text-xs"
                    value={field.value}
                    onChange={field.onChange}
                  >
                    {[1, 2].map((lt) => (
                      <option key={lt} value={lt}>
                        {t(resolveLendingTypeMessageKey(lt) ?? '')}
                      </option>
                    ))}
                  </select>
                )}
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">
                {t('field.subjectCode')}
              </label>
              <div className="flex gap-1">
                <input
                  list={`journal-subject-options-${index}-${j}`}
                  className="min-w-0 flex-1 rounded-md border px-2 py-1.5 text-xs"
                  value={watch(
                    `txTypeItems.${index}.loanRuleList.${j}.subjectCode`,
                  )}
                  onChange={(e) => onSubjectChange(index, j, e.target.value)}
                />
                <datalist id={`journal-subject-options-${index}-${j}`}>
                  {subjectOptions.map((o) => (
                    <option key={o.value} value={o.value} label={o.label} />
                  ))}
                </datalist>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 px-2"
                  disabled={subjectSavePending}
                  onClick={() => onSubjectSave(index, j)}
                >
                  {t('action.save')}
                </Button>
              </div>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">
                {t('field.subjectTitle')}
              </label>
              <input
                className="w-full rounded-md border px-2 py-1.5 text-xs"
                {...register(
                  `txTypeItems.${index}.loanRuleList.${j}.subjectTitle` as const,
                )}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">
                {t('field.subjectCategory')}
              </label>
              <input
                className="w-full rounded-md border px-2 py-1.5 text-xs"
                {...register(
                  `txTypeItems.${index}.loanRuleList.${j}.subjectCategory` as const,
                )}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">
                {t('field.amountDesc')}
              </label>
              <input
                className="w-full rounded-md border px-2 py-1.5 text-xs"
                {...register(
                  `txTypeItems.${index}.loanRuleList.${j}.amountDesc` as const,
                )}
              />
            </div>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3"
        onClick={() =>
          append(makeEmptyLoanRule(txType ?? 0, 1))
        }
      >
        + {t('field.loanType')}
      </Button>
      {fields.length > 2 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-2 text-red-600"
          onClick={() => remove(fields.length - 1)}
        >
          ✕
        </Button>
      ) : null}
    </div>
  );
}
