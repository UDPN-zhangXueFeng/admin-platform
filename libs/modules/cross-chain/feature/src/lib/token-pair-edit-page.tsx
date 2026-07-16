'use client';

import * as React from 'react';
import { Control, Controller, useForm } from 'react-hook-form';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { toast } from 'sonner';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@myorg/shared/ui';
import {
  getReceiveToken,
  getTokenPairDetail,
  useEditTokenPairMutation,
  useSaveTokenPairMutation,
  useSendTokenListQuery,
  type ReceiveTokenOption,
  type SendTokenOption,
  type TokenPairEditForm,
  type TokenPairEditReq,
  type TokenPairSaveReq,
} from '@myorg/modules/cross-chain/data-access';
import { EMPTY_DISPLAY } from '@myorg/modules/cross-chain/util';

/**
 * reSet 的本地等价（迁移自源 libs/utils/index.ts:46 `reSet(value, len=2)`）。
 *
 * send/receive 的 stablecoinCount / approveTokenCount 为字符串金额，
 * 沿用源码 Number(value).toFixed(2).千分位 行为。
 */
function reSet(value: number | string | undefined | null): string {
  if (value == null || value === '') return EMPTY_DISPLAY;
  const num = Number(value);
  if (Number.isNaN(num) || num < 0) return EMPTY_DISPLAY;
  return num.toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, '$1,');
}

/**
 * TokenPairEditPage — 代币对新增 / 编辑共用页（本模块最复杂之一）。
 *
 * 迁移自 td-manage src/pages/cross-chain/token-pair/edit.tsx（458 行）。
 * antd `Form.useForm` → react-hook-form；`Spin` → 按钮 disabled（mutation.isPending）；
 * useSWR sendToken → useSendTokenListQuery。
 *
 * 核心联动 + 竞态保护（完整搬运源码时序，勿简化）：
 *   1. 新增态：useEffect(sendToken) 自动选 sendToken[0] → setSendTokenInfo(send[0])。
 *   2. sendToken Select onChange：setSendTokenInfo(item) →
 *      latestSendTokenIdRef.current = stablecoinId → getReceiveToken(stablecoinId)。
 *   3. getReceiveToken(tokenId)：动态 URL getReceiveTokenApi(tokenId) →
 *      若 latestSendTokenIdRef.current !== tokenId 则抛弃（竞态保护）→
 *      setReceiveToken(list) → list.length ? setReceiveTokenInfo(list[0]) 自动选首个。
 *   4. resetReceiveTokenInfo：每次切换 sendToken 清空 receive 全字段（避免残留）。
 *   5. 编辑态：getTokenPairDetailApi 回填全字段（send/receive 名 + endpointId + 地址 + fee）。
 *
 * 硬约束（cc-12 summary + 迁移文档第 7.19 节）：
 * - sendToken Select（新增态从 getSendToken 选，编辑态 disabled）。
 * - receiveToken Select（新增态从 getReceiveToken(stablecoinId) 动态 URL 选，
 *   编辑态 disabled）。编辑态仅 crossChainFee 可改。
 * - send 无流动性池（isLiquidityPoolWalletAddress===false）时提示跳 /cross-chain/liquidity-pool/edit。
 * - crossChainFee（InputNumber 小数位 validator 按 decimalPrecision）。
 * - onFinish 按 query.id 分支 save/edit（编辑态仅 crossChainFee）。
 * - 成功 toast + router.back()。
 *
 * 表单结构：左栏（send）+ 中间 token-pair 图标 + 右栏（receive），对齐源码 flex justify-between。
 */
export function TokenPairEditPage(): React.JSX.Element {
  const t = useTranslations('modules.cross-chain');
  const router = useRouter();

  // 列表页跳 /cross-chain/token-pair/edit?id=<id>（编辑）/ edit（新增，无参）。
  const searchParams = useSearchParams();
  const idStr = searchParams.get('id') ?? '';
  const tokenCrossChainId = idStr !== '' ? Number(idStr) : undefined;
  const isEdit =
    tokenCrossChainId != null && !Number.isNaN(tokenCrossChainId);

  // ── 本地状态（源码 useState，联动展示用）──
  const [sendBalance, setSendBalance] = React.useState<string>('0');
  const [sendAuthorized, setSendAuthorized] = React.useState<string>('0');
  const [receiveBalance, setReceiveBalance] = React.useState<string>('0');
  const [receiveAuthorized, setReceiveAuthorized] = React.useState<string>('0');
  const [isLiquidityPoolWalletAddress, setIsLiquidityPoolWalletAddress] =
    React.useState(false);
  const [decimalPrecision, setDecimalPrecision] = React.useState(0);
  const [symbol, setSymbol] = React.useState('');
  const [receiveSymbol, setReceiveSymbol] = React.useState('');
  // receiveToken 列表（sendToken 切换后动态拉取）。
  const [receiveToken, setReceiveToken] = React.useState<ReceiveTokenOption[]>(
    [],
  );
  // receive Select key（源码 receiveSelectKey，强制 Select 重渲染清空选中态）。
  const [receiveSelectKey, setReceiveSelectKey] = React.useState(0);

  // 竞态保护：sendToken 切换期间若响应返回时已切到别的 Token，则抛弃过期响应。
  const latestSendTokenIdRef = React.useRef<number | string>('');

  const {
    control,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<TokenPairEditForm>({ defaultValues: {} });

  // ── sendToken 下拉（getSendToken）──
  const sendTokenQuery = useSendTokenListQuery();
  const sendTokenList = sendTokenQuery.data ?? [];

  // ── mutations ──
  const saveMutation = useSaveTokenPairMutation();
  const editMutation = useEditTokenPairMutation();
  const isPending = saveMutation.isPending || editMutation.isPending;

  // ── 重置 receive 全字段（源码 resetReceiveTokenInfo）──
  const resetReceiveTokenInfo = React.useCallback(() => {
    setReceiveToken([]);
    setReceiveSelectKey((pre) => pre + 1);
    setReceiveBalance('0');
    setReceiveAuthorized('0');
    setReceiveSymbol('');
    setValue('receiveTokenId', undefined);
    setValue('receiveEndpointId', undefined);
    setValue('receiveCrossChainAddress', undefined);
    setValue('receiveLiquidityPoolWalletAddress', undefined);
  }, [setValue]);

  // ── 填充单条 receive 信息（源码 setReceiveTokenInfo）──
  const setReceiveTokenInfo = React.useCallback(
    (item: Partial<ReceiveTokenOption> = {}) => {
      const {
        stablecoinId,
        approveTokenCount,
        stablecoinCount,
        crossChainAddress,
        endpointId,
        liquidityPoolWalletAddress,
        symbol: sym = '',
      } = item;
      setReceiveSymbol(sym);
      setReceiveBalance(stablecoinCount ?? '0');
      setReceiveAuthorized(approveTokenCount ?? '0');
      setValue('receiveTokenId', stablecoinId);
      setValue('receiveEndpointId', endpointId);
      setValue('receiveCrossChainAddress', crossChainAddress);
      setValue('receiveLiquidityPoolWalletAddress', liquidityPoolWalletAddress);
    },
    [setValue],
  );

  // ── 拉目标链 Token 列表（源码 getReceiveToken，含竞态保护）──
  const getReceiveTokenList = React.useCallback(
    async (tokenId: number | string) => {
      resetReceiveTokenInfo();
      if (!tokenId) return;
      const currentTokenId = tokenId;
      try {
        const list = await getReceiveToken(Number(tokenId));
        // 竞态保护：若期间切换了 Token，抛弃该次响应。
        if (latestSendTokenIdRef.current !== currentTokenId) {
          return;
        }
        setReceiveToken(list ?? []);
        if (list && list.length > 0) {
          setReceiveTokenInfo(list[0]);
        }
      } catch {
        // 接口失败静默（源码 res.data.code !== 0 时 return，不 toast）。
      }
    },
    [resetReceiveTokenInfo, setReceiveTokenInfo],
  );

  // ── 填充 send 信息（源码 setSendTokenInfo）──
  const setSendTokenInfo = React.useCallback(
    (item: Partial<SendTokenOption>) => {
      const {
        stablecoinId = '',
        approveTokenCount = '',
        stablecoinCount = '',
        crossChainAddress = '',
        endpointId = '',
        liquidityPoolWalletAddress = '',
        symbol: sym = '',
        decimalPrecision: dp = 0,
      } = item;
      setDecimalPrecision(Number(dp));
      latestSendTokenIdRef.current = stablecoinId;
      getReceiveTokenList(stablecoinId);
      setSymbol(sym);
      setSendBalance(stablecoinCount);
      setSendAuthorized(approveTokenCount);
      setIsLiquidityPoolWalletAddress(liquidityPoolWalletAddress !== '');
      setValue('sendTokenId', stablecoinId);
      setValue('sendEndpointId', endpointId);
      setValue('sendCrossChainAddress', crossChainAddress);
      // 源码：流动性池钱包地址为空时展示 cross_chain_00129（占位文案），但此处仅展示。
      setValue(
        'sendLiquidityPoolWalletAddress',
        liquidityPoolWalletAddress
          ? liquidityPoolWalletAddress
          : t('cross_chain_00129'),
      );
      setValue('crossChainFee', '');
    },
    [getReceiveTokenList, setValue, t],
  );

  // ── 编辑态回填（源码 getTokenPairDetail）──
  const getTokenPairDetailData = React.useCallback(async () => {
    if (!isEdit) return;
    try {
      const d = await getTokenPairDetail(tokenCrossChainId as number);
      if (!d) return;
      setDecimalPrecision(Number(d.decimalPrecision ?? 0));
      setIsLiquidityPoolWalletAddress(
        (d.sendLiquidityPoolWalletAddress ?? '') !== '',
      );
      setSymbol(d.sendTokenCurrencySymbol ?? '');
      setSendBalance(d.sendStablecoinCount ?? '0');
      setSendAuthorized(d.sendApproveTokenCount ?? '0');
      setReceiveSymbol(d.receiveTokenCurrencySymbol ?? '');
      setReceiveBalance(d.receiveStablecoinCount ?? '0');
      setReceiveAuthorized(d.receiveApproveTokenCount ?? '0');
      reset({
        crossChainFee: d.crossChainFee,
        sendTokenId: d.sendTokenName,
        sendEndpointId:
          d.sendEndpointId != null ? String(d.sendEndpointId) : undefined,
        sendCrossChainAddress: d.sendCrossChainAddress,
        sendLiquidityPoolWalletAddress: d.sendLiquidityPoolWalletAddress,
        receiveTokenId: d.receiveTokenName,
        receiveEndpointId:
          d.receiveEndpointId != null ? String(d.receiveEndpointId) : undefined,
        receiveCrossChainAddress: d.receiveCrossChainAddress,
        receiveLiquidityPoolWalletAddress: d.receiveLiquidityPoolWalletAddress,
      });
    } catch {
      // 接口失败静默（源码 res.data.code !== 0 时 return）。
    }
  }, [isEdit, tokenCrossChainId, reset]);

  // 编辑态初始化回填（源码 useEffect[]）。
  React.useEffect(() => {
    void getTokenPairDetailData();
  }, [getTokenPairDetailData]);

  // 新增态：sendToken 就绪后自动选首项（源码 useEffect[sendToken]）。
  React.useEffect(() => {
    if (isEdit) return;
    if (sendTokenList.length > 0) {
      setSendTokenInfo(sendTokenList[0]);
    }
  }, [isEdit, sendTokenList, setSendTokenInfo]);

  const onSaveSuccess = React.useCallback(() => {
    toast.success(t('submitSuccess'));
    router.back();
  }, [t, router]);

  const onSubmit = React.useCallback(
    (values: TokenPairEditForm) => {
      if (isEdit) {
        // 编辑态：仅 crossChainFee 可改。
        const dto: TokenPairEditReq = {
          tokenCrossChainId: tokenCrossChainId as number,
          crossChainFee: values.crossChainFee ?? '',
        };
        editMutation.mutate(dto, { onSuccess: onSaveSuccess });
      } else {
        // 新增态：send/receive 全字段。
        const dto: TokenPairSaveReq = {
          sendTokenId: values.sendTokenId ?? '',
          sendEndpointId: values.sendEndpointId ?? '',
          sendCrossChainAddress: values.sendCrossChainAddress ?? '',
          sendLiquidityPoolWalletAddress:
            values.sendLiquidityPoolWalletAddress ?? '',
          receiveTokenId: values.receiveTokenId ?? '',
          receiveEndpointId: values.receiveEndpointId ?? '',
          receiveCrossChainAddress: values.receiveCrossChainAddress ?? '',
          receiveLiquidityPoolWalletAddress:
            values.receiveLiquidityPoolWalletAddress ?? '',
          crossChainFee: values.crossChainFee ?? '',
        };
        saveMutation.mutate(dto, { onSuccess: onSaveSuccess });
      }
    },
    [isEdit, tokenCrossChainId, editMutation, saveMutation, onSaveSuccess],
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="flex items-stretch justify-between gap-4">
        {/* ── 左栏：send ── */}
        <div className="mb-4 w-[45%] rounded-md bg-card p-4 shadow-md">
          <div className="mb-4 text-sm font-bold">{t('cross_chain_0088')}</div>

          {/* sendToken（新增态 Select，编辑态 Input disabled） */}
          <Controller
            control={control}
            name="sendTokenId"
            rules={{ required: true }}
            render={({ field }) => (
              <div className="mb-4">
                <Label className="mb-1.5 block text-sm font-medium">
                  {t('cross_chain_0044')}
                </Label>
                {isEdit ? (
                  <Input
                    value={(field.value as string) ?? ''}
                    onChange={field.onChange}
                    disabled
                  />
                ) : (
                  <Select
                    key={`send-${receiveSelectKey}`}
                    value={(field.value as string) ?? undefined}
                    onValueChange={(v) => {
                      field.onChange(v);
                      const matched = sendTokenList.find(
                        (el) => el.stablecoinId === v,
                      );
                      setSendTokenInfo(matched ?? {});
                    }}
                  >
                    <SelectTrigger aria-invalid={!!errors.sendTokenId}>
                      <SelectValue placeholder={t('cross_chain_0044')} />
                    </SelectTrigger>
                    <SelectContent>
                      {sendTokenList.map((el) => (
                        <SelectItem key={el.stablecoinId} value={el.stablecoinId}>
                          {el.stablecoinName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {errors.sendTokenId ? (
                  <p className="mt-1 text-sm text-destructive" role="alert">
                    {t('fieldRequired', { field: t('cross_chain_0044') })}
                  </p>
                ) : null}
              </div>
            )}
          />

          {/* sendEndpointId（disabled） */}
          <ReadonlyField
            control={control}
            name="sendEndpointId"
            label={t('cross_chain_0001')}
          />
          {/* sendCrossChainAddress（disabled） */}
          <ReadonlyField
            control={control}
            name="sendCrossChainAddress"
            label={t('cross_chain_00123')}
          />
          {/* sendLiquidityPoolWalletAddress（disabled） */}
          <ReadonlyField
            control={control}
            name="sendLiquidityPoolWalletAddress"
            label={t('cross_chain_0045')}
          />

          {/* send 余额 / 授权 或 无流动性池提示 */}
          <div className="-mt-4 mb-6">
            {isLiquidityPoolWalletAddress ? (
              <div className="flex flex-col">
                <span>{`${t('cross_chain_0047')}: ${reSet(sendBalance)} ${symbol}`}</span>
                <span>{`${t('cross_chain_0048')}: ${reSet(sendAuthorized)} ${symbol}`}</span>
              </div>
            ) : (
              <div>
                <span>{t('cross_chain_00128')}</span>
                <button
                  type="button"
                  className="cursor-pointer text-primary hover:underline"
                  onClick={() =>
                    router.push('/cross-chain/liquidity-pool/edit')
                  }
                >
                  {t('cross_chain_00127')}
                </button>
              </div>
            )}
          </div>

          {/* crossChainFee（InputNumber 小数位 validator） */}
          <Controller
            control={control}
            name="crossChainFee"
            rules={{
              required: t('cross_chain_0026'),
              validate: {
                decimalPrecision: (value) => {
                  if (value === '' || value == null) {
                    return t('cross_chain_0026');
                  }
                  const str = String(value);
                  if (str.indexOf('.') > -1) {
                    const frac = str.split('.')[1] ?? '';
                    if (frac.length > decimalPrecision) {
                      return t('cross_chain_0028', {
                        decimalPrecision,
                      });
                    }
                  }
                  return true;
                },
              },
            }}
            render={({ field }) => (
              <div>
                <Label className="mb-1.5 block text-sm font-medium">
                  {t('cross_chain_0084')}
                </Label>
                <div className="flex items-stretch">
                  <Input
                    type="number"
                    value={field.value ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      field.onChange(v === '' ? undefined : v);
                    }}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                    className="rounded-r-none"
                  />
                  <span className="inline-flex items-center rounded-r-md border border-l-0 border-input bg-muted px-3 text-sm text-muted-foreground">
                    {`${symbol} ${t('cross_chain_0090')}`}
                  </span>
                </div>
                {errors.crossChainFee ? (
                  <p className="mt-1 text-sm text-destructive" role="alert">
                    {String(errors.crossChainFee.message ?? '')}
                  </p>
                ) : null}
                <div className="-mt-4 text-sm text-muted-foreground">
                  {t('cross_chain_0091')}
                </div>
              </div>
            )}
          />
        </div>

        {/* 中间装饰图标 */}
        <div className="flex w-14 shrink-0 items-center justify-center">
          <img
            src="/stablecoin/images/token-pair-setting.svg"
            alt=""
            className="h-14 w-14"
          />
        </div>

        {/* ── 右栏：receive ── */}
        <div className="mb-4 w-[45%] rounded-md bg-card p-4 shadow-md">
          <div className="mb-4 text-sm font-bold">{t('cross_chain_00124')}</div>

          {/* receiveToken（新增态 Select，编辑态 Input disabled） */}
          <Controller
            control={control}
            name="receiveTokenId"
            rules={{ required: true }}
            render={({ field }) => (
              <div className="mb-4">
                <Label className="mb-1.5 block text-sm font-medium">
                  {t('cross_chain_0044')}
                </Label>
                {isEdit ? (
                  <Input
                    value={(field.value as string) ?? ''}
                    onChange={field.onChange}
                    disabled
                  />
                ) : (
                  <Select
                    key={`receive-${receiveSelectKey}`}
                    value={(field.value as string) ?? undefined}
                    onValueChange={(v) => {
                      field.onChange(v);
                      const matched = receiveToken.find(
                        (el) => el.stablecoinId === v,
                      );
                      setReceiveTokenInfo(matched ?? {});
                    }}
                  >
                    <SelectTrigger aria-invalid={!!errors.receiveTokenId}>
                      <SelectValue placeholder={t('cross_chain_0044')} />
                    </SelectTrigger>
                    <SelectContent>
                      {receiveToken.map((el) => (
                        <SelectItem key={el.stablecoinId} value={el.stablecoinId}>
                          {el.stablecoinName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {errors.receiveTokenId ? (
                  <p className="mt-1 text-sm text-destructive" role="alert">
                    {t('fieldRequired', { field: t('cross_chain_0044') })}
                  </p>
                ) : null}
              </div>
            )}
          />

          {/* receiveEndpointId（disabled） */}
          <ReadonlyField
            control={control}
            name="receiveEndpointId"
            label={t('cross_chain_0001')}
          />
          {/* receiveCrossChainAddress（disabled） */}
          <ReadonlyField
            control={control}
            name="receiveCrossChainAddress"
            label={t('cross_chain_00123')}
          />
          {/* receiveLiquidityPoolWalletAddress（disabled） */}
          <ReadonlyField
            control={control}
            name="receiveLiquidityPoolWalletAddress"
            label={t('cross_chain_0045')}
          />

          {/* receive 余额 / 授权（始终展示，源码同款） */}
          <div className="-mt-4 mb-6 flex flex-col">
            <span>{`${t('cross_chain_0047')}: ${reSet(receiveBalance)} ${
              receiveSymbol || ''
            }`}</span>
            <span>{`${t('cross_chain_0048')}: ${reSet(receiveAuthorized)} ${
              receiveSymbol || ''
            }`}</span>
          </div>
        </div>
      </div>

      {/* ── 底部操作 ── */}
      <div className="mt-10 flex justify-end gap-8">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          {t('action.back')}
        </Button>
        <Button type="submit" disabled={isPending}>
          {t('action.submit')}
        </Button>
      </div>
    </form>
  );
}

/**
 * 只读字段（Input disabled）。
 *
 * send/receive 的 endpointId / 合约地址 / 钱包地址在源码中均为 disabled Input，
 * 值由联动（新增态）或回填（编辑态）设置，用户不可编辑。
 * required 仅用于表单提交守卫（联动失败时阻止提交）。
 */
function ReadonlyField({
  control,
  name,
  label,
}: {
  control: Control<TokenPairEditForm>;
  name: keyof TokenPairEditForm;
  label: string;
}): React.JSX.Element {
  return (
    <Controller
      control={control}
      name={name}
      rules={{ required: true }}
      render={({ field }) => (
        <div className="mb-4">
          <Label className="mb-1.5 block text-sm font-medium">{label}</Label>
          <Input
            value={(field.value as string) ?? ''}
            onChange={field.onChange}
            disabled
          />
        </div>
      )}
    />
  );
}
