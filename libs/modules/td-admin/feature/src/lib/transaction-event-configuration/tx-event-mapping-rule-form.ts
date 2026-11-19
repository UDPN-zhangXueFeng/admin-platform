import type {
  NormalizationEventMapping,
  SaveNormalizationMapping,
} from '@myorg/modules/td-admin/data-access';
import {
  MAPPING_METHOD_VALUE,
  ORGANIZATION_CODE_FIELD,
  isSystemBuiltinMapping,
  shouldSubmitSourceField,
  type MappingMethod,
} from './tx-event-config.constants';

export interface OptionalMappingRow {
  targetFieldKey: string;
  mappingMethod: MappingMethod;
  sourceFieldKey: string;
  description: string;
}

export interface EditFormValues {
  effectiveDate: string;
  organizationCode: string;
  optionalMappings: OptionalMappingRow[];
}

export function orderMappings(a: NormalizationEventMapping, b: NormalizationEventMapping) {
  return (a.orderNum ?? Number.MAX_SAFE_INTEGER) - (b.orderNum ?? Number.MAX_SAFE_INTEGER);
}

export function buildSubmitMappings(
  normalizationEventId: number,
  detailMappings: NormalizationEventMapping[],
  values: EditFormValues,
): SaveNormalizationMapping[] {
  const fixed = detailMappings.filter(isSystemBuiltinMapping);
  const maxOrder = detailMappings.reduce((max, row) => Math.max(max, row.orderNum ?? 0), 0);
  return [
    ...fixed.map((row): SaveNormalizationMapping => {
      const mappingField = row.mappingField || '';
      const mappingMethod = row.mappingMethod || MAPPING_METHOD_VALUE.DIRECT;
      const organization = mappingField === ORGANIZATION_CODE_FIELD;
      const remarks = organization ? values.organizationCode : row.remarks;
      return {
        normalizationEventId,
        mappingField,
        mappingMethod,
        orderNum: row.orderNum,
        systemBuiltin: row.systemBuiltin ?? 1,
        ...(shouldSubmitSourceField(mappingMethod) && { sourceField: row.sourceField || mappingField }),
        ...(organization && { fieldValue: values.organizationCode }),
        ...(remarks && { remarks }),
      };
    }),
    ...values.optionalMappings.map((row, index): SaveNormalizationMapping => {
      const existing = detailMappings.find((item) => item.mappingField === row.targetFieldKey);
      const mappingMethod = MAPPING_METHOD_VALUE[row.mappingMethod];
      return {
        normalizationEventId,
        mappingField: row.targetFieldKey,
        mappingMethod,
        remarks: row.description,
        orderNum: existing?.orderNum ?? maxOrder + index + 1,
        systemBuiltin: existing?.systemBuiltin ?? 2,
        ...(shouldSubmitSourceField(mappingMethod) && row.sourceFieldKey && { sourceField: row.sourceFieldKey }),
      };
    }),
  ];
}
