'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Card, Checkbox, Label, RadioGroup, RadioGroupItem, Switch } from '@myorg/shared/ui';

interface SpAccessFormSecuritySectionProps {
  metaEnabled: boolean;
  setMetaEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  reconciliation: string;
  setReconciliation: (value: string) => void;
  custodySelection: string[];
  setCustodySelection: React.Dispatch<React.SetStateAction<string[]>>;
}

export function SpAccessFormSecuritySection({
  metaEnabled,
  setMetaEnabled,
  reconciliation,
  setReconciliation,
  custodySelection,
  setCustodySelection,
}: SpAccessFormSecuritySectionProps) {
  const t = useTranslations('modules.sp-access');
  const models = [
    { key: 'issuer', label: t('sp_access_0153'), description: t('sp_access_0156') },
    { key: 'sp', label: t('sp_access_0154'), description: t('sp_access_0157') },
    { key: 'end_user', label: t('sp_access_0155'), description: t('sp_access_0158') },
  ] as const;

  return (
    <>
      <Card className="p-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <Label>
              {t('sp_access_0147')}
              <span className="ml-0.5 text-destructive" aria-hidden="true">
                *
              </span>
            </Label>
            <div className="flex items-center gap-3">
              <Switch checked={metaEnabled} onCheckedChange={setMetaEnabled} aria-label={t('sp_access_0147')} aria-required="true" />
              <span className="text-sm text-muted-foreground">{metaEnabled ? t('PUB_Yes') : t('PUB_No')}</span>
            </div>
          </div>
          <div className="space-y-3">
            <Label>
              {t('sp_access_0148')}
              <span className="ml-0.5 text-destructive" aria-hidden="true">
                *
              </span>
            </Label>
            <RadioGroup value={reconciliation} onValueChange={setReconciliation} className="flex flex-wrap gap-4" aria-required="true">
              {[['1', 'sp_access_0150'], ['2', 'sp_access_0151'], ['3', 'sp_access_0152']].map(([value, key]) => (
                <label key={value} className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value={value} />
                  {t(key)}
                </label>
              ))}
            </RadioGroup>
            <p className="text-xs text-muted-foreground">
              {reconciliation === '1' ? t('sp_access_0117') : reconciliation === '2' ? t('sp_access_0118') : t('sp_access_0119')}
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-1 text-lg font-semibold">{t('sp_access_0067')}</h2>
        <p className="mb-4 text-sm text-muted-foreground">{t('sp_access_0179')}</p>
        <div className="grid gap-3 md:grid-cols-3">
          {models.map((model) => (
            <label key={model.key} className={`flex cursor-pointer flex-col gap-2 rounded-md border p-4 ${custodySelection.includes(model.key) ? 'border-primary' : ''}`}>
              <span className="flex items-center gap-2">
                <Checkbox checked={custodySelection.includes(model.key)} onCheckedChange={(checked) => setCustodySelection((previous) => checked ? [...previous, model.key] : previous.filter((item) => item !== model.key))} />
                <span className="text-sm font-medium">{model.label}</span>
              </span>
              <span className="text-xs text-muted-foreground">{model.description}</span>
            </label>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-1 text-lg font-semibold">{t('sp_access_0149')}</h2>
        <p className="mb-4 text-sm text-muted-foreground">{t('sp_access_0178')}</p>
        <div className="flex flex-wrap gap-10">
          {[
            {
              label: 'sp_access_0180',
              aria: 'sp_access_0180',
              description: 'sp_access_0200',
            },
            {
              label: 'sp_access_0181',
              aria: 'sp_access_0181',
              description: 'sp_access_0201',
            },
          ].map((policy) => (
            <div key={policy.label} className="flex items-start gap-3">
              <Switch checked disabled aria-label={t(policy.aria)} />
              <div>
                <p className="text-sm font-medium">{t(policy.label)}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t(policy.description)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
