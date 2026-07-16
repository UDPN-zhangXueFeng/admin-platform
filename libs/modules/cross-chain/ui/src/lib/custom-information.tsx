/**
 * CustomInformation — 结构化详情展示组件。
 *
 * 搬自 td-manage approval-manage/components/CustomInformation.tsx（80 行纯展示组件）。
 * token-pair/view（左右两栏详情）+ rd-bridge/view（Drawer 操作记录详情）共用。
 *
 * 与 mmf-basic-details 不同：mmf-basic-details 是 3 列网格 + 标题行，
 * 本组件是垂直堆叠列表，每项可选 isTable（竖排 label 上 / value 下）或
 * 默认横排（label 左 40% / value 右 60%），showBorder 控制底部分隔线。
 *
 * 无外部依赖（不依赖 @myorg/shared/ui，纯 Tailwind）。
 */
import * as React from 'react';
import type { ReactNode } from 'react';

/** detailsInfo 中每一项的字段定义。 */
export interface CustomInformationItem {
  /** 标签（已 i18n）。 */
  label?: ReactNode;
  /** 值（调用方负责格式化 / 拼接 / 渲染 Badge）。 */
  value?: ReactNode;
  /** 底部分隔线（默认无）。 */
  showBorder?: boolean;
  /** true=竖排布局（label 上 / value 下），默认横排（label 左 / value 右）。 */
  isTable?: boolean;
}

/** detailsInfo 中每一组（含标题）。 */
export interface CustomInformationSection {
  /** 分组标题（已 i18n）。 */
  title?: ReactNode;
  /** 分组内字段列表。 */
  list?: CustomInformationItem[];
}

export interface CustomInformationProps {
  /** 结构化信息分组（含标题 + 字段列表）。 */
  detailsInfo: CustomInformationSection[];
}

/**
 * 渲染垂直堆叠的结构化详情信息。
 *
 * 不依赖 antd / @myorg/shared/ui，纯 Tailwind 布局。
 * 横排模式：label 左 40% + value 右 60%（弹性，长文本 break-all）。
 * 竖排模式（isTable）：label 上方独立行 + value 下方占满。
 * showBorder 为 true 时底部分隔线灰色 1px。
 */
export function CustomInformation({ detailsInfo }: CustomInformationProps) {
  if (!detailsInfo || detailsInfo.length === 0) {
    return null;
  }

  return (
    <div className="full">
      {detailsInfo.map((section, sectionIdx) => (
        <div key={sectionIdx}>
          {section.title ? (
            <div className="rounded-sm bg-[#f5f5f5] p-2 text-sm font-bold">
              {section.title}
            </div>
          ) : null}
          {section.list && section.list.length > 0 ? (
            <div className="p-2">
              {section.list.map((item, itemIdx) => (
                <div key={itemIdx}>
                  {item.label != null ? (
                    item.isTable ? (
                      <div
                        className="flex flex-col py-3"
                        style={{
                          borderBottom: item.showBorder
                            ? '1px solid #f5f5f5'
                            : undefined,
                        }}
                      >
                        <span className="mb-2">{item.label}</span>
                        <div className="break-all">{item.value}</div>
                      </div>
                    ) : (
                      <div
                        className="flex items-center py-3"
                        style={{
                          borderBottom: item.showBorder
                            ? '1px solid #f5f5f5'
                            : undefined,
                        }}
                      >
                        <span className="w-[40%]">{item.label}</span>
                        <div className="w-[60%] break-all">{item.value}</div>
                      </div>
                    )
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export default CustomInformation;
