'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Checkbox, Label, RadioGroup, RadioGroupItem, Switch } from '@myorg/shared/ui';

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
      <section className="rounded-lg border bg-card p-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <Label>{t('sp_access_0147')}</Label>
            <div className="flex items-center gap-3">
              <Switch checked={metaEnabled} onCheckedChange={setMetaEnabled} aria-label={t('sp_access_0147')} />
              <span className="text-sm text-muted-foreground">{metaEnabled ? t('PUB_Yes') : t('PUB_No')}</span>
            </div>
          </div>
          <div className="space-y-3">
            <Label>{t('sp_access_0148')}</Label>
            <RadioGroup value={reconciliation} onValueChange={setReconciliation} className="flex flex-wrap gap-4">
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
      </section>

      <section className="rounded-lg border bg-card p-6">
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
      </section>

      <section className="rounded-lg border bg-card p-6">
        <h2 className="mb-1 text-lg font-semibold">{t('sp_access_0149')}</h2>
        <p className="mb-4 text-sm text-muted-foreground">{t('sp_access_0178')}</p>
        <div className="flex flex-wrap gap-10">
          {[['sp_access_0180', 'sp_access_0180'], ['sp_access_0181', 'sp_access_0181']].map(([label, aria]) => (
            <div key={label} className="flex items-start gap-3">
              <Switch checked disabled aria-label={t(aria)} />
              <p className="text-sm font-medium">{t(label)}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
