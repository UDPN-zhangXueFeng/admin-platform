'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { ArrowRightCircle } from 'lucide-react';
import { PageHeader, CopyableEllipsisText, Timeline, type TimelineItem } from '@myorg/shared/ui';
import {
  useCrossChainTxDetailQuery,
  useCrossChainTxTreeQuery,
  type TransactionTreeNode,
} from '@myorg/modules/td-admin/data-access';
import { EMPTY_DISPLAY } from '.';
import { CrossChainStatusBadge } from '.';
import { formatAdminTimestamp } from '../format-admin-time';

/**
 * 区块链色块（迁移自源码 view.tsx 的 `<span style={{background: t('blockchain_code_color_${name}')}}>`）。
 *
 * blockchain_code_color_* 走 common/blockchain 全局命名空间（i18n 已有），
 * 此处 fallback 透明色避免翻译缺失时空白不可见。
 *
 * 注：useTranslations 只能取单一命名空间，common 命名空间需单独 hook。
 */
function BlockchainCodeChip({
  name,
  color,
}: {
  name?: string;
  color?: string;
}): React.JSX.Element | null {
  if (!name) return null;
  return (
    <span
      className="ml-2 rounded-sm px-1 text-xs text-white"
      style={{ background: color || 'transparent' }}
    >
      {name}
    </span>
  );
}

/**
 * CrossChainTransactionsDetailPage — 跨链交易详情页。
 *
 * 迁移自 td-manage src/pages/cross-chain/cross-chain-transactions/view.tsx（495 行）。
 * useSWR → TanStack Query（useCrossChainTxDetailQuery / useCrossChainTxTreeQuery）。
 *
 * 结构：
 *   1. 顶部信息区 8 字段（transferId 方向 / tokens 含区块链色块 / from·to copyable /
 *      serviceFee / fxRate / 创建时间 / 状态 Tag）。
 *   2. 垂直 Steps 时间线（按 index 0/1/2/3+ 分支渲染不同日志结构）。
 *   3. 底部「返回」按钮。
 *
 * 硬约束（cc-9 summary + 迁移文档第 7.10 节）：
 * - transferId 从 query string 取（列表跳 /cross-chain/cross-chain-transactions/view?transferId=）。
 * - 调 transactions/detail（顶部 8 字段）+ transactions/tree/details（Steps 节点）。
 * - 区块链色块：blockchain_code_color_${sourceBlockName/destinationBlockName}（common 命名空间）。
 * - Steps 按 index 分支：index===0/1/2/3/>=4 各自结构，
 *   35=success 详细（含 txHash 外链 browserUrl + 'tx/' + txHash + 色块 blockShortName + transactionId/tokenCount）、
 *   20·30=空、40=error 简略（仅状态文案）。完整搬运源码时序，勿简化。
 * - current：自动定位首个非成功节点（txStatus∈{20,30,40}）。
 */
export function CrossChainTransactionsDetailPage(): React.JSX.Element {
  const t = useTranslations('modules.cross-chain');
  const tCommon = useTranslations('common');
  const router = useRouter();

  const searchParams = useSearchParams();
  // 列表 / 流动性池详情跳转用 `transferId`；兼容旧深链 `?id=`（源码 view.tsx:25,30 读 query.id）。
  const transferIdStr =
    searchParams.get('transferId') ?? searchParams.get('id') ?? '';
  const transferId =
    transferIdStr !== '' ? Number(transferIdStr) : undefined;
  const hasTransferId = transferId != null && !Number.isNaN(transferId);

  const detailResult = useCrossChainTxDetailQuery(transferId, hasTransferId);
  const treeResult = useCrossChainTxTreeQuery(transferId, hasTransferId);
  const detail = detailResult.data;
  const nodes = treeResult.data ?? [];

  // current：首个非成功节点（txStatus∈{20,30,40}）；全部成功则定位到节点之后。
  const current = React.useMemo(() => {
    const stepIdx = nodes.findIndex(
      (el) => el.txStatus === 20 || el.txStatus === 30 || el.txStatus === 40,
    );
    return stepIdx === -1 ? nodes.length : stepIdx;
  }, [nodes]);

  const timelineItems: TimelineItem[] = nodes.map((el, index) => {
    const isSuccess = el.txStatus === 35;
    const isError = el.txStatus === 40;
    const status = isError ? 'error' : isSuccess ? 'complete' : index === current ? 'current' : 'upcoming';
    return {
      key: index,
      title: t(`cross_chain_transactions_log_title_${index}`),
      description: renderDescription({
        node: el, index, isEmpty: el.txStatus === 20 || el.txStatus === 30,
        isSuccess, isError, t, tCommon,
        statusKey: `cross_chain_transactions_status_${el.txStatus ?? ''}`,
      }),
      status,
    };
  });

  // ── 顶部信息区 8 字段（源码 items useMemo）──
  const infoItems = React.useMemo(() => {
    if (!detail) return [];
    const {
      sourceTokenName,
      sourceBlockName,
      fromCount,
      sourceSymbol,
      sourceCurrencySymbol,
      toCount,
      destinationSymbol,
      destinationCurrencySymbol,
      destinationTokenName,
      destinationBlockName,
      fromAddress,
      toAddress,
      serviceFee,
      fxRate,
      createdOn,
      status,
    } = detail;
    return [
      {
        label: t('cross_chain_00132'),
        node: (
          <div className="flex items-start">
            <div>
              <div>
                <span>{fromCount}</span>
                <span className="ml-2">{sourceSymbol}</span>
              </div>
              <div className="text-xs">{`${fromCount ?? ''} ${
                sourceCurrencySymbol ?? ''
              }`}</div>
            </div>
            <ArrowRightCircle className="mx-2 mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <div>
                <span>{toCount}</span>
                <span className="ml-2">{destinationSymbol}</span>
              </div>
              <div className="text-xs">{`${toCount ?? ''} ${
                destinationCurrencySymbol ?? ''
              }`}</div>
            </div>
          </div>
        ),
      },
      {
        label: t('cross_chain_0083'),
        node: (
          <div className="flex items-start">
            <div>
              <div>
                <span>{sourceTokenName}</span>
                <BlockchainCodeChip
                  name={sourceBlockName}
                  color={tCommon(
                    `blockchain_code_color_${sourceBlockName ?? ''}`,
                  )}
                />
              </div>
              <div className="text-xs">{`${
                sourceCurrencySymbol ?? ''
              }-pegged`}</div>
            </div>
            <ArrowRightCircle className="mx-2 mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <div>
                <span>{destinationTokenName}</span>
                <BlockchainCodeChip
                  name={destinationBlockName}
                  color={tCommon(
                    `blockchain_code_color_${destinationBlockName ?? ''}`,
                  )}
                />
              </div>
              <div className="text-xs">{`${
                destinationCurrencySymbol ?? ''
              }-pegged`}</div>
            </div>
          </div>
        ),
      },
      {
        label: t('cross_chain_0063'),
        node: <CopyableEllipsisText value={fromAddress} maxWidth={260} />,
      },
      {
        label: t('cross_chain_0064'),
        node: <CopyableEllipsisText value={toAddress} maxWidth={260} />,
      },
      {
        label: t('cross_chain_0066'),
        node: (
          <span>{`${serviceFee ?? ''} ${sourceSymbol ?? ''} ${t(
            'cross_chain_0090',
          )}`}</span>
        ),
      },
      {
        label: t('cross_chain_0067'),
        node: (
          <span>{`${
            sourceCurrencySymbol ?? ''
          }/${destinationCurrencySymbol ?? ''} = ${fxRate ?? ''}`}</span>
        ),
      },
      {
        label: t('filter.createTime'),
        node: (
          <span>
            {createdOn != null
              ? formatAdminTimestamp(Number(createdOn))
              : EMPTY_DISPLAY}
          </span>
        ),
      },
      {
        label: t('filter.status'),
        node: <CrossChainStatusBadge kind="cross-chain-tx" status={status} />,
      },
    ];
  }, [detail, t, tCommon]);

  return (
    <div className="space-y-4">
      {/* 顶部信息区 */}
      <div className="bg-card p-4 shadow-sm">
        <PageHeader className="mb-4" backLabel={t('action.back')} onBack={() => router.back()} title={t('cross_chain_0093')} />
        <div className="mb-4">{t('cross_chain_00102')}</div>
        <div className="mb-4 rounded-md border border-solid border-slate-200 p-4">
          {infoItems.map((item, key) => (
            <div key={key} className="my-6 flex items-center">
              <div className="w-[20%]">{item.label}</div>
              <div className="flex items-center">{item.node}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Steps 垂直时间线 */}
      <div className="mt-4 bg-card p-4 shadow-sm">
        <div className="mb-4">{t('cross_chain_00103')}</div>
        <div className="mb-4 rounded-md border border-solid border-slate-200 p-4">
          <Timeline items={timelineItems} ariaLabel={t('cross_chain_00103')} />
        </div>
      </div>

    </div>
  );
}


/** 按分支渲染节点描述（完整搬运源码逻辑，保持 index 0/1/2/3/>=4 各自结构）。 */
function renderDescription(args: {
  node: TransactionTreeNode;
  index: number;
  isEmpty: boolean;
  isSuccess: boolean;
  isError: boolean;
  t: ReturnType<typeof useTranslations>;
  tCommon: ReturnType<typeof useTranslations>;
  statusKey: string;
}): React.ReactNode {
  const {
    node,
    index,
    isEmpty,
    isSuccess,
    isError,
    t,
    tCommon,
    statusKey,
  } = args;

  // 20·30：空描述（源码返回 ''）。
  if (isEmpty) return null;

  // 35=success：详细（各 index 字段集合不同）。
  if (isSuccess) {
    if (index === 0) {
      return (
        <>
          <BulletRow>{t(statusKey)}</BulletRow>
          <BulletRow>
            <span className="mr-1">{`${t('cross_chain_00110')}:`}</span>
            <CopyableEllipsisText
              value={node.transactionId}
              maxWidth={240}
            />
          </BulletRow>
          <BulletRow>
            <span>{`${t('cross_chain_00111')}: ${node.tokenCount ?? ''} ${
              node.tokenSymbol ?? ''
            } ${t('cross_chain_00105')}`}</span>
          </BulletRow>
          <BulletRow>
            <span className="mr-1">{`${t('cross_chain_00112')}:`}</span>
            <TxHashLink node={node} t={t} tCommon={tCommon} />
          </BulletRow>
          <BulletRow>
            <span>
              {node.txTime != null
                ? formatAdminTimestamp(Number(node.txTime))
                : EMPTY_DISPLAY}
            </span>
          </BulletRow>
        </>
      );
    }
    if (index === 1) {
      return (
        <>
          <BulletRow>{t(statusKey)}</BulletRow>
          <BulletRow>
            <span>
              {node.txTime != null
                ? formatAdminTimestamp(Number(node.txTime))
                : EMPTY_DISPLAY}
            </span>
          </BulletRow>
        </>
      );
    }
    if (index === 2) {
      return (
        <>
          <BulletRow>{t(statusKey)}</BulletRow>
          <BulletRow>
            <span>{node.remarks ?? ''}</span>
          </BulletRow>
          <BulletRow>
            <span>
              {node.txTime != null
                ? formatAdminTimestamp(Number(node.txTime))
                : EMPTY_DISPLAY}
            </span>
          </BulletRow>
        </>
      );
    }
    if (index === 3) {
      return (
        <>
          <BulletRow>{t(statusKey)}</BulletRow>
          <BulletRow>
            <span className="mr-1">{`${t('cross_chain_00112')}:`}</span>
            <TxHashLink node={node} t={t} tCommon={tCommon} />
          </BulletRow>
          <BulletRow>
            <span>
              {node.txTime != null
                ? formatAdminTimestamp(Number(node.txTime))
                : EMPTY_DISPLAY}
            </span>
          </BulletRow>
        </>
      );
    }
    // index >= 4：方向相反文案 cross_chain_00106。
    return (
      <>
        <BulletRow>{t(statusKey)}</BulletRow>
        <BulletRow>
          <span>{`${t('cross_chain_00111')}: ${node.tokenCount ?? ''} ${
            node.tokenSymbol ?? ''
          } ${t('cross_chain_00106')}`}</span>
        </BulletRow>
        <BulletRow>
          <span className="mr-1">{`${t('cross_chain_00112')}:`}</span>
          <TxHashLink node={node} t={t} tCommon={tCommon} />
        </BulletRow>
        <BulletRow>
          <span>
            {node.txTime != null
              ? formatAdminTimestamp(Number(node.txTime))
              : EMPTY_DISPLAY}
          </span>
        </BulletRow>
      </>
    );
  }

  // 40=error：仅状态文案（源码：t(statusKey)，注释掉的 remarks/txTime 不迁移）。
  if (isError) {
    return <BulletRow>{t(statusKey)}</BulletRow>;
  }

  // 兜底：状态文案。
  return <BulletRow>{t(statusKey)}</BulletRow>;
}

/** txHash 外链 + 色块 + copyable（迁移自源码 Paragraph copyable + <a> + 色块 span）。 */
function TxHashLink({
  node,
  t,
  tCommon,
}: {
  node: TransactionTreeNode;
  t: ReturnType<typeof useTranslations>;
  tCommon: ReturnType<typeof useTranslations>;
}): React.JSX.Element {
  const href =
    node.browserUrl && node.txHash
      ? `${node.browserUrl}tx/${node.txHash}`
      : undefined;
  const shortHash = node.txHash
    ? `${node.txHash.substring(0, 10)}...${node.txHash.substring(
        node.txHash.length - 8,
      )}`
    : EMPTY_DISPLAY;
  return (
    <span className="inline-flex min-w-0 items-center">
      <CopyableEllipsisText
        value={node.txHash}
        maxWidth={200}
        copyLabel={t('action.view')}
      />
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-2 text-primary hover:underline"
        >
          {shortHash}
        </a>
      ) : null}
      <BlockchainCodeChip
        name={node.blockShortName}
        color={tCommon(`blockchain_code_color_${node.blockShortName ?? ''}`)}
      />
    </span>
  );
}

/** 带圆点前缀的描述行。 */
function BulletRow({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex items-start">
      <span aria-hidden="true" className="mt-[7px] mr-2 size-1 shrink-0 rounded-full bg-muted-foreground/50" />
      <span className="min-w-0">{children}</span>
    </div>
  );
}
