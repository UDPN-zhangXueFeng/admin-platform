'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import type { ModuleManifest } from '@myorg/shared/model';

interface ModuleEntry {
  manifest: () => Promise<ModuleManifest>;
  pages: Record<string, () => Promise<{ default: ComponentType<unknown> }>>;
}

const moduleRegistry: Record<string, ModuleEntry> = {
  user: {
    manifest: () => import('@myorg/modules/user/feature').then((m) => m.manifest),
    pages: {
      list: () =>
        import('@myorg/modules/user/feature').then((m) => ({
          default: m.UserListPage as unknown as ComponentType<unknown>,
        })),
      detail: () =>
        import('@myorg/modules/user/feature').then((m) => ({
          default: m.UserDetailPage as unknown as ComponentType<unknown>,
        })),
      create: () =>
        import('@myorg/modules/user/feature').then((m) => ({
          default: m.UserFormPage as unknown as ComponentType<unknown>,
        })),
      edit: () =>
        import('@myorg/modules/user/feature').then((m) => ({
          default: m.UserFormPage as unknown as ComponentType<unknown>,
        })),
    },
  },
  'key-management': {
    manifest: () =>
      import('@myorg/modules/key-management/feature').then((m) => m.manifest),
    pages: {
      list: () =>
        import('@myorg/modules/key-management/feature').then((m) => ({
          default: m.KeySignedTransactionsListPage as unknown as ComponentType<unknown>,
        })),
      detail: () =>
        import('@myorg/modules/key-management/feature').then((m) => ({
          default: m.KeySignedTransactionsDetailPage as unknown as ComponentType<unknown>,
        })),
    },
  },
  order: {
    manifest: () => import('@myorg/modules/order/feature').then((m) => m.manifest),
    pages: {
      list: () =>
        import('@myorg/modules/order/feature').then((m) => ({
          default: m.OrderListPage as unknown as ComponentType<unknown>,
        })),
      detail: () =>
        import('@myorg/modules/order/feature').then((m) => ({
          default: m.OrderDetailPage as unknown as ComponentType<unknown>,
        })),
      create: () =>
        import('@myorg/modules/order/feature').then((m) => ({
          default: m.OrderFormPage as unknown as ComponentType<unknown>,
        })),
    },
  },
  'travel-rule': {
    manifest: () =>
      import('@myorg/modules/travel-rule/feature').then((m) => m.manifest),
    pages: {
      list: () =>
        import('@myorg/modules/travel-rule/feature').then((m) => ({
          default: m.TravelRuleListPage as unknown as ComponentType<unknown>,
        })),
    },
  },
  'chart-of-accounts': {
    manifest: () =>
      import('@myorg/modules/chart-of-accounts/feature').then((m) => m.manifest),
    pages: {
      list: () =>
        import('@myorg/modules/chart-of-accounts/feature').then((m) => ({
          default: m.ChartOfAccountsListPage as unknown as ComponentType<unknown>,
        })),
      detail: () =>
        import('@myorg/modules/chart-of-accounts/feature').then((m) => ({
          default: m.ChartOfAccountsDetailPage as unknown as ComponentType<unknown>,
        })),
    },
  },
  'journal-entries-new': {
    manifest: () =>
      import('@myorg/modules/journal-entries-new/feature').then((m) => m.manifest),
    pages: {
      list: () =>
        import('@myorg/modules/journal-entries-new/feature').then((m) => ({
          default: m.JournalEntriesNewListPage as unknown as ComponentType<unknown>,
        })),
      detail: () =>
        import('@myorg/modules/journal-entries-new/feature').then((m) => ({
          default: m.JournalEntriesNewDetailPage as unknown as ComponentType<unknown>,
        })),
    },
  },
  'posting-engine': {
    manifest: () =>
      import('@myorg/modules/posting-engine/feature').then((m) => m.manifest),
    pages: {
      list: () =>
        import('@myorg/modules/posting-engine/feature').then((m) => ({
          default: m.PostingEngineListPage as unknown as ComponentType<unknown>,
        })),
      detail: () =>
        import('@myorg/modules/posting-engine/feature').then((m) => ({
          default: m.PostingEngineDetailPage as unknown as ComponentType<unknown>,
        })),
      edit: () =>
        import('@myorg/modules/posting-engine/feature').then((m) => ({
          default: m.PostingEngineFormPage as unknown as ComponentType<unknown>,
        })),
    },
  },
  'wallet-type': {
    manifest: () =>
      import('@myorg/modules/wallet/feature').then((m) => m.walletTypeManifest),
    pages: {
      list: () =>
        import('@myorg/modules/wallet/feature').then((m) => ({
          default: m.WalletTypeListPage as unknown as ComponentType<unknown>,
        })),
      detail: () =>
        import('@myorg/modules/wallet/feature').then((m) => ({
          default: m.WalletTypeDetailPage as unknown as ComponentType<unknown>,
        })),
      edit: () =>
        import('@myorg/modules/wallet/feature').then((m) => ({
          default: m.WalletTypeFormPage as unknown as ComponentType<unknown>,
        })),
    },
  },
  'user-wallet': {
    manifest: () =>
      import('@myorg/modules/wallet/feature').then((m) => m.userWalletManifest),
    pages: {
      list: () =>
        import('@myorg/modules/wallet/feature').then((m) => ({
          default: m.UserWalletListPage as unknown as ComponentType<unknown>,
        })),
      detail: () =>
        import('@myorg/modules/wallet/feature').then((m) => ({
          default: m.UserWalletDetailPage as unknown as ComponentType<unknown>,
        })),
    },
  },
  'operational-wallet': {
    manifest: () =>
      import('@myorg/modules/wallet/feature').then(
        (m) => m.operationalWalletManifest,
      ),
    pages: {
      list: () =>
        import('@myorg/modules/wallet/feature').then((m) => ({
          default:
            m.OperationalWalletListPage as unknown as ComponentType<unknown>,
        })),
      detail: () =>
        import('@myorg/modules/wallet/feature').then((m) => ({
          default:
            m.OperationalWalletDetailPage as unknown as ComponentType<unknown>,
        })),
    },
  },
  'transaction-event-configuration': {
    manifest: () =>
      import('@myorg/modules/transaction-event-configuration/feature').then(
        (m) => m.manifest,
      ),
    pages: {
      list: () =>
        import('@myorg/modules/transaction-event-configuration/feature').then(
          (m) => ({
            default:
              m.TxEventConfigListPage as unknown as ComponentType<unknown>,
          }),
        ),
      detail: () =>
        import('@myorg/modules/transaction-event-configuration/feature').then(
          (m) => ({
            default:
              m.TxEventConfigDetailPage as unknown as ComponentType<unknown>,
          }),
        ),
    },
  },
  syslog: {
    manifest: () => import('@myorg/modules/syslog/feature').then((m) => m.manifest),
    pages: {
      list: () =>
        import('@myorg/modules/syslog/feature').then((m) => ({
          default: m.SysLogListPage as unknown as ComponentType<unknown>,
        })),
    },
  },
  role: {
    manifest: () => import('@myorg/modules/role/feature').then((m) => m.manifest),
    pages: {
      list: () =>
        import('@myorg/modules/role/feature').then((m) => ({
          default: m.RoleListPage as unknown as ComponentType<unknown>,
        })),
      detail: () =>
        import('@myorg/modules/role/feature').then((m) => ({
          default: m.RoleViewPage as unknown as ComponentType<unknown>,
        })),
      edit: () =>
        import('@myorg/modules/role/feature').then((m) => ({
          default: m.RoleFormPage as unknown as ComponentType<unknown>,
        })),
      create: () =>
        import('@myorg/modules/role/feature').then((m) => ({
          default: m.RoleFormPage as unknown as ComponentType<unknown>,
        })),
    },
  },
  workflow: {
    manifest: () =>
      import('@myorg/modules/workflow/feature').then((m) => m.manifest),
    pages: {
      list: () =>
        import('@myorg/modules/workflow/feature').then((m) => ({
          default: m.WorkflowListPage as unknown as ComponentType<unknown>,
        })),
      detail: () =>
        import('@myorg/modules/workflow/feature').then((m) => ({
          default: m.WorkflowViewPage as unknown as ComponentType<unknown>,
        })),
      edit: () =>
        import('@myorg/modules/workflow/feature').then((m) => ({
          default: m.WorkflowFormPage as unknown as ComponentType<unknown>,
        })),
      create: () =>
        import('@myorg/modules/workflow/feature').then((m) => ({
          default: m.WorkflowFormPage as unknown as ComponentType<unknown>,
        })),
    },
  },
  'suspense-adjustment': {
    manifest: () =>
      import('@myorg/modules/suspense-adjustment/feature').then(
        (m) => m.manifest,
      ),
    pages: {
      list: () =>
        import('@myorg/modules/suspense-adjustment/feature').then((m) => ({
          default:
            m.SuspenseAdjustmentListPage as unknown as ComponentType<unknown>,
        })),
      detail: () =>
        import('@myorg/modules/suspense-adjustment/feature').then((m) => ({
          default:
            m.SuspenseAdjustmentDetailPage as unknown as ComponentType<unknown>,
        })),
      edit: () =>
        import('@myorg/modules/suspense-adjustment/feature').then((m) => ({
          default:
            m.SuspenseAdjustmentFormPage as unknown as ComponentType<unknown>,
        })),
    },
  },
  'audit-trail': {
    manifest: () =>
      import('@myorg/modules/audit-trail/feature').then((m) => m.manifest),
    pages: {
      list: () =>
        import('@myorg/modules/audit-trail/feature').then((m) => ({
          default: m.AuditTrailListPage as unknown as ComponentType<unknown>,
        })),
      detail: () =>
        import('@myorg/modules/audit-trail/feature').then((m) => ({
          default: m.AuditTrailDetailPage as unknown as ComponentType<unknown>,
        })),
    },
  },
  statements: {
    manifest: () =>
      import('@myorg/modules/statements/feature').then((m) => m.manifest),
    pages: {
      list: () =>
        import('@myorg/modules/statements/feature').then((m) => ({
          default: m.StatementsListPage as unknown as ComponentType<unknown>,
        })),
      detail: () =>
        import('@myorg/modules/statements/feature').then((m) => ({
          default: m.StatementsDetailPage as unknown as ComponentType<unknown>,
        })),
    },
  },
  // 顶层模块（源菜单单条 /approval-manage，非 group）：pages 用通用 key
  // { list, detail }，对齐 statements / audit-trail 等顶层模块模式。
  'approval-manage': {
    manifest: () =>
      import('@myorg/modules/approval-manage/feature').then((m) => m.manifest),
    pages: {
      list: () =>
        import('@myorg/modules/approval-manage/feature').then((m) => ({
          default: m.ApprovalManageListPage as unknown as ComponentType<unknown>,
        })),
      detail: () =>
        import('@myorg/modules/approval-manage/feature').then((m) => ({
          default:
            m.ApprovalManageDetailPage as unknown as ComponentType<unknown>,
        })),
    },
  },
  // mmf 分组路由（/mmf/<child>）：拆成 accrual / settlement 两个子模块 entry，
  // pages 用通用 key（list/detail）。对齐 sys group 范本（role/workflow 等）。
  accrual: {
    manifest: () =>
      import('@myorg/modules/mmf/feature').then((m) => m.accrualManifest),
    pages: {
      list: () =>
        import('@myorg/modules/mmf/feature').then((m) => ({
          default: m.AccrualListPage as unknown as ComponentType<unknown>,
        })),
      detail: () =>
        import('@myorg/modules/mmf/feature').then((m) => ({
          default: m.AccrualDetailPage as unknown as ComponentType<unknown>,
        })),
    },
  },
  settlement: {
    manifest: () =>
      import('@myorg/modules/mmf/feature').then((m) => m.settlementManifest),
    pages: {
      list: () =>
        import('@myorg/modules/mmf/feature').then((m) => ({
          default: m.SettlementListPage as unknown as ComponentType<unknown>,
        })),
      detail: () =>
        import('@myorg/modules/mmf/feature').then((m) => ({
          default: m.SettlementDetailPage as unknown as ComponentType<unknown>,
        })),
    },
  },
  'journal-entries': {
    manifest: () =>
      import('@myorg/modules/journal-entries/feature').then((m) => m.manifest),
    pages: {
      list: () =>
        import('@myorg/modules/journal-entries/feature').then((m) => ({
          default: m.JournalEntriesListPage as unknown as ComponentType<unknown>,
        })),
      detail: () =>
        import('@myorg/modules/journal-entries/feature').then((m) => ({
          default: m.JournalEntriesDetailPage as unknown as ComponentType<unknown>,
        })),
      edit: () =>
        import('@myorg/modules/journal-entries/feature').then((m) => ({
          default: m.JournalEntriesFormPage as unknown as ComponentType<unknown>,
        })),
      create: () =>
        import('@myorg/modules/journal-entries/feature').then((m) => ({
          default: m.JournalEntriesFormPage as unknown as ComponentType<unknown>,
        })),
    },
  },
  'tokenized-deposit': {
    manifest: () =>
      import('@myorg/modules/tokenized-deposit/feature').then((m) => m.manifest),
    pages: {
      list: () =>
        import('@myorg/modules/tokenized-deposit/feature').then((m) => ({
          default:
            m.TokenizedDepositOverviewPage as unknown as ComponentType<unknown>,
        })),
      detail: () =>
        import('@myorg/modules/tokenized-deposit/feature').then((m) => ({
          default:
            m.TokenizedDepositViewPage as unknown as ComponentType<unknown>,
        })),
      edit: () =>
        import('@myorg/modules/tokenized-deposit/feature').then((m) => ({
          default:
            m.TokenizedDepositEditPage as unknown as ComponentType<unknown>,
        })),
      onboard: () =>
        import('@myorg/modules/tokenized-deposit/feature').then((m) => ({
          default:
            m.TokenizedDepositOnboardPage as unknown as ComponentType<unknown>,
        })),
    },
  },
  // "Token Management" 主菜单别名 → 复用 tokenized-deposit 模块（同一业务入口，同 Ticket 图标）
  'token-management': {
    manifest: () =>
      import('@myorg/modules/tokenized-deposit/feature').then((m) => m.manifest),
    pages: {
      list: () =>
        import('@myorg/modules/tokenized-deposit/feature').then((m) => ({
          default:
            m.TokenizedDepositOverviewPage as unknown as ComponentType<unknown>,
        })),
      detail: () =>
        import('@myorg/modules/tokenized-deposit/feature').then((m) => ({
          default:
            m.TokenizedDepositViewPage as unknown as ComponentType<unknown>,
        })),
      edit: () =>
        import('@myorg/modules/tokenized-deposit/feature').then((m) => ({
          default:
            m.TokenizedDepositEditPage as unknown as ComponentType<unknown>,
        })),
      onboard: () =>
        import('@myorg/modules/tokenized-deposit/feature').then((m) => ({
          default:
            m.TokenizedDepositOnboardPage as unknown as ComponentType<unknown>,
        })),
    },
  },
  // blockchain 分组路由（/blockchain/<child>）：拆成 deployment / node /
  // smart-contract 三个子模块 entry，pages 用通用 key（list/detail/edit）。
  // 对齐 sys group 范本（role/workflow 等子模块各自 entry）。
  deployment: {
    manifest: () =>
      import('@myorg/modules/blockchain/feature').then(
        (m) => m.deploymentManifest,
      ),
    pages: {
      list: () =>
        import('@myorg/modules/blockchain/feature').then((m) => ({
          default: m.DeploymentListPage as unknown as ComponentType<unknown>,
        })),
      detail: () =>
        import('@myorg/modules/blockchain/feature').then((m) => ({
          default: m.DeploymentDetailPage as unknown as ComponentType<unknown>,
        })),
    },
  },
  node: {
    manifest: () =>
      import('@myorg/modules/blockchain/feature').then((m) => m.nodeManifest),
    pages: {
      list: () =>
        import('@myorg/modules/blockchain/feature').then((m) => ({
          default: m.NodeListPage as unknown as ComponentType<unknown>,
        })),
      edit: () =>
        import('@myorg/modules/blockchain/feature').then((m) => ({
          default: m.NodeEditPage as unknown as ComponentType<unknown>,
        })),
    },
  },
  'smart-contract': {
    manifest: () =>
      import('@myorg/modules/blockchain/feature').then(
        (m) => m.smartContractManifest,
      ),
    pages: {
      list: () =>
        import('@myorg/modules/blockchain/feature').then((m) => ({
          default: m.SmartContractListPage as unknown as ComponentType<unknown>,
        })),
    },
  },
  // cross-chain 分组路由（/cross-chain/<child>）：拆成 cross-chain-transactions /
  // fx-rate / liquidity-pool / rd-bridge / token-pair 五个子模块 entry，pages 用通用
  // key（list/detail/edit）。对齐 blockchain / sys group 范本（group 容器不进 registry）。
  'cross-chain-transactions': {
    manifest: () =>
      import('@myorg/modules/cross-chain/feature').then(
        (m) => m.crossChainTransactionsManifest,
      ),
    pages: {
      list: () =>
        import('@myorg/modules/cross-chain/feature').then((m) => ({
          default:
            m.CrossChainTransactionsListPage as unknown as ComponentType<unknown>,
        })),
      detail: () =>
        import('@myorg/modules/cross-chain/feature').then((m) => ({
          default:
            m.CrossChainTransactionsDetailPage as unknown as ComponentType<unknown>,
        })),
    },
  },
  'fx-rate': {
    manifest: () =>
      import('@myorg/modules/cross-chain/feature').then((m) => m.fxRateManifest),
    pages: {
      list: () =>
        import('@myorg/modules/cross-chain/feature').then((m) => ({
          default: m.FxRateListPage as unknown as ComponentType<unknown>,
        })),
      detail: () =>
        import('@myorg/modules/cross-chain/feature').then((m) => ({
          default: m.FxRateDetailPage as unknown as ComponentType<unknown>,
        })),
    },
  },
  'liquidity-pool': {
    manifest: () =>
      import('@myorg/modules/cross-chain/feature').then(
        (m) => m.liquidityPoolManifest,
      ),
    pages: {
      list: () =>
        import('@myorg/modules/cross-chain/feature').then((m) => ({
          default:
            m.LiquidityPoolListPage as unknown as ComponentType<unknown>,
        })),
      detail: () =>
        import('@myorg/modules/cross-chain/feature').then((m) => ({
          default:
            m.LiquidityPoolDetailPage as unknown as ComponentType<unknown>,
        })),
      edit: () =>
        import('@myorg/modules/cross-chain/feature').then((m) => ({
          default:
            m.LiquidityPoolEditPage as unknown as ComponentType<unknown>,
        })),
    },
  },
  'rd-bridge': {
    manifest: () =>
      import('@myorg/modules/cross-chain/feature').then((m) => m.rdBridgeManifest),
    pages: {
      list: () =>
        import('@myorg/modules/cross-chain/feature').then((m) => ({
          default: m.RdBridgeListPage as unknown as ComponentType<unknown>,
        })),
      detail: () =>
        import('@myorg/modules/cross-chain/feature').then((m) => ({
          default: m.RdBridgeDetailPage as unknown as ComponentType<unknown>,
        })),
      edit: () =>
        import('@myorg/modules/cross-chain/feature').then((m) => ({
          default: m.RdBridgeEditPage as unknown as ComponentType<unknown>,
        })),
    },
  },
  'token-pair': {
    manifest: () =>
      import('@myorg/modules/cross-chain/feature').then(
        (m) => m.tokenPairManifest,
      ),
    pages: {
      list: () =>
        import('@myorg/modules/cross-chain/feature').then((m) => ({
          default: m.TokenPairListPage as unknown as ComponentType<unknown>,
        })),
      detail: () =>
        import('@myorg/modules/cross-chain/feature').then((m) => ({
          default: m.TokenPairDetailPage as unknown as ComponentType<unknown>,
        })),
      edit: () =>
        import('@myorg/modules/cross-chain/feature').then((m) => ({
          default: m.TokenPairEditPage as unknown as ComponentType<unknown>,
        })),
    },
  },
  // pledge 分组路由（/pledge/<child>）：拆成 asset-transaction / reserve-asset-list
  // 两个子模块 entry，pages 用通用 key（list/detail/create）。对齐 cross-chain / blockchain
  // group 范本（group 容器 'pledge' 不进 registry，每子模块各自 entry，id=子模块名）。
  'asset-transaction': {
    manifest: () =>
      import('@myorg/modules/pledge/feature').then(
        (m) => m.assetTransactionManifest,
      ),
    pages: {
      list: () =>
        import('@myorg/modules/pledge/feature').then((m) => ({
          default:
            m.AssetTransactionListPage as unknown as ComponentType<unknown>,
        })),
      // edit→create：源 asset-transaction/edit 实为新建交易页，统一映射到 create pageKey。
      create: () =>
        import('@myorg/modules/pledge/feature').then((m) => ({
          default:
            m.AssetTransactionEditPage as unknown as ComponentType<unknown>,
        })),
    },
  },
  'reserve-asset-list': {
    manifest: () =>
      import('@myorg/modules/pledge/feature').then(
        (m) => m.reserveAssetListManifest,
      ),
    pages: {
      list: () =>
        import('@myorg/modules/pledge/feature').then((m) => ({
          default:
            m.ReserveAssetListPage as unknown as ComponentType<unknown>,
        })),
      // new-view→detail：详情 3 种入口（列表 Details / Popconfirm / asset-ategory 返回）统一映射。
      detail: () =>
        import('@myorg/modules/pledge/feature').then((m) => ({
          default:
            m.ReserveAssetDetailPage as unknown as ComponentType<unknown>,
        })),
      // asset-ategory→create：新增资产类别页（源文件名 typo，实为 asset-category）。
      create: () =>
        import('@myorg/modules/pledge/feature').then((m) => ({
          default:
            m.ReserveAssetCategoryAddPage as unknown as ComponentType<unknown>,
        })),
    },
  },
  'real-time': {
    manifest: () =>
      import('@myorg/modules/reconciliation/feature').then(
        (m) => m.realTimeManifest,
      ),
    pages: {
      list: () =>
        import('@myorg/modules/reconciliation/feature').then((m) => ({
          default: m.RealTimeListPage as unknown as ComponentType<unknown>,
        })),
      detail: () =>
        import('@myorg/modules/reconciliation/feature').then((m) => ({
          default: m.RealTimeDetailPage as unknown as ComponentType<unknown>,
        })),
    },
  },
  reserve: {
    manifest: () =>
      import('@myorg/modules/reconciliation/feature').then(
        (m) => m.reserveManifest,
      ),
    pages: {
      list: () =>
        import('@myorg/modules/reconciliation/feature').then((m) => ({
          default: m.ReserveListPage as unknown as ComponentType<unknown>,
        })),
      detail: () =>
        import('@myorg/modules/reconciliation/feature').then((m) => ({
          default: m.ReserveDetailPage as unknown as ComponentType<unknown>,
        })),
    },
  },
  // interest 分组路由（/interest/<child>）：拆成 interest-policy / interest-accrual /
  // interest-transactions 三个子模块 entry。key 加 group 前缀避免与 mmf 的 accrual 等扁平 key 冲突。
  // 路由解析（[[...slug]]/page.tsx）对 interest group 用 `${module}-${slug[0]}` 作为 registry key。
  'interest-policy': {
    manifest: () =>
      import('@myorg/modules/interest/feature').then(
        (m) => m.policyManifest,
      ),
    pages: {
      list: () =>
        import('@myorg/modules/interest/feature').then((m) => ({
          default: m.PolicyListPage as unknown as ComponentType<unknown>,
        })),
      detail: () =>
        import('@myorg/modules/interest/feature').then((m) => ({
          default: m.PolicyDetailPage as unknown as ComponentType<unknown>,
        })),
      edit: () =>
        import('@myorg/modules/interest/feature').then((m) => ({
          default: m.PolicyDepositEditPage as unknown as ComponentType<unknown>,
        })),
      create: () =>
        import('@myorg/modules/interest/feature').then((m) => ({
          default: m.PolicyDepositEditPage as unknown as ComponentType<unknown>,
        })),
    },
  },
  'interest-accrual': {
    manifest: () =>
      import('@myorg/modules/interest/feature').then(
        (m) => m.accrualManifest,
      ),
    pages: {
      list: () =>
        import('@myorg/modules/interest/feature').then((m) => ({
          default: m.AccrualListPage as unknown as ComponentType<unknown>,
        })),
      detail: () =>
        import('@myorg/modules/interest/feature').then((m) => ({
          default: m.AccrualDetailPage as unknown as ComponentType<unknown>,
        })),
    },
  },
  'interest-transactions': {
    manifest: () =>
      import('@myorg/modules/interest/feature').then(
        (m) => m.transactionsManifest,
      ),
    pages: {
      list: () =>
        import('@myorg/modules/interest/feature').then((m) => ({
          default: m.TransactionsListPage as unknown as ComponentType<unknown>,
        })),
      detail: () =>
        import('@myorg/modules/interest/feature').then((m) => ({
          default: m.TransactionsDetailPage as unknown as ComponentType<unknown>,
        })),
    },
  },
  // screening-monitoring 分组路由（/screening-monitoring/<child>）：拆成 rule / transaction-monitoring / screening-providers
  rule: {
    manifest: () => import('@myorg/modules/screening-monitoring/feature').then((m) => m.ruleManifest),
    pages: {
      list: () => import('@myorg/modules/screening-monitoring/feature').then((m) => ({ default: m.RuleListPage as unknown as ComponentType<unknown> })),
      detail: () => import('@myorg/modules/screening-monitoring/feature').then((m) => ({ default: m.RuleDetailPage as unknown as ComponentType<unknown> })),
      edit: () => import('@myorg/modules/screening-monitoring/feature').then((m) => ({ default: m.RuleEditPage as unknown as ComponentType<unknown> })),
      create: () => import('@myorg/modules/screening-monitoring/feature').then((m) => ({ default: m.RuleEditPage as unknown as ComponentType<unknown> })),
      t_edit: () => import('@myorg/modules/screening-monitoring/feature').then((m) => ({ default: m.RuleTEditPage as unknown as ComponentType<unknown> })),
    },
  },
  'transaction-monitoring': {
    manifest: () => import('@myorg/modules/screening-monitoring/feature').then((m) => m.transactionMonitoringManifest),
    pages: {
      list: () => import('@myorg/modules/screening-monitoring/feature').then((m) => ({ default: m.TransactionMonitoringListPage as unknown as ComponentType<unknown> })),
      detail: () => import('@myorg/modules/screening-monitoring/feature').then((m) => ({ default: m.TransactionMonitoringDetailPage as unknown as ComponentType<unknown> })),
    },
  },
  'screening-providers': {
    manifest: () => import('@myorg/modules/screening-monitoring/feature').then((m) => m.screeningProvidersManifest),
    pages: {
      list: () => import('@myorg/modules/screening-monitoring/feature').then((m) => ({ default: m.ScreeningProvidersPage as unknown as ComponentType<unknown> })),
    },
  },
  'statistics-reports': {
    manifest: () => import('@myorg/modules/statistics-reports/feature').then((m) => m.statisticsReportsManifest),
    pages: { list: () => import('@myorg/modules/statistics-reports/feature').then((m) => ({ default: m.StatisticsReportsPage as unknown as ComponentType<unknown> })) },
  },
  'account-manage': {
    manifest: () => import('@myorg/modules/account-manage/feature').then((m) => m.accountManageManifest),
    pages: {
      list: () => import('@myorg/modules/account-manage/feature').then((m) => ({ default: m.AccountManagePage as unknown as ComponentType<unknown> })),
      detail: () => import('@myorg/modules/account-manage/feature').then((m) => ({ default: m.AccountRegisterPage as unknown as ComponentType<unknown> })),
    },
  },
  'statistic-analysis': {
    manifest: () => import('@myorg/modules/statistic-analysis/feature').then((m) => m.statisticAnalysisManifest),
    pages: { list: () => import('@myorg/modules/statistic-analysis/feature').then((m) => ({ default: m.StatisticAnalysisPage as unknown as ComponentType<unknown> })) },
  },
  'transaction-flow': {
    manifest: () => import('@myorg/modules/transaction-flow/feature').then((m) => m.transactionFlowManifest),
    pages: { list: () => import('@myorg/modules/transaction-flow/feature').then((m) => ({ default: m.TransactionFlowPage as unknown as ComponentType<unknown> })) },
  },
  'data-export': {
    manifest: () => import('@myorg/modules/data-export/feature').then((m) => m.dataExportManifest),
    pages: { list: () => import('@myorg/modules/data-export/feature').then((m) => ({ default: m.DataExportPage as unknown as ComponentType<unknown> })) },
  },
  networks: {
    manifest: () => import('@myorg/modules/networks/feature').then((m) => m.networksManifest),
    pages: { list: () => import('@myorg/modules/networks/feature').then((m) => ({ default: m.NetworksPage as unknown as ComponentType<unknown> })) },
  },
};

const manifestCache = new Map<string, ModuleManifest>();

export function loadModulePage(
  moduleId: string,
  pageKey: string,
): ComponentType<unknown> | null {
  const loader = moduleRegistry[moduleId]?.pages[pageKey];
  if (!loader) return null;

  return dynamic(() => loader(), { ssr: false }) as unknown as ComponentType<unknown>;
}

export async function getModuleManifest(moduleId: string): Promise<ModuleManifest | null> {
  const cached = manifestCache.get(moduleId);
  if (cached) return cached;

  const entry = moduleRegistry[moduleId];
  if (!entry) return null;

  const manifest = await entry.manifest();
  manifestCache.set(moduleId, manifest);
  return manifest;
}
