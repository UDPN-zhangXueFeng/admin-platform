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
 * (§8.C.2). Submit is mock-only: `console.log`, no navigation.
 */

'use client';

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@myorg/shared/util-i18n';

import {
  Button,
  Input,
  RadioGroup,
  RadioGroupItem,
  Textarea,
} from '@myorg/shared/ui';
import { FormSelect } from '@myorg/shared/ui-forms';

import { policyEditList } from '@myorg/modules/key-management/data-access';
import { roleNameOptions, rotationMethodOptions } from '@myorg/modules/key-management/util';

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

/** Rotation frequency unit options (Day/Month). */
const frequencyUnitOptions = [
  { label: 'Day(s)', value: 'days' },
  { label: 'Month(s)', value: 'months' },
];

export function KeyPolicyConfigurationEditPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { control, register, watch, reset } = useForm<EditFormValues>({
    defaultValues: DEFAULT_VALUES,
  });

  // Resolve the numeric id from ?id= (matches source `Number(id)` semantics).
  const policyId = React.useMemo(() => {
    const raw = searchParams.get('id');
    if (!raw) return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  }, [searchParams]);

  // Backfill the form when the id resolves to a record in policyEditList.
  // If find returns undefined (id missing — e.g. 4, or out-of-range), the
  // form stays at DEFAULT_VALUES (blank) — faithful to source §8.C.2.
  React.useEffect(() => {
    if (policyId === undefined) return;
    const record = policyEditList.find((item) => item.id === policyId);
    if (!record) return;

    const freq = parseRotationFrequency(record.rotationFrequency ?? '');
    const method = toMethodValue(record.rotationMethods ?? '');

    reset({
      businessName: record.businessName,
      frequencyNumber: String(freq.number),
      frequencyUnit: freq.unit,
      // rotationTime is 'HH:mm:ss' already — pass through directly (§8.E, no dayjs).
      rotationTime: record.rotationTime ?? '',
      rotationMethod: method,
    });
  }, [policyId, reset]);

  // Description is read-only and derived from the selected business name
  // (source uses an independent state; we derive from watch for parity).
  const selectedBusinessName = watch('businessName');
  const description = React.useMemo(() => {
    const match = roleNameOptions.find((o) => o.value === selectedBusinessName);
    return match?.description ?? '';
  }, [selectedBusinessName]);

  const rotationMethod = watch('rotationMethod');

  const handleBack = () => {
    router.back();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Mock-only submit — faithful to source: console.log, no navigation.
    console.log('Submit:', watch());
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="mb-6 text-xl font-bold">
          Edit Key Rotation Policy Configuration
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Business Name + Description */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <FormSelect
              name="businessName"
              control={control}
              label="Business Name"
              options={roleNameOptions}
              placeholder="Please select"
              required
              // Disabled: the role cannot be changed when editing.
              disabled
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Description
              </label>
              <Textarea rows={3} value={description} disabled placeholder="" />
            </div>
          </div>

          {/* Rotation Period Configuration */}
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h3 className="mb-6 font-bold">Rotation Period Configuration</h3>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
              <div className="md:col-span-1">
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Rotation Frequency
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
                />
              </div>
              <div className="md:col-span-1">
                <FormSelect
                  name="frequencyUnit"
                  control={control}
                  label=""
                  options={frequencyUnitOptions}
                  placeholder="Month(s)"
                  required
                />
              </div>
              <div className="md:col-span-1">
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Rotation Time
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
              </div>
            </div>

            <div className="mt-6">
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Rotation Methods
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
                    {rotationMethodOptions.map((opt) => (
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
              {rotationMethod === 'system-initiated' && (
                <div className="mt-2 flex items-start gap-1 text-sm text-blue-500">
                  <span aria-hidden="true" className="mt-0.5">
                    ⓘ
                  </span>
                  <span>
                    The system will automatically initiate rotation upon
                    maturity. No manual intervention is required.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleBack}>
              Back
            </Button>
            <Button type="submit">Submit</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
