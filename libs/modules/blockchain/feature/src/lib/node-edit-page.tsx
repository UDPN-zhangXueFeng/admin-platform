'use client';

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { toast } from 'sonner';
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@myorg/shared/ui';
import { FormField } from '@myorg/shared/ui-forms';
import {
  getNodeDetail,
  getNodeParamsDetail,
  useBlockchainListQuery,
  useEditNodeMutation,
  useNodeLocationListQuery,
  useSaveNodeMutation,
  type NodeEditFormValues,
  type NodeParamsDetailField,
  type NodeParamsSearchReqVO,
} from '@myorg/modules/blockchain/data-access';
import { buildNodeParamsDetail } from './node-edit-helpers';

/**
 * 节点编辑页 browserUrl 校验正则（迁移自源 node/edit.tsx）。
 * 要求 http:// 或 https:// 开头的合法域名路径。
 */
const URL_REGEX =
  // eslint-disable-next-line no-useless-escape
  /^https?:\/\/([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;

/** 保存/编辑成功后跳回列表的延迟（对齐源码 setTimeout 1000ms）。 */
const REDIRECT_DELAY_MS = 1000;

/**
 * NodeEditPage — 节点新增/编辑共用页（本模块最复杂，文档步骤 10）。
 *
 * 迁移自 td-manage src/pages/blockchain/node/edit.tsx（240 行）。
 *
 * 业务逻辑：
 * - 按 `query.blockchainId` 区分新增/编辑（编辑态两个 Select disabled）。
 * - 链 / 节点位置两个 Select 任一 onChange（且两者都有值）触发 `params/search`
 *   拉 `nodeParamsDetail` → `map` 出 N 个动态 `Input`（name=paramKey, label=paramName, required）。
 * - 链 Select onChange 时用选中项的 `browserUrl` 预填 browserUrl 输入框。
 * - 编辑态 `useEffect` 调 `detailApi`（endpoint 拼写保持 `detial`）回填 chainName/nodeLocation/
 *   browserUrl，并在 `getNodeParamsDetail().then()` 内回填动态字段（**修正源码时序 bug**：
 *   源码先 setFiledArrObj([]) 再异步 then 回填，但 filedArrObj.forEach 在 then 外同步执行，
 *   首次拉到的旧值会 set 空集合；这里把回填收敛到 then 内，保证字段集合已就绪）。
 * - onFinish 回扫 values 与 filedArrObj 按 paramKey 匹配拼装 nodeParamsDetail，按分支调
 *   save/edit，成功后 1s 跳回 /blockchain/node。
 * - browserUrl 用 URL 正则校验（源码同款正则）。
 *
 * 类型说明：动态字段 paramKey 运行时由接口返回，无法静态收窄表单 schema，故
 * NodeEditFormValues 含 `[key: string]: unknown` 索引签名（见 blockchain.model.ts）。
 */
export function NodeEditPage(): React.JSX.Element {
  const t = useTranslations('modules.blockchain');
  const router = useRouter();
  const searchParams = useSearchParams();

  const queryBlockchainId = searchParams?.get('blockchainId') ?? '';
  const queryNodeLocationId = searchParams?.get('nodeLocationId') ?? '';
  const isEdit = !!(queryBlockchainId && queryNodeLocationId);

  // ── 下拉数据源 ──
  const blockchainList = useBlockchainListQuery();
  const nodeLocationList = useNodeLocationListQuery();
  const saveMutation = useSaveNodeMutation();
  const editMutation = useEditNodeMutation();
  const submitting = saveMutation.isPending || editMutation.isPending;

  // ── 动态字段集合（params/search 返回的 nodeParamsDetail）──
  const [filedArrObj, setFiledArrObj] = React.useState<NodeParamsDetailField[]>(
    [],
  );

  const {
    control,
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<NodeEditFormValues>({
    defaultValues: {
      chainName: '',
      nodeLocation: '',
      browserUrl: '',
    },
    // 动态字段（paramKey）非静态 key，关闭严格模式以便任意键注册/取值。
    shouldUnregister: false,
  });

  /**
   * 按 blockchainId + nodeLocationId 拉节点参数明细并渲染动态字段。
   *
   * **关键时序修正（文档第 8 章 / 步骤 10）**：源码在 `setFiledArrObj([])` 之后、
   * `paramsSearchApi().then()` 之外同步执行 `filedArrObj.forEach(setFieldValue)`，
   * 由于 filedArrObj 此时仍是旧值（异步未返回），首次会 set 空集合——回填丢失。
   *
   * 这里把「拉取 + setState + 回填」收敛进 `.then()` 内，保证回填时字段集合已就绪。
   * 新增态无预设值，回填空字符串即可（与源码 form.setFieldValue(paramKey, paramValue) 等价，
   * params/search 返回的 paramValue 在新增场景通常为空模板）。
   */
  const fetchParamsDetail = React.useCallback(
    (
      req: NodeParamsSearchReqVO,
      /** 编辑态回填用的预设值（来自 detailApi.nodeParamsDetail）。新增态传 undefined。 */
      preset: NodeParamsDetailField[] | undefined,
    ) => {
      getNodeParamsDetail(req)
        .then((res) => {
          const fields = res?.nodeParamsDetail ?? [];
          setFiledArrObj(fields);
          // 回填动态字段：preset 优先（编辑态从 detailApi 来），否则用 params/search 自带值。
          const source = preset ?? fields;
          source.forEach((item) => {
            setValue(item.paramKey, item.paramValue ?? '');
          });
        })
        .catch(() => {
          setFiledArrObj([]);
        });
    },
    [setValue],
  );

  // ── 编辑态：detailApi 回填 + 首次拉动态字段 ──
  // 仅在 query 参数齐全时执行一次（对齐源码 useEffect []）。
  const detailLoadedRef = React.useRef(false);
  React.useEffect(() => {
    if (!isEdit || detailLoadedRef.current) return;
    detailLoadedRef.current = true;

    setValue('chainName', queryBlockchainId);
    setValue('nodeLocation', queryNodeLocationId);

    getNodeDetail(queryBlockchainId, queryNodeLocationId)
      .then((detail) => {
        if (!detail) return;
        setValue('browserUrl', detail.browserUrl ?? '');
        // 动态字段：先确定字段集合，再在 paramsSearch.then 内回填 detail 的 paramValue。
        // 这里用 detail.nodeParamsDetail 作为 preset 传给 fetchParamsDetail，
        // 保证回填发生在字段集合就绪之后（修正源码时序 bug）。
        fetchParamsDetail(
          {
            blockchainId: queryBlockchainId,
            nodeLocationId: queryNodeLocationId,
          },
          detail.nodeParamsDetail,
        );
      })
      .catch(() => {
        // detail 失败时仍拉一次 params/search 以渲染空字段集合（降级）。
        fetchParamsDetail(
          {
            blockchainId: queryBlockchainId,
            nodeLocationId: queryNodeLocationId,
          },
          undefined,
        );
      });
  }, [isEdit, queryBlockchainId, queryNodeLocationId, setValue, fetchParamsDetail]);

  // ── Select onChange：拉动态字段（新增态从下拉触发；编辑态 disabled 不触发）──
  const handleChainChange = React.useCallback(
    (chainId: string) => {
      const nodeLocation = (getValues('nodeLocation') as string) ?? '';
      // 预填 browserUrl：从下拉数据中找到选中项的 browserUrl。
      const selected = (blockchainList.data ?? []).find(
        (b) => String(b.key) === String(chainId),
      );
      setValue('browserUrl', selected?.browserUrl ?? '');
      if (chainId && nodeLocation) {
        fetchParamsDetail(
          { blockchainId: chainId, nodeLocationId: nodeLocation },
          undefined,
        );
      }
    },
    [getValues, setValue, blockchainList.data, fetchParamsDetail],
  );

  const handleNodeLocationChange = React.useCallback(
    (nodeLocationId: string) => {
      const chainId = (getValues('chainName') as string) ?? '';
      if (chainId && nodeLocationId) {
        fetchParamsDetail(
          { blockchainId: chainId, nodeLocationId },
          undefined,
        );
      }
    },
    [getValues, fetchParamsDetail],
  );

  // ── 提交：按分支调 save/edit，成功 1s 跳回列表 ──
  const onValid = React.useCallback(
    (values: NodeEditFormValues) => {
      const blockchainId = (values.chainName as string) ?? '';
      const nodeLocationId = (values.nodeLocation as string) ?? '';
      const browserUrl = (values.browserUrl as string) ?? '';
      const nodeParamsDetail = buildNodeParamsDetail(filedArrObj, values);

      const onSuccess = () => {
        toast.success(t('saveSuccess'));
        window.setTimeout(() => {
          router.push('/blockchain/node');
        }, REDIRECT_DELAY_MS);
      };

      if (isEdit) {
        editMutation.mutate(
          { blockchainId, nodeLocationId, nodeParamsDetail, browserUrl },
          { onSuccess },
        );
        return;
      }
      saveMutation.mutate(
        { blockchainId, nodeLocationId, nodeParamsDetail, browserUrl },
        { onSuccess },
      );
    },
    [filedArrObj, isEdit, editMutation, saveMutation, router, t],
  );

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="mb-6 text-base font-semibold">
        {isEdit ? t('editTitle') : t('newTitle')}
      </div>

      <form
        onSubmit={handleSubmit(onValid)}
        className="w-full max-w-[60%]"
        noValidate
      >
        <div className="flex justify-between gap-6">
          {/* 链名 Select：编辑态 disabled；单项 status!==1 disabled；onChange 预填 browserUrl + 拉动态字段 */}
          <Controller
            control={control}
            name="chainName"
            rules={{ required: t('blockchain_0000') }}
            render={({ field }) => (
              <div className="w-2/5">
                <label
                  htmlFor="select-chainName"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  {t('blockchain_0000')}
                  <span className="ml-0.5 text-destructive" aria-hidden="true">
                    *
                  </span>
                </label>
                <Select
                  value={(field.value as string) ?? ''}
                  onValueChange={(v) => {
                    field.onChange(v);
                    handleChainChange(v);
                  }}
                  disabled={isEdit}
                >
                  <SelectTrigger
                    id="select-chainName"
                    aria-invalid={!!errors.chainName}
                  >
                    <SelectValue placeholder={t('blockchain_0000')} />
                  </SelectTrigger>
                  <SelectContent>
                    {(blockchainList.data ?? []).map((b) => (
                      <SelectItem
                        key={b.key}
                        value={String(b.key)}
                        disabled={b.status !== 1}
                      >
                        {b.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.chainName ? (
                  <p className="mt-1 text-sm text-destructive" role="alert">
                    {String(errors.chainName.message ?? '')}
                  </p>
                ) : null}
              </div>
            )}
          />

          {/* 节点位置 Select：编辑态 disabled；onChange 拉动态字段 */}
          <Controller
            control={control}
            name="nodeLocation"
            rules={{ required: t('blockchain_0001') }}
            render={({ field }) => (
              <div className="w-2/5">
                <label
                  htmlFor="select-nodeLocation"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  {t('blockchain_0001')}
                  <span className="ml-0.5 text-destructive" aria-hidden="true">
                    *
                  </span>
                </label>
                <Select
                  value={(field.value as string) ?? ''}
                  onValueChange={(v) => {
                    field.onChange(v);
                    handleNodeLocationChange(v);
                  }}
                  disabled={isEdit}
                >
                  <SelectTrigger
                    id="select-nodeLocation"
                    aria-invalid={!!errors.nodeLocation}
                  >
                    <SelectValue placeholder={t('blockchain_0001')} />
                  </SelectTrigger>
                  <SelectContent>
                    {(nodeLocationList.data ?? []).map((nl) => (
                      <SelectItem key={nl.key} value={String(nl.key)}>
                        {nl.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.nodeLocation ? (
                  <p className="mt-1 text-sm text-destructive" role="alert">
                    {String(errors.nodeLocation.message ?? '')}
                  </p>
                ) : null}
              </div>
            )}
          />
        </div>

        {/* 动态参数字段（params/search 返回的 nodeParamsDetail map 出 N 个 Input）。
            name=paramKey / label=paramName / required。运行时通过 register(paramKey) 注册。 */}
        {filedArrObj.map((el) => (
          <FormField
            key={el.paramKey}
            name={el.paramKey}
            label={el.paramName}
            required
            register={register(el.paramKey, { required: t('blockchain_0001') })}
          />
        ))}

        {/* browserUrl：URL 正则校验（源码同款正则）。 */}
        <Controller
          control={control}
          name="browserUrl"
          rules={{
            required: t('blockchain_0031'),
            validate: (value) => {
              const v = typeof value === 'string' ? value : '';
              if (!URL_REGEX.test(v)) {
                return t('blockchain_0034');
              }
              return true;
            },
          }}
          render={({ field }) => (
            <div className="mt-4">
              <label
                htmlFor="field-browserUrl"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                {t('blockchain_0031')}
                <span className="ml-0.5 text-destructive" aria-hidden="true">
                  *
                </span>
              </label>
              <input
                id="field-browserUrl"
                type="text"
                value={(field.value as string) ?? ''}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
                placeholder={t('blockchain_0031')}
                aria-invalid={!!errors.browserUrl}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
              {errors.browserUrl ? (
                <p className="mt-1 text-sm text-destructive" role="alert">
                  {String(errors.browserUrl.message ?? '')}
                </p>
              ) : null}
            </div>
          )}
        />

        <div className="mt-8 flex justify-center gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={submitting}
          >
            {t('action.cancel')}
          </Button>
          <Button type="submit" disabled={submitting}>
            {t('action.submit')}
          </Button>
        </div>
      </form>
    </div>
  );
}
