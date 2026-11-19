'use client';
import * as React from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { useParams, useSearchParams } from 'next/navigation';
import { Card, PageHeader, Tabs, TabsContent, TabsList, TabsTrigger } from '@myorg/shared/ui';
import { useRouter } from '@myorg/shared/util-i18n';
import { useSpAccessDetailQuery } from '@myorg/modules/td-admin/data-access';
import { SpAccessBaseInfoSection } from './sp-access-base-info-section';
import { SpAccessStatusBadge } from './sp-access-status-badge';
import { SpAccessUserWalletsSection } from './sp-access-user-wallets-section';
import { SpAccessSubmittedTransactionsSection } from './sp-access-submitted-transactions-section';
import { SpAccessOperationRecordsSection } from './sp-access-operation-records-section';

/**
 * SP 服务商详情页（上游 t_view.tsx）。
 * URL 形态 `/sp-access/detail?id={spId}&spCode={spCode}`；列表行的 `id` 传入
 * detail/basicInfo 的 `{ spId }`。审批页是独立链路，才使用 `{ spRecordId }`。
 * 基本信息通过 POST detail/basicInfo 拉取。
 */
export function SpAccessDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const t = useTranslations('modules.sp-access');
  const tBack = useTranslations('modules.workflow');
  const router = useRouter();

  const rawId = searchParams.get('id');
  const spCode = searchParams.get('spCode') ?? '';
  const slug = Array.isArray(params?.slug) ? params.slug : [];
  const rawParamId = slug.length > 1 ? slug[1] : (slug[0] ?? '');
  const spId = Number(rawId ?? rawParamId);

  const { data: detail, isLoading, error } = useSpAccessDetailQuery(
    Number.isFinite(spId) && spId > 0 ? spId : undefined,
  );

  React.useEffect(() => {
    if (error) toast.error(error instanceof Error ? error.message : t('sp_access_0125'));
  }, [error, t]);

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <PageHeader title={t('sp_access_0107')} backLabel={tBack('action.back')} onBack={() => router.back()} />
        <Card className="h-64 animate-pulse" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="space-y-4">
        <PageHeader title={t('sp_access_0107')} backLabel={tBack('action.back')} onBack={() => router.back()} />
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
          <p className="text-sm text-muted-foreground">{spCode}</p>
        </div>
      </div>
    );
  }

  const effectiveSpCode = spCode || detail.spCode || '';

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('sp_access_0107')}
        backLabel={tBack('action.back')}
        onBack={() => router.back()}
        actions={
          <SpAccessStatusBadge
            kind="spStatus"
            status={Number(detail.state)}
          />
        }
      />
      <Tabs defaultValue="base-info" className="w-full">
        <TabsList>
          <TabsTrigger value="base-info">{t('sp_access_0038')}</TabsTrigger>
          <TabsTrigger value="user-wallets">{t('sp_access_0051')}</TabsTrigger>
          <TabsTrigger value="submitted-transactions">
            {t('sp_access_0073')}
          </TabsTrigger>
          <TabsTrigger value="operation-records">
            {t('sp_access_0137')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="base-info">
          <SpAccessBaseInfoSection detail={detail} />
        </TabsContent>
        <TabsContent value="user-wallets">
          <SpAccessUserWalletsSection detail={detail} />
        </TabsContent>
        <TabsContent value="submitted-transactions">
          <SpAccessSubmittedTransactionsSection
            detail={detail}
            spCode={effectiveSpCode}
          />
        </TabsContent>
        <TabsContent value="operation-records">
          <SpAccessOperationRecordsSection spCode={effectiveSpCode} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
