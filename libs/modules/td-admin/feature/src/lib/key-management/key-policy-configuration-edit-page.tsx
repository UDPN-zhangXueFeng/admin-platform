/**
 * KeyPolicyConfigurationEditPage — edit form backfilled from mock data by id.
 *
 * Pure mock (see key-policy-configuration.md): reads `?id=` from the URL,
 * looks up the record in `policyEditList` (4 items, ids 1/2/3/5 — no 4),
 * and backfills the form via `parseRotationFrequency` + Title→kebab method
 * mapping + rotationTime string passthrough (no dayjs — §8.E).
 *
 * Source reference: td-manage/src/pages/key-management/key-policy-configuration/edit.tsx
 * (backfill logic lines 232-254, parseRotationFrequency lines 211-221).
 *
 * Fallback behavior when the id is not in policyEditList (e.g. id=4 missing,
 * or a list row with id=5 that resolves but id=99 does not): `find` returns
 * undefined and the form stays at its defaults (blank) — faithful to source
 * (§8.C.2).
 *
 * Backend status (confirmed 2026-10-27): no key rotation policy update API
 * exists (upstream edit.tsx submits via console.log only; live backend
 * documents none). A validated submit logs the payload and shows an explicit
 * demo notice — it never claims the policy was updated and never navigates.
 * Client validation (required businessName / frequency / rotationTime /
 * rotationMethod) matches the source `form.validateFields()` contract.
 */

'use client';

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Info } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import {
  Button,
  Input,
  RadioGroup,
  RadioGroupItem,
  Textarea,
} from '@myorg/shared/ui';
import { FormSelect } from '@myorg/shared/ui-forms';
import { useRouter } from '@myorg/shared/util-i18n';

import { policyEditList } from '@myorg/modules/td-admin/data-access';
import { roleNameOptions, rotationMethodOptions } from '.';

/**
 * Parse a rotation-frequency string (e.g. "3 months", "1 day") into a number
 * and a unit. Verbatim from source edit.tsx:211-221: regex `(\d+)\s*(day|month)`,
 * day→'days', month→'months', default {1, 'months'} when no match.
 */
function parseRotationFrequency(
  frequency: string,
): { number: number; unit: string } {
  const match = frequency.match(/(\d+)\s*(day|month)/i);
  if (match) {
    return {
      number: parseInt(match[1], 10),
      unit: match[2].toLowerCase().includes('day') ? 'days' : 'months',
    };
  }
  return { number: 1, unit: 'months' };
}

/**
 * Map a Title Case rotation method from mock data to the kebab-case value
 * used by the Radio group. Verbatim from source edit.tsx:237-240.
 */
function toMethodValue(method: string): string {
  return method === 'System-initiated' ? 'system-initiated' : 'manual-approval';
}

/** Edit form values. frequencyNumber is a string (FormSelect requires string values). */
interface EditFormValues {
  businessName: string;
  frequencyNumber: string;
  frequencyUnit: string;
  rotationTime: string;
  rotationMethod: string;
}

const DEFAULT_VALUES: EditFormValues = {
  businessName: '',
  frequencyNumber: '',
  frequencyUnit: '',
  rotationTime: '',
  rotationMethod: '',
};

/** Rotation frequency number options 1-12 (string values for FormSelect). */
const frequencyNumberOptions = Array.from({ length: 12 }, (_, i) => ({
  label: String(i + 1),
  value: String(i + 1),
}));

/** Rotation frequency unit options. Values are canonical ('days'/'months'). */
const frequencyUnitOptions: { labelKey: string; value: string }[] = [
  { labelKey: 'KP_Days', value: 'days' },
  { labelKey: 'KP_Months', value: 'months' },
];

export function KeyPolicyConfigurationEditPage() {
  const t = useTranslations('modules.key-management');
  const router = useRouter();
  const searchParams = useSearchParams();

  /** Set once a validated submit happened — surfaces the demo notice. */
  const [demoSubmitted, setDemoSubmitted] = React.useState(false);

  const formSchema = React.useMemo(
    () =>
      z.object({
        businessName: z.string().min(1, t('KP_PleaseSelectBusinessName')),
        frequencyNumber: z.string().min(1, t('KP_PleaseSelectFrequency')),
        frequencyUnit: z.string().min(1, t('KP_PleaseSelectFrequency')),
        rotationTime: z.string().min(1, t('KP_PleaseSelectRotationTime')),
        rotationMethod: z.string().min(1, t('KP_PleaseSelectRotationMethod')),
      }),
    [t],
  );

  // Resolve the numeric id from ?id= (matches source `Number(id)` semantics).
  const policyId = React.useMemo(() => {
    const raw = searchParams.get('id');
    if (!raw) return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  }, [searchParams]);

  // Backfill via initial defaultValues, NOT a post-mount reset(): RHF 7.x
  // reset() does not propagate into Controller-bound Radix selects (FormSelect),
  // which left businessName/frequency selects blank (ISS-B-01 / KM-042).
  // If the id resolves to no record (missing — e.g. 4, or out-of-range), the
  // form stays at DEFAULT_VALUES (blank) — faithful to source §8.C.2.
  const initialValues = React.useMemo<EditFormValues>(() => {
    if (policyId === undefined) return DEFAULT_VALUES;
    const record = policyEditList.find((item) => item.id === policyId);
    if (!record) return DEFAULT_VALUES;

    const freq = parseRotationFrequency(record.rotationFrequency ?? '');
    const method = toMethodValue(record.rotationMethods ?? '');

    return {
      businessName: record.businessName,
      frequencyNumber: String(freq.number),
      frequencyUnit: freq.unit,
      // rotationTime is 'HH:mm:ss' already — pass through directly (§8.E, no dayjs).
      rotationTime: record.rotationTime ?? '',
      rotationMethod: method,
    };
  }, [policyId]);

  const {
    control,
    register,
    watch,
    handleSubmit,
    formState: { errors },
  } = useForm<EditFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialValues,
  });

  // Description is read-only and derived from the selected business name
  // (source uses an independent state; we derive from watch for parity).
  const selectedBusinessName = watch('businessName');
  const description = React.useMemo(() => {
    const match = roleNameOptions.find((o) => o.value === selectedBusinessName);
    return match?.description ?? '';
  }, [selectedBusinessName]);

  const rotationMethod = watch('rotationMethod');

  const onSubmit = (values: EditFormValues) => {
    // Demo-only: surface the explicit demo notice. No persistence, no
    // navigation, and the form payload is deliberately NOT logged (user
    // input, nothing to persist).
    void values;
    setDemoSubmitted(true);
  };

  const localizedFrequencyUnitOptions = React.useMemo(
    () =>
      frequencyUnitOptions.map((o) => ({
        label: t(o.labelKey),
        value: o.value,
      })),
    [t],
  );

  const localizedMethodOptions = React.useMemo(
    () =>
      rotationMethodOptions.map((opt) => ({
        value: opt.value,
        label:
          opt.value === 'system-initiated'
            ? t('KP_SystemInitiated')
            : t('KP_ManualApproval'),
      })),
    [t],
  );

  return (
    <div className="space-y-6">
      {/* Demo banner — no update API exists; submission never persists. */}
      <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        {t('KP_DemoBanner')}
      </div>

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="mb-6 text-xl font-bold">{t('KP_EditTitle')}</h2>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Business Name + Description */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <FormSelect
              name="businessName"
              control={control}
              label={t('KP_BusinessName')}
              options={roleNameOptions}
              placeholder={t('KP_PleaseSelect')}
              required
              error={errors.businessName?.message}
              // Disabled: the role cannot be changed when editing.
              disabled
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                {t('key_management_0053')}
              </label>
              <Textarea rows={3} value={description} disabled placeholder="" />
            </div>
          </div>

          {/* Rotation Period Configuration */}
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h3 className="mb-6 font-bold">{t('KP_RotationPeriodTitle')}</h3>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
              <div className="md:col-span-1">
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  {t('KP_RotationFrequency')}
                  <span className="ml-0.5 text-destructive" aria-hidden="true">
                    *
                  </span>
                </label>
                <FormSelect
                  name="frequencyNumber"
                  control={control}
                  label=""
                  options={frequencyNumberOptions}
                  placeholder="1"
                  required
                  error={errors.frequencyNumber?.message}
                />
              </div>
              <div className="md:col-span-1">
                <FormSelect
                  name="frequencyUnit"
                  control={control}
                  label=""
                  options={localizedFrequencyUnitOptions}
                  placeholder={t('KP_Months')}
                  required
                  error={errors.frequencyUnit?.message}
                />
              </div>
              <div className="md:col-span-1">
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  {t('KP_RotationTime')}
                  <span className="ml-0.5 text-destructive" aria-hidden="true">
                    *
                  </span>
                </label>
                <Input
                  type="time"
                  // step=1 allows seconds so 'HH:mm:ss' values round-trip.
                  step={1}
                  placeholder="02:00:00"
                  {...register('rotationTime')}
                />
                {errors.rotationTime && (
                  <p className="text-xs text-destructive">
                    {errors.rotationTime.message}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6">
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                {t('KP_RotationMethods')}
                <span className="ml-0.5 text-destructive" aria-hidden="true">
                  *
                </span>
              </label>
              <Controller
                name="rotationMethod"
                control={control}
                render={({ field }) => (
                  <RadioGroup
                    value={field.value}
                    onValueChange={field.onChange}
                    className="flex gap-6"
                  >
                    {localizedMethodOptions.map((opt) => (
                      <div key={opt.value} className="flex items-center gap-2">
                        <RadioGroupItem
                          value={opt.value}
                          id={`method-${opt.value}`}
                        />
                        <label
                          htmlFor={`method-${opt.value}`}
                          className="cursor-pointer text-sm font-medium"
                        >
                          {opt.label}
                        </label>
                      </div>
                    ))}
                  </RadioGroup>
                )}
              />
              {errors.rotationMethod && (
                <p className="text-xs text-destructive">
                  {errors.rotationMethod.message}
                </p>
              )}
              {rotationMethod === 'system-initiated' && (
                <div className="mt-2 flex items-start gap-1 text-sm text-blue-500">
                  <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{t('KP_SystemInitiatedHint')}</span>
                </div>
              )}
            </div>
          </div>

          {/* Demo notice — explicit non-persistence feedback. */}
          {demoSubmitted && (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {t('KP_DemoSubmitNotice')}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              {t('key_management_0056')}
            </Button>
            <Button type="submit">{t('KP_SubmitDemo')}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
