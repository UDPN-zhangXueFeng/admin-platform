import {
  kycRequiredOptions,
  privateKeyCustodyModelOptions,
  serviceProviderTypeOptions,
  spAccessStatusLabelMap,
  transactionPolicyOptions,
} from './constants';

function buildLabel(values: readonly { label: string; value: string }[], value?: string): string {
  if (!value) return '--';
  const option = values.find((item) => item.value === value);
  return option?.label ?? value;
}

function buildMultiLabel(values: readonly { label: string; value: string }[], value?: string): string {
  if (!value) return '--';

  const labels = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => buildLabel(values, item));

  return labels.length ? labels.join(', ') : '--';
}

export function parseTransactionPolicy(value?: string): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function serializeTransactionPolicy(values: string[]): string {
  return values
    .map((item) => item.trim())
    .filter(Boolean)
    .sort()
    .join(',');
}

export function parsePrivateKeyCustodyModel(value?: string): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function serializePrivateKeyCustodyModel(values: string[]): string {
  return values
    .map((item) => item.trim())
    .filter(Boolean)
    .sort()
    .join(',');
}

export function formatServiceProviderTypeLabel(value?: string): string {
  return buildLabel(serviceProviderTypeOptions, value);
}

export function formatSpAccessStatusLabel(value?: number): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '--';
  return spAccessStatusLabelMap[value] ?? String(value);
}

export function formatTransactionPolicyLabel(value?: string): string {
  return buildMultiLabel(transactionPolicyOptions, value);
}

export function formatPrivateKeyCustodyModelLabel(value?: string): string {
  return buildMultiLabel(privateKeyCustodyModelOptions, value);
}

export function formatTokenKycRequiredLabel(value?: number | string | boolean): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';

  if (typeof value === 'number') {
    if (value === 0) return 'No';
    return buildLabel(kycRequiredOptions, String(value));
  }

  if (typeof value === 'string') {
    const normalizedValue = value.trim();
    if (!normalizedValue) return '--';
    if (normalizedValue.toLowerCase() === 'yes') return 'Yes';
    if (normalizedValue.toLowerCase() === 'no') return 'No';
    return buildLabel(kycRequiredOptions, normalizedValue);
  }

  return '--';
}
