/**
 * tokenized-deposit feature barrel.
 *
 * 导出 4 个 registry 页（td-24 manifest 消费）：
 * - OverviewPage（list，运营总览，td-14/15/16/17/18/19）
 * - ViewPage（detail，单币种详情，td-20）
 * - EditPage（edit，编辑，td-11/12/13）
 * - OnboardPage（create，入驻，td-23）
 *
 * 亦导出 OverviewShell 供需要直接渲染壳的场景（如嵌入测试）。
 */
export {
  TokenizedDepositOverviewPage,
} from './tokenized-deposit-overview-page';
export {
  TokenizedDepositViewPage,
} from './tokenized-deposit-view-page';
export {
  TokenizedDepositEditPage,
} from './tokenized-deposit-edit-page';
export {
  TokenizedDepositOnboardPage,
} from './tokenized-deposit-onboard-page';
export {
  OverviewShell,
} from './tokenized-deposit-overview/overview-shell';
export {
  manifest,
} from './module-manifest';
// tokenized-deposit ui barrel.
//
// 命名空间路径：.

export {
  CoaSetupCard,
} from './coa-setup-card';
export type {
  CoaSetupStatus,
  CoaSetupInfo,
  CoaSetupErrors,
  CoaSetupOption,
  CoaSetupCardProps,
} from './coa-setup-card';

export {
  TokenizedDepositStatusBadge,
} from './tokenized-deposit-status-badge';
export type {
  TokenizedDepositBadgeDimension,
  TokenizedDepositStatusBadgeProps,
} from './tokenized-deposit-status-badge';

export {
  TokenizedDepositCopy,
} from './tokenized-deposit-copy';
export type {
  TokenizedDepositCopyProps,
} from './tokenized-deposit-copy';

export {
  TokenSelector,
} from './token-selector';
export type {
  TokenSelectorLabels,
  TokenSelectorMode,
  TokenSelectorOption,
  TokenSelectorProps,
  TokenSelectorStatus,
} from './token-selector';
