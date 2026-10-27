/**
 * KeyServiceConfigurationForm — new-service (configure) prototype form.
 *
 * Three blocks, faithful to td-manage configure.tsx:
 *   1. New Key Service Configuration — name (required, ≤50) +
 *      Wallet Attribute (hot/cold) + conditional Wallet Group IDs + description.
 *   2. Access Configuration — url (required) + dynamic Parameters rows.
 *   3. Supported Chains — 3 chain checkboxes + Name/ID inputs each.
 *
 * Architecture:
 * - Scalar fields  → react-hook-form + zod (required/length/conditional validation)
 * - Dynamic rows   → useState (parameters / chain selection) — matches source
 * - Submit         → DISABLED: the backend exposes no Key-service write API
 *   (verified against live /v3/api-docs: only the four read-only
 *   /key/config/* POSTs exist). The form is a read-only prototype; it never
 *   fakes a successful save and never echoes entered values to the console.
 *   Real per-service data lives on the read-only edit page instead.
 */

'use client';

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { zodResolver } from '@hookform/resolvers/zod';
import { Info } from 'lucide-react';
import { z } from 'zod';

import {
  Button,
  Checkbox,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@myorg/shared/ui';
import { useRouter } from '@myorg/shared/util-i18n';

/** (Configure-only — the edit view is a separate read-only page.) */

/** Dynamic access-parameter row. */
interface ParameterItem {
  id: number;
  type: string;
  key: string;
  value: string;
}

/** Supported-chain catalog (source edit.tsx:26-30 / configure.tsx:26-30). */
const supportedChains = [
  { key: 'hyperledgerBesu', label: 'Hyperledger Besu' },
  { key: 'ethereumSepolia', label: 'Ethereum Sepolia' },
  { key: 'polygon', label: 'Polygon' },
];

/** Parameter-type dropdown options (source edit.tsx:33-36). */
const parameterTypeOptions = [
  { value: 'headers', label: 'Request Headers' },
  { value: 'body', label: 'Request Body' },
];

/** Per-chain name/id inputs. */
type ChainData = Record<string, { name: string; id: string }>;

/** Form values for the react-hook-form scalar fields. */
interface KeyServiceFormValues {
  keyServiceName: string;
  hotWallet: boolean;
  coldWallet: boolean;
  hotWalletGroupId: string;
  coldWalletGroupId: string;
  description: string;
  url: string;
}

/** Zod resolver with the upstream configure-mode rules. */
function buildResolver() {
  return zodResolver(
    z
      .object({
        keyServiceName: z.string(),
        hotWallet: z.boolean(),
        coldWallet: z.boolean(),
        hotWalletGroupId: z.string(),
        coldWalletGroupId: z.string(),
        description: z.string().max(200, 'Maximum 200 characters'),
        url: z.string().min(1, 'Please enter URL'),
      })
      .superRefine((val, ctx) => {
        if (!val.keyServiceName.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['keyServiceName'],
            message: 'Please enter Key Service Name',
          });
        } else if (val.keyServiceName.length > 50) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['keyServiceName'],
            message: 'Maximum 50 characters',
          });
        }
        if (val.hotWallet && !val.hotWalletGroupId.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['hotWalletGroupId'],
            message: 'Please enter Hot Wallet Group ID',
          });
        }
        if (val.coldWallet && !val.coldWalletGroupId.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['coldWalletGroupId'],
            message: 'Please enter Cold Wallet Group ID',
          });
        }
      }),
  );
}

export function KeyServiceConfigurationForm() {
  const t = useTranslations('modules.key-management');
  const router = useRouter();

  const {
    control,
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<KeyServiceFormValues>({
    resolver: buildResolver(),
    // Upstream configure.tsx: blank start, hot wallet pre-selected.
    defaultValues: {
      keyServiceName: '',
      hotWallet: true,
      coldWallet: false,
      hotWalletGroupId: '',
      coldWalletGroupId: '',
      description: '',
      url: '',
    },
  });

  // Dynamic access-parameter rows (outside RHF — source used useState too).
  const [parameters, setParameters] = React.useState<ParameterItem[]>([
    { id: 1, type: 'headers', key: '', value: '' },
    { id: 2, type: 'headers', key: '', value: '' },
    { id: 3, type: 'body', key: '', value: '' },
  ]);

  // Supported-chain selection + per-chain name/id.
  const [selectedChains, setSelectedChains] =
    React.useState<Record<string, boolean>>({});
  const [chainData, setChainData] = React.useState<ChainData>({});

  const hotWallet = watch('hotWallet');
  const coldWallet = watch('coldWallet');
  const description = watch('description');

  // ----- Parameter row handlers -----
  const addParameter = () => {
    const newId = Math.max(...parameters.map((p) => p.id), 0) + 1;
    setParameters([...parameters, { id: newId, type: 'headers', key: '', value: '' }]);
  };

  const removeParameter = (id: number) => {
    if (parameters.length > 1) {
      setParameters(parameters.filter((p) => p.id !== id));
    }
  };

  const updateParameter = (
    id: number,
    field: keyof Omit<ParameterItem, 'id'>,
    value: string,
  ) => {
    setParameters(
      parameters.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
    );
  };

  // ----- Chain handlers -----
  const toggleChain = (chainKey: string, checked: boolean) => {
    setSelectedChains((prev) => ({ ...prev, [chainKey]: checked }));
  };

  const updateChainData = (
    chainKey: string,
    field: 'name' | 'id',
    value: string,
  ) => {
    setChainData((prev) => ({
      ...prev,
      [chainKey]: { ...prev[chainKey], [field]: value },
    }));
  };

  // No submit path: the backend has no Key-service write API. The Submit
  // button stays disabled (see footer) so nothing here can fake a save or
  // echo typed values (potentially credentials) to the console.
  const handleBack = () => {
    reset();
    router.back();
  };

  return (
    <div className="space-y-6">
      {/* Write APIs not available — honest prototype banner. */}
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm text-amber-700 dark:text-amber-400">
        {t('key_management_0068')}
      </div>
      <form className="space-y-6">
        {/* ---------- Block 1: New Key Service Configuration ---------- */}
        <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
          <h2 className="mb-2 text-base font-bold">
            New Key Service Configuration
          </h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Configure a descriptive name for your Key service.
          </p>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="key-service-name">
                Key Service Name
                <span className="ml-0.5 text-destructive">*</span>
              </label>
              <Input
                id="key-service-name"
                placeholder="Enter letters, numbers, or special chars (up to 50 chars)"
                {...register('keyServiceName')}
              />
              {errors.keyServiceName && (
                <p className="text-xs text-destructive">
                  {errors.keyServiceName.message}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Wallet Attribute */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Wallet Attribute
                <span className="ml-0.5 text-destructive">*</span>
              </label>
              <div className="flex flex-col gap-2">
                <Controller
                  control={control}
                  name="hotWallet"
                  render={({ field }) => (
                    <label className="flex items-center gap-2">
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(checked) =>
                          field.onChange(checked === true)
                        }
                      />
                      <span className="text-sm">Hot Wallet</span>
                    </label>
                  )}
                />
                <div className="flex items-center gap-1">
                  <Controller
                    control={control}
                    name="coldWallet"
                    render={({ field }) => (
                      <label className="flex items-center gap-2">
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(checked) =>
                            field.onChange(checked === true)
                          }
                        />
                        <span className="text-sm">Cold Wallet</span>
                      </label>
                    )}
                  />
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

            {/* Wallet Group ID — conditional inputs driven by checkboxes */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Wallet Group ID
                <span className="ml-0.5 text-destructive">*</span>
              </label>
              <div className="flex flex-col gap-2">
                {hotWallet && (
                  <div className="space-y-1">
                    <Input
                      placeholder="Hot Wallet Group ID"
                      {...register('hotWalletGroupId')}
                    />
                    {errors.hotWalletGroupId && (
                      <p className="text-xs text-destructive">
                        {errors.hotWalletGroupId.message}
                      </p>
                    )}
                  </div>
                )}
                {coldWallet && (
                  <div className="space-y-1">
                    <Input
                      placeholder="Cold Wallet Group ID"
                      {...register('coldWalletGroupId')}
                    />
                    {errors.coldWalletGroupId && (
                      <p className="text-xs text-destructive">
                        {errors.coldWalletGroupId.message}
                      </p>
                    )}
                  </div>
                )}
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
                placeholder="Enter description"
                {...register('description')}
              />
              <div className="flex justify-end">
                <span className="text-xs text-muted-foreground">
                  {description?.length ?? 0}/200
                </span>
              </div>
              {errors.description && (
                <p className="text-xs text-destructive">
                  {errors.description.message}
                </p>
              )}
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
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="url">
                URL
                <span className="ml-0.5 text-destructive">*</span>
              </label>
              <Input id="url" placeholder="" {...register('url')} />
              {errors.url && (
                <p className="text-xs text-destructive">{errors.url.message}</p>
              )}
            </div>
          </div>

          <div className="mb-4 mt-6 text-sm font-medium">Parameters</div>

          {/* Parameter header row */}
          <div className="mb-2 grid grid-cols-12 gap-4 text-sm text-muted-foreground">
            <div className="col-span-3">Parameter Type</div>
            <div className="col-span-3">Parameter Key</div>
            <div className="col-span-5">Parameter Value</div>
            <div className="col-span-1" />
          </div>

          {/* Parameter rows */}
          {parameters.map((param, index) => (
            <div className="mb-3 grid grid-cols-12 gap-4" key={param.id}>
              <div className="col-span-3">
                <Select
                  value={param.type}
                  onValueChange={(value) =>
                    updateParameter(param.id, 'type', value)
                  }
                >
                  <SelectTrigger aria-label="Parameter type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {parameterTypeOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-3">
                <Input
                  value={param.key}
                  onChange={(e) =>
                    updateParameter(param.id, 'key', e.target.value)
                  }
                  placeholder="Parameter Key"
                />
              </div>
              <div className="col-span-5">
                <Input
                  value={param.value}
                  onChange={(e) =>
                    updateParameter(param.id, 'value', e.target.value)
                  }
                  placeholder="Parameter Value"
                />
              </div>
              <div className="col-span-1 flex items-center">
                {index > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => removeParameter(param.id)}
                  >
                    Delete
                  </Button>
                )}
              </div>
            </div>
          ))}

          <Button type="button" variant="outline" onClick={addParameter}>
            + Add
          </Button>
        </div>

        {/* ---------- Block 3: Supported Chains ---------- */}
        <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
          <h2 className="mb-2 text-base font-bold">Supported Chains</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Configure the blockchain networks supported by this Key service.
          </p>

          {/* Chain header row */}
          <div className="mb-4 grid grid-cols-12 gap-4 text-sm text-muted-foreground">
            <div className="col-span-3" />
            <div className="col-span-4">Service Provider Blockchain Name</div>
            <div className="col-span-4">Service Provider Blockchain ID</div>
            <div className="col-span-1" />
          </div>

          {/* Chain rows */}
          {supportedChains.map((chain) => (
            <div className="mb-4 grid grid-cols-12 gap-4" key={chain.key}>
              <div className="col-span-3 flex items-center">
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedChains[chain.key] ?? false}
                    onCheckedChange={(checked) =>
                      toggleChain(chain.key, checked === true)
                    }
                  />
                  <span className="text-sm">{chain.label}</span>
                </label>
              </div>
              <div className="col-span-4">
                <Input
                  value={chainData[chain.key]?.name ?? ''}
                  onChange={(e) =>
                    updateChainData(chain.key, 'name', e.target.value)
                  }
                  disabled={!selectedChains[chain.key]}
                  placeholder=""
                />
              </div>
              <div className="col-span-4">
                <Input
                  value={chainData[chain.key]?.id ?? ''}
                  onChange={(e) =>
                    updateChainData(chain.key, 'id', e.target.value)
                  }
                  disabled={!selectedChains[chain.key]}
                  placeholder=""
                />
              </div>
              <div className="col-span-1" />
            </div>
          ))}

          {/* Action buttons */}
          <div className="mt-6 flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={handleBack}>
              Back
            </Button>
            {/* Write API unavailable — submission intentionally disabled. */}
            <Button type="button" disabled>
              Submit
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
