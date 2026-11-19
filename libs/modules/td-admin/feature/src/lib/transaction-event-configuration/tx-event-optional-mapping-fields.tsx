'use client';

import { Controller, useWatch, type UseFormReturn } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import {
  Button,
  Input,
  SearchableSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  type SearchableSelectOption,
} from '@myorg/shared/ui';
import { EMPTY_FIELD_VALUE } from './tx-event-config.constants';
import type { EditFormValues } from './tx-event-mapping-rule-form';

const METHODS = ['DIRECT', 'CONSTANT', 'GENERATE'] as const;

export function OptionalMappingFields({ form, index, options, loading, onRemove }: {
  form: Pick<UseFormReturn<EditFormValues>, 'control' | 'setValue' | 'clearErrors' | 'getValues'>;
  index: number;
  options: readonly SearchableSelectOption[];
  loading: boolean;
  onRemove: () => void;
}) {
  const t = useTranslations('modules.transaction-event-configuration');
  const { control, setValue, clearErrors, getValues } = form;
  const prefix = `optionalMappings.${index}` as const;
  const methodName = `${prefix}.mappingMethod` as const;
  const sourceName = `${prefix}.sourceFieldKey` as const;
  const method = useWatch({ control, name: methodName });
  const required = t('edit.required');

  return (
    <div className="grid grid-cols-[1.3fr_1fr_1.2fr_1.45fr_40px] border-t">
      <div className="px-4 py-3">
        <Controller control={control} name={`${prefix}.targetFieldKey`}
          rules={{ required, maxLength: { value: 100, message: t('edit.maxLength', { count: 100 }) } }}
          render={({ field, fieldState }) => (
            <>
              <Input maxLength={100} aria-label={t('field.targetField')} placeholder={t('field.targetField')} {...field} />
              {fieldState.error && <p role="alert" className="text-xs text-destructive">{fieldState.error.message}</p>}
            </>
          )}
        />
      </div>
      <div className="border-l px-4 py-3">
        <Controller control={control} name={methodName} rules={{ required }}
          render={({ field, fieldState }) => (
            <>
              <Select value={field.value} onValueChange={(value) => {
                field.onChange(value);
                if (value !== 'DIRECT') {
                  setValue(sourceName, '');
                  clearErrors(sourceName);
                }
              }}>
                <SelectTrigger aria-label={t('field.mappingMethod')}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METHODS.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                </SelectContent>
              </Select>
              {fieldState.error && <p role="alert" className="text-xs text-destructive">{fieldState.error.message}</p>}
            </>
          )}
        />
      </div>
      <div className="border-l px-4 py-3">
        <Controller control={control} name={sourceName}
          rules={{ validate: (value) => getValues(methodName) !== 'DIRECT' || Boolean(value) || required }}
          render={({ field, fieldState }) => method === 'DIRECT' ? (
            <>
              <label className="sr-only" htmlFor={`${prefix}-source`}>{t('field.sourceField')}</label>
              <SearchableSelect id={`${prefix}-source`} options={options} value={field.value} onValueChange={field.onChange}
                disabled={loading} placeholder={t('field.sourceField')}
                searchPlaceholder={t('field.searchSourceField')} emptyMessage={t('empty')} />
              {field.value && <Button type="button" variant="ghost" size="xs" onClick={() => field.onChange('')}>{t('action.clear')}</Button>}
              {fieldState.error && <p role="alert" className="text-xs text-destructive">{fieldState.error.message}</p>}
            </>
          ) : <Input aria-label={t('field.sourceField')} disabled value={EMPTY_FIELD_VALUE} />}
        />
      </div>
      <div className="border-l px-4 py-3">
        <Controller control={control} name={`${prefix}.description`}
          rules={{ required, maxLength: { value: 500, message: t('edit.maxLength', { count: 500 }) } }}
          render={({ field, fieldState }) => (
            <>
              <Input maxLength={500} aria-label={t('field.description')} placeholder={t('field.description')} {...field} />
              {fieldState.error && <p role="alert" className="text-xs text-destructive">{fieldState.error.message}</p>}
            </>
          )}
        />
      </div>
      <div className="flex items-center justify-center border-l">
        <Button type="button" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={onRemove} aria-label={t('action.remove')}>✕</Button>
      </div>
    </div>
  );
}
