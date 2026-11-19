/**
 * Row builders and table-column definitions for the key-service configuration
 * detail page (Parameters, Supported Chains, Operation Records).
 */

'use client';

import * as React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type {
  KeyServiceDetail,
  KeyServiceOperationRecord,
} from '@myorg/modules/td-admin/data-access';
import { formatAdminTimestamp } from '../format-admin-time';
import { createRowActionsColumn } from '../row-actions';
import { keyServiceOperationStatusToneMap } from './constants';
import { StatusBadge } from './key-service-configuration-detail.fields';
import {
  MASKED_VALUE,
  isSensitiveParameterKey,
} from './key-service-configuration-sensitive';

/** DataTable requires rows to carry an `id`. */
export type OperationRecordRow = KeyServiceOperationRecord & { id: string };

/** Inner Parameters-table row. */
export interface ParameterRow {
  id: string;
  parameterType?: number;
  parameterKey?: string;
  parameterValue?: string;
}

/** Inner Supported-Chains-table row. */
export interface ChainRow {
  id: string;
  blockchain?: string;
  serviceProviderBlockchainName?: string;
  serviceProviderBlockchainId?: string;
}

export function buildParameterRows(detail?: KeyServiceDetail): ParameterRow[] {
  return (detail?.accessParameters ?? []).map((item, idx) => ({
    id: `${item.parameterKey ?? idx}`,
    parameterType: item.parameterType,
    parameterKey: item.parameterKey,
    parameterValue: item.parameterValue,
  }));
}

export function buildChainRows(detail?: KeyServiceDetail): ChainRow[] {
  return (detail?.supportedChains ?? []).map((item, idx) => ({
    id: `${item.blockchain ?? idx}`,
    blockchain: item.blockchain,
    serviceProviderBlockchainName: item.serviceProviderBlockchainName,
    serviceProviderBlockchainId: item.serviceProviderBlockchainId,
  }));
}

export function buildOperationRecordRows(
  rows: KeyServiceOperationRecord[] | undefined,
): OperationRecordRow[] {
  return (rows ?? []).map((r, idx) => ({
    ...r,
    id: String(
      r.platformRecordId ??
        r.busCode ??
        `${r.keyServiceCode ?? 'record'}-${r.createdOn ?? idx}`,
    ),
  }));
}

export function useParameterColumns(
  getParameterTypeLabel: (type?: number) => string,
  revealedParamIds: Set<string>,
  toggleParamReveal: (id: string) => void,
) {
  const t = useTranslations('modules.key-management');

  return React.useMemo<ColumnDef<ParameterRow>[]>(
    () => [
      {
        accessorKey: 'parameterType',
        header: t('key_management_0041'),
        cell: ({ getValue }) =>
          getParameterTypeLabel(getValue() as number | undefined),
      },
      {
        accessorKey: 'parameterKey',
        header: t('key_management_0042'),
        cell: ({ getValue }) => (getValue() as string) || '--',
      },
      {
        accessorKey: 'parameterValue',
        header: t('key_management_0043'),
        // Parameter values can be long URLs/JSON — wrap instead of truncating
        // so credentials and ids stay readable.
        meta: { overflow: 'wrap' },
        cell: ({ row }) => {
          const param = row.original;
          const value = param.parameterValue;
          if (!value) return '--';
          // Security directive: credentials (private key / password / token
          // / secret / API key) are masked by default with explicit reveal.
          if (!isSensitiveParameterKey(param.parameterKey)) {
            return value;
          }
          const revealed = revealedParamIds.has(param.id);
          return (
            <span className="inline-flex max-w-full items-center gap-2">
              <span className="min-w-0 break-all font-mono text-xs">
                {revealed ? value : MASKED_VALUE}
              </span>
              <button
                type="button"
                aria-label={
                  revealed ? t('key_management_0072') : t('key_management_0071')
                }
                aria-pressed={revealed}
                onClick={() => toggleParamReveal(param.id)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {revealed ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </span>
          );
        },
      },
    ],
    [t, getParameterTypeLabel, revealedParamIds, toggleParamReveal],
  );
}

export function useOperationRecordColumns(
  getOperationTypeLabel: (type?: number) => string,
  getOperationStatusLabel: (status?: number) => string,
) {
  const t = useTranslations('modules.key-management');

  return React.useMemo<ColumnDef<OperationRecordRow>[]>(
    () => [
      {
        accessorKey: 'operationType',
        header: t('key_management_0048'),
        cell: ({ getValue }) => getOperationTypeLabel(getValue() as number),
      },
      {
        accessorKey: 'createdBy',
        header: t('key_management_0049'),
        cell: ({ getValue }) => (getValue() as string) || '--',
      },
      {
        accessorKey: 'createdOn',
        header: t('key_management_0050'),
        cell: ({ getValue }) => formatAdminTimestamp(getValue() as number),
      },
      {
        accessorKey: 'comments',
        header: t('key_management_0015'),
        cell: ({ getValue }) => (getValue() as string) || '--',
      },
      {
        accessorKey: 'status',
        header: t('key_management_0003'),
        cell: ({ getValue }) => {
          const status = getValue() as number;
          if (typeof status !== 'number') return '--';
          return (
            <StatusBadge
              tone={keyServiceOperationStatusToneMap[status] ?? 'default'}
              label={getOperationStatusLabel(status)}
            />
          );
        },
      },
      createRowActionsColumn<OperationRecordRow>({
        detail: {
          label: t('key_management_0012'),
          // Source renders a `Details` link with no onClick — kept
          // non-functional to mirror upstream.
          disabled: true,
          onClick: () => undefined,
        },
      }),
    ],
    [t, getOperationTypeLabel, getOperationStatusLabel],
  );
}

export function useChainColumns() {
  const t = useTranslations('modules.key-management');

  return React.useMemo<ColumnDef<ChainRow>[]>(
    () => [
      {
        accessorKey: 'blockchain',
        header: t('key_management_0063'),
        cell: ({ getValue }) => (getValue() as string) || '--',
      },
      {
        accessorKey: 'serviceProviderBlockchainName',
        header: t('key_management_0045'),
        cell: ({ getValue }) => (getValue() as string) || '--',
      },
      {
        accessorKey: 'serviceProviderBlockchainId',
        header: t('key_management_0046'),
        cell: ({ getValue }) => (getValue() as string) || '--',
      },
    ],
    [t],
  );
}
