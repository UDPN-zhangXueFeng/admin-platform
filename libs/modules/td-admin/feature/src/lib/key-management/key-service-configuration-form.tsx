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
import { Trash2 } from 'lucide-react';
import { z } from 'zod';

import {
  Button,
  Card,
  Checkbox,
  Input,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@myorg/shared/ui';
import { cn } from '@myorg/shared/util-classnames';
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
  { value: 'headers', i18nKey: 'key_management_0139' },
  { value: 'body', i18nKey: 'key_management_0140' },
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
function buildResolver(t: (key: string) => string) {
  return zodResolver(
    z
      .object({
        keyServiceName: z.string(),
        hotWallet: z.boolean(),
        coldWallet: z.boolean(),
        hotWalletGroupId: z.string(),
        coldWalletGroupId: z.string(),
        description: z.string().max(200, t('key_management_0143')),
        url: z.string().min(1, t('key_management_0144')),
      })
      .superRefine((val, ctx) => {
        if (!val.keyServiceName.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['keyServiceName'],
            message: t('key_management_0145'),
          });
        } else if (val.keyServiceName.length > 50) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['keyServiceName'],
            message: t('key_management_0146'),
          });
        }
        if (val.hotWallet && !val.hotWalletGroupId.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['hotWalletGroupId'],
            message: t('key_management_0147'),
          });
        }
        if (val.coldWallet && !val.coldWalletGroupId.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['coldWalletGroupId'],
            message: t('key_management_0148'),
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
    handleSubmit,
    formState: { errors },
  } = useForm<KeyServiceFormValues>({
    resolver: buildResolver(t),
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

  // Demo-only submit (matrix D4 / KM-022): validate, then surface the demo
  // notice. No persistence, no navigation, and the payload is deliberately
  // NOT logged (typed values may include credentials).
  const [demoSubmitted, setDemoSubmitted] = React.useState(false);
  const onSubmit = () => {
    setDemoSubmitted(true);
  };

  const handleBack = () => {
    reset();
    router.back();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        backLabel={t('key_management_0056')}
        onBack={handleBack}
        title={t('key_management_0120')}
        description={t('key_management_0121')}
      />
      <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
        <Card className="p-6">
          <h2 className="mb-5 text-base font-semibold">
            {t('key_management_0057')}
          </h2>

          <div className="grid gap-5 lg:grid-cols-2">
            <Field
              label={t('key_management_0001')}
              htmlFor="key-service-name"
              required
              error={errors.keyServiceName?.message}
            >
              <Input
                id="key-service-name"
                placeholder={t('key_management_0127')}
                {...register('keyServiceName')}
              />
            </Field>

            <Field
              label={t('key_management_0053')}
              htmlFor="description"
              hint={
                <span className="flex justify-end text-xs text-muted-foreground">
                  {description?.length ?? 0}/200
                </span>
              }
              error={errors.description?.message}
            >
              <Textarea
                id="description"
                rows={3}
                maxLength={200}
                placeholder={t('key_management_0128')}
                {...register('description')}
              />
            </Field>
          </div>

          <div className="mt-6 border-t border-border pt-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <div className="text-sm font-medium">
                  {t('key_management_0122')}
                  <span className="ml-0.5 text-destructive">*</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Controller
                    control={control}
                    name="hotWallet"
                    render={({ field }) => (
                      <label
                        className={cn(
                          'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                          field.value
                            ? 'border-primary bg-primary/5'
                            : 'border-border'
                        )}
                      >
                        <Checkbox
                          className="mt-0.5"
                          checked={field.value}
                          onCheckedChange={(checked) =>
                            field.onChange(checked === true)
                          }
                        />
                        <span className="text-sm font-medium">
                          {t('key_management_0123')}
                        </span>
                      </label>
                    )}
                  />
                  <Controller
                    control={control}
                    name="coldWallet"
                    render={({ field }) => (
                      <label
                        className={cn(
                          'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                          field.value
                            ? 'border-primary bg-primary/5'
                            : 'border-border'
                        )}
                      >
                        <Checkbox
                          className="mt-0.5"
                          checked={field.value}
                          onCheckedChange={(checked) =>
                            field.onChange(checked === true)
                          }
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">
                            {t('key_management_0124')}
                          </span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {t('key_management_0125')}
                          </span>
                        </span>
                      </label>
                    )}
                  />
                </div>
              </div>

              {(hotWallet || coldWallet) && (
                <div className="space-y-3">
                  <div className="text-sm font-medium">
                    {t('key_management_0126')}
                    <span className="ml-0.5 text-destructive">*</span>
                  </div>
                  <div className="space-y-3">
                    {hotWallet && (
                      <Field
                        label={t('key_management_0123')}
                        htmlFor="hot-wallet-group-id"
                        error={errors.hotWalletGroupId?.message}
                      >
                        <Input
                          id="hot-wallet-group-id"
                          placeholder={t('key_management_0123')}
                          {...register('hotWalletGroupId')}
                        />
                      </Field>
                    )}
                    {coldWallet && (
                      <Field
                        label={t('key_management_0124')}
                        htmlFor="cold-wallet-group-id"
                        error={errors.coldWalletGroupId?.message}
                      >
                        <Input
                          id="cold-wallet-group-id"
                          placeholder={t('key_management_0124')}
                          {...register('coldWalletGroupId')}
                        />
                      </Field>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* ---------- Block 2: Access Configuration ---------- */}
        <Card className="p-6">
          <h2 className="mb-2 text-base font-semibold">{t('key_management_0129')}</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            {t('key_management_0130')}
          </p>

          <Field
            label={t('key_management_0154')}
            htmlFor="url"
            required
            error={errors.url?.message}
          >
            <Input id="url" placeholder="" {...register('url')} />
          </Field>

          <div className="mt-6">
            <div className="mb-3 text-sm font-medium">
              {t('key_management_0131')}
            </div>

            <div className="hidden gap-3 px-3 text-xs font-medium text-muted-foreground md:grid md:grid-cols-12">
              <div className="col-span-3">{t('key_management_0132')}</div>
              <div className="col-span-3">{t('key_management_0133')}</div>
              <div className="col-span-5">{t('key_management_0134')}</div>
              <div className="col-span-1" />
            </div>

            <div className="mt-2 space-y-2">
              {parameters.map((param, index) => (
                <div
                  className="grid gap-3 rounded-lg border border-border p-3 md:grid-cols-12 md:items-center"
                  key={param.id}
                >
                  <div className="md:col-span-3">
                    <Select
                      value={param.type}
                      onValueChange={(value) =>
                        updateParameter(param.id, 'type', value)
                      }
                    >
                      <SelectTrigger aria-label={t('key_management_0132')}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {parameterTypeOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {t(opt.i18nKey)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-3">
                    <Input
                      aria-label={t('key_management_0133')}
                      value={param.key}
                      onChange={(e) =>
                        updateParameter(param.id, 'key', e.target.value)
                      }
                      placeholder={t('key_management_0133')}
                    />
                  </div>
                  <div className="md:col-span-5">
                    <Input
                      aria-label={t('key_management_0134')}
                      value={param.value}
                      onChange={(e) =>
                        updateParameter(param.id, 'value', e.target.value)
                      }
                      placeholder={t('key_management_0134')}
                    />
                  </div>
                  <div className="flex justify-end md:col-span-1 md:justify-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="iconSm"
                      className="text-destructive"
                      aria-label={`${t('key_management_0027')} ${
                        index + 1
                      }`}
                      disabled={parameters.length === 1}
                      onClick={() => removeParameter(param.id)}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={addParameter}
            >
              {t('key_management_0141')}
            </Button>
          </div>
        </Card>

        {/* ---------- Block 3: Supported Chains ---------- */}
        <Card className="p-6">
          <h2 className="mb-2 text-base font-semibold">{t('key_management_0135')}</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            {t('key_management_0136')}
          </p>

          <div className="space-y-3">
            {supportedChains.map((chain) => {
              const selected = selectedChains[chain.key] ?? false;
              return (
                <div
                  key={chain.key}
                  className={cn(
                    'rounded-lg border p-4 transition-colors',
                    selected ? 'border-primary/40 bg-primary/5' : 'border-border'
                  )}
                >
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                    <Checkbox
                      checked={selected}
                      onCheckedChange={(checked) =>
                        toggleChain(chain.key, checked === true)
                      }
                    />
                    {chain.label}
                  </label>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <Field
                      label={t('key_management_0137')}
                      htmlFor={`chain-${chain.key}-name`}
                    >
                      <Input
                        id={`chain-${chain.key}-name`}
                        value={chainData[chain.key]?.name ?? ''}
                        onChange={(e) =>
                          updateChainData(chain.key, 'name', e.target.value)
                        }
                        disabled={!selected}
                        placeholder=""
                      />
                    </Field>
                    <Field
                      label={t('key_management_0138')}
                      htmlFor={`chain-${chain.key}-id`}
                    >
                      <Input
                        id={`chain-${chain.key}-id`}
                        value={chainData[chain.key]?.id ?? ''}
                        onChange={(e) =>
                          updateChainData(chain.key, 'id', e.target.value)
                        }
                        disabled={!selected}
                        placeholder=""
                      />
                    </Field>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Demo notice — explicit non-persistence feedback (KM-022). */}
          {demoSubmitted && (
            <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {t('key_management_0073')}
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-6 flex justify-end">
            {/* Demo submit: gated by zod, never persisted (matrix D4). */}
            <Button type="submit">{t('key_management_0142')}</Button>
          </div>
        </Card>
      </form>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium" htmlFor={htmlFor}>
        {label}
        {required ? (
          <span className="ml-0.5 text-destructive">*</span>
        ) : null}
      </label>
      {children}
      {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
