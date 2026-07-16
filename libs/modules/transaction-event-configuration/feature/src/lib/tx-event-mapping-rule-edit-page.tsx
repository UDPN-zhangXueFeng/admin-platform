'use client';

import * as React from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { addDays, format, parseISO, startOfDay } from 'date-fns';
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@myorg/shared/ui';
import {
  useNormalizationDetailQuery,
  useSourceFieldsQuery,
  useUpdateNormalizationEventMutation,
  type SaveNormalizationMapping,
} from '@myorg/modules/transaction-event-configuration/data-access';
import {
  EMPTY_DISPLAY,
  EMPTY_FIELD_VALUE,
  FIXED_FIELD_ORDER,
  MAPPING_METHOD_VALUE,
  ORGANIZATION_CODE_FIELD,
  getSourceEventTypeByEventType,
  getSourceEventTypeMessageKey,
  getMappingMethodLabel,
  isSystemBuiltinMapping,
  normalizeTimestamp,
  shouldSubmitSourceField,
} from '@myorg/modules/transaction-event-configuration/util';

type MappingMethodKey = 'DIRECT' | 'CONSTANT' | 'GENERATE';

/** 字段 → 模块 i18n key（与 basic-info tab 一致，迁移自源 FIELD_LABEL_KEY_MAP）。 */
const FIELD_LABEL_KEY: Record<string, string> = {
  UniversalTransactionIdentifier: 'field.utIdentifier',
  UserUniversalIdentifier: 'field.userIdentifier',
  TokenName: 'field.tokenName',
  TransactionDate: 'field.transactionDate',
  ValueDate: 'field.valueDate',
  FinalityDate: 'field.finalityDate',
  OrganizationCode: 'field.organizationCode',
  TokenType: 'field.tokenType',
  Blockchain: 'field.blockchain',
  From: 'field.from',
  To: 'field.to',
  TransactionAmount: 'field.transactionAmount',
  TransactionHash: 'field.transactionHash',
  TransactionTime: 'field.transactionTime',
  Status: 'field.status',
};

interface OptionalMappingRow {
  targetFieldKey: string;
  mappingMethod: MappingMethodKey;
  sourceFieldKey: string;
  description: string;
}

interface EditFormValues {
  effectiveDate: string;
  organizationCode: string;
  optionalMappings: OptionalMappingRow[];
}

interface Option {
  label: string;
  value: string;
}

interface FixedRow {
  key: string;
  fieldLabelKey: string;
  mappingMethodLabel: string;
  sourceFieldDisplay: string;
  remarks: string;
  isOrganizationCode: boolean;
}

function parseId(raw?: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function methodNumToKey(method?: number): MappingMethodKey {
  if (method === MAPPING_METHOD_VALUE.CONSTANT) return 'CONSTANT';
  if (method === MAPPING_METHOD_VALUE.GENERATE) return 'GENERATE';
  return 'DIRECT';
}

/**
 * TxEventMappingRuleEditPage — Mapping Rule 编辑页（最复杂表单）。
 *
 * 迁移自 td-manage `mapping-rule/edit.tsx`（870 行）。1:1 保留：
 *   - 加载详情（detail）+ 源字段下拉（source-fields）。
 *   - 基本信息区：mappingRuleId / sourceEventType（只读）+ effectiveDate（必须 > today）。
 *   - 固定映射行（FIXED_FIELD_ORDER，只读；OrganizationCode 例外 → organizationCode 输入）。
 *   - 可选映射行（useFieldArray 动态）：targetFieldKey / mappingMethod / sourceFieldKey
 *     （仅 DIRECT 可编辑）/ description / 删除。
 *   - 保存：buildSubmitMappings（fixed + optional，DIRECT 才带 sourceField，
 *     OrganizationCode → fieldValue + remarks）+ update API。
 */
export function TxEventMappingRuleEditPage() {
  const t = useTranslations('modules.transaction-event-configuration');
  const router = useRouter();
  const searchParams = useSearchParams();
  const normalizationEventId = parseId(searchParams.get('id'));
  const bookId = searchParams.get('bookId') ?? '';

  const { data: detail, isLoading } =
    useNormalizationDetailQuery(normalizationEventId);
  const sourceFields = useSourceFieldsQuery(
    detail?.eventType !== undefined && normalizationEventId
      ? { eventType: detail.eventType, normalizationEventId }
      : null
  );
  const updateMutation = useUpdateNormalizationEventMutation();

  const { control, handleSubmit, reset, setValue, formState } =
    useForm<EditFormValues>({
      defaultValues: {
        effectiveDate: '',
        organizationCode: '',
        optionalMappings: [],
      },
    });
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'optionalMappings',
  });

  const detailMappings = detail?.mappings ?? [];

  const sourceFieldLabelMap = React.useMemo(() => {
    const m = new Map<string, string>();
    (sourceFields.data ?? []).forEach((f) => {
      if (f.fieldName) m.set(f.fieldName, f.fieldDesc || f.fieldName);
    });
    detailMappings.forEach((item) => {
      if (item.sourceField && !m.has(item.sourceField)) {
        m.set(item.sourceField, item.sourceField);
      }
    });
    return m;
  }, [sourceFields.data, detailMappings]);

  const sourceFieldOptions = React.useMemo<Option[]>(
    () =>
      Array.from(sourceFieldLabelMap.entries()).map(([value, label]) => ({
        value,
        label,
      })),
    [sourceFieldLabelMap]
  );

  const mappingMethodOptions = React.useMemo<Option[]>(
    () => [
      { label: t('mappingMethod.direct'), value: 'DIRECT' },
      { label: t('mappingMethod.constant'), value: 'CONSTANT' },
      { label: t('mappingMethod.generate'), value: 'GENERATE' },
    ],
    [t]
  );

  const fixedRows = React.useMemo<FixedRow[]>(() => {
    return FIXED_FIELD_ORDER.map((fieldKey) => {
      const existed = detailMappings.find((m) => m.mappingField === fieldKey);
      const showSource = shouldSubmitSourceField(existed?.mappingMethod);
      return {
        key: fieldKey,
        fieldLabelKey: FIELD_LABEL_KEY[fieldKey] ?? fieldKey,
        mappingMethodLabel: getMappingMethodLabel(existed?.mappingMethod),
        sourceFieldDisplay: showSource
          ? sourceFieldLabelMap.get(existed?.sourceField ?? '') ||
            existed?.sourceField ||
            EMPTY_FIELD_VALUE
          : EMPTY_FIELD_VALUE,
        remarks: existed?.remarks ?? EMPTY_FIELD_VALUE,
        isOrganizationCode: fieldKey === ORGANIZATION_CODE_FIELD,
      };
    });
  }, [detailMappings, sourceFieldLabelMap]);

  React.useEffect(() => {
    if (!detail || !normalizationEventId) return;
    const organizationField = detailMappings.find(
      (m) => m.mappingField === ORGANIZATION_CODE_FIELD
    );
    const effectiveTs = normalizeTimestamp(detail.effectiveDate);
    const initialOptional: OptionalMappingRow[] = detailMappings
      .filter((m) => !isSystemBuiltinMapping(m))
      .sort((a, b) => (a.orderNum ?? 0) - (b.orderNum ?? 0))
      .map((m) => ({
        targetFieldKey: m.mappingField ?? '',
        mappingMethod: methodNumToKey(m.mappingMethod),
        sourceFieldKey: m.sourceField ?? '',
        description: m.remarks ?? '',
      }));
    reset({
      effectiveDate: effectiveTs ? format(new Date(effectiveTs), 'yyyy-MM-dd') : '',
      organizationCode: organizationField?.remarks ?? '',
      optionalMappings: initialOptional,
    });
  }, [detail, normalizationEventId, detailMappings, reset]);

  const todayYmd = format(new Date(), 'yyyy-MM-dd');
  const minEffectiveYmd = format(addDays(new Date(), 1), 'yyyy-MM-dd');

  const mappingRuleIdDisplay = detail
    ? detail.eventCode ||
      detail.versionId ||
      (detail.normalizationEventId
        ? String(detail.normalizationEventId)
        : EMPTY_DISPLAY)
    : EMPTY_DISPLAY;
  const sourceEventKey = getSourceEventTypeMessageKey(
    getSourceEventTypeByEventType(detail?.eventType),
    bookId
    );
  const sourceEventTypeDisplay = sourceEventKey ? t(sourceEventKey) : EMPTY_DISPLAY;

  const buildSubmitMappings = (
    values: EditFormValues
  ): SaveNormalizationMapping[] => {
    const eid = detail?.normalizationEventId;
    if (!eid) return [];

    const fixedMappings: SaveNormalizationMapping[] = FIXED_FIELD_ORDER.map(
      (fieldKey, index) => {
        const existed = detailMappings.find((m) => m.mappingField === fieldKey);
        const mappingMethod =
          existed?.mappingMethod ??
          (fieldKey === ORGANIZATION_CODE_FIELD
            ? MAPPING_METHOD_VALUE.CONSTANT
            : MAPPING_METHOD_VALUE.DIRECT);
        const item: SaveNormalizationMapping = {
          normalizationEventId: eid,
          mappingField: fieldKey,
          mappingMethod,
          orderNum: existed?.orderNum ?? index + 1,
          systemBuiltin: existed?.systemBuiltin ?? 1,
        };
        if (shouldSubmitSourceField(mappingMethod)) {
          item.sourceField = existed?.sourceField || fieldKey;
        }
        if (fieldKey === ORGANIZATION_CODE_FIELD) {
          item.fieldValue = values.organizationCode;
          if (values.organizationCode) item.remarks = values.organizationCode;
        } else if (existed?.remarks) {
          item.remarks = existed.remarks;
        }
        return item;
      }
    );

    const maxOrderNum = detailMappings.reduce(
      (max, m) => Math.max(max, m.orderNum ?? 0),
      0
    );
    const optionalMappings: SaveNormalizationMapping[] = values.optionalMappings.map(
      (row, index) => {
        const existed = detailMappings.find(
          (m) => m.mappingField === row.targetFieldKey
        );
        const mappingMethod = MAPPING_METHOD_VALUE[row.mappingMethod];
        const result: SaveNormalizationMapping = {
          normalizationEventId: eid,
          mappingField: row.targetFieldKey,
          mappingMethod,
          remarks: row.description,
          orderNum: existed?.orderNum ?? maxOrderNum + index + 1,
          systemBuiltin: existed?.systemBuiltin ?? 2,
        };
        if (shouldSubmitSourceField(mappingMethod) && row.sourceFieldKey) {
          result.sourceField = row.sourceFieldKey;
        }
        return result;
      }
    );

    return [...fixedMappings, ...optionalMappings];
  };

  const onSubmit = handleSubmit((values) => {
    if (!detail?.normalizationEventId) return;
    updateMutation.mutate(
      {
        normalizationEventId: detail.normalizationEventId,
        eventCode: detail.eventCode,
        eventType: detail.eventType,
        effectiveDate: values.effectiveDate
          ? startOfDay(parseISO(values.effectiveDate)).getTime()
          : undefined,
        mappings: buildSubmitMappings(values),
      },
      { onSuccess: () => router.back() }
    );
  });

  if (!normalizationEventId) {
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
      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="mb-6 text-base font-semibold">
          {t('edit.basicInfoTitle')}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('field.mappingRuleId')}</label>
            <Input disabled value={mappingRuleIdDisplay} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              {t('field.sourceEventType')}
            </label>
            <Input disabled value={sourceEventTypeDisplay} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              {t('field.effectiveDate')}
              <span className="ml-0.5 text-red-500">*</span>
            </label>
            <Controller
              control={control}
              name="effectiveDate"
              rules={{
                required: true,
                validate: (v) => !v || v > todayYmd,
              }}
              render={({ field }) => (
                <Input type="date" min={minEffectiveYmd} {...field} />
              )}
            />
            <p className="text-xs text-muted-foreground">
              {t('edit.effectiveDateHint')}
            </p>
            {formState.errors.effectiveDate ? (
              <p className="text-xs text-red-500">
                {t('edit.invalidEffectiveDate')}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {/* Field mapping */}
      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="mb-4 text-base font-semibold">
          {t('edit.fieldMappingTitle')}
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[820px] overflow-hidden rounded-md border">
            <div className="grid grid-cols-[1.3fr_1fr_1.2fr_1.45fr_40px] bg-muted/30">
              <div className="px-4 py-3 text-sm font-medium">
                {t('field.targetField')}
                <span className="ml-0.5 text-red-500">*</span>
              </div>
              <div className="border-l px-4 py-3 text-sm font-medium">
                {t('field.mappingMethod')}
                <span className="ml-0.5 text-red-500">*</span>
              </div>
              <div className="border-l px-4 py-3 text-sm font-medium">
                {t('field.sourceField')}
                <span className="ml-0.5 text-red-500">*</span>
              </div>
              <div className="border-l px-4 py-3 text-sm font-medium">
                {t('field.description')}
              </div>
              <div className="border-l" />
            </div>

            {isLoading && !fields.length && !fixedRows.length ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                {t('empty')}
              </div>
            ) : (
              <>
                {fixedRows.map((row) => (
                  <div
                    key={`fixed-${row.key}`}
                    className="grid grid-cols-[1.3fr_1fr_1.2fr_1.45fr_40px] border-t"
                  >
                    <div className="px-4 py-3">
                      <Input disabled value={t(row.fieldLabelKey)} />
                    </div>
                    <div className="border-l px-4 py-3">
                      <Input disabled value={row.mappingMethodLabel} />
                    </div>
                    <div className="border-l px-4 py-3">
                      <Input disabled value={row.sourceFieldDisplay} />
                    </div>
                    <div className="border-l px-4 py-3">
                      {row.isOrganizationCode ? (
                        <Controller
                          control={control}
                          name="organizationCode"
                          rules={{ required: true, maxLength: 500 }}
                          render={({ field }) => (
                            <Input
                              maxLength={500}
                              placeholder={t('field.organizationCode')}
                              {...field}
                            />
                          )}
                        />
                      ) : (
                        <Input disabled value={row.remarks} />
                      )}
                    </div>
                    <div />
                  </div>
                ))}

                {fields.map((entry, index) => (
                  <div
                    key={entry.id}
                    className="grid grid-cols-[1.3fr_1fr_1.2fr_1.45fr_40px] border-t"
                  >
                    <div className="px-4 py-3">
                      <Controller
                        control={control}
                        name={`optionalMappings.${index}.targetFieldKey`}
                        rules={{ required: true, maxLength: 100 }}
                        render={({ field }) => (
                          <Input
                            maxLength={100}
                            placeholder={t('field.targetField')}
                            {...field}
                          />
                        )}
                      />
                    </div>
                    <div className="border-l px-4 py-3">
                      <Controller
                        control={control}
                        name={`optionalMappings.${index}.mappingMethod`}
                        rules={{ required: true }}
                        render={({ field }) => (
                          <Select
                            value={field.value}
                            onValueChange={(v) => {
                              field.onChange(v);
                              if (v !== 'DIRECT') {
                                setValue(
                                  `optionalMappings.${index}.sourceFieldKey`,
                                  ''
                                );
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={t('field.mappingMethod')} />
                            </SelectTrigger>
                            <SelectContent>
                              {mappingMethodOptions.map((option) => (
                                <SelectItem
                                  key={option.value}
                                  value={option.value}
                                >
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
                        name={`optionalMappings.${index}.mappingMethod`}
                        render={({ field: methodField }) =>
                          methodField.value === 'DIRECT' ? (
                            <Controller
                              control={control}
                              name={`optionalMappings.${index}.sourceFieldKey`}
                              rules={{ required: true }}
                              render={({ field }) => (
                                <Select
                                  value={field.value}
                                  onValueChange={field.onChange}
                                >
                                  <SelectTrigger>
                                    <SelectValue
                                      placeholder={t('field.sourceField')}
                                    />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {sourceFieldOptions.map((option) => (
                                      <SelectItem
                                        key={option.value}
                                        value={option.value}
                                      >
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            />
                          ) : (
                            <Input disabled value={EMPTY_FIELD_VALUE} />
                          )
                        }
                      />
                    </div>
                    <div className="border-l px-4 py-3">
                      <Controller
                        control={control}
                        name={`optionalMappings.${index}.description`}
                        rules={{ required: true, maxLength: 500 }}
                        render={({ field }) => (
                          <Input
                            maxLength={500}
                            placeholder={t('field.description')}
                            {...field}
                          />
                        )}
                      />
                    </div>
                    <div className="flex items-center justify-center border-l">
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-red-500"
                        onClick={() => remove(index)}
                        aria-label={t('action.remove')}
                      >
                        ✕
                      </Button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="mt-4"
          onClick={() =>
            append({
              targetFieldKey: '',
              mappingMethod: 'DIRECT',
              sourceFieldKey: '',
              description: '',
            })
          }
        >
          {t('action.add')}
        </Button>
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
