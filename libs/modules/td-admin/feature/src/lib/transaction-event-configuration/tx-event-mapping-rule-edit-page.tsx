'use client';

import * as React from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { addDays, format, parseISO, startOfDay } from 'date-fns';
import { Button, Card, Input, PageHeader } from '@myorg/shared/ui';
import { toast } from 'sonner';
import {
  useNormalizationDetailQuery,
  useSourceFieldsQuery,
  useUpdateNormalizationEventMutation,
} from '@myorg/modules/td-admin/data-access';
import {
  EMPTY_DISPLAY,
  MAPPING_METHOD_VALUE,
  ORGANIZATION_CODE_FIELD,
  getSourceEventTypeByEventType,
  getSourceEventTypeMessageKey,
  isSystemBuiltinMapping,
  normalizeTimestamp,
} from '.';

import { buildSubmitMappings, orderMappings, type EditFormValues, type OptionalMappingRow } from './tx-event-mapping-rule-form';
import { OptionalMappingFields } from './tx-event-optional-mapping-fields';
import { MappingFieldsCard } from './tx-event-mapping-fields-card';

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


interface Option {
  label: string;
  value: string;
}


function parseId(raw?: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n > 0 ? n : undefined;
}

function methodNumToKey(method?: number): OptionalMappingRow['mappingMethod'] {
  if (method === MAPPING_METHOD_VALUE.CONSTANT) return 'CONSTANT';
  if (method === MAPPING_METHOD_VALUE.GENERATE) return 'GENERATE';
  return 'DIRECT';
}

export function TxEventMappingRuleEditPage() {
  const t = useTranslations('modules.transaction-event-configuration');
  const router = useRouter();
  const searchParams = useSearchParams();
  const normalizationEventId = parseId(searchParams.get('id'));
  const bookId = searchParams.get('bookId') ?? '';

  const { data: detail, isLoading, error } =
    useNormalizationDetailQuery(normalizationEventId);
  const sourceFields = useSourceFieldsQuery(
    detail?.eventType !== undefined && normalizationEventId
      ? { eventType: detail.eventType, normalizationEventId }
      : null
  );
  const updateMutation = useUpdateNormalizationEventMutation();

  const form = useForm<EditFormValues>({
    defaultValues: { effectiveDate: '', organizationCode: '', optionalMappings: [] },
  });
  const { control, handleSubmit, reset, formState } = form;
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'optionalMappings',
  });

  const detailMappings = React.useMemo(() => detail?.mappings ?? [], [detail?.mappings]);

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

  React.useEffect(() => {
    if (!detail || !normalizationEventId) return;
    const organizationField = detailMappings.find(
      (m) => m.mappingField === ORGANIZATION_CODE_FIELD
    );
    const effectiveTs = normalizeTimestamp(detail.effectiveDate);
    const initialOptional: OptionalMappingRow[] = detailMappings
      .filter((m) => typeof m.mappingField === 'string' && !isSystemBuiltinMapping(m))
      .sort(orderMappings)
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

  const inFlight = React.useRef(false);
  const onSubmit = handleSubmit(async (values) => {
    if (!detail?.normalizationEventId || inFlight.current) return;
    inFlight.current = true;
    try {
      await updateMutation.mutateAsync({
        normalizationEventId: detail.normalizationEventId,
        eventCode: detail.eventCode,
        eventType: detail.eventType,
        effectiveDate: startOfDay(parseISO(values.effectiveDate)).getTime(),
        mappings: buildSubmitMappings(detail.normalizationEventId, detailMappings, values),
      });
      toast.success(t('submitSucceeded'));
      router.back();
    } catch {
      // The mutation error stays visible in the form for correction or retry.
    } finally {
      inFlight.current = false;
    }
  });

  if (!normalizationEventId) {
    return (
      <div className="space-y-4">
        <PageHeader
          title={t('mappingRuleEdit')}
          backLabel={t('action.back')}
          onBack={() => router.back()}
        />
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">{t('detail.invalidId')}</p>
        </Card>
      </div>
    );
  }

  const submitting = updateMutation.isPending;

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-4">
      <PageHeader
        title={t('mappingRuleEdit')}
        backLabel={t('action.back')}
        onBack={() => router.back()}
      />
      {[error, sourceFields.error, updateMutation.error].filter(Boolean).map((failure, index) => (
        <p key={index} role="alert" className="text-sm text-destructive">{failure?.message}</p>
      ))}
      {/* Basic information */}
      <Card className="p-6">
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
            <label htmlFor="normalization-effective-date" className="text-sm font-medium">
              {t('field.effectiveDate')}
              <span className="ml-0.5 text-destructive">*</span>
            </label>
            <Controller
              control={control}
              name="effectiveDate"
              rules={{
                required: t('edit.required'),
                validate: (value) => value > todayYmd || t('edit.invalidEffectiveDate'),
              }}
              render={({ field }) => (
                <Input id="normalization-effective-date" type="date" min={minEffectiveYmd} {...field} />
              )}
            />
            <p className="text-xs text-muted-foreground">
              {t('edit.effectiveDateHint')}
            </p>
            {formState.errors.effectiveDate ? (
              <p role="alert" className="text-xs text-destructive">
                {formState.errors.effectiveDate.message}
              </p>
            ) : null}
          </div>
        </div>
      </Card>

      <MappingFieldsCard
        control={control}
        mappings={detail ? detailMappings : undefined}
        fieldLabels={FIELD_LABEL_KEY}
        sourceLabels={sourceFieldLabelMap}
        loading={isLoading}
        actions={
          <Button type="button" variant="outline" className="mt-4" disabled={!detail || submitting}
            onClick={() => append({ targetFieldKey: '', mappingMethod: 'DIRECT', sourceFieldKey: '', description: '' })}>
            {t('action.add')}
          </Button>
        }
      >
        {fields.map((entry, index) => (
          <OptionalMappingFields key={entry.id} form={form} index={index}
            options={sourceFieldOptions} loading={sourceFields.isLoading}
            onRemove={() => remove(index)} />
        ))}
      </MappingFieldsCard>

      <div className="flex justify-end">
        <Button type="submit" disabled={!detail || submitting || formState.isSubmitting}>
          {t('action.submit')}
        </Button>
      </div>
    </form>
  );
}
