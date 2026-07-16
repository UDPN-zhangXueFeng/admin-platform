/**
 * COA Financial Book 初始化卡片 — 完全受控组件。
 *
 * 迁移自 td-manage `CoaSetupCard.tsx`（252 行），结构与逻辑完整还原，
 * 仅做 admin-platform 技术栈适配：
 *   - antd Input/Select/TimePicker/Spin → shared/ui Input + Radix Select + 原生 time input + Loader2
 *   - dayjs → date-fns（项目未装 dayjs，见 arch 文档第 6 节）
 *   - antd ClockCircleOutlined → lucide-react ClockCircle
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
 * `isFieldDisabled = readonly || data.status !== 'setup_required'`
 * configured 态（含 stablecoin 已配置）整体只读，仅展示。
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
import { Clock as ClockCircle, Loader2, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ChangeEvent, type ReactNode } from 'react';
import { format, parse } from 'date-fns';

import {
  Badge,
  Card,
  CardDescription,
  CardTitle,
  Field,
  FieldError,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@myorg/shared/ui';

import {
  COA_STATUS_STYLE,
  FINANCIAL_BOOK_NAME_MAX_LENGTH,
} from '@myorg/modules/tokenized-deposit/util';

// ── Props 契约（本地定义，与 data-access/model.ts 同名类型结构一致）──
//
// nx 边界规则：`type:ui` 仅可依赖 `type:ui`/`type:util`/`type:model`，
// 不可依赖 `type:data-access`（model.ts 所在层）。故 ui 层本地定义 Props 契约，
// 与 cross-chain-status-badge 等同模块兄弟组件惯例一致。
// 字段集严格对齐 data-access/model.ts 的 CoaSetupCardProps / CoaSetupInfo /
// CoaSetupErrors / CoaSetupOption，避免类型漂移；feature 层从 data-access
// import 同名类型并传 props，结构兼容。

/** COA 设置状态：configured（只读）/ setup_required（可编辑）。 */
export type CoaSetupStatus = 'configured' | 'setup_required';

/** COA Financial Book 初始化数据（完全受控，由父组件持有）。 */
export interface CoaSetupInfo {
  reserveAccountId?: number | string;
  status: CoaSetupStatus;
  financialBookName?: string;
  accountTemplateCode?: string;
  accountTemplateName?: string;
  eodCutOffTime?: string;
  timeZone?: string;
  timeZoneLabel?: string;
  linkedMessage?: string;
  headerNote?: string;
}

/** COA 字段校验错误映射。 */
export type CoaSetupErrors = Partial<
  Record<
    'financialBookName' | 'accountTemplateCode' | 'eodCutOffTime' | 'timeZone',
    string
  >
>;

/** COA 下拉选项（科目模板 / 时区）。 */
export interface CoaSetupOption {
  value: string;
  label: string;
}

/** CoaSetupCard Props（完全受控组件）。 */
export interface CoaSetupCardProps {
  data: CoaSetupInfo;
  loading?: boolean;
  /** 只读模式（stablecoin configured 态）。 */
  readonly?: boolean;
  /** 科目模板下拉选项。 */
  accountTemplateOptions?: CoaSetupOption[];
  /** 时区下拉选项。 */
  timezoneOptions?: CoaSetupOption[];
  /** 校验错误。 */
  errors?: CoaSetupErrors;
  /** 字段变更回调，参数为合并后的完整 data（patch 语义）。 */
  onChange?: (data: CoaSetupInfo) => void;
  className?: string;
}

// ── 时间格式（HH:mm:ss）常量与转换 ──

/** EOD 截止时间格式（与源 antd TimePicker format 一致）。 */
const EOD_TIME_FORMAT = 'HH:mm:ss';

/**
 * Radix Select 坑（arch 文档第 12 节坑 2）：SelectItem value 禁止空串。
 * fallback option 的 value 无可用 code 时，用此占位符，避免触发 Radix 警告。
 */
const FALLBACK_SELECT_VALUE = '__coa_fallback__';

/** date-fns parse 的参考基准日期（任意合法 Date 均可，只取时分秒）。 */
const TIME_REFERENCE_DATE = new Date(1970, 0, 1);

/**
 * `HH:mm:ss`（数据层）→ 控件值（`HH:mm`，原生 time input 精度到分钟）。
 *
 * 用 date-fns `parse` 解析 `HH:mm:ss`（项目未装 dayjs，见 arch 文档第 6 节），
 * 再 `format` 成 `HH:mm`。非法值回落空串，使控件显示 placeholder 而非脏值。
 *
 * 注意：原生 `<input type="time">` 仅支持 `HH:mm`，秒位在显示时丢失，
 * 但 `data.eodCutOffTime`（源数据）的秒位被完整保留，onChange 写回时
 * 用 {@link formatTimeValue} 归零补齐 `:00`。与源 antd TimePicker 行为一致——
 * 源 TimePicker format 虽含秒，但用户交互也只到分钟精度。
 */
function parseTimeValue(value?: string): string {
  if (!value) return '';

  const parsed = parse(value, EOD_TIME_FORMAT, TIME_REFERENCE_DATE);
  if (Number.isNaN(parsed.getTime())) return '';

  return format(parsed, 'HH:mm');
}

/**
 * 控件值（`HH:mm`）→ `data.eodCutOffTime`（`HH:mm:ss`）。
 *
 * 用 date-fns `format` 保证输出严格为 `HH:mm:ss`（秒位补 00）。
 * 与源码 antd TimePicker `onChange(_, timeString)` 写回 `HH:mm:ss` 语义一致。
 */
function formatTimeValue(controlValue: string): string {
  if (!controlValue) return '';

  const parsed = parse(controlValue, 'HH:mm', TIME_REFERENCE_DATE);
  if (Number.isNaN(parsed.getTime())) return '';

  return format(parsed, EOD_TIME_FORMAT);
}

// ── fallback option 构造 ──

/**
 * 当传入 options 为空但 data 有值时，构造单元素 fallback option，
 * 保证 Select 在只读/回填态仍能展示当前选中项。
 *
 * value 禁止空串（Radix 坑）：code 为空时用 {@link FALLBACK_SELECT_VALUE} 占位。
 */
function buildFallbackOption(
  value: string | undefined,
  label: string | undefined,
): CoaSetupOption[] {
  if (!value && !label) return [];
  return [
    {
      value: value || FALLBACK_SELECT_VALUE,
      label: label || value || '',
    },
  ];
}

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
}: CoaSetupCardProps) {
  const t = useTranslations('modules.tokenized-deposit');

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

  // ── 状态徽标配色（COA_STATUS_STYLE：configured/setup_required）──
  const statusStyle = COA_STATUS_STYLE[data.status];

  // ── Select 选中回调：同时写 code + name/label ──
  const handleAccountTemplateChange = (value: string) => {
    // fallback 占位符被选中时不更新（理论上 fallback 态 disabled，不会触发）
    if (value === FALLBACK_SELECT_VALUE) return;
    const selected = resolvedAccountTemplateOptions.find(
      (o) => o.value === value,
    );
    updateData({
      accountTemplateCode: value,
      accountTemplateName: selected?.label ?? value,
    });
  };

  const handleTimezoneChange = (value: string) => {
    if (value === FALLBACK_SELECT_VALUE) return;
    const selected = resolvedTimezoneOptions.find((o) => o.value === value);
    updateData({
      timeZone: value,
      timeZoneLabel: selected?.label ?? value,
    });
  };

  // ── EOD time input onChange ──
  const handleEodCutOffTimeChange = (event: ChangeEvent<HTMLInputElement>) => {
    updateData({ eodCutOffTime: formatTimeValue(event.target.value) });
  };

  // ── 渲染标题行 + 状态徽标（重设计：图标 tile + 标题 + 状态徽标 + 描述）──
  const renderHeader = (): ReactNode => (
    <div className="border-b bg-muted/35 px-6 py-5">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <RefreshCw className="size-4" aria-hidden="true" />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">
              {t('tokenized_deposit_coa_title')}
            </CardTitle>
            <Badge
              variant="secondary"
              style={{
                backgroundColor: statusStyle?.bg,
                color: statusStyle?.text,
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: 'currentColor' }}
              />
              {t(`tokenized_deposit_coa_status_${data.status}`)}
            </Badge>
          </div>
          <CardDescription className="leading-relaxed">
            {t('td_section_coa_desc')}
          </CardDescription>
          {data.headerNote ? (
            <div className="mt-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {data.headerNote}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  // ── 渲染关联提示行 ──
  const renderLinkedMessage = (): ReactNode => {
    const message =
      data.linkedMessage ||
      (isSetupRequired
        ? t('tokenized_deposit_coa_no_coa_found')
        : t('tokenized_deposit_coa_linked_readonly'));
    return (
      <div
        className={`flex items-start gap-3 ${
          isSetupRequired
            ? 'text-primary'
            : 'text-emerald-600 dark:text-emerald-400'
        }`}
      >
        <span
          className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: 'currentColor' }}
        />
        <div className="text-sm">{message}</div>
      </div>
    );
  };

  // ── 渲染单字段容器（shared/ui Field 系统）──
  const renderField = (
    labelKey: string,
    error: string | undefined,
    children: ReactNode,
    footer?: ReactNode,
  ) => (
    <Field>
      <FieldLabel>
        {isSetupRequired ? (
          <span className="text-destructive" aria-hidden="true">
            *
          </span>
        ) : null}
        {t(labelKey)}
      </FieldLabel>
      {children}
      {error ? <FieldError>{error}</FieldError> : null}
      {footer}
    </Field>
  );

  return (
    <Card className={`relative mb-4 ${className}`.trim()}>
      {/* loading 覆盖层（替代 antd Spin）：居中 Loader2 旋转 + 半透明遮罩 */}
      {loading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[2px]">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : null}

      {renderHeader()}

      <div className="flex flex-col gap-5 px-6 py-6">
        {renderLinkedMessage()}

        <div className="grid grid-cols-1 gap-x-12 gap-y-6 md:grid-cols-2">
          {/* 1) Financial Book Name */}
          {renderField(
            'tokenized_deposit_coa_financial_book_name',
            errors?.financialBookName,
            <Input
              value={data.financialBookName ?? ''}
              disabled={isFieldDisabled}
              maxLength={FINANCIAL_BOOK_NAME_MAX_LENGTH}
              placeholder={
                isSetupRequired
                  ? t('tokenized_deposit_coa_financial_book_placeholder')
                  : undefined
              }
              onChange={(event) =>
                updateData({ financialBookName: event.target.value })
              }
              className={
                errors?.financialBookName
                  ? 'border-destructive focus-visible:ring-destructive'
                  : undefined
              }
            />,
          )}

          {/* 2) Account Template */}
          {renderField(
            'tokenized_deposit_coa_account_template',
            errors?.accountTemplateCode,
            <Select
              value={data.accountTemplateCode ?? ''}
              disabled={isFieldDisabled}
              onValueChange={handleAccountTemplateChange}
            >
              <SelectTrigger
                className={errors?.accountTemplateCode ? 'border-destructive' : ''}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {resolvedAccountTemplateOptions.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    disabled={option.value === FALLBACK_SELECT_VALUE}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>,
          )}

          {/* 3) EOD Cut-off Time */}
          {renderField(
            'tokenized_deposit_coa_eod_cutoff',
            errors?.eodCutOffTime,
            <div className="relative w-full">
              <input
                type="time"
                value={parseTimeValue(data.eodCutOffTime)}
                disabled={isFieldDisabled}
                onChange={handleEodCutOffTimeChange}
                className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-9 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                  errors?.eodCutOffTime ? 'border-destructive' : ''
                }`}
              />
              <ClockCircle
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary"
                aria-hidden
              />
            </div>,
            <div className="mt-2 text-sm text-muted-foreground">
              {t('tokenized_deposit_coa_rollover_notice')}
            </div>,
          )}

          {/* 4) Time Zone */}
          {renderField(
            'tokenized_deposit_coa_time_zone',
            errors?.timeZone,
            <Select
              value={data.timeZone ?? ''}
              disabled={isFieldDisabled}
              onValueChange={handleTimezoneChange}
            >
              <SelectTrigger
                className={errors?.timeZone ? 'border-destructive' : ''}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {resolvedTimezoneOptions.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    disabled={option.value === FALLBACK_SELECT_VALUE}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>,
          )}
        </div>
      </div>
    </Card>
  );
}
