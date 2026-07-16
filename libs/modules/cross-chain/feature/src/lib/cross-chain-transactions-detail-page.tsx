'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { ArrowRightCircle } from 'lucide-react';
import { Button, CopyableEllipsisText } from '@myorg/shared/ui';
import { formatDate } from '@myorg/shared/util-dates';
import {
  useCrossChainTxDetailQuery,
  useCrossChainTxTreeQuery,
  type TransactionTreeNode,
} from '@myorg/modules/cross-chain/data-access';
import { EMPTY_DISPLAY } from '@myorg/modules/cross-chain/util';
import { CrossChainStatusBadge } from '@myorg/modules/cross-chain/ui';

const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';

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
 * - isErrorStatus：检测任一节点 txStatus===40 → Steps status='error'。
 */
export function CrossChainTransactionsDetailPage(): React.JSX.Element {
  const t = useTranslations('modules.cross-chain');
  const tCommon = useTranslations('common');
  const router = useRouter();

  const searchParams = useSearchParams();
  const transferIdStr = searchParams.get('transferId') ?? '';
  const transferId =
    transferIdStr !== '' ? Number(transferIdStr) : undefined;
  const hasTransferId = transferId != null && !Number.isNaN(transferId);

  const detailResult = useCrossChainTxDetailQuery(transferId, hasTransferId);
  const treeResult = useCrossChainTxTreeQuery(transferId, hasTransferId);
  const detail = detailResult.data;
  const nodes = treeResult.data ?? [];

  // current：首个非成功节点（txStatus∈{20,30,40}）；全部成功则定位到末尾。
  // isErrorStatus：任一节点 txStatus===40。
  const { current, isErrorStatus } = React.useMemo(() => {
    const errorIdx = nodes.findIndex(
      (el) => el.txStatus === 40,
    );
    const stepIdx = nodes.findIndex(
      (el) => el.txStatus === 20 || el.txStatus === 30 || el.txStatus === 40,
    );
    return {
      current: stepIdx === -1 ? nodes.length : stepIdx,
      isErrorStatus: errorIdx > -1,
    };
  }, [nodes]);

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
              ? formatDate(Number(createdOn), DATETIME_FMT)
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
          <ol className="space-y-8">
            {nodes.map((el, index) => (
              <StepItem
                key={index}
                node={el}
                index={index}
                isErrorStatus={isErrorStatus}
                current={current}
              />
            ))}
          </ol>
        </div>
      </div>

      <div className="flex justify-center">
        <Button onClick={() => router.back()}>{t('action.back')}</Button>
      </div>
    </div>
  );
}

/**
 * 单个时间线节点（按 index 0/1/2/3+ 分支渲染）。
 *
 * 完整搬运源码 view.tsx transactionLog useMemo 的分支结构：
 * - index===0：35=详细（状态 + transactionId copyable + tokenCount/tokenSymbol/方向文案 +
 *   txHash 外链 browserUrl+'tx/'+txHash + 色块 blockShortName + txTime）；20·30=空；40=仅状态。
 * - index===1：35=状态+txTime；20·30=空；40=状态+txTime。
 * - index===2：35=状态+remarks+txTime；20·30=空；40=仅状态。
 * - index===3：35=状态+txHash 外链+色块+txTime；20·30=空；40=仅状态。
 * - index>=4：35=状态+tokenCount/tokenSymbol（方向相反文案）+txHash 外链+色块+txTime；
 *   20·30=空；40=仅状态。
 *
 * current/isErrorStatus 仅用于节点圆点高亮态（对齐 antd Steps current/status）。
 */
function StepItem({
  node,
  index,
  isErrorStatus,
  current,
}: {
  node: TransactionTreeNode;
  index: number;
  isErrorStatus: boolean;
  current: number;
}): React.JSX.Element {
  const t = useTranslations('modules.cross-chain');
  const tCommon = useTranslations('common');

  const isActive = index === current;
  const isError = node.txStatus === 40;
  const isSuccess = node.txStatus === 35;
  const isEmpty = node.txStatus === 20 || node.txStatus === 30;

  // 圆点态：error 红 / success 绿 / 当前 process 蓝 / 其余灰。
  const dotClass = isError
    ? 'border-red-500 bg-red-500'
    : isSuccess
      ? 'border-green-500 bg-green-500'
      : isActive && !isErrorStatus
        ? 'border-primary bg-primary'
        : 'border-muted-foreground/40 bg-muted-foreground/40';

  const statusKey = `cross_chain_transactions_status_${node.txStatus ?? ''}`;

  return (
    <li className="relative flex gap-4">
      {/* 圆点 + 连接线 */}
      <div className="flex flex-col items-center">
        <span
          className={`mt-1 h-3 w-3 shrink-0 rounded-full border-2 ${dotClass}`}
        />
      </div>
      {/* 内容 */}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">
          {t(`cross_chain_transactions_log_title_${index}`)}
        </div>
        <div className="mt-1 space-y-1 text-sm text-muted-foreground">
          {renderDescription({
            node,
            index,
            isEmpty,
            isSuccess,
            isError,
            t,
            tCommon,
            statusKey,
          })}
        </div>
      </div>
    </li>
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
                ? formatDate(Number(node.txTime), DATETIME_FMT)
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
                ? formatDate(Number(node.txTime), DATETIME_FMT)
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
                ? formatDate(Number(node.txTime), DATETIME_FMT)
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
                ? formatDate(Number(node.txTime), DATETIME_FMT)
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
              ? formatDate(Number(node.txTime), DATETIME_FMT)
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

/** 带「・」前缀的描述行（对齐源码 `<span className="text-2xl">・</span>`）。 */
function BulletRow({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex items-start">
      <span className="mr-1 text-lg leading-none">・</span>
      <span className="min-w-0">{children}</span>
    </div>
  );
}
