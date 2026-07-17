'use client';

import * as React from 'react';
import {
  type Control,
  Controller,
  type UseFormGetValues,
  type UseFormSetValue,
} from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Info, KeyRound } from 'lucide-react';
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
 * AccountTypeSection — 账户类型选择区（Stablecoin/TD 分支用）。
 *
 * 迁移自 td-manage `edit/AccountTypeSection.tsx`（84 行）。antd Checkbox.Group →
 * 多个 Radix Checkbox + Controller（number[]）。
 *
 * ## 字段：accountTypeList（number[]）
 *
 * - value=1 永久 disabled（不可取消，源 Checkbox disabled 同）。
 * - value=2 可选。
 *
 * ## 联动（严格保留源）
 *
 * onChange 取消 value=2 时，清空 accountFeaturesList 中等于 2 的项
 * （`getValues('accountFeaturesList')` → filter → `setValue`）。
 * accountFeaturesList 为动态字段（不在 TDEditFormValues 严格类型内），用宽松 getValues/setValue。
 *
 * ## 只读
 *
 * `disabled = !!code && applyStatus===35`（Checkbox value=2 disabled）。
 */
export interface AccountTypeSectionProps {
  control: Control<TDEditFormValues>;
  setValue: UseFormSetValue<TDEditFormValues>;
  getValues: UseFormGetValues<TDEditFormValues>;
  hasCode: boolean;
  applyStatus?: number;
  embedded?: boolean;
}

export function AccountTypeSection({
  control,
  setValue,
  getValues,
  hasCode,
  applyStatus,
  embedded = false,
}: AccountTypeSectionProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');
  const disabled = hasCode && applyStatus === 35;

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
        description={t('td_section_account_desc')}
        embedded={embedded}
      />
      <CardContent className={embedded ? 'px-0 py-0' : 'py-6'}>
        <FieldGroup className="grid gap-5 md:grid-cols-2">
          <div>
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
                  // 取消 value=2 → 清 accountFeaturesList 中等于 2 的项（源 onChange 逻辑）。
                  if (type === 2 && !checked) {
                    const features = getValues(
                      'accountFeaturesList' as keyof TDEditFormValues,
                    ) as unknown as number[] | undefined;
                    const filtered = features?.filter((el) => el !== 2);
                    (setValue as (name: string, value: unknown) => void)(
                      'accountFeaturesList',
                      filtered,
                    );
                  }
                };
                return (
                  <FieldGroup>
                    <Field orientation="horizontal">
                      <Checkbox
                        id="account-type-1"
                        checked={value.includes(1)}
                        disabled
                        onCheckedChange={(c) => toggle(1, c === true)}
                      />
                      <FieldLabel htmlFor="account-type-1">
                        {t('td_account_type_1')}
                      </FieldLabel>
                    </Field>
                    <Field orientation="horizontal">
                      <Checkbox
                        id="account-type-2"
                        checked={value.includes(2)}
                        disabled={disabled}
                        onCheckedChange={(c) => toggle(2, c === true)}
                      />
                      <FieldLabel htmlFor="account-type-2">
                        {t('td_account_type_2')}
                      </FieldLabel>
                    </Field>
                  </FieldGroup>
                );
              }}
            />
            <div className="mt-4 text-sm text-primary">
              {t('tokenized_deposit_0106')}
            </div>
          </div>
          <div className="flex h-full rounded-lg border border-primary/30 bg-primary/5 p-4">
            <Info className="mr-3 h-5 w-5 shrink-0 text-primary" />
            <div className="flex-1 text-sm">
              <div className="mb-3">
                <span className="font-medium text-foreground">
                  {t('td_account_type_1') + ': '}
                </span>
                <span className="text-muted-foreground">
                  {t('tokenized_deposit_0108')}
                </span>
              </div>
              <div>
                <span className="font-medium text-foreground">
                  {t('td_account_type_2') + ': '}
                </span>
                <span className="text-muted-foreground">
                  {t('tokenized_deposit_0109')}
                </span>
              </div>
            </div>
          </div>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
