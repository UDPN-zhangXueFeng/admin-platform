'use client';

import type { ReactNode } from 'react';
import { Controller, type Control } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Card, Input } from '@myorg/shared/ui';
import type { NormalizationEventMapping } from '@myorg/modules/td-admin/data-access';
import {
  EMPTY_FIELD_VALUE,
  ORGANIZATION_CODE_FIELD,
  getMappingMethodLabel,
  isSystemBuiltinMapping,
  shouldSubmitSourceField,
} from './tx-event-config.constants';
import { orderMappings, type EditFormValues } from './tx-event-mapping-rule-form';

const COLUMN_GRID = 'grid grid-cols-[1.3fr_1fr_1.2fr_1.45fr_40px]';

export function MappingFieldsCard({ control, mappings, fieldLabels, sourceLabels, loading, children, actions }: {
  control: Control<EditFormValues>;
  mappings: NormalizationEventMapping[] | undefined;
  fieldLabels: Record<string, string>;
  sourceLabels: ReadonlyMap<string, string>;
  loading: boolean;
  children: ReactNode;
  actions: ReactNode;
}) {
  const t = useTranslations('modules.transaction-event-configuration');
  const rows = mappings?.filter(isSystemBuiltinMapping).sort(orderMappings);
  const required = t('edit.required');

  return (
    <Card className="p-6">
      <div className="mb-4 text-base font-semibold">{t('edit.fieldMappingTitle')}</div>
      <div className="overflow-x-auto">
        <div className="min-w-[820px] overflow-hidden rounded-md border">
          <div className={`${COLUMN_GRID} bg-muted/30`}>
            {(['targetField', 'mappingMethod', 'sourceField', 'description'] as const).map((column, index) => (
              <div key={column} className={`px-4 py-3 text-sm font-medium ${index ? 'border-l' : ''}`}>
                {t(`field.${column}`)}
                {index < 3 && <span className="ml-0.5 text-destructive">*</span>}
              </div>
            ))}
            <div className="border-l" />
          </div>
          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t('loading')}</p>
          ) : (
            <>
              {rows?.map(({ mappingField, mappingMethod, sourceField, remarks, normalizationEventMappingId }, index) => {
                const key = mappingField || EMPTY_FIELD_VALUE;
                const source = shouldSubmitSourceField(mappingMethod) && sourceField
                  ? sourceLabels.get(sourceField) || sourceField : EMPTY_FIELD_VALUE;
                return (
                  <div key={normalizationEventMappingId ?? index} className={`${COLUMN_GRID} border-t`}>
                    <div className="px-4 py-3"><Input disabled value={fieldLabels[key] ? t(fieldLabels[key]) : key} /></div>
                    <div className="border-l px-4 py-3"><Input disabled value={getMappingMethodLabel(mappingMethod)} /></div>
                    <div className="border-l px-4 py-3"><Input disabled value={source} /></div>
                    <div className="border-l px-4 py-3">
                      {key === ORGANIZATION_CODE_FIELD ? (
                        <Controller control={control} name="organizationCode"
                          rules={{ required, maxLength: { value: 500, message: t('edit.maxLength', { count: 500 }) } }}
                          render={({ field, fieldState }) => (
                            <>
                              <Input maxLength={500} aria-label={t('field.organizationCode')} placeholder={t('field.organizationCode')} {...field} />
                              {fieldState.error && <p role="alert" className="text-xs text-destructive">{fieldState.error.message}</p>}
                            </>
                          )}
                        />
                      ) : <Input disabled value={remarks || EMPTY_FIELD_VALUE} />}
                    </div>
                    <div />
                  </div>
                );
              })}
              {children}
            </>
          )}
        </div>
      </div>
      {actions}
    </Card>
  );
}
