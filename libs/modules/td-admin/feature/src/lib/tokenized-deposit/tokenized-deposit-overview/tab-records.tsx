/**
 * OverviewRecordsTab — 运营总览页 Tab1 铸销记录。
 *
 * 迁移自 td-manage src/pages/tokenized-deposit/index.tsx 的 getItem() Tab1（3 分支）：
 * - 质押铸造（mintMethod===1 && pledgeType===1）：customTable（/td/manage/searches/record）
 * - MMF（mintMethod===20 && pledgeType===0）：嵌入 `<Summary tokenCode={code} />`（td-21）
 * - SP 直铸（其余 mintMethod/pledgeType 组合）：customTableSp（/transaction/getDirectMintingTxList）
 *
 * ## 三分支判断顺序（严格对齐源码 getItem 第 1123-1139 行）
 *
 * 源码是 if/else if/else 链：先匹配质押，再匹配 MMF，最后兜底 SP。
 * 故 SP 分支并非「mintMethod===20」，而是「非质押且非 MMF 的所有组合」。
 * 任务描述称「SP 直铸 mintMethod===20」与源码相反 —— **以源码为准**（见返回说明）。
 *
 * ## 数据过滤（react-hook-form 隐式）
 *
 * 源 customTable / customTableSp 均 `form hidden: true, items: []`，仅靠
 * initialValues（stablecoinCode / stablecoinId）作为隐式过滤条件传给后端，无 UI 筛选。
 * 这里等价：直接把标识塞进 query params，不引入 form。
 *
 * ## 行操作 View（跨模块跳转 /approval-manage/view）
 *
 * - 质押分支：恒可点（源 disabled: false）。
 * - SP 分支：`taskId === null` 时 disabled（源 disabled: data.taskId === null ? true : false）。
 * 两者均跳 `/approval-manage/view?id={taskId}&busCode={businessCode}`。
 *
 * i18n namespace: `modules.tokenized-deposit`。
 */
'use client';

import * as React from 'react';
import {
  MINT_METHOD,
  PLEDGE_TYPE,
  type ApplyListItem,
} from '@myorg/modules/td-admin/data-access';
import { Summary } from '../summary';
import { PledgeRecordsTable } from './pledge-records-table';
import { SPRecordsTable } from './sp-records-table';

export interface OverviewRecordsTabProps {
  /** 当前选中 TD（源 getUsablePrice）。提供 mintMethod/pledgeType/code/stablecoinId。 */
  td: ApplyListItem;
}

/**
 * 渲染 Tab1。按 mintMethod/pledgeType 三分支选择表格或 Summary。
 *
 * 用法（在 OverviewShell TabsContent value="1" 内）：
 * ```tsx
 * <OverviewRecordsTab td={currentTd} />
 * ```
 */
export function OverviewRecordsTab({
  td,
}: OverviewRecordsTabProps): React.JSX.Element {
  const mintMethod = td?.mintMethod;
  const pledgeType = td?.pledgeType;

  // 分支顺序严格对齐源码 getItem if/else if/else。
  if (mintMethod === MINT_METHOD.STABLECOIN && pledgeType === PLEDGE_TYPE.PLEDGE) {
    return <PledgeRecordsTable td={td} />;
  }
  if (mintMethod === MINT_METHOD.MMF && pledgeType === PLEDGE_TYPE.SP) {
    return <Summary tokenCode={td?.code ?? ''} />;
  }
  return <SPRecordsTable td={td} />;
}
