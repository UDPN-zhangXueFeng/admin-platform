/**
 * KeyPolicyConfigurationNewPage — create form (pure mock, demo-only submit).
 *
 * Architecture:
 * - Client-state (form)  → react-hook-form + zod (required validation)
 * - Reference data       → roleNameOptions / rotationMethodOptions (util constants)
 * - Submit               → no backend endpoint exists (upstream new.tsx
 *                          console.log only; live backend documents no key
 *                          rotation policy create API). A validated submit
 *                          logs the payload and shows an explicit demo
 *                          notice — it never claims the policy was created
 *                          and never navigates away.
 *
 * Source: td-manage/src/pages/key-management/key-policy-configuration/new.tsx
 * Downgrades (per plan §6 / §8.D / §8.E):
 * - antd TimePicker  → Input[type=time] (no TimePicker on target)
 * - dayjs            → dropped (HH:mm:ss string passes through directly)
 * - Rotation Method  → kebab-case value (rotationMethodOptions); labels
 *                      localized, values stay the canonical kebab data value.
 */

'use client';

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { Info } from 'lucide-react';
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

import { roleNameOptions, rotationMethodOptions } from '.';

// Frequency number options: 1–12 (source new.tsx:155-158).
const frequencyNumberOptions = Array.from({ length: 12 }, (_, i) => ({
  label: String(i + 1),
  value: String(i + 1),
}));

// Frequency unit options (source new.tsx:161-164). Values are the canonical
// mock values ('days'/'months') — labels localized at render time.
const frequencyUnitOptions: { labelKey: string; value: string }[] = [
  { labelKey: 'KP_Days', value: 'days' },
  { labelKey: 'KP_Months', value: 'months' },
];

// Business Name options for the FormSelect (no "All" — create page only).
const businessNameSelectOptions = roleNameOptions.map((o) => ({
  label: o.label,
  value: o.value,
}));

export function KeyPolicyConfigurationNewPage() {
  const t = useTranslations('modules.key-management');
  const router = useRouter();

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
  type FormValues = z.infer<typeof formSchema>;

  const {
    control,
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    // Source initialValues: frequencyNumber 1 / frequencyUnit months /
    // rotationMethod system-initiated.
    defaultValues: {
      businessName: '',
      frequencyNumber: '1',
      frequencyUnit: 'months',
      rotationTime: '',
      rotationMethod: 'system-initiated',
    },
  });

  /** Set once a validated submit happened — surfaces the demo notice. */
  const [demoSubmitted, setDemoSubmitted] = React.useState(false);

  // Business Name → read-only Description (source new.tsx:172-176 linkage).
  const selectedBusinessName = watch('businessName');
  const description = React.useMemo(
    () =>
      roleNameOptions.find((o) => o.value === selectedBusinessName)
        ?.description ?? '',
    [selectedBusinessName],
  );

  const rotationMethod = watch('rotationMethod');

  const onSubmit = (values: FormValues) => {
    // Demo-only: surface the explicit demo notice. No persistence, no
    // navigation, and the form payload is deliberately NOT logged (user
    // input, nothing to persist).
    void values;
    setDemoSubmitted(true);
  };

  const localizedFrequencyUnitOptions = React.useMemo(
    () =>
      frequencyUnitOptions.map((o) => ({ label: t(o.labelKey), value: o.value })),
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
      {/* Demo banner — no create API exists; submission never persists. */}
      <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        {t('KP_DemoBanner')}
      </div>

      <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <div className="mb-6 text-base font-semibold">{t('KP_NewTitle')}</div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Business Name + linked Description */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <FormSelect
              name="businessName"
              control={control}
              label={t('KP_BusinessName')}
              options={businessNameSelectOptions}
              placeholder={t('KP_PleaseSelect')}
              required
              error={errors.businessName?.message}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {t('key_management_0053')}
              </label>
              <Textarea rows={3} value={description} disabled placeholder="" />
            </div>
          </div>

          {/* Rotation Period Configuration */}
          <div className="rounded-lg border bg-card p-6">
            <div className="mb-4 text-base font-semibold">
              {t('KP_RotationPeriodTitle')}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {/* Rotation Frequency: number × unit side by side */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  {t('KP_RotationFrequency')}
                  <span className="ml-0.5 text-destructive">*</span>
                </label>
                <div className="flex gap-2">
                  <div className="w-20">
                    <FormSelect
                      name="frequencyNumber"
                      control={control}
                      label=""
                      options={frequencyNumberOptions}
                    />
                  </div>
                  <div className="w-28">
                    <FormSelect
                      name="frequencyUnit"
                      control={control}
                      label=""
                      options={localizedFrequencyUnitOptions}
                    />
                  </div>
                </div>
                {(errors.frequencyNumber || errors.frequencyUnit) && (
                  <p className="text-xs text-destructive">
                    {t('KP_PleaseSelectFrequency')}
                  </p>
                )}
              </div>

              {/* Rotation Time — Input[type=time] (downgraded TimePicker) */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  {t('KP_RotationTime')}
                  <span className="ml-0.5 text-destructive">*</span>
                </label>
                <Input
                  type="time"
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

            {/* Rotation Method — RadioGroup (kebab value) + Info hint */}
            <div className="mt-4 space-y-1.5">
              <label className="text-sm font-medium">
                {t('KP_RotationMethods')}
                <span className="ml-0.5 text-destructive">*</span>
              </label>
              <Controller
                control={control}
                name="rotationMethod"
                render={({ field }) => (
                  <RadioGroup
                    value={field.value}
                    onValueChange={field.onChange}
                    className="flex gap-6"
                  >
                    {localizedMethodOptions.map((opt) => {
                      const id = `rotation-method-${opt.value}`;
                      return (
                        <div key={opt.value} className="flex items-center gap-2">
                          <RadioGroupItem value={opt.value} id={id} />
                          <label htmlFor={id} className="text-sm">
                            {opt.label}
                          </label>
                        </div>
                      );
                    })}
                  </RadioGroup>
                )}
              />
              {rotationMethod === 'system-initiated' && (
                <div className="mt-1 flex items-start gap-1 text-sm text-blue-500">
                  <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{t('KP_SystemInitiatedHint')}</span>
                </div>
              )}
              {errors.rotationMethod && (
                <p className="text-xs text-destructive">
                  {errors.rotationMethod.message}
                </p>
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
