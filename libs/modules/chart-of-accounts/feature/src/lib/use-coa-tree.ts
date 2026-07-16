'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ColumnDef } from '@tanstack/react-table';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@myorg/shared/ui';
import {
  chartOfAccountsKeys,
  disableCoaAccounts,
  enableCoaAccounts,
  extractCoaTreeNodes,
  saveCoaAccounts,
  useCoaTreeQuery,
  applyCoaDraftAccounts,
  buildCoaRowsFromTree,
  getBalanceSideByDirectionValue,
  getCoaDraftKey,
  getDirectionValue,
  getAccountTypeValue,
  toCoaSavePayload,
  type AccountEditorFormValues,
  type BookAccountSaveReqVO,
  type CoaAction,
  type CoaDraftAccount,
  type CoaModalState,
  type CoaRow,
  type CoaToggleFormValues,
} from '@myorg/modules/chart-of-accounts/data-access';

import { COA_ROWS, SECOND_BOOK_COA_ROWS } from './chart-of-accounts-detail.constants';
import { getFinancialBookMetaById } from './financial-book-meta';
import { buildCoaColumns } from './coa-columns';

export interface UseCoaTreeOptions {
  financeBookId: number | undefined;
  /** 账本 meta id（'1' / '2'），决定 mock fallback 与 token type 展示。 */
  detailId: string;
  enabled?: boolean;
}

/**
 * useCoaTree — Chart of Accounts tab 的全部状态与操作。
 *
 * 迁移自源 `useChartOfAccounts` 的 COA 部分：树数据（接口失败回退 mock）、
 * 草稿编辑（本地累积，提交时批量保存）、启用/停用（直接调接口）、modal 状态与文案。
 * antd message → useToast；antd Form instance → 由 Dialog 内部 RHF 自管理。
 */
export function useCoaTree({ financeBookId, detailId, enabled = true }: UseCoaTreeOptions) {
  const t = useTranslations('modules.chart-of-accounts');
  const toast = useToast();
  const queryClient = useQueryClient();

  const [coaModalState, setCoaModalState] = useState<CoaModalState>(null);
  const [coaDraftAccounts, setCoaDraftAccounts] = useState<CoaDraftAccount[]>([]);
  const [coaActionSubmitting, setCoaActionSubmitting] = useState(false);

  const bookMeta = useMemo(() => getFinancialBookMetaById(detailId), [detailId]);
  const isFirstBook = bookMeta.id === '1';

  const treeQuery = useCoaTreeQuery(financeBookId, enabled);

  // 接口有数据则用树；否则回退本地 mock（与源项目 fallback 一致）。
  const baseCoaRows = useMemo<CoaRow[]>(() => {
    if (treeQuery.data) {
      const nodes = extractCoaTreeNodes(treeQuery.data);
      if (nodes.length) return buildCoaRowsFromTree(nodes);
    }
    return isFirstBook ? COA_ROWS : SECOND_BOOK_COA_ROWS;
  }, [treeQuery.data, isFirstBook]);

  const coaRows = useMemo(
    () => applyCoaDraftAccounts(baseCoaRows, coaDraftAccounts),
    [baseCoaRows, coaDraftAccounts]
  );

  const getDescendantCoaRows = useCallback(
    (record: CoaRow): CoaRow[] => {
      if (!record.accountCode) return [];
      return coaRows.filter(
        (item) =>
          item.rowType === 'item' &&
          !!item.accountCode &&
          item.accountCode.startsWith(`${record.accountCode}.`)
      );
    },
    [coaRows]
  );

  const getParentCoaRow = useCallback(
    (record: CoaRow): CoaRow | undefined => {
      if (!record.parentCode) return undefined;
      return coaRows.find(
        (item) => item.rowType === 'item' && item.accountCode === record.parentCode
      );
    },
    [coaRows]
  );

  const canAddSubAccount = useCallback((record: CoaRow): boolean => {
    const level = record.depth ?? record.level ?? 0;
    if (level >= 2) return false;
    return !(record.status === 'pending-submit' && record.allowPosting);
  }, []);

  const toggleChildAccounts = useMemo<CoaRow[]>(() => {
    if (
      !coaModalState ||
      (coaModalState.type !== 'deactivate' && coaModalState.type !== 'activate')
    ) {
      return [];
    }
    return getDescendantCoaRows(coaModalState.record).filter((item) => {
      if (!item.bookAccountId) return false;
      return coaModalState.type === 'deactivate'
        ? item.status === 'active'
        : item.status === 'inactive';
    });
  }, [coaModalState, getDescendantCoaRows]);

  const closeCoaModal = useCallback(() => setCoaModalState(null), []);

  const openCoaModal = useCallback(
    (action: CoaAction, record: CoaRow) => {
      if (action === 'new-primary-account') {
        if (record.sectionType) {
          setCoaModalState({
            type: 'new-primary-account',
            sectionType: record.sectionType,
          });
        }
        return;
      }

      if (record.rowType !== 'item') return;
      if (action === 'new-sub-account' && !canAddSubAccount(record)) return;

      if (action === 'activate') {
        const parent = getParentCoaRow(record);
        if (parent && parent.status !== 'active') {
          toast.error(t('coa.activateParentFirst'));
          return;
        }
      }

      setCoaModalState({ type: action, record });
    },
    [canAddSubAccount, getParentCoaRow, toast, t]
  );

  // ── 草稿编辑提交（累积到本地 draft，不直接调接口） ──
  const handleAccountEditorSubmit = useCallback(
    (values: AccountEditorFormValues) => {
      if (
        !coaModalState ||
        coaModalState.type === 'deactivate' ||
        coaModalState.type === 'activate'
      ) {
        return;
      }
      if (!financeBookId) {
        toast.error('financeBookId is missing');
        return;
      }

      const accountCodeInput = values.accountCode?.trim() ?? '';
      const accountCodeSuffixInput = values.accountCodeSuffix?.trim() ?? '';
      const accountName = values.accountName?.trim() ?? '';
      const remarks = values.description?.trim() ?? '';
      const isSubAccountForm =
        coaModalState.type === 'new-sub-account' ||
        (coaModalState.type === 'edit' && !!coaModalState.record.parentCode);
      const isPersistedAccountEdit =
        coaModalState.type === 'edit' && !!coaModalState.record.bookAccountId;

      let accountCode = accountCodeInput;

      if (isSubAccountForm) {
        const parentCode =
          coaModalState.type === 'new-sub-account'
            ? coaModalState.record.accountCode
            : coaModalState.record.parentCode;
        if (!/^\d{2}$/.test(accountCodeSuffixInput)) {
          toast.error(t('coa.code2Digit'));
          return;
        }
        accountCode = `${parentCode || ''}.${accountCodeSuffixInput}`;
      }

      if (isPersistedAccountEdit) {
        accountCode = coaModalState.record.accountCode || accountCode;
      }

      if (!accountCode) {
        toast.error(t('coa.codeRequired'));
        return;
      }
      if (!accountName) {
        toast.error(t('coa.nameRequired'));
        return;
      }

      const isSameRecord = (row: CoaRow): boolean => {
        if (coaModalState.type !== 'edit') return false;
        if (coaModalState.record.bookAccountId && row.bookAccountId) {
          return row.bookAccountId === coaModalState.record.bookAccountId;
        }
        return row.accountCode === coaModalState.record.accountCode;
      };

      const duplicateCode = coaRows.some(
        (row) =>
          row.rowType === 'item' && !isSameRecord(row) && row.accountCode === accountCode
      );
      if (duplicateCode) {
        toast.error(t('coa.duplicateCode'));
        return;
      }

      const duplicateName = coaRows.some(
        (row) =>
          row.rowType === 'item' &&
          !isSameRecord(row) &&
          (row.accountName?.trim().toLowerCase() === accountName.toLowerCase())
      );
      if (duplicateName) {
        toast.error(t('coa.duplicateName'));
        return;
      }

      const accountType =
        coaModalState.type === 'new-primary-account'
          ? coaModalState.sectionType
          : coaModalState.record.accountType;
      const typeValue =
        coaModalState.type === 'edit'
          ? coaModalState.record.typeValue || getAccountTypeValue(accountType)
          : getAccountTypeValue(accountType);
      const directionValue =
        coaModalState.type === 'edit'
          ? coaModalState.record.directionValue || getDirectionValue(accountType)
          : getDirectionValue(accountType);

      if (!typeValue || !directionValue) {
        toast.error(t('coa.invalidAccountType'));
        return;
      }

      const basePayload: BookAccountSaveReqVO = {
        financeBookId,
        accountCode,
        accountName,
        type: typeValue,
        direction: directionValue,
        allowPosting: values.allowPosting ? 1 : 2,
        suspenseAccount: values.allowPosting && values.suspenseAccount ? 1 : 2,
        remarks,
      };

      if (coaModalState.type === 'new-sub-account') {
        basePayload.parentCode = coaModalState.record.accountCode;
        basePayload.level = (coaModalState.record.level || 0) + 1;
      } else if (coaModalState.type === 'new-primary-account') {
        basePayload.level = 0;
      } else if (coaModalState.type === 'edit') {
        if (coaModalState.record.bookAccountId) {
          basePayload.bookAccountId = coaModalState.record.bookAccountId;
        }
        basePayload.parentCode = coaModalState.record.parentCode;
        basePayload.level = coaModalState.record.level;
      }

      const lookupPayload: BookAccountSaveReqVO =
        coaModalState.type === 'edit'
          ? { ...basePayload, accountCode: coaModalState.record.accountCode || basePayload.accountCode }
          : basePayload;
      const lookupDraftKey = getCoaDraftKey(lookupPayload);
      const draftAccount: CoaDraftAccount = {
        ...basePayload,
        draftType: coaModalState.type,
        draftKey: getCoaDraftKey(basePayload),
      };

      setCoaDraftAccounts((prev) => {
        const idx = prev.findIndex(
          (item) =>
            item.draftKey === lookupDraftKey ||
            (coaModalState?.type === 'edit' &&
              !coaModalState.record.bookAccountId &&
              item.accountCode === coaModalState.record.accountCode)
        );
        if (idx === -1) return [...prev, draftAccount];
        const next = [...prev];
        next[idx] = draftAccount;
        return next;
      });
      closeCoaModal();
    },
    [coaModalState, financeBookId, coaRows, closeCoaModal, toast, t]
  );

  // ── 启用 / 停用（直接调接口） ──
  const handleCoaToggleSubmit = useCallback(
    async (values: CoaToggleFormValues) => {
      if (
        !coaModalState ||
        (coaModalState.type !== 'deactivate' && coaModalState.type !== 'activate')
      ) {
        return;
      }
      if (!financeBookId || !coaModalState.record.bookAccountId) {
        toast.error('financeBookId / bookAccountId is missing');
        return;
      }

      const bookAccountIds = [
        coaModalState.record.bookAccountId,
        ...(values.childAccountKeys ?? []).map((key) => Number(key)),
      ].filter((id): id is number => Number.isFinite(id));

      setCoaActionSubmitting(true);
      try {
        const action = coaModalState.type === 'deactivate' ? 'disable' : 'enable';
        const req = { financeBookId, bookAccountIds };
        if (action === 'disable') {
          await disableCoaAccounts(req);
        } else {
          await enableCoaAccounts(req);
        }
        await queryClient.invalidateQueries({ queryKey: chartOfAccountsKeys.coaTrees() });
        closeCoaModal();
      } catch {
        toast.error(t('coa.toggleFailed'));
      } finally {
        setCoaActionSubmitting(false);
      }
    },
    [coaModalState, financeBookId, queryClient, closeCoaModal, toast, t]
  );

  // ── 批量保存草稿 ──
  const handleCoaDraftSubmit = useCallback(async () => {
    if (!coaDraftAccounts.length || !financeBookId) return;
    setCoaActionSubmitting(true);
    try {
      await saveCoaAccounts({
        financeBookId,
        accounts: coaDraftAccounts.map(toCoaSavePayload),
      });
      setCoaDraftAccounts([]);
      await queryClient.invalidateQueries({ queryKey: chartOfAccountsKeys.coaTrees() });
      toast.success(t('coa.saveSuccess'));
    } catch {
      toast.error(t('coa.saveFailed'));
    } finally {
      setCoaActionSubmitting(false);
    }
  }, [coaDraftAccounts, financeBookId, queryClient, toast, t]);

  // ── Modal 文案（迁移自 view.tsx 的 currentModalTitle / modalAccountTypeLabel 等） ──
  const modalAccountType =
    coaModalState?.type === 'new-primary-account'
      ? coaModalState.sectionType
      : coaModalState?.record.accountType;
  const modalAccountTypeLabel =
    modalAccountType === 'assets' ? t('coa.asset') : t('coa.liability');
  const modalBalanceSide =
    coaModalState?.type === 'edit'
      ? coaModalState.record.balanceSide ||
        getBalanceSideByDirectionValue(coaModalState.record.directionValue, modalAccountType)
      : getBalanceSideByDirectionValue(undefined, modalAccountType);
  const modalRecordName =
    coaModalState && coaModalState.type !== 'new-primary-account'
      ? `${coaModalState.record.accountCode ?? ''} – ${coaModalState.record.accountName ?? ''}`
      : '';
  const modalParentRecordName =
    coaModalState?.type === 'edit' && coaModalState.record.parentCode
      ? (() => {
          const parent = coaRows.find(
            (item) =>
              item.rowType === 'item' && item.accountCode === coaModalState.record.parentCode
          );
          return parent
            ? `${parent.accountCode ?? ''} – ${parent.accountName ?? ''}`
            : coaModalState.record.parentCode;
        })()
      : modalRecordName;
  const isParentAccount =
    coaModalState?.type === 'edit' && coaModalState.record.accountCode
      ? coaRows.some(
          (item) =>
            item.rowType === 'item' &&
            !!item.accountCode &&
            item.accountCode.startsWith(`${coaModalState.record.accountCode}.`)
        )
      : false;

  const currentModalTitle = (() => {
    if (!coaModalState) return '';
    if (coaModalState.type === 'new-primary-account') return t('coa.modalNewPrimary');
    if (coaModalState.type === 'new-sub-account') return t('coa.modalNewSub');
    if (coaModalState.type === 'edit') {
      return (coaModalState.record.depth ?? 0) === 0
        ? t('coa.modalEditPrimary')
        : t('coa.modalEditSub');
    }
    if (coaModalState.type === 'activate') return t('common.activate');
    return t('coa.modalDeactivate');
  })();

  const columns = useMemo<ColumnDef<CoaRow>[]>(
    () => buildCoaColumns({ t: (key: string) => t(key), onAction: openCoaModal }),
    [t, openCoaModal]
  );

  // detail-page 需要的基础信息（tokenType 等）来自 bookMeta，由调用方注入；
  // 这里仅暴露 COA 相关派生。
  return {
    coaRows,
    columns,
    coaTreeLoading: treeQuery.isLoading,
    coaModalState,
    coaDraftAccounts,
    coaActionSubmitting,
    toggleChildAccounts,
    openCoaModal,
    closeCoaModal,
    handleAccountEditorSubmit,
    handleCoaToggleSubmit,
    handleCoaDraftSubmit,
    currentModalTitle,
    modalAccountTypeLabel,
    modalBalanceSide,
    modalRecordName,
    modalParentRecordName,
    isParentAccount,
  };
}
