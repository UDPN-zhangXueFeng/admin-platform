'use client';

import * as React from 'react';
import { type Control, Controller } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { KeyRound } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Card,
  CardContent,
  Field,
  FieldError,
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
  /** Key Service 查询失败标志（inline 错误反馈，文档 14.5）。 */
  keyServiceError?: boolean;
  onKeyServiceChange: (value: string) => void;
  embedded?: boolean;
}

export function KeyCustodySection({
  control,
  hasCode,
  applyStatus,
  keyServiceList,
  keyServiceError = false,
  onKeyServiceChange,
  embedded = false,
}: KeyCustodySectionProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');

  const isReadonly = hasCode && applyStatus === 35;
  const disabled = isReadonly || !keyServiceList || keyServiceList.length === 0;

  return (
    <Card
      className={embedded ? 'rounded-none border-0 shadow-none' : undefined}
    >
      <SectionHeading
        icon={KeyRound}
        title={t('key_custody_title')}
        description={t('td_section_custody_desc')}
        embedded={embedded}
      />
      <CardContent className={embedded ? 'px-0 py-0' : 'py-6'}>
        <FieldGroup className="max-w-[40rem]">
          <Controller
            control={control}
            name="keyServiceName"
            rules={{ required: t('key_custody_required') }}
            render={({ field, fieldState }) => (
              <Field>
                <FieldLabel htmlFor="select-keyServiceName">
                  <Required />
                  {t('key_custody_label')}
                </FieldLabel>
                {keyServiceError ? (
                  <Alert variant="destructive">
                    <AlertTitle>{t('td_keyservice_empty_title')}</AlertTitle>
                    <AlertDescription>
                      {t('td_query_load_failed')}
                    </AlertDescription>
                  </Alert>
                ) : keyServiceList && keyServiceList.length === 0 ? (
                  <Alert variant="destructive">
                    <AlertTitle>{t('td_keyservice_empty_title')}</AlertTitle>
                    <AlertDescription>
                      {t('td_keyservice_empty_desc')}
                    </AlertDescription>
                  </Alert>
                ) : null}
                <Select
                  value={(field.value as string) ?? ''}
                  onValueChange={(v) => {
                    field.onChange(v);
                    onKeyServiceChange(v);
                  }}
                  disabled={disabled}
                >
                  <SelectTrigger
                    id="select-keyServiceName"
                    className="h-10 w-full bg-background"
                  >
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
                <FieldError>{fieldState.error?.message}</FieldError>
              </Field>
            )}
          />
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
