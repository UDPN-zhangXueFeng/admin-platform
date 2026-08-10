/**
 * TanStack Query key factory for key-service-configuration.
 */

import type { KeyServiceOperationRecordParams } from './key-service-configuration.model';

export const keyServiceConfigurationKeys = {
  all: () => ['key-service-configuration'] as const,
  details: () => [...keyServiceConfigurationKeys.all(), 'detail'] as const,
  detail: (keyServiceCode: string) =>
    [...keyServiceConfigurationKeys.details(), keyServiceCode] as const,
  operationRecords: () =>
    [...keyServiceConfigurationKeys.all(), 'operation-records'] as const,
  operationRecord: (params: KeyServiceOperationRecordParams) =>
    [...keyServiceConfigurationKeys.operationRecords(), params] as const,
  list: () => [...keyServiceConfigurationKeys.all(), 'list'] as const,
};
