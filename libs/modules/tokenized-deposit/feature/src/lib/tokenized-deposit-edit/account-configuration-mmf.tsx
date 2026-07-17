'use client';

import * as React from 'react';
import {
  type Control,
  Controller,
  type UseFormSetValue,
} from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { KeyRound } from 'lucide-react';
import {
  Card,
  CardContent,
  Checkbox,
  Field,
  FieldGroup,
  FieldLabel,
} from '@myorg/shared/ui';

import type { TDEditFormValues } from '@myorg/modules/tokenized-deposit/data-access';
import { SectionHeading } from './ui/section-card';

/**
 * AccountConfigurationMMF — MMF 账户配置区（mintMethod===20 分支用）。
 *
 * 迁移自 td-manage `src/pages/tokenized-deposit/_accountConfigurationMMF.tsx`（77 行）。
 *
 * ## 行为（严格保留源）
 *
 * - accountTypeList 固定为 [3]（Yield-Bearing），mount 时 `setValue('accountTypeList', [3])`。
 * - value=3 的 Checkbox 永久 disabled（不可取消，源 Checkbox disabled 同）。
 * - onChange 取消 value=2 时清 accountFeaturesList（与 AccountTypeSection 同款联动，源同）。
 *   实际场景 value 只可能是 [3]，此分支保留以对齐源结构。
 */
export interface AccountConfigurationMMFProps {
  control: Control<TDEditFormValues>;
  setValue: UseFormSetValue<TDEditFormValues>;
  hasCode: boolean;
  applyStatus?: number;
  embedded?: boolean;
}

export function AccountConfigurationMMF({
  control,
  setValue,
  embedded = false,
}: AccountConfigurationMMFProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');

  // mount 时固定 accountTypeList=[3]（源 useEffect [] 同）。
  React.useEffect(() => {
    (setValue as (name: string, value: unknown) => void)('accountTypeList', [
      3,
    ]);
  }, [setValue]);

  return (
    <Card
      className={
        embedded
          ? 'rounded-none border-x-0 border-b-0 border-t pt-7 shadow-none'
          : undefined
      }
    >
      <SectionHeading
        icon={KeyRound}
        title={t('tokenized_deposit_0105')}
        description={t('td_section_account_desc_mmf')}
        embedded={embedded}
      />
      <CardContent className={embedded ? 'px-0 py-0' : 'py-6'}>
        <FieldGroup>
          <Controller
            control={control}
            name="accountTypeList"
            rules={{ required: true }}
            render={({ field }) => {
              const value = (field.value as number[]) ?? [];
              const toggle = (type: number, checked: boolean) => {
                const next = checked
                  ? Array.from(new Set([...value, type]))
                  : value.filter((el) => el !== type);
                field.onChange(next);
                if (type === 2 && !checked) {
                  (setValue as (name: string, value: unknown) => void)(
                    'accountFeaturesList',
                    [],
                  );
                }
              };
              return (
                <Field orientation="horizontal">
                  <Checkbox
                    id="account-type-mmf"
                    checked={value.includes(3)}
                    disabled
                    onCheckedChange={(c) => toggle(3, c === true)}
                  />
                  <FieldLabel htmlFor="account-type-mmf">
                    {t('td_account_type_3')}
                  </FieldLabel>
                </Field>
              );
            }}
          />
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
