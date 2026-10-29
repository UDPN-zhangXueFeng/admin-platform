'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { useAuth } from '@myorg/shared/util-auth';
import type { TDEditFormValues } from '@myorg/modules/td-admin/data-access/lib/tokenized-deposit/tokenized-deposit.model';

import { useCoaSetup } from './tokenized-deposit-edit/hooks/use-coa-setup';
import { DEFAULT_FORM_VALUES, useTdDraft } from './tokenized-deposit-edit/hooks/use-td-draft';
import { useTdFormData } from './tokenized-deposit-edit/hooks/use-td-form-data';
import { useTdFormHeader } from './tokenized-deposit-edit/hooks/use-td-form-header';
import { useTdQueryErrorToast } from './tokenized-deposit-edit/hooks/use-td-query-error-toast';
import { useTdReset } from './tokenized-deposit-edit/hooks/use-td-reset';
import { useTdStepNav } from './tokenized-deposit-edit/hooks/use-td-step-nav';
import { useTdWalletFlow } from './tokenized-deposit-edit/hooks/use-td-wallet-flow';

/**
 * TokenizedDepositFormContent —— add/edit 共享表单内核。
 *
 * 迁移自 td-manage `src/pages/tokenized-deposit/edit.tsx`（386 行）。承载完整的
 * add/edit 表单：useForm + 6 hooks(useDetailInit/useBlockchainEffect/useKeyService/
 * useCoaSetup/useWalletManagement/useTokenizedDepositSubmit) + 3 声明式 query + 8 sections
 * + 2 Modal + 2 AlertDialog。逻辑与原 EditPage 100% 一致，差异仅收敛到 `mode` 入参。
 *
 * ## add / edit 分流（mode 入参，替代原 query.code）
 *
 * - `mode='add'`（OnboardPage 调用，code 恒 undefined）：hasCode=false → useDetailInit
 *   不回填、useBlockchainEffect 设默认链/币种、submit 走 createMutation。
 * - `mode='edit'`（EditPage 调用，code 来自 query.code）：hasCode=true → useDetailInit
 *   回填、applyStatus===35 整页只读、submit 走 editMutation。
 *
 * hasCode 派生 `mode === 'edit' && !!code`，向下透传给所有 section/hook，其余逻辑零改动。
 *
 * ## 默认值（对齐源 initialValues）
 *
 * usPrice:'1' / accountTypeList:[1] / whitelistMode:'full' /
 * enableTokenReconciliation:RECON_DISABLED /
 * enableReserveAssetReconciliation:RECON_DISABLED
 *
 * ## 命令式 ↔ 声明式桥接（源 useSWR/命令式 API → TanStack Query）
 *
 * reserveList/smartContractNameList 仍由 td-11 hooks 的命令式回调
 * (`getReserveList`/`getDeployInfo`) 驱动本地 state，再由声明式 query 消费——桥接语义
 * 与原 EditPage 完全一致。
 *
 * i18n namespace: `modules.tokenized-deposit`。
 *
 * ## 拆分（≤300 行重构，零行为变化）
 *
 * 本文件保留组合根与 FormState 组装；内核拆至 tokenized-deposit-edit/hooks/：
 * use-td-form-data（watch/桥接 state/query/keyService/G6）、use-td-draft（草稿）、
 * use-td-reset、use-td-step-nav、use-td-form-header、use-td-wallet-flow 与
 * ui/td-shared-dialogs。
 */
export interface UseTokenizedDepositFormParams {
  /** 'add' = Onboard 新建态；'edit' = Edit 编辑态（需 code 回填） */
  mode: 'add' | 'edit';
  /** 编辑态的记录 code（来自 query.code）；add 态恒 undefined */
  code?: string;
}

export function useTokenizedDepositForm({
  mode,
  code,
}: UseTokenizedDepositFormParams) {
  const t = useTranslations('modules.tokenized-deposit');
  const router = useRouter();
  const { user } = useAuth();
  const hasCode = mode === 'edit' && !!code;

  // ── 草稿作用域（按用户隔离；anon 兜底对齐 draftKey 契约）──
  const draftScope = React.useMemo(() => ({ userId: user?.id }), [user?.id]);

  // ── 主表单（react-hook-form）──
  const form = useForm<TDEditFormValues>({
    defaultValues: DEFAULT_FORM_VALUES,
  });

  // ── keystore 密码 Modal 表单（源 form1，GenerateWallet keystore 路径 reset/提交）──
  const form1 = useForm<{ password?: string }>();

  // ── form watch + 桥接 state + 声明式 query + keyService + G6 ──
  const { reserveQueryError, contractQueryError, ...data } = useTdFormData({
    form,
    mode,
    hasCode,
  });

  // ── COA 双套数据（useCoaSetup 派生 shouldShowXxx + 双套 data/errors）──
  const { coaQueryError, ...coa } = useCoaSetup({
    mintMethod: data.mintMethod,
    reserveAccountId: data.reserveAccountId,
  });

  // ── 页头/进度/summary 派生（纯展示）──
  const header = useTdFormHeader({ mode, hasCode, form, data });
  const { steps } = header;

  // ── 向导步骤导航（currentStep + 逐步校验）──
  const nav = useTdStepNav({
    form,
    flag: data.flag,
    mintMethod: data.mintMethod,
    steps,
    coa,
  });

  // ── 草稿（仅 add 模式；mount 检测/自动保存/恢复/丢弃/GAP-2/touched 包装）──
  const draft = useTdDraft({ mode, form, draftScope, data, coa });

  // ── Reset application（清草稿 + 默认值 + 重放 mount 默认链/币种）──
  const reset = useTdReset({
    form,
    draftScope,
    coaTouchedRef: draft.coaTouchedRef,
    data,
    coa,
    setCurrentStep: nav.setCurrentStep,
    setMaxReachedStep: nav.setMaxReachedStep,
  });

  // ── 钱包/回填/提交接线 + 共享 sharedDialogs ──
  const flow = useTdWalletFlow({
    form,
    form1,
    code,
    mode,
    router,
    data,
    coa,
    handleSubmitSuccess: draft.handleSubmitSuccess,
  });

  // ── G3：查询加载失败统一反馈 ──
  useTdQueryErrorToast(
    reserveQueryError,
    contractQueryError,
    data.keyServiceError,
    coaQueryError,
  );

  return {
    mode,
    code,
    hasCode,
    t,
    router,
    form,
    form1,
    ...data,
    ...coa,
    ...header,
    ...nav,
    ...draft,
    ...reset,
    ...flow,
  };
}

export type TokenizedDepositFormState = ReturnType<typeof useTokenizedDepositForm>;
