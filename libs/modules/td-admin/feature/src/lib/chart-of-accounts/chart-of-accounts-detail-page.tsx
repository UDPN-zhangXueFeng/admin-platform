'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@myorg/shared/util-i18n';
import { useTranslations } from 'next-intl';
import { Button, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from '@myorg/shared/ui';
import { FIXED_TOKEN_TYPES, useCoaBasicInfoQuery } from '@myorg/modules/td-admin/data-access';

import { getFinancialBookMetaByBookId } from './financial-book-meta';
import { useCoaTree } from './use-coa-tree';
import { useEodBalances } from './use-eod-balances';
import { CoaTab } from './coa-tab';
import { CoaAccountEditorDialog } from './coa-account-editor-dialog';
import { CoaToggleDialog } from './coa-toggle-dialog';
import { EodBalancesContent } from './eod-balances-content';
import { EodDetailDrawer } from './eod-detail-drawer';
import { PostToSuspenseDialog } from './post-to-suspense-dialog';
import { ReviewSuspensePostingsDrawer } from './review-suspense-postings-drawer';

const VALID_TABS = ['basic-information', 'chart-of-accounts', 'eod-statements'] as const;
type DetailTab = (typeof VALID_TABS)[number];

function isDetailTab(value: string | null): value is DetailTab {
  return !!value && (VALID_TABS as readonly string[]).includes(value);
}

function DetailField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium break-words">{children}</dd>
    </div>
  );
}

/** ms 时间戳 → 本地时间字符串（与 sp-access 详情页约定一致）。 */
function formatTimestamp(value?: number): string {
  if (!value) return '--';
  return new Date(value).toLocaleString();
}

/**
 * ChartOfAccountsDetailPage — 详情视图（tabs 分发）。
 *
 * Basic Information（useCoaBasicInfoQuery：详情接口）+ Chart of Accounts（useCoaTree：树编辑/草稿/启停）+
 * EOD Statements（useEodBalances：余额列表/明细 drawer/post-to-suspense/review）。
 * 读取 bookNo/financeBookId/tab query params，按 tab 激活对应数据查询。
 */
export function ChartOfAccountsDetailPage() {
  const t = useTranslations('modules.chart-of-accounts');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();

  const bookNo = searchParams.get('bookNo') ?? '';
  const financeBookIdStr = searchParams.get('financeBookId') ?? '';
  const financeBookId = financeBookIdStr ? Number(financeBookIdStr) : undefined;
  const initialTab = searchParams.get('tab');

  const [activeTab, setActiveTab] = React.useState<DetailTab>(
    isDetailTab(initialTab) ? initialTab : 'basic-information'
  );

  const meta = getFinancialBookMetaByBookId(bookNo);
  const detailId = meta.id;
  const basicInfoQuery = useCoaBasicInfoQuery(financeBookId);
  const basicInfo = basicInfoQuery.data;
  /** 展示名：live basicInfo.bookName → query param bookNo → '--'（不使用本地 sample meta）。 */
  const displayBookName = basicInfo?.bookName || bookNo || '--';
  /** EOD 货币：live basicInfo.currencyCode → 空串（不伪造 meta.currency）。 */
  const eodCurrency = basicInfo?.currencyCode || '';
  const tokenTypeLabels = React.useMemo(
    () =>
      Object.fromEntries(
        FIXED_TOKEN_TYPES.map((tokenType) => [tokenType, t(`tokenType.${tokenType}`)])
      ) as Record<number, string>,
    [t]
  );

  const coa = useCoaTree({
    financeBookId,
    enabled: activeTab === 'chart-of-accounts',
  });
  const eod = useEodBalances({
    financeBookId,
    detailId,
    currency: eodCurrency,
    enabled: activeTab === 'eod-statements',
  });

  const handleTabChange = (value: string) => {
    if (isDetailTab(value)) setActiveTab(value);
  };
  const onBack = () => router.back();

  // AccountEditorDialog 的 open（new-primary / new-sub / edit）
  const editorOpen =
    !!coa.coaModalState &&
    (coa.coaModalState.type === 'new-primary-account' ||
      coa.coaModalState.type === 'new-sub-account' ||
      coa.coaModalState.type === 'edit');
  const toggleOpen =
    !!coa.coaModalState &&
    (coa.coaModalState.type === 'deactivate' ||
      coa.coaModalState.type === 'activate');
  const editorParentAccountCode =
    coa.coaModalState && coa.coaModalState.type !== 'new-primary-account'
      ? coa.coaModalState.type === 'new-sub-account'
        ? coa.coaModalState.record.accountCode
        : coa.coaModalState.record.parentCode
      : undefined;

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="basic-information">{t('tab.basicInformation')}</TabsTrigger>
          <TabsTrigger value="chart-of-accounts">{t('tab.chartOfAccounts')}</TabsTrigger>
          <TabsTrigger value="eod-statements">{t('tab.eodStatements')}</TabsTrigger>
        </TabsList>

        {/* Basic Information */}
        <TabsContent value="basic-information">
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-base font-semibold">{t('detail.basicInformationTitle')}</h2>
              <Button variant="outline" onClick={onBack}>{t('action.back')}</Button>
            </div>
            {basicInfoQuery.isError ? (
              <p className="py-4 text-sm text-destructive" role="alert">
                {t('coa.toggleFailed')}
              </p>
            ) : basicInfo ? (
              <dl className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <DetailField label={t('field.bookName')}>{basicInfo.bookName || '--'}</DetailField>
                <DetailField label={t('field.bookNo')}>{basicInfo.bookNo || '--'}</DetailField>
                <DetailField label={t('detail.financeBookId')}>{financeBookIdStr || '--'}</DetailField>
                <DetailField label={t('field.reserveAssetName')}>{basicInfo.reserveAssetName || '--'}</DetailField>
                <DetailField label={t('field.currency')}>{basicInfo.currencyCode || '--'}</DetailField>
                <DetailField label={t('field.tokenType')}>
                  {basicInfo.tokenType != null
                    ? tokenTypeLabels[basicInfo.tokenType] ?? String(basicInfo.tokenType)
                    : '--'}
                </DetailField>
                <DetailField label={t('field.tokens')}>
                  {(basicInfo.tokens ?? [])
                    .map((token) => token.tokenName)
                    .filter(Boolean)
                    .join(', ') || '--'}
                </DetailField>
                <DetailField label={t('field.eodCutoffTime')}>{basicInfo.eodCutoffTime || '--'}</DetailField>
                <DetailField label={t('field.lastEodPostingRun')}>{basicInfo.lastEodPostingRun || '--'}</DetailField>
                <DetailField label={t('field.createdBy')}>{basicInfo.createdBy || '--'}</DetailField>
                <DetailField label={t('field.createdOn')}>{formatTimestamp(basicInfo.createdOn)}</DetailField>
              </dl>
            ) : basicInfoQuery.isLoading ? (
              <Skeleton className="h-48" />
            ) : (
              <p className="py-4 text-sm text-muted-foreground">{tCommon('noData')}</p>
            )}
          </div>
        </TabsContent>

        {/* Chart of Accounts */}
        <TabsContent value="chart-of-accounts">
          <CoaTab
            description={t('coa.tabDescription', { bookName: displayBookName })}
            alertMessage={t('coa.tabAlert')}
            rows={coa.coaRows}
            columns={coa.columns}
            errorMessage={coa.coaTreeError ? tCommon('common_task_status_40') : undefined}
            loading={coa.coaTreeLoading}
            emptyMessage={tCommon('noData')}
            onBack={onBack}
            backLabel={t('action.back')}
            onSave={coa.handleCoaDraftSubmit}
            saveLabel={t('coa.saveDraft')}
            saveLoading={coa.coaActionSubmitting}
            saveDisabled={!coa.coaDraftAccounts.length}
          />
        </TabsContent>

        {/* EOD Statements */}
        <TabsContent value="eod-statements">
          <EodBalancesContent
            rows={eod.filteredEodRows}
            columns={eod.columns}
            description={t('eod.tabDescription')}
            onApplyFilters={eod.onApplyFilters}
            onBack={onBack}
            t={(key: string) => t(key)}
          />
        </TabsContent>
      </Tabs>

      {/* COA dialogs */}
      <CoaAccountEditorDialog
        open={editorOpen}
        modalState={coa.coaModalState}
        accountTypeLabel={coa.modalAccountTypeLabel}
        balanceSide={coa.modalBalanceSide}
        recordName={coa.modalRecordName}
        parentRecordName={coa.modalParentRecordName}
        parentAccountCode={editorParentAccountCode}
        isParentAccount={coa.isParentAccount}
        submitting={coa.coaActionSubmitting}
        title={coa.currentModalTitle}
        newPrimaryHint={t('coa.newPrimaryHint', { accountType: coa.modalAccountTypeLabel })}
        subAccountAlert={t('coa.subAccountAlert')}
        t={(key: string) => t(key)}
        onSubmit={coa.handleAccountEditorSubmit}
        onCancel={coa.closeCoaModal}
      />
      <CoaToggleDialog
        open={toggleOpen}
        isDeactivate={coa.coaModalState?.type === 'deactivate'}
        recordName={coa.modalRecordName}
        childAccounts={coa.toggleChildAccounts}
        submitting={coa.coaActionSubmitting}
        title={coa.currentModalTitle}
        alertMessage={
          coa.coaModalState?.type === 'deactivate'
            ? t('coa.deactivateAlert')
            : t('coa.activateAlert')
        }
        recordLabel={t('coa.recordLabel')}
        childAccountsLabel={
          coa.coaModalState?.type === 'deactivate'
            ? t('coa.subAccountsToDeactivate')
            : t('coa.enableChildAccounts')
        }
        commentLabel={t('coa.comment')}
        cancelLabel={t('common.cancel')}
        confirmLabel={t('common.confirm')}
        onSubmit={coa.handleCoaToggleSubmit}
        onCancel={coa.closeCoaModal}
      />

      {/* EOD drawer + modals */}
      <EodDetailDrawer
        open={eod.drawerOpen}
        statement={eod.selectedStatement}
        detail={eod.selectedDetail}
        basicInfo={{ financialBookName: displayBookName }}
        onClose={eod.closeDetail}
        t={(key: string) => t(key)}
      />
      <ReviewSuspensePostingsDrawer
        open={eod.reviewOpen}
        detail={eod.selectedDetail}
        t={(key: string) => t(key)}
        onCancel={eod.closeDetail}
        onConfirm={() => {
          /* TODO: 接入审核确认后端 */
          eod.closeDetail();
        }}
      />
      <PostToSuspenseDialog
        open={eod.postToSuspenseOpen}
        config={null}
        currency={eodCurrency}
        title={t('eod.postToSuspenseTitle')}
        t={(key: string) => t(key)}
        onSubmit={() => {
          /* TODO: 接入 post-to-suspense 后端（高风险） */
          eod.closePostToSuspense();
        }}
        onCancel={eod.closePostToSuspense}
      />
    </div>
  );
}
