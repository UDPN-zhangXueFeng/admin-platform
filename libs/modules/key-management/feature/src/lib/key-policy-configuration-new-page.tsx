/**
 * KeyPolicyConfigurationNewPage — create form (pure mock).
 *
 * Architecture:
 * - Client-state (form)  → react-hook-form + zod (required validation)
 * - Reference data       → roleNameOptions / rotationMethodOptions (util constants)
 * - Submit               → console.log only, no navigation (faithful to source mock)
 *
 * Source: td-manage/src/pages/key-management/key-policy-configuration/new.tsx
 * Downgrades (per plan §6 / §8.D / §8.E):
 * - antd TimePicker  → Input[type=time] (no TimePicker on target)
 * - dayjs            → dropped (HH:mm:ss string passes through directly)
 * - Rotation Method  → kebab-case value (rotationMethodOptions)
 */

'use client';

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Info } from 'lucide-react';
import { z } from 'zod';

import { Button, Input, RadioGroup, RadioGroupItem, Textarea } from '@myorg/shared/ui';
import { FormSelect } from '@myorg/shared/ui-forms';
import { useRouter } from '@myorg/shared/util-i18n';

import {
  roleNameOptions,
  rotationMethodOptions,
} from '@myorg/modules/key-management/util';

// Frequency number options: 1–12 (source new.tsx:155-158).
const frequencyNumberOptions = Array.from({ length: 12 }, (_, i) => ({
  label: String(i + 1),
  value: String(i + 1),
}));

// Frequency unit options: Day(s) / Month(s) (source new.tsx:161-164).
const frequencyUnitOptions = [
  { label: 'Day(s)', value: 'days' },
  { label: 'Month(s)', value: 'months' },
];

// Business Name options for the FormSelect (no "All" — create page only).
const businessNameSelectOptions = roleNameOptions.map((o) => ({
  label: o.label,
  value: o.value,
}));

const formSchema = z.object({
  businessName: z.string().min(1, 'Please select business name'),
  frequencyNumber: z.string().min(1, 'Please select frequency'),
  frequencyUnit: z.string().min(1, 'Please select unit'),
  rotationTime: z.string().min(1, 'Please select rotation time'),
  rotationMethod: z.string().min(1, 'Please select rotation method'),
});

type FormValues = z.infer<typeof formSchema>;

export function KeyPolicyConfigurationNewPage() {
  const router = useRouter();

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

  // Business Name → read-only Description (source new.tsx:172-176 linkage).
  const selectedBusinessName = watch('businessName');
  const description = React.useMemo(
    () =>
      roleNameOptions.find((o) => o.value === selectedBusinessName)?.description ??
      '',
    [selectedBusinessName],
  );

  const rotationMethod = watch('rotationMethod');

  const onSubmit = (values: FormValues) => {
    // Pure mock — no navigation, faithful to source.
    console.log('Submit:', values);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <div className="mb-6 text-base font-semibold">
          New Key Rotation Policy Configuration
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Business Name + linked Description */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <FormSelect
              name="businessName"
              control={control}
              label="Business Name"
              options={businessNameSelectOptions}
              placeholder="Please select"
              required
              error={errors.businessName?.message}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Description</label>
              <Textarea rows={3} value={description} disabled placeholder="" />
            </div>
          </div>

          {/* Rotation Period Configuration */}
          <div className="rounded-lg border bg-card p-6">
            <div className="mb-4 text-base font-semibold">
              Rotation Period Configuration
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {/* Rotation Frequency: number × unit side by side */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Rotation Frequency
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
                      options={frequencyUnitOptions}
                    />
                  </div>
                </div>
                {(errors.frequencyNumber || errors.frequencyUnit) && (
                  <p className="text-xs text-destructive">
                    Please select frequency
                  </p>
                )}
              </div>

              {/* Rotation Time — Input[type=time] (downgraded TimePicker) */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Rotation Time
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
                Rotation Methods
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
                    {rotationMethodOptions.map((opt) => {
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
                  <span>
                    The system will automatically initiate rotation upon
                    maturity. No manual intervention is required.
                  </span>
                </div>
              )}
              {errors.rotationMethod && (
                <p className="text-xs text-destructive">
                  {errors.rotationMethod.message}
                </p>
              )}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Back
            </Button>
            <Button type="submit">Submit</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
