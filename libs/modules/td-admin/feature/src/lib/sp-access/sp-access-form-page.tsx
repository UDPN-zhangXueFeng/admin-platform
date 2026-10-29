'use client';

import * as React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@myorg/shared/ui';
import { SpAccessFormBasicSection } from './sp-access-form-basic-section';
import { SpAccessFormSecuritySection } from './sp-access-form-security-section';
import { SpAccessFormTokenSection } from './sp-access-form-token-section';
import { useSpAccessForm } from './use-sp-access-form';

export function SpAccessFormPage() {
  const form = useSpAccessForm();

  if (form.isEditMode && form.detailLoading) {
    return (
      <div className="space-y-4 p-6">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-lg border bg-card" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="icon" onClick={() => form.router.push('/sp-access')} aria-label={form.tc('PUB_GoBack')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-semibold">{form.isEditMode ? form.t('sp_access_0062') : form.t('sp_access_0050')}</h1>
      </div>

      <form onSubmit={form.onSubmit} className="space-y-6">
        <SpAccessFormBasicSection
          isEditMode={form.isEditMode}
          basic={form.basic}
          setBasic={form.setBasic}
          description={form.description}
          setDescription={form.setDescription}
          licenseLoading={form.licenseLoading}
          licensePreviewUrl={form.licensePreviewUrl}
          uploadingFile={form.uploadingFile}
          onFileChange={form.handleFileChange}
        />
        <SpAccessFormSecuritySection
          metaEnabled={form.metaEnabled}
          setMetaEnabled={form.setMetaEnabled}
          reconciliation={form.reconciliation}
          setReconciliation={form.setReconciliation}
          custodySelection={form.custodySelection}
          setCustodySelection={form.setCustodySelection}
        />
        <SpAccessFormTokenSection
          walletRules={form.walletRules}
          typeOptions={form.typeOptions}
          tokenConfigs={form.tokenConfigs}
          selectedTokenCount={form.selectedTokenCount}
          updateTokenConfig={form.updateTokenConfig}
          togglePermissionKey={form.togglePermissionKey}
        />

        {form.formError ? <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{form.formError}</div> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => form.router.push('/sp-access')} disabled={form.submitting || form.mutationPending}>{form.tc('cancel')}</Button>
          <Button type="submit" disabled={form.submitting || form.mutationPending || form.uploadingFile}>{form.submitting || form.mutationPending ? form.tc('loading') : form.isEditMode ? form.t('sp_access_0173') : form.tc('create')}</Button>
        </div>
      </form>
    </div>
  );
}
