'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Upload } from 'lucide-react';
import { Input, Label, Textarea } from '@myorg/shared/ui';
import { BUSINESS_LICENSE_ACCEPT, DESCRIPTION_MAX_LENGTH, EMAIL_MAX_LENGTH, NAME_MAX_LENGTH, PHONE_MAX_LENGTH } from './constants';
import type { SpAccessBasicValues } from './sp-access-form-utils';

interface SpAccessFormBasicSectionProps {
  isEditMode: boolean;
  basic: SpAccessBasicValues;
  setBasic: React.Dispatch<React.SetStateAction<SpAccessBasicValues>>;
  description: string;
  setDescription: React.Dispatch<React.SetStateAction<string>>;
  licenseLoading: boolean;
  licensePreviewUrl: string | null;
  uploadingFile: boolean;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
}

export function SpAccessFormBasicSection({
  isEditMode,
  basic,
  setBasic,
  description,
  setDescription,
  licenseLoading,
  licensePreviewUrl,
  uploadingFile,
  onFileChange,
}: SpAccessFormBasicSectionProps) {
  const t = useTranslations('modules.sp-access');
  const tc = useTranslations('common');
  const updateBasic = (field: keyof SpAccessBasicValues, value: string) => {
    setBasic((previous) => ({ ...previous, [field]: value }));
  };

  return (
    <section className="rounded-lg border bg-card p-6">
      <h2 className="mb-4 text-lg font-semibold">{t('sp_access_0009')}</h2>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="sp-name">{t('sp_access_0000')}</Label>
          <Input id="sp-name" value={basic.spName} maxLength={NAME_MAX_LENGTH} disabled={isEditMode} placeholder={t('sp_access_0162')} onChange={(event) => updateBasic('spName', event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sp-type">{t('sp_access_0065')}</Label>
          <select id="sp-type" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={basic.spType} onChange={(event) => updateBasic('spType', event.target.value)}>
            {[1, 5, 10, 15, 20, 25].map((value) => <option key={value} value={value}>{t(`service_provider_type_${value}`)}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact-name">{t('sp_access_0039')}</Label>
          <Input id="contact-name" value={basic.contactName} maxLength={NAME_MAX_LENGTH} placeholder={t('sp_access_0163')} onChange={(event) => updateBasic('contactName', event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sp-email">{t('PUB_Email')}</Label>
          <Input id="sp-email" type="email" value={basic.email} maxLength={EMAIL_MAX_LENGTH} placeholder={t('sp_access_0164')} onChange={(event) => updateBasic('email', event.target.value)} />
          <p className="text-xs text-muted-foreground">{t('sp_access_0029')}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="sp-phone">{t('PUB_Phone')}</Label>
          <Input id="sp-phone" value={basic.phone} maxLength={PHONE_MAX_LENGTH} placeholder={t('sp_access_0165')} onChange={(event) => updateBasic('phone', event.target.value.replace(/[^+\d]/g, ''))} />
        </div>
        <div className="space-y-2">
          <Label>{t('sp_access_0041')}</Label>
          {isEditMode ? (
            <div className="text-sm">
              {licenseLoading ? <span className="text-muted-foreground">...</span> : licensePreviewUrl?.startsWith('data:image/') ? <img src={licensePreviewUrl} alt={t('sp_access_0041')} className="h-28 rounded border" /> : licensePreviewUrl?.startsWith('data:application/pdf') ? <iframe title={t('sp_access_0041')} src={licensePreviewUrl} className="h-40 w-full rounded border" /> : licensePreviewUrl ? <a href={licensePreviewUrl} target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">{t('sp_access_0167')}</a> : <span className="text-muted-foreground">{t('sp_access_0168')}</span>}
            </div>
          ) : (
            <div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent">
                <Upload className="h-4 w-4" />
                {uploadingFile ? tc('loading') : t('sp_access_0187')}
                <input type="file" className="sr-only" accept={BUSINESS_LICENSE_ACCEPT} onChange={onFileChange} />
              </label>
              <p className="mt-2 text-xs text-muted-foreground">{t('sp_access_0042')}</p>
            </div>
          )}
        </div>
        <div className="space-y-2 md:col-span-3">
          <Label htmlFor="sp-desc">{t('sp_access_0040')}</Label>
          <Textarea id="sp-desc" value={description} maxLength={DESCRIPTION_MAX_LENGTH} rows={4} placeholder={t('sp_access_0166')} onChange={(event) => setDescription(event.target.value)} />
          <p className="text-right text-xs text-muted-foreground">{description.length} / {DESCRIPTION_MAX_LENGTH}</p>
        </div>
      </div>
    </section>
  );
}
