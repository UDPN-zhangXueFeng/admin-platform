'use client';

import * as React from 'react';

/**
 * ApprovalDetailGrid — 通用只读详情渲染壳（迁移自 td-manage
 * `src/pages/approval-manage/components/CustomInformation.tsx`，82 行）。
 *
 * 25 个审核组件（T6-T11）共用此原语展示业务字段。结构与源 1:1：
 * - `detailsInfo`：两层嵌套数组（section[] → list[]）。
 * - 每个 section 可有 `title`（灰底小标题）+ `list`（键值对）。
 * - 每个 list item：`label` / `value` / `isTable`（true=纵向堆叠 label 在上，false=横向 label 左 value 右）/ `showBorder`（底部分隔线）。
 *
 * 目标化用 Tailwind class（源用 inline style `borderBottom: 1px solid #f5f5f5` + bg `#f5f5f5`），
 * 对齐 posting-engine book-detail 的 table-based kv 布局风格（border-collapse + w-[34%] label 列）。
 * 但保留源的 isTable 横/纵切换语义（posting-engine 只有横向，CustomInformation 两种都有，审核组件依赖纵向态）。
 *
 * NOTE: value 为 ReactNode，调用方可传 <CopyableEllipsisText> / <ApprovalStatusBadge> / 格式化文本。
 */

/** 单个键值行（迁移自源 CustomInformationProps.detailsInfo[].list[]）。 */
export interface ApprovalDetailItem {
  label?: React.ReactNode;
  value?: React.ReactNode;
  /** 底部分隔线（源 showBorder → borderBottom #f5f5f5）。 */
  showBorder?: boolean;
  /** true=纵向（label 上 value 下），false=横向（label 左 40% value 右 60%）。源 isTable。 */
  isTable?: boolean;
}

/** 单个 section（迁移自源 detailsInfo[]）。 */
export interface ApprovalDetailSection {
  title?: React.ReactNode;
  list?: ApprovalDetailItem[];
}

export interface ApprovalDetailGridProps {
  sections: ApprovalDetailSection[];
}

/**
 * 渲染只读详情网格。
 *
 * 布局决策：源用 div + flex 自适应；目标保留 div 结构（非 table），
 * 因为 isTable 纵向态需要 label 占满一行后 value 另起，table 行难以表达。
 * 分隔线/标题底色用 Tailwind（border-border / bg-muted）替代源硬编码 #f5f5f5，
 * 视觉等价且支持暗色主题（源项目无暗色，目标库统一用 CSS 变量）。
 */
export function ApprovalDetailGrid({ sections }: ApprovalDetailGridProps) {
  return (
    <div className="w-full">
      {sections.map((section, sIndex) => (
        <div key={sIndex}>
          {section.title ? (
            <div className="rounded-sm bg-muted px-2 py-1.5 text-sm font-semibold">
              {section.title}
            </div>
          ) : null}
          {section.list && section.list.length > 0 ? (
            <div className="px-2">
              {section.list.map((item, iIndex) => {
                if (!item.label) return null;
                const borderClass = item.showBorder
                  ? 'border-b border-border'
                  : '';
                if (item.isTable) {
                  // 纵向：label 占满一行（mb-2 间距），value 另起一行。
                  return (
                    <div
                      key={iIndex}
                      className={`flex flex-col py-3 ${borderClass}`}
                    >
                      <span className="mb-2 text-sm text-muted-foreground">
                        {item.label}
                      </span>
                      <div className="break-all text-sm">{item.value}</div>
                    </div>
                  );
                }
                // 横向：label 左 40%，value 右 60%（源 w-[40%]/w-[60%]）。
                return (
                  <div
                    key={iIndex}
                    className={`flex items-center py-3 ${borderClass}`}
                  >
                    <span className="w-[40%] text-sm text-muted-foreground">
                      {item.label}
                    </span>
                    <div className="w-[60%] break-all text-sm">{item.value}</div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
