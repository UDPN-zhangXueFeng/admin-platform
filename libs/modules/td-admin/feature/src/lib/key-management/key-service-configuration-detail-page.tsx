/**
 * KeyServiceConfigurationDetailPage — read-only detail view with two tabs.
 *
 * Tab 1 (Basic Information): key service details (wallet groups + audit
 * strip), access parameter details (url + Parameters table) and supported
 * chains details (table).
 * Tab 2 (Operation Records): filter + paginated table (sibling component).
 *
 * The service name and status render only in the page header; field, label
 * and column definitions live in `.fields.tsx`/`.tables.tsx`.
 *
 * Source: td-manage/src/pages/key-management/key-service-configuration/detail.tsx
 */

'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';

import {
  DataTable,
  DetailField,
  DetailGrid,
  DetailSection,
  PageHeader,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@myorg/shared/ui';

import { useKeyServiceConfigurationDetailQuery } from '@myorg/modules/td-admin/data-access';
import { keyServiceStatusToneMap } from './constants';
import {
  KeyServiceBasicFields,
  StatusBadge,
  useKeyServiceConfigurationLabels,
} from './key-service-configuration-detail.fields';
import {
  buildChainRows,
  buildParameterRows,
  useChainColumns,
  useParameterColumns,
} from './key-service-configuration-detail.tables';
import { KeyServiceOperationRecordsTab } from './key-service-configuration-detail-records-tab';

export function KeyServiceConfigurationDetailPage() {
  const t = useTranslations('modules.key-management');
  const router = useRouter();
  const searchParams = useSearchParams();

  const keyServiceCode = React.useMemo(
    () => searchParams.get('id') ?? undefined,
    [searchParams],
  );

  const {
    data: detail,
    isLoading,
    isError,
    error,
    refetch,
  } = useKeyServiceConfigurationDetailQuery(keyServiceCode);

  const labels = useKeyServiceConfigurationLabels();

  // Sensitive parameter values (credentials) render masked until the
  // operator explicitly reveals one; values are never logged anywhere.
  const [revealedParamIds, setRevealedParamIds] = React.useState<Set<string>>(
    () => new Set(),
  );
  const toggleParamReveal = React.useCallback((id: string) => {
    setRevealedParamIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const parameterColumns = useParameterColumns(
    labels.getParameterTypeLabel,
    revealedParamIds,
    toggleParamReveal,
  );
  const chainColumns = useChainColumns();
  const parameterRows = buildParameterRows(detail);
  const chainRows = buildChainRows(detail);

  return (
    <div className="space-y-6">
      <PageHeader
        backLabel={t('key_management_0056')}
        onBack={() => router.back()}
        title={isLoading ? (
          <Skeleton aria-hidden="true" className="h-8 w-56 max-w-full" />
        ) : (
          detail?.keyServiceName || '--'
        )}
        actions={isLoading ? (
          <Skeleton aria-hidden="true" className="h-6 w-16 rounded-full" />
        ) : detail?.status ? (
          <StatusBadge
            tone={keyServiceStatusToneMap[detail.status] ?? 'default'}
            label={labels.getStatusLabel(detail.status)}
          />
        ) : (
          <span className="text-sm text-muted-foreground">--</span>
        )}
      />

      <Tabs defaultValue="basic" className="w-full">
        <TabsList>
          <TabsTrigger value="basic">{t('key_management_0057')}</TabsTrigger>
          <TabsTrigger value="records">{t('key_management_0058')}</TabsTrigger>
        </TabsList>

        {/* ---------- Tab 1: Basic Information ---------- */}
        <TabsContent value="basic" className="mt-4 space-y-6">
          {isError ? (
            // A single failed detail query must surface once, with an
            // explicit retry, instead of three duplicated error cards.
            <DetailSection
              title={t('key_management_0038')}
              error={{
                message: error?.message || t('key_management_0070'),
                retryLabel: t('key_management_retry'),
                onRetry: () => refetch(),
              }}
            >
              {null}
            </DetailSection>
          ) : (
            <>
              {/* Card A — key service details (wallet groups + audit strip) */}
              <DetailSection
                title={t('key_management_0038')}
                loading={isLoading}
              >
                <KeyServiceBasicFields detail={detail} />
              </DetailSection>

              {/* Card B — access parameters (url + full-width table) */}
              <DetailSection
                title={t('key_management_0039')}
                loading={isLoading}
                skeleton="table"
                contentPadding="none"
              >
                <div className="px-4 pb-4 sm:px-6 sm:pb-6">
                  <DetailGrid>
                    <DetailField
                      label={t('key_management_0007')}
                      value={detail?.url}
                      span="full"
                    />
                  </DetailGrid>
                  <h3 className="mb-3 mt-6 text-sm font-semibold">
                    {t('key_management_0040')}
                  </h3>
                </div>
                <div className="overflow-x-auto border-t border-border/60">
                  <DataTable
                    columns={parameterColumns}
                    data={parameterRows}
                    emptyMessage={t('PUB_NoData')}
                  />
                </div>
              </DetailSection>

              {/* Card C — supported chains (full-width table) */}
              <DetailSection
                title={t('key_management_0044')}
                loading={isLoading}
                skeleton="table"
                contentPadding="none"
              >
                <div className="overflow-x-auto">
                  <DataTable
                    columns={chainColumns}
                    data={chainRows}
                    emptyMessage={t('PUB_NoData')}
                  />
                </div>
              </DetailSection>
            </>
          )}
        </TabsContent>

        {/* ---------- Tab 2: Operation Records ---------- */}
        <TabsContent value="records" className="mt-4 space-y-6">
          <KeyServiceOperationRecordsTab
            keyServiceCode={keyServiceCode}
            keyServiceName={detail?.keyServiceName}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
