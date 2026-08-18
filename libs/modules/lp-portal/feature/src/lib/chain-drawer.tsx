'use client';

/**
 * 交易链路抽屉（B6，源 `src/views/tx-flow/chain-drawer.vue` 1:1 语义迁移）。
 *
 * 源语义要点（对照 map「交易链路抽屉」behaviors，一条不漏）：
 * - 抽屉 720px、标题「交易链路」；挂载即开（父页 v-if=drawerRow），
 *   关闭 → onClosed → 父页卸载；
 * - 基本信息取行 props 不二次请求（el-descriptions 2 列 border 等价）：
 *   交易单号 txUuid 优先 txNo 兜底双兜底（F1）、完成时间 completedTime
 *   === 0 显 '-'（严格 ===0 哨兵，与 confirmTime truthy 口径不同源）；
 * - GET /lp/tx-flow/chain/{transactionId}：响应可能为扁平数组或带
 *   children 的树 → flatten 递归摊平（节点 step>0 用自身，否则继承父
 *   step 浅拷贝替换；DFS 父后子追加）；
 * - 0024 → 抽屉内降级条 + nodes 保留（旧数据不清）；
 * - 固定 8 段阶段轴可点击（step 1〜8 缺失补齐，仅收 1≤step≤8 节点）；
 *   阶段状态由前端从 statusTo/交易终态推断，优先级链照源（见
 *   {@link buildStageList}，一条都不能错）；
 * - 事件时间线：选中阶段事件按 eventTime 升序、相同则 flowId 升序；
 *   timestamp 顶部放置；nodeType 2/3/4 映射动作/报文/重试（1 环节兜底
 *   显 `事件类型 ${nodeType}`）；statusFrom/statusTo 任非 0 显迁移文本；
 *   meta 三行 操作人/货币系统交易 ID/备注 空显 '-'；
 * - 两级空态：nodes 空「暂无阶段数据」；选中阶段无事件「该阶段暂无事件
 *   明细」。
 *
 * 本文件同时导出 {@link TxStatusBadge}：列表页与抽屉共用的状态徽标
 * （13 值文案 + 分层变体 + 50 冲正中警示描边），集中一处防两页口径分叉
 * （data-access 禁 UI 依赖，只能落在 feature 层；本文件是 tx-flow-pages
 * 的被依赖叶子，方向单一无环）。
 */
import * as React from 'react';
import { Check, LoaderCircle, Minus, X } from 'lucide-react';

import {
  Badge,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@myorg/shared/ui';
import {
  LP_PROJECT_ID,
  TX_STATUS_LABEL,
  TX_STATUS_VARIANT,
  TX_STATUS_WARN_CLASS,
  isServiceDown,
  txNoText,
  useTxFlowChainQuery,
  type TxChainNode,
  type TxRow,
} from '@myorg/modules/lp-portal/data-access';
import { formatMoney, formatTime } from './format';
import { ServiceDownAlert } from './service-down-alert';

/* ================================================================== */
/* 码表与共享徽标                                                       */
/* ================================================================== */

/** 阶段映射（step 1〜8 阶段轴，固定顺序）。 */
const STAGE_STEP_MAP: Record<number, string> = {
  1: '报价',
  2: '确认',
  3: '源端划转',
  4: '源端验证',
  5: '垫资解付',
  6: '入账',
  7: '结算',
  8: '完成',
};

/** 阶段状态映射（1 未开始 / 2 进行中 / 3 成功 / 4 失败 / 5 跳过）。 */
const STAGE_STATUS_MAP: Record<number, string> = {
  1: '未开始',
  2: '进行中',
  3: '成功',
  4: '失败',
  5: '跳过',
};

/** 事件类型映射（nodeType 2 动作 / 3 报文 / 4 重试；1 环节兜底显数值）。 */
const EVENT_TYPE_MAP: Record<number, string> = {
  2: '动作',
  3: '报文',
  4: '重试',
};

/** 阶段轴条目（响应无阶段对象，由扁平节点按 step 分组自建；裁决 C-10）。 */
interface StageItem {
  step: number;
  /** 1 未开始 / 2 进行中 / 3 成功 / 4 失败 / 5 跳过 */
  status: number;
  startTime: number;
  endTime: number;
}

/** 交易状态徽标：列表页与抽屉共用（未知码显原值，兜底中性变体）。 */
export function TxStatusBadge({ status }: { status: number }) {
  const variant = TX_STATUS_VARIANT[status] ?? 'secondary';
  return (
    <Badge
      variant={variant}
      className={status === 50 ? TX_STATUS_WARN_CLASS : undefined}
    >
      {TX_STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

/* ================================================================== */
/* flatten 与阶段推断（照源逐条平移，勿改优先级链）                       */
/* ================================================================== */

/**
 * chain 响应可能为带 children 的树（TxFlowNodeVO）或扁平数组；递归摊平：
 * 节点 step>0 用自身，否则继承父 step（浅拷贝替换 step）；DFS 父后子追加。
 */
export function flattenChain(
  incoming: TxChainNode[] | null | undefined,
  inheritedStep = 0,
): TxChainNode[] {
  const out: TxChainNode[] = [];
  for (const n of incoming ?? []) {
    const step = n.step > 0 ? n.step : inheritedStep;
    out.push(step === n.step ? n : { ...n, step });
    const children = (n as TxChainNode & { children?: TxChainNode[] })
      .children;
    if (children && children.length) out.push(...flattenChain(children, step));
  }
  return out;
}

/**
 * 固定 8 段阶段轴（照源 stageList 推断规则，一条不能错）：
 * - 仅收 1≤step≤8 节点，maxStep=最深有节点 step；
 * - 【无节点阶段】txStatus===40 → 3 成功；否则 step<maxStep → 5 跳过；
 *   否则 1 未开始（时间 0/0）；
 * - 【有节点阶段】startTime=最早 eventTime（初 0，`startTime===0 ||
 *   n.eventTime<startTime` 时更新）、endTime=最晚 eventTime；状态判定
 *   优先级链：任一节点 statusTo===70||90 → 4 失败；step<maxStep → 3 成功；
 *   txStatus 40|60|80（交易终态）→ 3；txStatus 70|90 → 4 失败；
 *   其余 → 2 进行中。
 */
function buildStageList(nodes: TxChainNode[], txStatus: number): StageItem[] {
  if (!nodes.length) return [];
  const byStep = new Map<number, TxChainNode[]>();
  let maxStep = 0;
  for (const n of nodes) {
    if (n.step < 1 || n.step > 8) continue;
    const list = byStep.get(n.step) ?? [];
    list.push(n);
    byStep.set(n.step, list);
    if (n.step > maxStep) maxStep = n.step;
  }
  const list: StageItem[] = [];
  for (let step = 1; step <= 8; step++) {
    const stepNodes = byStep.get(step);
    if (!stepNodes) {
      let status = 1;
      if (txStatus === 40) status = 3;
      else if (maxStep > 0 && step < maxStep) status = 5;
      list.push({ step, status, startTime: 0, endTime: 0 });
      continue;
    }
    let startTime = 0;
    let endTime = 0;
    for (const n of stepNodes) {
      if (startTime === 0 || n.eventTime < startTime) startTime = n.eventTime;
      if (n.eventTime > endTime) endTime = n.eventTime;
    }
    let status: number;
    if (stepNodes.some((n) => n.statusTo === 70 || n.statusTo === 90))
      status = 4;
    else if (step < maxStep) status = 3;
    else if (txStatus === 40 || txStatus === 60 || txStatus === 80) status = 3;
    else if (txStatus === 70 || txStatus === 90) status = 4;
    else status = 2;
    list.push({ step, status, startTime, endTime });
  }
  return list;
}

/** 默认选中优先级：首个进行中(2)/失败(4)阶段 ?? 首个有事件节点的阶段 ?? step 1。 */
function pickInitialStep(stages: StageItem[], nodes: TxChainNode[]): number {
  const active =
    stages.find((s) => s.status === 2 || s.status === 4) ??
    stages.find((s) => nodes.some((n) => n.step === s.step));
  return active ? active.step : 1;
}

/** 0 显 '-'，其余 formatTime（源 fmtTime）。 */
function fmtTime(ms: number): string {
  return ms === 0 ? '-' : formatTime(ms);
}

/** 状态迁移（from/to 均为 0 时不渲染）。 */
function hasTransit(e: TxChainNode): boolean {
  return (e.statusFrom ?? 0) !== 0 || (e.statusTo ?? 0) !== 0;
}

function transitText(e: TxChainNode): string {
  const from = e.statusFrom ?? 0;
  const to = e.statusTo ?? 0;
  return `${TX_STATUS_LABEL[from] ?? from}→${TX_STATUS_LABEL[to] ?? to}`;
}

/* ================================================================== */
/* 阶段轴与事件时间线视图                                               */
/* ================================================================== */

/** 阶段状态 → 图标（el-step status 映射 1/5 wait、2 process、3 finish、4 error）。 */
function StageIcon({ status }: { status: number }) {
  if (status === 3)
    return <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />;
  if (status === 4)
    return <X className="h-4 w-4 text-red-600" aria-hidden="true" />;
  if (status === 2)
    return (
      <LoaderCircle
        className="h-4 w-4 animate-spin text-primary"
        aria-hidden="true"
      />
    );
  // 1 未开始 / 5 跳过
  return <Minus className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
}

/** 连接线配色：成功/跳过（已越过）绿、失败红、其余灰。 */
function connectorClass(status: number): string {
  if (status === 3 || status === 5) return 'bg-emerald-500';
  if (status === 4) return 'bg-red-500';
  return 'bg-border';
}

function StageAxis({
  stages,
  selectedStep,
  onSelect,
}: {
  stages: StageItem[];
  selectedStep: number;
  onSelect: (step: number) => void;
}) {
  return (
    <ol className="flex">
      {stages.map((s, i) => {
        const selected = s.step === selectedStep;
        const name = STAGE_STEP_MAP[s.step] ?? `${s.step}`;
        const title = s.status === 5 ? `${name}(跳过)` : name;
        return (
          <li key={s.step} className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => onSelect(s.step)}
              className="group block w-full cursor-pointer rounded px-1 py-1 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-current={selected ? 'step' : undefined}
            >
              <span className="relative flex items-center justify-center">
                {/* 与左邻阶段的连接线（同属左侧阶段的出线，取其配色） */}
                {i > 0 && (
                  <span
                    aria-hidden="true"
                    className={`absolute top-1/2 right-1/2 left-0 h-0.5 -translate-y-1/2 ${connectorClass(stages[i - 1].status)}`}
                  />
                )}
                {/* 向右邻阶段的连接线（最后一段不画，源 CSS hack 等价语义） */}
                {i < stages.length - 1 && (
                  <span
                    aria-hidden="true"
                    className={`absolute top-1/2 left-1/2 right-0 h-0.5 -translate-y-1/2 ${connectorClass(s.status)}`}
                  />
                )}
                <span className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full border bg-background">
                  <StageIcon status={s.status} />
                </span>
              </span>
              <span
                className={`mt-1.5 block truncate text-xs leading-4 ${
                  selected
                    ? 'font-semibold text-foreground underline'
                    : 'text-foreground/80 group-hover:text-foreground'
                }`}
              >
                {title}
              </span>
              <span className="mt-0.5 block font-mono text-[11px] leading-4 text-muted-foreground tabular-nums">
                {fmtTime(s.startTime)}
                <br />
                至 {fmtTime(s.endTime)}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function EventTimeline({ events }: { events: TxChainNode[] }) {
  return (
    <ol className="relative ml-3 border-l border-border">
      {events.map((e) => (
        <li key={e.flowId} className="relative mb-5 ml-5 last:mb-0">
          <span
            aria-hidden="true"
            className="absolute top-1 -left-[27px] h-2.5 w-2.5 rounded-full border-2 border-background bg-primary"
          />
          {/* el-timeline-item placement=top：时间戳置顶 */}
          <div className="font-mono text-xs text-muted-foreground tabular-nums">
            {fmtTime(e.eventTime)}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              {EVENT_TYPE_MAP[e.nodeType] ?? `事件类型 ${e.nodeType}`}
            </Badge>
            {hasTransit(e) && (
              <span className="font-mono text-[13px] text-muted-foreground">
                {transitText(e)}
              </span>
            )}
          </div>
          <div className="mt-1 text-xs leading-5 text-muted-foreground">
            操作人:{e.operator || '-'}
          </div>
          <div className="text-xs leading-5 text-muted-foreground">
            货币系统交易 ID:
            <span className="font-mono">{e.csTxId || '-'}</span>
          </div>
          <div className="text-xs leading-5 text-muted-foreground">
            备注:{e.remark || '-'}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ================================================================== */
/* 基本信息                                                            */
/* ================================================================== */

function DescItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-card px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 min-w-0 break-all text-sm">{children}</dd>
    </div>
  );
}

function BasicInfo({ row, pairText }: { row: TxRow; pairText: string }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border">
      <DescItem label="交易单号">
        <span className="font-mono text-xs">{txNoText(row)}</span>
      </DescItem>
      <DescItem label="交易 ID">
        <span className="font-mono text-xs">{row.transactionId}</span>
      </DescItem>
      <DescItem label="货币对">{pairText}</DescItem>
      <DescItem label="本金">
        <span className="font-mono text-xs tabular-nums">
          {formatMoney(row.principal)}
        </span>
      </DescItem>
      <DescItem label="状态">
        <TxStatusBadge status={row.status} />
      </DescItem>
      <DescItem label="创建时间">
        <span className="font-mono text-xs tabular-nums">
          {formatTime(row.createTime)}
        </span>
      </DescItem>
      <DescItem label="完成时间">
        {/* 源口径：completedTime === 0 严格判 0 = 未完成哨兵（非 truthy） */}
        <span className="font-mono text-xs tabular-nums">
          {row.completedTime === 0 ? '-' : formatTime(row.completedTime)}
        </span>
      </DescItem>
    </dl>
  );
}

/* ================================================================== */
/* 抽屉主体                                                            */
/* ================================================================== */

export interface ChainDrawerProps {
  /** 行数据（基本信息取本对象，不二次请求）。 */
  row: TxRow;
  /** 父页算好的货币对文本（`S→T` 或原始 pairId）。 */
  pairText: string;
  /** 关闭回调（父页据此置 drawerRow=null 卸载抽屉）。 */
  onClosed: () => void;
}

export function ChainDrawer({ row, pairText, onClosed }: ChainDrawerProps) {
  const chainQuery = useTxFlowChainQuery(LP_PROJECT_ID, row.transactionId);

  // 摊平后的节点（扁平/树两结构兼容；refetch 失败时 query 保留旧 data）
  const nodes = React.useMemo(
    () => flattenChain(chainQuery.data),
    [chainQuery.data],
  );
  const stageList = React.useMemo(
    () => buildStageList(nodes, row.status),
    [nodes, row.status],
  );

  // 当前选中阶段（点击切换，驱动事件区过滤）；挂载时若 query 缓存已有
  // 数据则惰性取默认选中，避免首帧选中错档闪烁。
  const [selectedStep, setSelectedStep] = React.useState(() =>
    pickInitialStep(buildStageList(flattenChain(chainQuery.data), row.status), flattenChain(chainQuery.data)),
  );
  // 每次链路数据装载成功重算默认选中（源 initSelectedStep 在 loadChain 成功后调用）
  React.useEffect(() => {
    setSelectedStep(pickInitialStep(stageList, nodes));
  }, [stageList, nodes]);

  // 0024 → 抽屉内降级条；非 0024 失败清除降级条（nodes 保留，拦截器已 toast）
  const err = chainQuery.error;
  const drawerDown = err != null && isServiceDown(err) ? err : null;

  const currentStageStatus =
    stageList.find((s) => s.step === selectedStep)?.status ?? 1;

  // 选中阶段事件：eventTime 升序，相同则 flowId 升序（源排序口径）
  const selectedEvents = React.useMemo(
    () =>
      nodes
        .filter((n) => n.step === selectedStep)
        .sort((a, b) => a.eventTime - b.eventTime || a.flowId - b.flowId),
    [nodes, selectedStep],
  );

  return (
    <Drawer open onOpenChange={(o) => !o && onClosed()}>
      <DrawerContent className="w-[720px] max-w-[92vw] p-0 sm:max-w-[92vw]">
        <div className="flex h-full flex-col">
          <DrawerHeader className="border-b px-6 py-4">
            <DrawerTitle>交易链路</DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {drawerDown && <ServiceDownAlert traceId={drawerDown.traceId} />}

            <h4 className="mt-0 text-sm font-semibold">基本信息</h4>
            <BasicInfo row={row} pairText={pairText} />

            <h4 className="mt-6 mb-3 text-sm font-semibold">交易链路</h4>
            {chainQuery.isPending ? (
              <div className="space-y-2" aria-label="加载中">
                <div className="h-7 w-full animate-pulse rounded bg-muted" />
                <div className="h-16 w-full animate-pulse rounded bg-muted" />
              </div>
            ) : nodes.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                暂无阶段数据
              </div>
            ) : (
              <>
                <StageAxis
                  stages={stageList}
                  selectedStep={selectedStep}
                  onSelect={setSelectedStep}
                />
                <div className="mt-6 mb-3 text-sm font-semibold">
                  {STAGE_STEP_MAP[selectedStep] ?? selectedStep}(
                  {STAGE_STATUS_MAP[currentStageStatus] ?? currentStageStatus})
                </div>
                {selectedEvents.length > 0 ? (
                  <EventTimeline events={selectedEvents} />
                ) : (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    该阶段暂无事件明细
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
