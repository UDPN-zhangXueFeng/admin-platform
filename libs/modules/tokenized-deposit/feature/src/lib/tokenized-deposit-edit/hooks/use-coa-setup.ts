'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  useFinanceBookByReserveQuery,
  useFinanceTemplateQuery,
  useTimezoneOptionsQuery,
  type CoaSetupErrors,
  type CoaSetupInfo,
  type CoaSetupOption,
  type FinanceBookInfo,
  type FinanceTemplateOption,
  type TimezoneOption,
} from '@myorg/modules/tokenized-deposit/data-access';
import {
  MINT_METHOD,
  getNextCoaSetupErrors,
  mapFinanceBookToCoaSetup,
  normalizeCoaSetupTimeZone,
  setupRequiredCoaSetupMock,
  withDefaultAccountTemplate,
  withDefaultCoaTimezone,
} from '@myorg/modules/tokenized-deposit/util';
import { getCoaTemplateTokenType } from '@myorg/modules/tokenized-deposit/util';

/**
 * useCoaSetup — COA Financial Book 初始化 hook（双套数据 + 下拉 + 时区自适应）。
 *
 * 迁移自 td-manage `edit/hooks/useCoaSetup.ts`（299 行）。严格保留源时序与分支。
 *
 * ## 双套 COA 数据（互斥）
 *
 * | 套 | mintMethod | 态 | 数据来源 |
 * |----|-----------|----|---------|
 * | tokenizedDeposit | 5 (TD) | setup_required 可编辑 | 本地 state（用户编辑） |
 * | stablecoin | 1 (Stablecoin) | configured 只读 / setup_required | useFinanceBookByReserveQuery |
 *
 * edit.tsx 至多渲染一个 CoaSetupCard。
 *
 * ## 下拉
 *
 * - 科目模板：useFinanceTemplateQuery(tokenType)，tokenType = getCoaTemplateTokenType(mintMethod)
 *   （1→1 / 5→5 / 20→undefined）。映射 FinanceTemplateOption → CoaSetupOption
 *   （value=String(bookTemplateId)||bookTemplateName, label=bookTemplateName）。
 * - 时区：useTimezoneOptionsQuery，兼容新 `{ value, label }` 与旧 `{ key, value }` 响应。
 *
 * ## 浏览器时区自适应
 *
 * mount → setCurrentTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone)。
 * setup_required 态且 timeZone 仍为 mock 默认（Europe/Paris）时，自动改写为浏览器时区。
 *
 * ## withDefaultAccountTemplate
 *
 * accountTemplateCode/Name 为空时，填入下拉首项（coaTemplateOptions[0]）。
 *
 * ## 与源差异
 *
 * 命令式 API（financeTemplateListApi / commonTimezoneListApi / financeBookBy_reserveApi）
 * → TanStack Query（useFinanceTemplateQuery / useTimezoneOptionsQuery / useFinanceBookByReserveQuery）。
 * coaTemplateOptions / coaTimezoneOptions 本地 state 删除，改由 query data 派生。
 * by-reserve 的 success/catch fallback 合并到 mapFinanceBookToCoaSetup（内部已处理 null）。
 */
export interface UseCoaSetupParams {
  mintMethod?: number;
  reserveAccountId?: string | number;
}

export interface UseCoaSetupReturn {
  stablecoinCoaData: CoaSetupInfo;
  stablecoinCoaErrors: CoaSetupErrors;
  stablecoinCoaReadonly: boolean;
  stablecoinCoaLoading: boolean;
  handleStablecoinCoaChange: (data: CoaSetupInfo) => void;
  tokenizedDepositCoaData: CoaSetupInfo;
  tokenizedDepositCoaErrors: CoaSetupErrors;
  handleTokenizedDepositCoaChange: (data: CoaSetupInfo) => void;
  coaTemplateOptions: CoaSetupOption[];
  coaTimezoneOptions: CoaSetupOption[];
  /**
   * COA 相关查询（financeBook / template / timezone）任一失败的合并标志。
   * inline 错误反馈用（文档 14.5）。
   */
  coaQueryError: boolean;
  shouldShowSetupRequiredCoaSetup: boolean;
  shouldShowStablecoinCoaSetup: boolean;
  setStablecoinCoaData: (data: CoaSetupInfo | null) => void;
  setStablecoinCoaErrors: (errors: CoaSetupErrors) => void;
  setTokenizedDepositCoaData: (data: CoaSetupInfo | null) => void;
  setTokenizedDepositCoaErrors: (errors: CoaSetupErrors) => void;
}

export function useCoaSetup({
  mintMethod,
  reserveAccountId,
}: UseCoaSetupParams): UseCoaSetupReturn {
  // ── 双套本地 state ──
  const [coaSetupInfo, setCoaSetupInfo] = useState<CoaSetupInfo | null>(null);
  const [tokenizedDepositCoaSetupInfo, setTokenizedDepositCoaSetupInfo] =
    useState<CoaSetupInfo | null>(null);
  const [coaSetupErrors, setCoaSetupErrors] = useState<CoaSetupErrors>({});
  const [tokenizedDepositCoaSetupErrors, setTokenizedDepositCoaSetupErrors] =
    useState<CoaSetupErrors>({});
  const [currentTimeZone, setCurrentTimeZone] = useState('');

  // ── 派生标志 ──
  const shouldShowSetupRequiredCoaSetup =
    mintMethod === MINT_METHOD.TOKENIZED_DEPOSIT;
  const shouldShowStablecoinCoaSetup =
    mintMethod === MINT_METHOD.STABLECOIN &&
    reserveAccountId !== undefined &&
    reserveAccountId !== null &&
    reserveAccountId !== '';
  const coaTemplateTokenType = getCoaTemplateTokenType(mintMethod);

  // ── 下拉查询（声明式）──
  const { data: financeTemplateData, isError: templateError } =
    useFinanceTemplateQuery(coaTemplateTokenType);
  const { data: timezoneData, isError: timezoneError } =
    useTimezoneOptionsQuery();
  const {
    data: financeBookData,
    isLoading: coaSetupLoading,
    isError: financeBookError,
  } = useFinanceBookByReserveQuery(
    shouldShowStablecoinCoaSetup ? reserveAccountId : undefined,
  );

  // 任一 COA 相关查询失败的合并标志（inline 错误反馈用）。
  const coaQueryError = templateError || timezoneError || financeBookError;

  // ── 下拉映射（FinanceTemplateOption → CoaSetupOption）──
  const coaTemplateOptions: CoaSetupOption[] = useMemo(() => {
    if (!financeTemplateData) return [];
    return financeTemplateData.map((item: FinanceTemplateOption) => {
      const value =
        item.bookTemplateId !== undefined
          ? String(item.bookTemplateId)
          : (item.templateCode ??
            item.bookTemplateName ??
            item.templateName ??
            '');

      return {
        value,
        label:
          item.bookTemplateName ?? item.templateName ?? item.templateCode ?? value,
      };
    });
  }, [financeTemplateData]);

  // 时区：兼容新 {value,label} 和旧 {key,value}，统一为 CoaSetupOption。
  const coaTimezoneOptions: CoaSetupOption[] = useMemo(
    () =>
      (timezoneData ?? []).map((item: TimezoneOption) => ({
        value: item.key ?? item.value ?? '',
        label: item.label ?? item.value ?? item.key ?? '',
      })),
    [timezoneData],
  );

  // ── 当前浏览器时区匹配的 option ──
  const currentTimezoneOption = useMemo(
    () =>
      currentTimeZone
        ? coaTimezoneOptions.find((item) => item.value === currentTimeZone) ||
          coaTimezoneOptions.find((item) =>
            item.label.includes(currentTimeZone),
          )
        : undefined,
    [coaTimezoneOptions, currentTimeZone],
  );

  // ── setup_required 运行时 fallback 态（默认模板 + 浏览器时区）──
  const setupRequiredCoaSetupInfo: CoaSetupInfo = useMemo(
    () => ({
      ...setupRequiredCoaSetupMock,
      accountTemplateCode: coaTemplateOptions[0]?.value || '',
      accountTemplateName: coaTemplateOptions[0]?.label || '',
      timeZone:
        currentTimezoneOption?.value ||
        currentTimeZone ||
        setupRequiredCoaSetupMock.timeZone,
      timeZoneLabel:
        currentTimezoneOption?.label ||
        currentTimeZone ||
        setupRequiredCoaSetupMock.timeZoneLabel,
    }),
    [coaTemplateOptions, currentTimeZone, currentTimezoneOption],
  );

  const defaultCoaTemplateOption = coaTemplateOptions[0];
  const defaultCoaTimezoneOption =
    currentTimezoneOption ||
    (currentTimeZone
      ? { value: currentTimeZone, label: currentTimeZone }
      : undefined);

  // ── TD COA（本地可编辑，withDefaultAccountTemplate + 时区归一化）──
  const tokenizedDepositCoaData: CoaSetupInfo = useMemo(
    () =>
      normalizeCoaSetupTimeZone(
        withDefaultAccountTemplate(
          withDefaultCoaTimezone(
            tokenizedDepositCoaSetupInfo ?? setupRequiredCoaSetupInfo,
            defaultCoaTimezoneOption,
          ),
          defaultCoaTemplateOption,
        ),
        coaTimezoneOptions,
      ),
    [
      coaTimezoneOptions,
      defaultCoaTemplateOption,
      defaultCoaTimezoneOption,
      setupRequiredCoaSetupInfo,
      tokenizedDepositCoaSetupInfo,
    ],
  );

  // ── Stablecoin COA（by-reserve 拉取，configured 只读）──
  const stablecoinCoaData: CoaSetupInfo = useMemo(
    () =>
      normalizeCoaSetupTimeZone(
        withDefaultAccountTemplate(
          withDefaultCoaTimezone(
            coaSetupInfo ?? {
              ...setupRequiredCoaSetupInfo,
              reserveAccountId,
            },
            defaultCoaTimezoneOption,
          ),
          defaultCoaTemplateOption,
        ),
        coaTimezoneOptions,
      ),
    [
      coaTimezoneOptions,
      coaSetupInfo,
      defaultCoaTemplateOption,
      defaultCoaTimezoneOption,
      reserveAccountId,
      setupRequiredCoaSetupInfo,
    ],
  );

  const isStablecoinCoaReadonly = stablecoinCoaData.status === 'configured';

  // ── 字段变更回调（增量校验）──
  const handleTokenizedDepositCoaChange = useCallback(
    (data: CoaSetupInfo) => {
      setTokenizedDepositCoaSetupInfo(data);
      setTokenizedDepositCoaSetupErrors((errors) =>
        getNextCoaSetupErrors(errors, data),
      );
    },
    [],
  );
  const handleStablecoinCoaChange = useCallback((data: CoaSetupInfo) => {
    setCoaSetupInfo(data);
    setCoaSetupErrors((errors) => getNextCoaSetupErrors(errors, data));
  }, []);

  // ── 浏览器时区（mount 一次）──
  useEffect(() => {
    setCurrentTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || '');
  }, []);

  // ── mintMethod 变化时清 TD COA（源 effect 4）──
  useEffect(() => {
    if (mintMethod !== MINT_METHOD.TOKENIZED_DEPOSIT) {
      setTokenizedDepositCoaSetupInfo(null);
      setTokenizedDepositCoaSetupErrors({});
    }
  }, [mintMethod]);

  // ── 时区自适应：setup_required 且仍为 mock 默认时改写为浏览器时区（源 effect 5）──
  useEffect(() => {
    if (!currentTimezoneOption) return;

    if (
      tokenizedDepositCoaSetupInfo?.status === 'setup_required' &&
      tokenizedDepositCoaSetupInfo.timeZone ===
        setupRequiredCoaSetupMock.timeZone &&
      tokenizedDepositCoaSetupInfo.timeZone !== currentTimezoneOption.value
    ) {
      setTokenizedDepositCoaSetupInfo({
        ...tokenizedDepositCoaSetupInfo,
        timeZone: currentTimezoneOption.value,
        timeZoneLabel: currentTimezoneOption.label,
      });
    }

    if (
      coaSetupInfo?.status === 'setup_required' &&
      coaSetupInfo.timeZone === setupRequiredCoaSetupMock.timeZone &&
      coaSetupInfo.timeZone !== currentTimezoneOption.value
    ) {
      setCoaSetupInfo({
        ...coaSetupInfo,
        timeZone: currentTimezoneOption.value,
        timeZoneLabel: currentTimezoneOption.label,
      });
    }
  }, [coaSetupInfo, currentTimezoneOption, tokenizedDepositCoaSetupInfo]);

  // ── shouldShowStablecoinCoaSetup 关闭时清 stablecoin COA（源 effect 6 前半）──
  useEffect(() => {
    if (!shouldShowStablecoinCoaSetup) {
      setCoaSetupInfo(null);
      setCoaSetupErrors({});
    }
  }, [shouldShowStablecoinCoaSetup]);

  // ── by-reserve 数据同步到 state（源 effect 6 主体）──
  // mapFinanceBookToCoaSetup 内部处理 null → setupRequired fallback，
  // 故 undefined data（成功但空 / 失败）也安全映射为 fallback。
  // loading 期间不同步（保持旧 state，避免闪烁），对齐源 setCoaSetupLoading 行为。
  useEffect(() => {
    if (!shouldShowStablecoinCoaSetup) return;
    if (coaSetupLoading) return;

    const mapped = mapFinanceBookToCoaSetup(
      (financeBookData as FinanceBookInfo | undefined) ?? null,
      reserveAccountId ?? '',
    );
    setCoaSetupInfo(mapped);
    setCoaSetupErrors({});
  }, [
    financeBookData,
    coaSetupLoading,
    reserveAccountId,
    shouldShowStablecoinCoaSetup,
  ]);

  return {
    stablecoinCoaData,
    stablecoinCoaErrors: coaSetupErrors,
    stablecoinCoaReadonly: isStablecoinCoaReadonly,
    stablecoinCoaLoading: coaSetupLoading,
    handleStablecoinCoaChange,
    tokenizedDepositCoaData,
    tokenizedDepositCoaErrors: tokenizedDepositCoaSetupErrors,
    handleTokenizedDepositCoaChange,
    coaTemplateOptions,
    coaTimezoneOptions,
    coaQueryError,
    shouldShowSetupRequiredCoaSetup,
    shouldShowStablecoinCoaSetup,
    setStablecoinCoaData: setCoaSetupInfo,
    setStablecoinCoaErrors: setCoaSetupErrors,
    setTokenizedDepositCoaData: setTokenizedDepositCoaSetupInfo,
    setTokenizedDepositCoaErrors: setTokenizedDepositCoaSetupErrors,
  };
}
