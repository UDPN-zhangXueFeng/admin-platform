/**
 * KeyServiceConfigurationEditPage — read-only edit preview backed by real data.
 *
 * The upstream edit.tsx is a prototype: it backfills hardcoded mock data
 * (including sample credentials) for every id and its Submit is a
 * console.log TODO. The live backend exposes no Key-service write API
 * (only the four read-only POSTs under /v1/key/config), so this page:
 * - loads the REAL service detail via POST /api/manage/v1/key/config/detail;
 * - renders every field disabled (no fake edit affordance, no fake success);
 * - shows an explicit banner that submission is unavailable;
 * - never echoes values (potentially credentials) to the console.
 * - masks credential-like parameter values (private key / password /
 *   token / secret / API key) behind an explicit per-value reveal toggle;
 * Source layout: td-manage .../key-service-configuration/edit.tsx.
 */

'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Eye, EyeOff, Info } from 'lucide-react';

import {
  MASKED_VALUE,
  isSensitiveParameterKey,
} from './key-service-configuration-sensitive';

import {
  Button,
  Checkbox,
  Input,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@myorg/shared/ui';
import { useRouter } from '@myorg/shared/util-i18n';

import {
  useKeyServiceConfigurationDetailQuery,
  type KeyServiceDetail,
} from '@myorg/modules/td-admin/data-access';

/** Localized label for a numeric access-parameter type (mirrors detail page). */
function useParameterTypeLabel() {
  const t = useTranslations('modules.key-management');
  return React.useCallback(
    (type?: number) => {
      if (type === undefined || type === null) return '--';
      if (type === 1) return t('key_management_0066');
      if (type === 5) return t('key_management_0023');
      if (type === 10) return t('key_management_0024');
      return t('key_management_0064', { value: type });
    },
    [t],
  );
}

function ReadOnlyField({
  id,
  label,
  value,
  placeholder,
  required,
}: {
  id: string;
  label: string;
  value?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium" htmlFor={id}>
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </label>
      <Input id={id} value={value ?? ''} placeholder={placeholder} disabled />
    </div>
  );
}

export function KeyServiceConfigurationEditPage() {
  const t = useTranslations('modules.key-management');
  const router = useRouter();
  const searchParams = useSearchParams();
  const parameterTypeLabel = useParameterTypeLabel();

  const keyServiceCode = searchParams.get('id') ?? undefined;
  const { data: detail, isLoading, isError, error } =
    useKeyServiceConfigurationDetailQuery(keyServiceCode);

  // Wallet attributes derive from the real record — the wire has no boolean
  // flags, presence of a group id is the source of truth. [INFERENCE]
  const hotWallet = Boolean(detail?.hotWalletGroupId);
  const coldWallet = Boolean(detail?.coldWalletGroupId);
  const descriptionLength = detail?.description?.length ?? 0;
  // Sensitive parameter values (credentials) render masked until the
  // operator explicitly reveals one; values are never logged anywhere.
  const [revealedParamIds, setRevealedParamIds] = React.useState<Set<string>>(
    () => new Set(),
  );
  const toggleParamReveal = (id: string) =>
    setRevealedParamIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  const renderBody = (d: KeyServiceDetail) => (
    <>
      {/* ---------- Block 1: Edit Key Service Configuration ---------- */}
      <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <h2 className="mb-2 text-base font-bold">
          Edit Key Service Configuration
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Configure a descriptive name for your Key service.
        </p>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ReadOnlyField
            id="key-service-name"
            label="Key Service Name"
            value={d.keyServiceName}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Wallet Attribute */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Wallet Attribute
              <span className="ml-0.5 text-destructive">*</span>
            </label>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2">
                <Checkbox checked={hotWallet} disabled />
                <span className="text-sm">Hot Wallet</span>
              </label>
              <div className="flex items-center gap-1">
                <label className="flex items-center gap-2">
                  <Checkbox checked={coldWallet} disabled />
                  <span className="text-sm">Cold Wallet</span>
                </label>
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label="Cold wallet info"
                        className="text-muted-foreground"
                      >
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Cold wallet requires additional security measures
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>

          {/* Wallet Group ID */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Wallet Group ID
              <span className="ml-0.5 text-destructive">*</span>
            </label>
            <div className="flex flex-col gap-2">
              {hotWallet ? (
                <ReadOnlyField
                  id="hot-wallet-group-id"
                  label=""
                  value={d.hotWalletGroupId}
                />
              ) : null}
              {coldWallet ? (
                <ReadOnlyField
                  id="cold-wallet-group-id"
                  label=""
                  value={d.coldWalletGroupId}
                />
              ) : null}
              {!hotWallet && !coldWallet ? '--' : null}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="description">
              Description
            </label>
            <Textarea
              id="description"
              rows={3}
              maxLength={200}
              value={d.description ?? ''}
              disabled
            />
            <div className="flex justify-end">
              <span className="text-xs text-muted-foreground">
                {descriptionLength}/200
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ---------- Block 2: Access Configuration ---------- */}
      <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <h2 className="mb-2 text-base font-bold">Access Configuration</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Configure the Key service parameters required for access. Empty
          fields will be ignored.
        </p>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ReadOnlyField
            id="url"
            label="URL"
            required
            value={d.url}
          />
        </div>

        <div className="mb-4 mt-6 text-sm font-medium">Parameters</div>

        <div className="mb-2 grid grid-cols-12 gap-4 text-sm text-muted-foreground">
          <div className="col-span-3">Parameter Type</div>
          <div className="col-span-3">Parameter Key</div>
          <div className="col-span-5">Parameter Value</div>
          <div className="col-span-1" />
        </div>

        {(d.accessParameters ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">--</p>
        ) : (
          (d.accessParameters ?? []).map((param, index) => (
            <div
              className="mb-3 grid grid-cols-12 gap-4"
              key={`${param.parameterKey ?? 'param'}-${index}`}
            >
              <div className="col-span-3">
                <Input
                  aria-label="Parameter type"
                  value={parameterTypeLabel(param.parameterType)}
                  disabled
                />
              </div>
              <div className="col-span-3">
                <Input value={param.parameterKey ?? ''} disabled />
              </div>
              <div className="col-span-5">
                {/* Security directive: credentials masked by default with
                    explicit per-value reveal; never logged. */}
                {(() => {
                  const rowId = `${param.parameterKey ?? 'param'}-${index}`;
                  const value = param.parameterValue ?? '';
                  if (!isSensitiveParameterKey(param.parameterKey)) {
                    return <Input value={value} disabled />;
                  }
                  const revealed = revealedParamIds.has(rowId);
                  return (
                    <span className="inline-flex h-9 items-center gap-2">
                      <span className="w-full rounded-md border bg-muted/40 px-3 font-mono text-xs">
                        {revealed ? value : MASKED_VALUE}
                      </span>
                      <button
                        type="button"
                        aria-label={
                          revealed
                            ? t('key_management_0072')
                            : t('key_management_0071')
                        }
                        aria-pressed={revealed}
                        onClick={() => toggleParamReveal(rowId)}
                        className="text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {revealed ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </span>
                  );
                })()}
              </div>
              <div className="col-span-1" />
            </div>
          ))
        )}
      </div>

      {/* ---------- Block 3: Supported Chains ---------- */}
      <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <h2 className="mb-2 text-base font-bold">Supported Chains</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Configure the blockchain networks supported by this Key service.
        </p>

        <div className="mb-4 grid grid-cols-12 gap-4 text-sm text-muted-foreground">
          <div className="col-span-3" />
          <div className="col-span-4">Service Provider Blockchain Name</div>
          <div className="col-span-4">Service Provider Blockchain ID</div>
          <div className="col-span-1" />
        </div>

        {(d.supportedChains ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">--</p>
        ) : (
          (d.supportedChains ?? []).map((chain, index) => (
            <div
              className="mb-4 grid grid-cols-12 gap-4"
              key={`${chain.blockchain ?? 'chain'}-${index}`}
            >
              <div className="col-span-3 flex items-center">
                <label className="flex items-center gap-2">
                  <Checkbox checked disabled />
                  <span className="text-sm">{chain.blockchain || '--'}</span>
                </label>
              </div>
              <div className="col-span-4">
                <Input
                  aria-label="Service Provider Blockchain Name"
                  value={chain.serviceProviderBlockchainName ?? ''}
                  disabled
                />
              </div>
              <div className="col-span-4">
                <Input
                  aria-label="Service Provider Blockchain ID"
                  value={chain.serviceProviderBlockchainId ?? ''}
                  disabled
                />
              </div>
              <div className="col-span-1" />
            </div>
          ))
        )}

        {/* Action buttons */}
        <div className="mt-6 flex justify-end gap-4">
          <Button variant="outline" onClick={() => router.back()}>
            Back
          </Button>
          {/* Write API unavailable — submission intentionally disabled. */}
          <Button disabled>Submit</Button>
        </div>
      </div>
    </>
  );

  return (
    <div className="space-y-6">
      {/* Write APIs not available — honest prototype banner. */}
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm text-amber-700 dark:text-amber-400">
        {t('key_management_0068')}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="h-48 w-full animate-pulse rounded-md bg-muted" />
          <div className="h-48 w-full animate-pulse rounded-md bg-muted" />
        </div>
      ) : isError || !detail ? (
        // Missing id / backend failure must not masquerade as empty data.
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
          {error?.message || t('key_management_0070')}
        </div>
      ) : (
        renderBody(detail)
      )}
    </div>
  );
}
