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
export { TokenizedDepositOverviewPage } from './lib/tokenized-deposit-overview-page';
export { TokenizedDepositViewPage } from './lib/tokenized-deposit-view-page';
export { TokenizedDepositEditPage } from './lib/tokenized-deposit-edit-page';
export { TokenizedDepositOnboardPage } from './lib/tokenized-deposit-onboard-page';
export { OverviewShell } from './lib/tokenized-deposit-overview/overview-shell';
export { manifest } from './lib/module-manifest';
