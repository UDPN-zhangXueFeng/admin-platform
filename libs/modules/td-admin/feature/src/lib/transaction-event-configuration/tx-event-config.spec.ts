import {
  canViewMappingRules,
  formatAssetValue,
  mappingMethodMessageKey,
  resolveEventStatusMeta,
  resolveHistorySourceEvent,
  resolveMappingRuleStatusMeta,
} from './tx-event-config.constants';
import { buildSubmitMappings } from './tx-event-mapping-rule-form';

it.each([
  ['9007199254740993.995 VND', '9007199254740994.00 VND'],
  ['-0.005 USD', '-0.01 USD'],
  [' 12 USD ', '12.00 USD'],
  [null, '--'],
])('formats asset amount %s without converting strings to floating point', (value, expected) => {
  expect(formatAssetValue(value)).toBe(expected);
});

it('requires the backend UUID to show the Mapping Rules action', () => {
  expect(canViewMappingRules(new Set(['91ce483ff5fe47fc94073cdc25256935']))).toBe(true);
  expect(canViewMappingRules(new Set(['transaction-event-configuration:view-mapping-rules']))).toBe(false);
  expect(canViewMappingRules(new Set())).toBe(false);
});

it('resolves method and history aliases without changing status sets', () => {
  expect(mappingMethodMessageKey('DIRECT')).toBe('mappingMethod.direct');
  expect(mappingMethodMessageKey('2')).toBe('mappingMethod.constant');
  expect(resolveHistorySourceEvent('RESERVE_OUT', 3)).toBe('reserveOut');
  expect(resolveHistorySourceEvent('unknown', 3)).toBe('fundingIn');
  expect(resolveMappingRuleStatusMeta(5)).toBeNull();
  expect(resolveEventStatusMeta(5)?.labelKey).toBe('eventStatus.draft');
});

it('builds the update payload without inventing built-ins when real built-ins exist', () => {
  const rows = buildSubmitMappings(250, [
    { mappingField: 'OrganizationCode', mappingMethod: 2, sourceField: 'ignored', orderNum: 10, systemBuiltin: 1 },
    { mappingField: 'Existing', mappingMethod: 3, orderNum: 20, systemBuiltin: 2 },
  ], {
    effectiveDate: '2026-11-20',
    organizationCode: 'ORG',
    optionalMappings: [
      { targetFieldKey: 'Existing', mappingMethod: 'GENERATE', sourceFieldKey: 'ignored', description: 'generate' },
      { targetFieldKey: 'Custom', mappingMethod: 'DIRECT', sourceFieldKey: 'Source', description: 'direct' },
    ],
  });
  expect(rows).toEqual([
    { normalizationEventId: 250, mappingField: 'OrganizationCode', mappingMethod: 2, orderNum: 10, systemBuiltin: 1, fieldValue: 'ORG', remarks: 'ORG' },
    { normalizationEventId: 250, mappingField: 'Existing', mappingMethod: 3, orderNum: 20, systemBuiltin: 2, remarks: 'generate' },
    { normalizationEventId: 250, mappingField: 'Custom', mappingMethod: 1, orderNum: 22, systemBuiltin: 2, remarks: 'direct', sourceField: 'Source' },
  ]);
});
