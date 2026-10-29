'use client';

import * as React from 'react';
import { type Control, Controller } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { HelpCircle, Network } from 'lucide-react';
import {
  Field,
  FieldGroup,
  FieldLabel,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@myorg/shared/ui';

import type {
  BlockchainOption,
  SmartContractOption,
  TDEditFormValues,
} from '@myorg/modules/td-admin/data-access';
import { Required, SectionHeading } from './ui/section-card';

/** Whitelist Mode 选项（partial/noWhitelist disabled，源同）。 */
const WHITELIST_MODE_OPTIONS = [
  { value: 'full', label: 'Full Whitelist' },
  { value: 'partial', label: 'Partial Whitelist', disabled: true },
  { value: 'noWhitelist', label: 'No Whitelist', disabled: true },
];

/**
 * NetworkContractFields — 「Network & contract」区（blockchain/smartContract/whitelist/metaType）。
 * 源: token-basic-info-section.tsx 37-42、437-609（纯代码搬移，逻辑/JSX 不变）。
 */
export interface NetworkContractFieldsProps {
  control: Control<TDEditFormValues>;
  isReadonly: boolean;
  chainType: string;
  blockchainList?: BlockchainOption[];
  smartContractNameList?: SmartContractOption[];
  onBlockchainChange: (value: string) => void;
}

export function NetworkContractFields({
  control,
  isReadonly,
  chainType,
  blockchainList,
  smartContractNameList,
  onBlockchainChange,
}: NetworkContractFieldsProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');

  return (
    <section className="border-t border-border pt-7">
      <SectionHeading
        icon={Network}
        title={t('td_section_network')}
        description={t('td_section_network_desc')}
        embedded
      />
      <FieldGroup className="grid gap-5 md:grid-cols-2">
        {/* blockchainId Select（逐项 disabled status!==1，onChange → onBlockchainChange） */}
        <Controller
          control={control}
          name="blockchainId"
          rules={{ required: true }}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="select-blockchainId">
                <Required />
                {t('tokenized_deposit_0007')}
              </FieldLabel>
              <Select
                value={(field.value as string) ?? ''}
                onValueChange={(v) => {
                  field.onChange(v);
                  onBlockchainChange(v);
                }}
                disabled={isReadonly}
              >
                <SelectTrigger
                  id="select-blockchainId"
                  className="h-10 w-full bg-background"
                >
                  <SelectValue placeholder={t('tokenized_deposit_0007')} />
                </SelectTrigger>
                <SelectContent>
                  {(blockchainList ?? []).map((item) => (
                    <SelectItem
                      key={item.key}
                      value={item.key}
                      disabled={item.status !== 1}
                    >
                      {item.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        />

        {/* smartContractPackageId Select */}
        <Controller
          control={control}
          name="smartContractPackageId"
          rules={{ required: true }}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="select-smartContractPackageId">
                <Required />
                {t('tokenized_deposit_0016')}
              </FieldLabel>
              <Select
                value={(field.value as string) ?? ''}
                onValueChange={field.onChange}
                disabled={isReadonly}
              >
                <SelectTrigger
                  id="select-smartContractPackageId"
                  className="h-10 w-full bg-background"
                >
                  <SelectValue placeholder={t('tokenized_deposit_0016')} />
                </SelectTrigger>
                <SelectContent>
                  {(smartContractNameList ?? []).map((item) => (
                    <SelectItem
                      key={String(item.key)}
                      value={String(item.key ?? '')}
                    >
                      {item.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        />

        {/* whitelistMode Select（partial/noWhitelist disabled） */}
        <Controller
          control={control}
          name="whitelistMode"
          rules={{ required: true }}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="select-whitelistMode">
                {t('tokenized_deposit_whitelist_mode')}
              </FieldLabel>
              <Select
                value={(field.value as string) ?? ''}
                onValueChange={field.onChange}
                disabled={isReadonly}
              >
                <SelectTrigger
                  id="select-whitelistMode"
                  className="h-10 w-full bg-background"
                >
                  <SelectValue
                    placeholder={t(
                      'tokenized_deposit_whitelist_mode_placeholder',
                    )}
                  />
                </SelectTrigger>
                <SelectContent>
                  {WHITELIST_MODE_OPTIONS.map((opt) => (
                    <SelectItem
                      key={opt.value}
                      value={opt.value}
                      disabled={opt.disabled}
                    >
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        />

        {/* metaType RadioGroup（5=Yes/1=No，disabled isReadonly||tron） */}
        <Controller
          control={control}
          name="metaType"
          rules={{
            required: true,
            validate: (value) => value !== undefined && value !== null,
          }}
          render={({ field }) => (
            <Field>
              <FieldLabel>
                <Required />
                {t('tokenized_deposit_0090')}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="size-4 cursor-help text-primary" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      {t('tokenized_deposit_0136')}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </FieldLabel>
              <RadioGroup
                id="field-metaType"
                value={field.value !== undefined ? String(field.value) : ''}
                onValueChange={(v) => field.onChange(Number(v))}
                disabled={isReadonly || chainType === 'tron'}
                className="flex gap-6"
              >
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="5" />
                  {t('PUB_Yes')}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="1" />
                  {t('PUB_No')}
                </label>
              </RadioGroup>
            </Field>
          )}
        />

      </FieldGroup>
    </section>
  );
}
