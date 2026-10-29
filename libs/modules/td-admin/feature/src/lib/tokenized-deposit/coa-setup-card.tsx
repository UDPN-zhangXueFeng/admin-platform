/**
 * COA Financial Book 初始化卡片 — 完全受控组件。
 *
 * 迁移自 td-manage `CoaSetupCard.tsx`（252 行），结构与逻辑完整还原，
 * 仅做 admin-platform 技术栈适配：
 *   - antd Input/Select/TimePicker/Spin → shared/ui Input + Radix Select + 原生 time input + Loader2
 *   - dayjs → date-fns（项目未装 dayjs，见 arch 文档第 6 节）
 *
 * ## 受控契约
 *
 * 无任何内部 state。所有数据走 `props.data`，字段变更走 `props.onChange`，
 * 由父组件持有唯一数据源（与源码 `updateData` 的 patch 合并语义一致）。
 *
 * ## 4 字段
 *
 * | 字段 | 控件 | 说明 |
 * |------|------|------|
 * | `financialBookName` | Input | maxLength = 50 |
 * | `accountTemplateCode`/`accountTemplateName` | Radix Select | 选中时同时写 code + name |
 * | `eodCutOffTime` | 原生 input[type=time] | HH:mm:ss 字符串 ↔ 控件值（date-fns） |
 * | `timeZone`/`timeZoneLabel` | Radix Select | 选中时同时写 code + label |
 *
 * ## 字段禁用规则
 *
 * - 四个字段均遵循 `readonly || data.status !== 'setup_required'`。
 * - Tokenized Deposit 的 `setup_required` 态可编辑；已配置的 Stablecoin COA 仅回显。
 *
 * ## fallback option 机制
 *
 * 父组件传入的 options 为空，但 `data` 已有 code/name（如 configured 回填态或
 * 下拉未加载完）时，构造单元素 fallback option，使 Select 仍能显示当前值，
 * 避免出现"选中项丢失"的空白。Radix Select 的 SelectItem value 禁止空串，
 * 故 fallback value 用 code 或 label 兜底（见 arch 文档第 12 节坑 2）。
 *
 * ## 状态徽标
 *
 * 按 `data.status` 取 `COA_STATUS_STYLE` 配色（bg/text hex），文案走 i18n
 * `tokenized_deposit_coa_status_${status}`。
 *
 * ## 关联提示行
 *
 * `data.linkedMessage` 优先；否则 setup_required → `tokenized_deposit_coa_no_coa_found`，
 * configured → `tokenized_deposit_coa_linked_readonly`。
 *
 * i18n namespace: `modules.tokenized-deposit`，label key 为相对 key（不带前缀）。
 */
import { Loader2 } from 'lucide-react';
import * as React from 'react';
import { Card } from '@myorg/shared/ui';

import { CoaCardHeader, CoaLinkedMessage } from './coa-card-header';
import { CoaSetupCardFields } from './coa-setup-card-fields';
import type { CoaSetupCardProps, CoaSetupInfo } from './coa-setup-types';
import { buildFallbackOption } from './coa-time-utils';

export type {
  CoaSetupStatus,
  CoaSetupInfo,
  CoaSetupErrors,
  CoaSetupOption,
  CoaSetupCardProps,
} from './coa-setup-types';

// ── 主组件 ──

/**
 * COA Financial Book 初始化卡片。
 *
 * 用法：
 * ```tsx
 * <CoaSetupCard
 *   data={coaData}
 *   loading={loading}
 *   readonly={false}
 *   accountTemplateOptions={templateOptions}
 *   timezoneOptions={tzOptions}
 *   errors={errors}
 *   onChange={setCoaData}
 * />
 * ```
 */

export function CoaSetupCard({
  data,
  loading = false,
  readonly = false,
  accountTemplateOptions,
  timezoneOptions,
  errors,
  onChange,
  className = '',
  embedded = false,
}: CoaSetupCardProps) {
  // ── 派生状态 ──
  const isSetupRequired = data.status === 'setup_required';
  const isFieldDisabled = readonly || !isSetupRequired;

  // fallback option：options 为空但 data 有值时兜底展示
  const accountTemplateFallbackOptions = buildFallbackOption(
    data.accountTemplateCode,
    data.accountTemplateName,
  );
  const timezoneFallbackOptions = buildFallbackOption(
    data.timeZone,
    data.timeZoneLabel,
  );

  const resolvedAccountTemplateOptions = accountTemplateOptions?.length
    ? accountTemplateOptions
    : accountTemplateFallbackOptions;
  const resolvedTimezoneOptions = timezoneOptions?.length
    ? timezoneOptions
    : timezoneFallbackOptions;

  // ── 数据更新（patch 合并，与源 updateData 语义一致）──
  const updateData = (patch: Partial<CoaSetupInfo>) => {
    onChange?.({ ...data, ...patch });
  };

  return (
    <Card
      className={`relative ${
        embedded ? 'mb-0 rounded-none border-0 shadow-none' : 'mb-4'
      } ${className}`.trim()}
    >
      {/* loading 覆盖层（替代 antd Spin）：居中 Loader2 旋转 + 半透明遮罩 */}
      {loading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[2px]">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : null}

      <CoaCardHeader
        embedded={embedded}
        status={data.status}
        headerNote={data.headerNote}
      />

      <div
        className={`flex flex-col gap-5 ${embedded ? 'px-2 py-2' : 'px-6 py-6'}`}
      >
        <CoaLinkedMessage
          linkedMessage={data.linkedMessage}
          isSetupRequired={isSetupRequired}
        />

        <CoaSetupCardFields
          data={data}
          errors={errors}
          isFieldDisabled={isFieldDisabled}
          isSetupRequired={isSetupRequired}
          resolvedAccountTemplateOptions={resolvedAccountTemplateOptions}
          resolvedTimezoneOptions={resolvedTimezoneOptions}
          updateData={updateData}
        />
      </div>
    </Card>
  );
}
