'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Checkbox, Input, Label, Switch } from '@myorg/shared/ui';
import type { SpAccessTypeOption, SpAccessWalletRule } from '@myorg/modules/td-admin/data-access';
import { buildPermissionKey, type TokenConfigState } from './sp-access-form-utils';

interface SpAccessFormTokenSectionProps {
  walletRules: SpAccessWalletRule[];
  typeOptions: SpAccessTypeOption[];
  tokenConfigs: Record<string, TokenConfigState>;
  selectedTokenCount: number;
  updateTokenConfig: (stablecoinId: string, updater: (current: TokenConfigState) => TokenConfigState) => void;
  togglePermissionKey: (
    stablecoinId: string,
    field: 'apiPermissionKeys' | 'contractPermissionKeys',
    key: string,
    checked: boolean,
  ) => void;
}

export function SpAccessFormTokenSection({
  walletRules,
  typeOptions,
  tokenConfigs,
  selectedTokenCount,
  updateTokenConfig,
  togglePermissionKey,
}: SpAccessFormTokenSectionProps) {
  const t = useTranslations('modules.sp-access');
  const [tokenKeyword, setTokenKeyword] = React.useState('');
  const filteredRules = React.useMemo(() => {
    const keyword = tokenKeyword.trim().toLowerCase();
    return walletRules.filter((rule) =>
      !keyword ||
      `${rule.name ?? ''} ${rule.blockchainName ?? ''}`.toLowerCase().includes(keyword),
    );
  }, [tokenKeyword, walletRules]);
  const groupedRules = React.useMemo(() => {
    const groups = new Map<number, SpAccessWalletRule[]>();
    filteredRules.forEach((rule) => {
      const type = Number(rule.tokenType) || 0;
      groups.set(type, [...(groups.get(type) ?? []), rule]);
    });
    return Array.from(groups.entries());
  }, [filteredRules]);
  const allSelected = walletRules.length > 0 && walletRules.every((rule) => tokenConfigs[String(rule.stablecoinId)]?.enabled);
  const setAllSelected = (enabled: boolean) => {
    walletRules.forEach((rule) => {
      updateTokenConfig(String(rule.stablecoinId), (current) => ({ ...current, enabled }));
    });
  };

  const renderPermissions = (key: string, config: TokenConfigState, field: 'apiPermissionKeys' | 'contractPermissionKeys') => (
    <div className="space-y-3 rounded-md border p-4">
      <p className="text-sm font-medium">{field === 'apiPermissionKeys' ? t('sp_access_0064') : t('sp_access_0047')}</p>
      {typeOptions.map((typeOption) => (
        <div key={`${field}-${typeOption.accessConfId}`} className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{typeOption.name ?? t('sp_access_0046')}</p>
          <div className="grid gap-2 md:grid-cols-2">
            {walletRules.find((rule) => String(rule.stablecoinId) === key)?.walletRules.map((walletOption) => {
              const ruleId = Number(walletOption.walletRuleId);
              const permissionKey = buildPermissionKey(typeOption.accessConfId, ruleId);
              const disabled = walletOption.state === 0 || (field === 'contractPermissionKeys' && !config.contractAddress.trim());
              return (
                <label key={`${permissionKey}-${field}`} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={config[field].has(permissionKey)}
                    disabled={disabled}
                    onCheckedChange={(checked) => togglePermissionKey(key, field, permissionKey, Boolean(checked))}
                  />
                  <span>{walletOption.name ?? '--'}</span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  const renderTokenCard = (rule: SpAccessWalletRule) => {
    const key = String(rule.stablecoinId);
    const config = tokenConfigs[key];
    if (!config?.enabled) return null;
    return (
      <div key={key} className="rounded-md border p-4">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded bg-muted text-xs font-semibold">
            T{Number(rule.tokenType) || ''}
          </span>
          <div>
            <p className="font-semibold">{rule.name ?? '--'}</p>
            <p className="text-xs text-muted-foreground">{t('sp_access_0068')}{rule.blockchainName ?? '--'}</p>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-3 rounded-md bg-muted/30 p-4">
            <div className="flex items-center justify-between"><p className="font-semibold">{t('sp_access_0064')}</p><Switch checked disabled aria-label={t('sp_access_0064')} /></div>
            <Label htmlFor={`${key}-wallet`}>{t('sp_access_0045')}</Label>
            <Input id={`${key}-wallet`} value={config.walletAddress} placeholder={t('sp_access_0192')} onChange={(event) => updateTokenConfig(key, (previous) => ({ ...previous, walletAddress: event.target.value }))} />
            {renderPermissions(key, config, 'apiPermissionKeys')}
            <Label htmlFor={`${key}-webhook`}>{t('sp_access_0159')}</Label>
            <Input id={`${key}-webhook`} value={config.webhookUrl} placeholder={t('sp_access_0193')} onChange={(event) => updateTokenConfig(key, (previous) => ({ ...previous, webhookUrl: event.target.value }))} />
          </div>
          <div className="space-y-3 rounded-md bg-muted/30 p-4">
            <div className="flex items-center justify-between"><p className="font-semibold">{t('sp_access_0048')}</p><Switch checked disabled aria-label={t('sp_access_0048')} /></div>
            <Label htmlFor={`${key}-contract`}>{t('sp_access_0048')}</Label>
            <Input
              id={`${key}-contract`}
              value={config.contractAddress}
              placeholder={t('sp_access_0192')}
              onChange={(event) => {
                const value = event.target.value;
                updateTokenConfig(key, (previous) => ({ ...previous, contractAddress: value, contractPermissionKeys: value.trim() ? previous.contractPermissionKeys : new Set<string>() }));
              }}
            />
            {renderPermissions(key, config, 'contractPermissionKeys')}
            <p className="rounded bg-primary/5 px-3 py-2 text-xs text-muted-foreground">{t('sp_access_0194')}</p>
          </div>
          <div className="space-y-3 rounded-md bg-muted/30 p-4">
            <div className="flex items-center justify-between"><p className="font-semibold">{t('sp_access_0110')}</p><Switch checked={false} disabled aria-label={t('sp_access_0110')} /></div>
            <p className="text-xs text-muted-foreground">{t('sp_access_0195')}</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <section className="rounded-lg border bg-card p-6">
      <div className="mb-1 flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">{t('sp_access_0063')}</h2><span className="text-sm text-muted-foreground">{t('sp_access_0184')}: {selectedTokenCount}</span></div>
      <p className="mb-4 text-sm text-muted-foreground">{t('sp_access_0043')}</p>
      <div className="grid gap-6 lg:grid-cols-[minmax(220px,1fr)_minmax(0,3fr)]">
        <div className="rounded-md border p-4">
          <Input value={tokenKeyword} onChange={(event) => setTokenKeyword(event.target.value)} placeholder={t('sp_access_0188')} />
          <label className="mt-4 flex items-center gap-2 text-sm"><Checkbox checked={allSelected} onCheckedChange={(checked) => setAllSelected(Boolean(checked))} />{t('sp_access_0189')}</label>
          <div className="mt-4 max-h-[520px] space-y-4 overflow-auto pr-1">
            {groupedRules.map(([type, rules]) => (
              <div key={type}><p className="mb-2 text-sm font-semibold">{type ? t(`token_type_${type}`) : t('sp_access_0044')}</p><div className="space-y-2">
                {rules.map((rule) => {
                  const key = String(rule.stablecoinId);
                  const enabled = tokenConfigs[key]?.enabled ?? false;
                  return <label key={key} className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-sm ${enabled ? 'border-primary bg-primary/5' : ''}`}><Checkbox checked={enabled} onCheckedChange={(checked) => updateTokenConfig(key, (current) => ({ ...current, enabled: Boolean(checked) }))} /><span>{rule.name ?? '--'}{rule.blockchainName ? ` (${rule.blockchainName})` : ''}</span></label>;
                })}
              </div></div>
            ))}
          </div>
        </div>
        <div className="rounded-md border border-dashed p-4">
          <div className="mb-4 flex items-center justify-between text-sm font-medium"><span>{t('sp_access_0184')} ({selectedTokenCount})</span><button type="button" className="text-primary underline-offset-4 hover:underline" onClick={() => setAllSelected(false)}>{t('sp_access_0190')}</button></div>
          {selectedTokenCount === 0 ? <p className="text-sm text-muted-foreground">{t('sp_access_0196')}</p> : <div className="space-y-6">{walletRules.map(renderTokenCard)}</div>}
        </div>
      </div>
    </section>
  );
}
