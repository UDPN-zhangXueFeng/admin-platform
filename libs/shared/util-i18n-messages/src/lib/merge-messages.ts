/**
 * 翻译消息合并器
 *
 * 根据 locale、项目 ID 和启用的模块列表，按需加载并合并翻译文件：
 * 1. 加载通用翻译（common + layout + auth）
 * 2. 仅加载已启用模块的翻译（tree-shake 未启用模块的翻译）
 * 3. 应用项目专属翻译覆盖（deep merge）
 *
 * 静态 import 保证了 Turbopack/Webpack 在打包时能分析完整的依赖图。
 * 动态 import() 对于完全动态的路径（含变量的模板字符串）可能导致
 * 打包器无法追踪到文件，因此核心翻译文件采用静态 import。
 */

// ── 静态 import：en-US ──
import enUSCommon from './en-US/common.json';
import enUSLayout from './en-US/layout.json';
import enUSAuth from './en-US/auth.json';
import enUSApiMsg from './en-US/api-msg.json';
import enUSDashboard from './en-US/modules/dashboard.json';
import enUSModulesOrder from './en-US/modules/order.json';
import enUSModulesUser from './en-US/modules/user.json';
import enUSModulesTravelRule from './en-US/modules/travel-rule.json';
import enUSModulesChartOfAccounts from './en-US/modules/chart-of-accounts.json';
import enUSModulesJournalEntriesNew from './en-US/modules/journal-entries-new.json';
import enUSModulesPostingEngine from './en-US/modules/posting-engine.json';
import enUSModulesTransactionEventConfiguration from './en-US/modules/transaction-event-configuration.json';
import enUSModulesSyslog from './en-US/modules/syslog.json';
import enUSModulesRole from './en-US/modules/role.json';
import enUSModulesWorkflow from './en-US/modules/workflow.json';
import enUSModulesWallet from './en-US/modules/wallet.json';
import enUSModulesSuspenseAdjustment from './en-US/modules/suspense-adjustment.json';
import enUSModulesAuditTrail from './en-US/modules/audit-trail.json';
import enUSModulesMmf from './en-US/modules/mmf.json';
import enUSModulesStatements from './en-US/modules/statements.json';
import enUSModulesJournalEntries from './en-US/modules/journal-entries.json';
import enUSModulesBlockchain from './en-US/modules/blockchain.json';
import enUSModulesKeyManagement from './en-US/modules/key-management.json';
import enUSModulesCrossChain from './en-US/modules/cross-chain.json';
import enUSModulesTokenizedDeposit from './en-US/modules/tokenized-deposit.json';
import enUSModulesPledge from './en-US/modules/pledge.json';
import enUSModulesApprovalManage from './en-US/modules/approval-manage.json';
import enUSModulesInterest from './en-US/modules/interest.json';
import enUSModulesScreeningMonitoring from './en-US/modules/screening-monitoring.json';
import enUSModulesStatisticsReports from './en-US/modules/statistics-reports.json';
import enUSModulesAccountManage from './en-US/modules/account-manage.json';
import enUSModulesStatisticAnalysis from './en-US/modules/statistic-analysis.json';
import enUSModulesTransactionFlow from './en-US/modules/transaction-flow.json';
import enUSModulesNetworks from './en-US/modules/networks.json';
import enUSModulesScreeningProviders from './en-US/modules/screening-providers.json';
import enUSModulesReconciliation from './en-US/modules/reconciliation.json';
import enUSProjectsEcommerce from './en-US/projects/ecommerce.json';
import enUSProjectsStablecoin from './en-US/projects/stablecoin.json';

// ── 静态 import：zh-CN ──
import zhCNCommon from './zh-CN/common.json';
import zhCNLayout from './zh-CN/layout.json';
import zhCNAuth from './zh-CN/auth.json';
import zhCNApiMsg from './zh-CN/api-msg.json';
import zhCNDashboard from './zh-CN/modules/dashboard.json';
import zhCNModulesOrder from './zh-CN/modules/order.json';
import zhCNModulesUser from './zh-CN/modules/user.json';
import zhCNModulesTravelRule from './zh-CN/modules/travel-rule.json';
import zhCNModulesChartOfAccounts from './zh-CN/modules/chart-of-accounts.json';
import zhCNModulesJournalEntriesNew from './zh-CN/modules/journal-entries-new.json';
import zhCNModulesPostingEngine from './zh-CN/modules/posting-engine.json';
import zhCNModulesTransactionEventConfiguration from './zh-CN/modules/transaction-event-configuration.json';
import zhCNModulesSyslog from './zh-CN/modules/syslog.json';
import zhCNModulesRole from './zh-CN/modules/role.json';
import zhCNModulesWorkflow from './zh-CN/modules/workflow.json';
import zhCNModulesWallet from './zh-CN/modules/wallet.json';
import zhCNModulesSuspenseAdjustment from './zh-CN/modules/suspense-adjustment.json';
import zhCNModulesAuditTrail from './zh-CN/modules/audit-trail.json';
import zhCNModulesMmf from './zh-CN/modules/mmf.json';
import zhCNModulesStatements from './zh-CN/modules/statements.json';
import zhCNModulesJournalEntries from './zh-CN/modules/journal-entries.json';
import zhCNModulesBlockchain from './zh-CN/modules/blockchain.json';
import zhCNModulesKeyManagement from './zh-CN/modules/key-management.json';
import zhCNModulesCrossChain from './zh-CN/modules/cross-chain.json';
import zhCNModulesTokenizedDeposit from './zh-CN/modules/tokenized-deposit.json';
import zhCNModulesPledge from './zh-CN/modules/pledge.json';
import zhCNModulesApprovalManage from './zh-CN/modules/approval-manage.json';
import zhCNModulesReconciliation from './zh-CN/modules/reconciliation.json';
import zhCNProjectsEcommerce from './zh-CN/projects/ecommerce.json';
import zhCNProjectsStablecoin from './zh-CN/projects/stablecoin.json';

/** 静态消息映射：locale → { namespace → messages } */
const messageMap: Record<string, Record<string, Record<string, unknown>>> = {
  'en-US': {
    common: enUSCommon as unknown as Record<string, unknown>,
    layout: enUSLayout as unknown as Record<string, unknown>,
    auth: enUSAuth as unknown as Record<string, unknown>,
    'api-msg': enUSApiMsg as unknown as Record<string, unknown>,
    'modules/dashboard': enUSDashboard as unknown as Record<string, unknown>,
    'modules/order': enUSModulesOrder as unknown as Record<string, unknown>,
    'modules/user': enUSModulesUser as unknown as Record<string, unknown>,
    'modules/travel-rule': enUSModulesTravelRule as unknown as Record<string, unknown>,
    'modules/chart-of-accounts': enUSModulesChartOfAccounts as unknown as Record<string, unknown>,
    'modules/journal-entries-new': enUSModulesJournalEntriesNew as unknown as Record<string, unknown>,
    'modules/posting-engine': enUSModulesPostingEngine as unknown as Record<string, unknown>,
    'modules/transaction-event-configuration': enUSModulesTransactionEventConfiguration as unknown as Record<string,unknown>,
    'modules/syslog': enUSModulesSyslog as unknown as Record<string, unknown>,
    'modules/role': enUSModulesRole as unknown as Record<string, unknown>,
    'modules/workflow': enUSModulesWorkflow as unknown as Record<string, unknown>,
    'modules/wallet': enUSModulesWallet as unknown as Record<string, unknown>,
    'modules/suspense-adjustment': enUSModulesSuspenseAdjustment as unknown as Record<string, unknown>,
    'modules/audit-trail': enUSModulesAuditTrail as unknown as Record<string, unknown>,
    'modules/mmf': enUSModulesMmf as unknown as Record<string, unknown>,
    'modules/statements': enUSModulesStatements as unknown as Record<string, unknown>,
    'modules/journal-entries': enUSModulesJournalEntries as unknown as Record<string, unknown>,
    'modules/blockchain': enUSModulesBlockchain as unknown as Record<string, unknown>,
    'modules/key-management': enUSModulesKeyManagement as unknown as Record<string, unknown>,
    'modules/cross-chain': enUSModulesCrossChain as unknown as Record<string, unknown>,
    'modules/tokenized-deposit': enUSModulesTokenizedDeposit as unknown as Record<string, unknown>,
    'modules/pledge': enUSModulesPledge as unknown as Record<string, unknown>,
    'modules/approval-manage': enUSModulesApprovalManage as unknown as Record<string, unknown>,
    'modules/reconciliation': enUSModulesReconciliation as unknown as Record<string, unknown>,
    'modules/interest': enUSModulesInterest as unknown as Record<string, unknown>,
    'modules/screening-monitoring': enUSModulesScreeningMonitoring as unknown as Record<string, unknown>,
    'modules/statistics-reports': enUSModulesStatisticsReports as unknown as Record<string, unknown>,
    'modules/account-manage': enUSModulesAccountManage as unknown as Record<string, unknown>,
    'modules/statistic-analysis': enUSModulesStatisticAnalysis as unknown as Record<string, unknown>,
    'modules/transaction-flow': enUSModulesTransactionFlow as unknown as Record<string, unknown>,
    'modules/networks': enUSModulesNetworks as unknown as Record<string, unknown>,
    'modules/screening-providers': enUSModulesScreeningProviders as unknown as Record<string, unknown>,
    'projects/ecommerce': enUSProjectsEcommerce as unknown as Record<string, unknown>,
    'projects/stablecoin': enUSProjectsStablecoin as unknown as Record<string, unknown>,
  },
  'zh-CN': {
    common: zhCNCommon as unknown as Record<string, unknown>,
    layout: zhCNLayout as unknown as Record<string, unknown>,
    auth: zhCNAuth as unknown as Record<string, unknown>,
    'api-msg': zhCNApiMsg as unknown as Record<string, unknown>,
    'modules/dashboard': zhCNDashboard as unknown as Record<string, unknown>,
    'modules/order': zhCNModulesOrder as unknown as Record<string, unknown>,
    'modules/user': zhCNModulesUser as unknown as Record<string, unknown>,
    'modules/travel-rule': zhCNModulesTravelRule as unknown as Record<string, unknown>,
    'modules/chart-of-accounts': zhCNModulesChartOfAccounts as unknown as Record<string, unknown>,
    'modules/journal-entries-new': zhCNModulesJournalEntriesNew as unknown as Record<string, unknown>,
    'modules/posting-engine': zhCNModulesPostingEngine as unknown as Record<string, unknown>,
    'modules/transaction-event-configuration': zhCNModulesTransactionEventConfiguration as unknown as Record<string,unknown>,
    'modules/syslog': zhCNModulesSyslog as unknown as Record<string, unknown>,
    'modules/role': zhCNModulesRole as unknown as Record<string, unknown>,
    'modules/workflow': zhCNModulesWorkflow as unknown as Record<string, unknown>,
    'modules/wallet': zhCNModulesWallet as unknown as Record<string, unknown>,
    'modules/suspense-adjustment': zhCNModulesSuspenseAdjustment as unknown as Record<string, unknown>,
    'modules/audit-trail': zhCNModulesAuditTrail as unknown as Record<string, unknown>,
    'modules/mmf': zhCNModulesMmf as unknown as Record<string, unknown>,
    'modules/statements': zhCNModulesStatements as unknown as Record<string, unknown>,
    'modules/journal-entries': zhCNModulesJournalEntries as unknown as Record<string, unknown>,
    'modules/blockchain': zhCNModulesBlockchain as unknown as Record<string, unknown>,
    'modules/key-management': zhCNModulesKeyManagement as unknown as Record<string, unknown>,
    'modules/cross-chain': zhCNModulesCrossChain as unknown as Record<string, unknown>,
    'modules/tokenized-deposit': zhCNModulesTokenizedDeposit as unknown as Record<string, unknown>,
    'modules/pledge': zhCNModulesPledge as unknown as Record<string, unknown>,
    'modules/approval-manage': zhCNModulesApprovalManage as unknown as Record<string, unknown>,
    'modules/reconciliation': zhCNModulesReconciliation as unknown as Record<string, unknown>,
    'projects/ecommerce': zhCNProjectsEcommerce as unknown as Record<string, unknown>,
    'projects/stablecoin': zhCNProjectsStablecoin as unknown as Record<string, unknown>,
  },
};

/**
 * 深度合并两个对象，source 的属性递归覆盖 target。
 * 不引入 lodash，保持零依赖。
 */
function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const key of Object.keys(source)) {
    const sourceVal = source[key];
    const targetVal = target[key];

    if (
      typeof sourceVal === 'object' &&
      sourceVal !== null &&
      !Array.isArray(sourceVal) &&
      typeof targetVal === 'object' &&
      targetVal !== null &&
      !Array.isArray(targetVal)
    ) {
      deepMerge(targetVal as Record<string, unknown>, sourceVal as Record<string, unknown>);
    } else {
      target[key] = sourceVal;
    }
  }
}

/** 从静态 map 中获取翻译文件 */
function getMessages(locale: string, namespace: string): Record<string, unknown> {
  return messageMap[locale]?.[namespace] ?? {};
}

/**
 * 合并翻译消息
 *
 * @param locale        当前语言代码，如 'en-US'、'zh-CN'
 * @param projectId     项目标识，如 'ecommerce'、'crm'
 * @param enabledModules 启用的模块 ID 列表，如 ['user', 'order']
 * @returns 合并后的完整消息对象，供 next-intl 的 NextIntlClientProvider 使用
 */
export async function mergeMessages(
  locale: string,
  projectId?: string,
  enabledModules?: string[]
): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {};

  // 1. 加载通用翻译（包裹为 common 命名空间，对齐 layout/auth 模式，
  //    使各模块的 useTranslations('common') 能取到全局公共 key）。
  const common = getMessages(locale, 'common');
  if (Object.keys(common).length > 0) {
    result.common = common;
  }

  const layout = getMessages(locale, 'layout');
  if (Object.keys(layout).length > 0) {
    result.layout = layout;
  }

  // 1.5 加载 auth 命名空间（登录/认证页面，始终加载）
  const auth = getMessages(locale, 'auth');
  if (Object.keys(auth).length > 0) {
    result.auth = auth;
  }

  // 1.6 加载 api-msg 命名空间（API 错误消息，始终加载）
  const apiMsg = getMessages(locale, 'api-msg');
  if (Object.keys(apiMsg).length > 0) {
    result['api-msg'] = apiMsg;
  }

  // 2. 加载启用模块的翻译（未启用的模块不加载）
  if (enabledModules && enabledModules.length > 0) {
    const modulesMap: Record<string, unknown> = {};

    for (const mod of enabledModules) {
      const modMessages = getMessages(locale, `modules/${mod}`);
      if (Object.keys(modMessages).length > 0) {
        modulesMap[mod] = modMessages;
      }
    }

    if (Object.keys(modulesMap).length > 0) {
      result.modules = modulesMap;
    }
  }

  // 3. 应用项目专属覆盖
  if (projectId) {
    const overrides = getMessages(locale, `projects/${projectId}`);
    if (Object.keys(overrides).length > 0) {
      deepMerge(result, overrides);
    }
  }

  return result;
}
