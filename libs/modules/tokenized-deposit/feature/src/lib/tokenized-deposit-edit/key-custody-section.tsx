'use client';

import * as React from 'react';
import { type Control, Controller } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { KeyRound } from 'lucide-react';
import {
  Card,
  CardContent,
  Field,
  FieldGroup,
  FieldLabel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@myorg/shared/ui';

import type {
  KeyServiceOption,
  TDEditFormValues,
} from '@myorg/modules/tokenized-deposit/data-access';
import { Required, SectionHeading } from './ui/section-card';

/**
 * KeyCustodySection — 密钥托管服务选择区。
 *
 * 迁移自 td-manage `edit/KeyCustodySection.tsx`（48 行）。源全英文硬编码，本组件
 * i18n 化（key_custody_title / key_custody_label / key_custody_placeholder）。
 *
 * ## disabled 规则（严格保留源）
 *
 * - 编辑只读态（!!code && applyStatus===35）→ disabled。
 * - 否则：keyServiceList 为空或未加载 → disabled。
 *
 * ## 联动
 *
 * onChange → onKeyServiceChange（触发 useWalletManagement 重新派生 storageType/
 * walletAttribute/隐藏标志等）。
 */
export interface KeyCustodySectionProps {
  control: Control<TDEditFormValues>;
  hasCode: boolean;
  applyStatus?: number;
  keyServiceList?: KeyServiceOption[];
  onKeyServiceChange: (value: string) => void;
}

export function KeyCustodySection({
  control,
  hasCode,
  applyStatus,
  keyServiceList,
  onKeyServiceChange,
}: KeyCustodySectionProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');

  const isReadonly = hasCode && applyStatus === 35;
  const disabled =
    isReadonly || !keyServiceList || keyServiceList.length === 0;

  return (
    <Card>
      <SectionHeading
        icon={KeyRound}
        title={t('key_custody_title')}
        description={t('td_section_custody_desc')}
      />
      <CardContent className="py-6">
        <FieldGroup className="grid gap-5 md:grid-cols-3">
          <Controller
            control={control}
            name="keyServiceName"
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor="select-keyServiceName">
                  <Required />
                  {t('key_custody_label')}
                </FieldLabel>
                <Select
                  value={(field.value as string) ?? ''}
                  onValueChange={(v) => {
                    field.onChange(v);
                    onKeyServiceChange(v);
                  }}
                  disabled={disabled}
                >
                  <SelectTrigger id="select-keyServiceName" className="h-10 w-full bg-background">
                    <SelectValue placeholder={t('key_custody_placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {(keyServiceList ?? []).map((item) => (
                      <SelectItem
                        key={item.keyServiceCode ?? ''}
                        value={item.keyServiceCode ?? ''}
                      >
                        {item.keyServiceName ?? ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          />
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
