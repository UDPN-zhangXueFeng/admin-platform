'use client';

import { useSearchParams } from 'next/navigation';
import { useRouter } from '@myorg/shared/util-i18n';
import { useTranslations } from 'next-intl';
import { PageHeader, Tabs, TabsContent, TabsList, TabsTrigger } from '@myorg/shared/ui';
import { useCoaBasicInfoQuery } from '@myorg/modules/td-admin/data-access';

import { getFinancialBookMetaByBookId } from './financial-book-meta';
import { CoaBasicInformation } from './coa-basic-information';
import { useCoaTree } from './use-coa-tree';
import { useEodBalances } from './use-eod-balances';
import { useTrialBalance } from './use-trial-balance';
import { useOperationRecords } from './use-operation-records';
import { CoaTab } from './coa-tab';
import { CoaAccountEditorDialog } from './coa-account-editor-dialog';
import { CoaToggleDialog } from './coa-toggle-dialog';
import { EodBalancesContent } from './eod-balances-content';
import { EodDetailDrawer } from './eod-detail-drawer';
import { ReviewSuspensePostingsDrawer } from './review-suspense-postings-drawer';
import { TrialBalanceContent } from './trial-balance-content';
import { TrialBalanceActivityDrawer } from './trial-balance-activity-drawer';
import { OperationRecordsContent } from './operation-records-content';

const VALID_TABS = [
  'basic-information',
  'chart-of-accounts',
  'eod-balances',
  'trial-balance',
  'operation-records',
] as const;
type DetailTab = (typeof VALID_TABS)[number];

function isDetailTab(value: string | null): value is DetailTab {
  return !!value && (VALID_TABS as readonly string[]).includes(value);
}


/**
 * ChartOfAccountsDetailPage — 详情视图（tabs 分发）。
 *
 * Basic Information（useCoaBasicInfoQuery：详情接口）+ Chart of Accounts（useCoaTree：树编辑/草稿/启停）+
 * EOD Statements（useEodBalances：余额列表/明细 drawer/post-to-suspense/review）+
 * Trial Balance（useTrialBalance：as-of 汇总/试算表/Activity drawer）+
 * Operation Records（useOperationRecords：筛选/分页/明细 drawer/审批跳转）。
 * 读取 bookNo/financeBookId/tab query params，按 tab 激活对应数据查询。
 */
export function ChartOfAccountsDetailPage() {
  const t = useTranslations('modules.chart-of-accounts');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();

  const bookNo = searchParams.get('bookNo') ?? '';
  const bookName = searchParams.get('bookName');
  const id = Number(searchParams.get('financeBookId'));
  const financeBookId = Number.isSafeInteger(id) && id > 0 ? id : undefined;
  const tab = searchParams.get('tab');
  const normalizedTab = tab === 'eod-statements' ? 'eod-balances' : tab;
  const activeTab = isDetailTab(normalizedTab) ? normalizedTab : 'basic-information';
  const meta = getFinancialBookMetaByBookId(bookNo);
  const detailId = searchParams.get('id') === '2' ? '2' : meta.id;
  const basicInfoQuery = useCoaBasicInfoQuery(financeBookId);
  const basicInfo = basicInfoQuery.data;
  const displayBookName = basicInfo?.bookName || bookName || bookNo || '--';
  /** EOD 货币：live basicInfo.currencyCode → 空串（不伪造 meta.currency）。 */
  const eodCurrency = basicInfo?.currencyCode || '';

  const coa = useCoaTree({
    financeBookId,
    enabled: activeTab === 'chart-of-accounts',
  });
  const eod = useEodBalances({
    financeBookId,
    detailId,
    currency: eodCurrency,
    enabled: activeTab === 'eod-balances',
  });
  const displayBookId = basicInfo?.bookNo || bookNo || '--';
  const trialBalance = useTrialBalance({
    financeBookId,
    enabled: activeTab === 'trial-balance',
    basicInfoLoading: basicInfoQuery.isLoading,
    lastEodPostingRun: basicInfo?.lastEodPostingRun,
    basicInfo: { financialBookName: displayBookName, bookId: displayBookId },
    fallbackCurrency: eodCurrency,
    tokenType: basicInfo?.tokenType,
  });
  const operationRecords = useOperationRecords({
    financeBookId,
    enabled: activeTab === 'operation-records',
  });

  const handleTabChange = (value: string) => {
    if (!isDetailTab(value)) return;
    const query = new URLSearchParams(searchParams.toString());
    query.set('tab', value);
    window.history.replaceState(null, '', `?${query.toString()}`);
  };
  const onBack = () => router.push('/accounting/chart-of-accounts');

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
      <PageHeader title={t('title')} backLabel={t('action.back')} onBack={onBack} />
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="basic-information">{t('tab.basicInformation')}</TabsTrigger>
          <TabsTrigger value="chart-of-accounts">{t('tab.chartOfAccounts')}</TabsTrigger>
          <TabsTrigger value="eod-balances">{t(eod.isFirstBook ? 'tab.eodBalances' : 'tab.eodStatements')}</TabsTrigger>
          <TabsTrigger value="trial-balance">{t('tab.trialBalance')}</TabsTrigger>
          <TabsTrigger value="operation-records">{t('tab.operationRecords')}</TabsTrigger>
        </TabsList>

        {/* Basic Information */}
        <TabsContent value="basic-information">
          <CoaBasicInformation
            info={basicInfo}
            bookNo={bookNo}
            loading={basicInfoQuery.isLoading}
            error={basicInfoQuery.isError}
            onRetry={() => { void basicInfoQuery.refetch(); }}
          />
        </TabsContent>

        {/* Chart of Accounts */}
        <TabsContent value="chart-of-accounts">
          <CoaTab
            description={t('coa.tabDescription', { bookName: displayBookName })}
            alertMessage={t('coa.tabAlert')}
            rows={coa.coaRows}
            columns={coa.columns}
            errorMessage={coa.coaTreeError ? t('common.loadFailed') : undefined}
            loading={coa.coaTreeLoading}
            emptyMessage={tCommon('noData')}
            onSave={coa.handleCoaDraftSubmit}
            saveLabel={t('coa.saveDraft')}
            saveLoading={coa.coaActionSubmitting}
            saveDisabled={!coa.coaDraftAccounts.length}
          />
        </TabsContent>

        {/* EOD Statements */}
        <TabsContent value="eod-balances">
          <EodBalancesContent
            rows={eod.filteredEodRows}
            columns={eod.columns}
            loading={eod.balancesLoading}
            error={eod.balancesError}
            initialFilters={eod.appliedFilters}
            title={t(eod.isFirstBook ? 'tab.eodBalances' : 'tab.eodStatements')}
            onApplyFilters={eod.onApplyFilters}
            onRetry={eod.retryBalances}
            t={(key: string) => t(key)}
          />
        </TabsContent>

        {/* Trial Balance */}
        <TabsContent value="trial-balance">
          <TrialBalanceContent
            bookName={displayBookName}
            filters={trialBalance.filters}
            onFiltersChange={trialBalance.setFilters}
            summary={trialBalance.summary}
            loading={trialBalance.loading}
            error={trialBalance.error}
            columns={trialBalance.columns}
            t={(key: string, values?: Record<string, string | number>) =>
              t(key, values)
            }
          />
        </TabsContent>

        {/* Operation Records */}
        <TabsContent value="operation-records">
          <OperationRecordsContent
            bookName={displayBookName}
            rows={operationRecords.rows}
            columns={operationRecords.columns}
            loading={operationRecords.loading}
            error={operationRecords.error}
            total={operationRecords.total}
            pagination={operationRecords.pagination}
            initialFilters={operationRecords.appliedFilters}
            onApplyFilters={operationRecords.applyFilters}
            onResetFilters={operationRecords.resetFilters}
            onPageChange={operationRecords.goToPage}
            onPageSizeChange={operationRecords.changePageSize}
            t={(key: string, values?: Record<string, string | number>) =>
              t(key, values)
            }
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
        loading={eod.detailLoading}
        error={eod.detailError}
        basicInfo={{ financialBookName: displayBookName }}
        onClose={eod.closeDetail}
        t={(key: string) => t(key)}
      />
      <ReviewSuspensePostingsDrawer
        open={eod.reviewOpen}
        detail={eod.selectedDetail}
        loading={eod.detailLoading}
        error={eod.detailError}
        t={(key: string) => t(key)}
        onCancel={eod.closeDetail}
      />

      {/* Trial Balance activity drawer */}
      <TrialBalanceActivityDrawer
        selectedRow={trialBalance.selectedRow}
        summary={trialBalance.summary}
        meta={trialBalance.activityMeta}
        rows={trialBalance.activityRows}
        loading={trialBalance.activityLoading}
        error={trialBalance.activityError}
        columns={trialBalance.activityColumns}
        basicInfo={{
          financialBookName: displayBookName,
          bookId: displayBookId,
        }}
        onClose={trialBalance.closeActivity}
        t={(key: string, values?: Record<string, string | number>) =>
          t(key, values)
        }
      />
    </div>
  );
}
