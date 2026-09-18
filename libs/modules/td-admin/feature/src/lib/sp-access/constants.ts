export const serviceProviderTypeOptions = [
  { label: 'Commercial Bank', value: '1' },
  { label: 'Payment Company', value: '5' },
  { label: 'Custodian', value: '10' },
  { label: 'Online Business', value: '15' },
  { label: 'Offline Business', value: '20' },
  { label: 'Others', value: '25' },
] as const;

export const transactionPolicyOptions = [
  { label: 'Via Current SP', value: '1' },
  { label: 'Direct (End User)', value: '2' },
] as const;

export const privateKeyCustodyModelOptions = [
  { label: 'Issuer Custody', value: '1' },
  { label: 'SP Custody', value: '2' },
  { label: 'Self-Custody (End User)', value: '3' },
] as const;

export const metaTypeOptions = [
  { label: 'Disabled', value: '1' },
  { label: 'Enabled', value: '5' },
] as const;

export const reconciliationFrequencyOptions = [
  { label: 'Daily', value: '1' },
  { label: 'Weekly', value: '2' },
  { label: 'Monthly', value: '3' },
] as const;

export const kycRequiredOptions = [
  { label: 'No', value: '1' },
  { label: 'Yes', value: '2' },
] as const;

export const spAccessStatusLabelMap: Record<number, string> = {
  0: 'Opening',
  1: 'Enabled',
  2: 'Disabled',
};
