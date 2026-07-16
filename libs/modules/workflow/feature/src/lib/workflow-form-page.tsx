'use client';

import * as React from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Minus,
  Plus,
} from 'lucide-react';

import {
  Button,
  Input,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@myorg/shared/ui';
import { useRouter } from '@myorg/shared/util-i18n';

import { ApproverSelector } from '@myorg/modules/workflow/ui';
import {
  WORKFLOW_PAGE_SIZE,
  WorkflowSwitch,
  displayToTransferStepName,
  isThresholdBusiness,
  transferToDisplayStepName,
  transferToUserNames,
  validateThresholdAmount,
  type CandidateUser,
} from '@myorg/modules/workflow/util';
import {
  useBusinessListQuery,
  useCandidateUsersQuery,
  useCreateWorkflowMutation,
  useUpdateWorkflowMutation,
  useWorkflowDetailQuery,
  type WorkflowCreateReq,
  type WorkflowStepType,
} from '@myorg/modules/workflow/data-access';

/** `stablecoin` 是默认活动项目（见 configs/stablecoin.json）。 */
const PROJECT_ID = 'stablecoin';

/**
 * 表单节点值（对应旧页 nodes[]）。
 *
 * stepName 为展示态（' / ' 分隔）；提交时转传输态（'-' 分隔），见 util/workflow-step-name。
 * selectUser 仅作回填/抽屉初始化辅助；userId[] 是真正数据。
 * enableThreshold/thresholdAmount 为 t_edit 阈值增强字段（可选分支，workflow.md §6.4）。
 */
interface WorkflowNodeFormValue {
  /** 序号（展示态：首节点=1 发起人占位）。提交时 -1。 */
  stepOrder: number;
  /** 首节点为文案占位字符串；其余为 stepType 数字（5/10）。 */
  stepType: string | number;
  /** 审批人名展示串（' / ' 分隔）。 */
  stepName: string;
  /** 执行模式文案占位（旧页固定 i18n 文案）。 */
  executionMode: string;
  /** 审批人 id 列表。 */
  userId: number[];
  /** 抽屉回填辅助：人名数组。 */
  selectUser?: string[];
  /** t_edit 阈值增强：启用阈值。后端未落地时仅前端占位。 */
  enableThreshold?: boolean;
  /** t_edit 阈值增强：阈值金额。 */
  thresholdAmount?: number | null;
}

interface WorkflowFormValues {
  workflowName: string;
  businessCode: string;
  withdrawType: number;
  previousStepType: number;
  escalationType: number;
  nodes: WorkflowNodeFormValue[];
}

function parseId(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** 构造初始 2 节点（发起人占位 + 第一个审批节点）。 */
function buildInitialNodes(
  initiatorLabel: string,
  authorizedUserLabel: string,
  executionModeLabel: string,
  threshold = false
): WorkflowNodeFormValue[] {
  return [
    {
      stepOrder: 1,
      stepType: initiatorLabel,
      stepName: authorizedUserLabel,
      executionMode: executionModeLabel,
      userId: [],
    },
    {
      stepOrder: 2,
      stepType: 5 as WorkflowStepType,
      stepName: '',
      executionMode: executionModeLabel,
      userId: [],
      enableThreshold: threshold ? false : undefined,
      thresholdAmount: threshold ? null : undefined,
    },
  ];
}

/**
 * WorkflowFormPage — 新建/编辑二合一表单页（edit 生产版 + t_edit 阈值增强可选分支）。
 *
 * 迁移自 td-manage edit.tsx（生产）+ t_edit.tsx（阈值原型增强）。迁移决策
 * （workflow.md §2.3 / §8.1）：以 edit 生产版为基线，把 t_edit 的阈值字段
 * （enableThreshold/thresholdAmount + THRESHOLD_BUSINESS_CODES + 阶梯校验）作为
 * 「条件渲染」分支合入——仅当 businessCode ∈ THRESHOLD_BUSINESS_CODES 时节点表单
 * 才渲染阈值列。**不单独建 t_edit 路由**（收敛单一新增入口，文档建议）。
 *
 * - id 有无区分：有 → 编辑态（detail 回填，workflowName/businessCode disabled，提交调 update）；
 *   无 → 新增态（提交调 create）。
 * - 基础信息：workflowName（maxLength 50，编辑态只读）/ businessCode（Select，编辑态只读，
 *   切换重置节点为初始 2 节点 + 清空已选）。
 * - 审批节点（useFieldArray 替代 Form.List）：固定首节点（发起人占位只读）；末尾「Add」追加；
 *   仅最后一个节点可 remove。每节点：stepOrder（只读序号）/ stepType（Select [5,10] disabled）/
 *   stepName（readOnly + 「Selected」按钮唤起 ApproverSelector）/ executionMode（只读）。
 *   阈值列（条件渲染）：enableThreshold Checkbox + thresholdAmount（> 前缀，阶梯校验）。
 * - 三项开关：withdrawType / previousStepType / escalationType（RadioGroup 1=Yes/2=No）。
 *
 * 数据变换（对齐旧码，集中于此）：
 *   - 提交：过滤首节点 → stepName ' / '→'-'（displayToTransferStepName）→ stepOrder-1
 *     → userId 映射 {userId}[]。
 *   - 回填：nodes 逆向 → stepOrder+1 → stepName '-'→' / '（transferToDisplayStepName）→
 *     userId 从 stepUsers 提取。
 */
export function WorkflowFormPage() {
  const t = useTranslations('modules.workflow');
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = parseId(searchParams.get('id'));
  const isEdit = id != null;

  const { data: businessList } = useBusinessListQuery(PROJECT_ID);
  const { data: detail } = useWorkflowDetailQuery(PROJECT_ID, id);
  const createMutation = useCreateWorkflowMutation(PROJECT_ID);
  const updateMutation = useUpdateWorkflowMutation(PROJECT_ID);

  // 选人抽屉状态：当前编辑的节点下标 + 抽屉打开 + 查询参数。
  const [pickerIndex, setPickerIndex] = React.useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [pickerUserName, setPickerUserName] = React.useState('');
  const [pickerPageNum, setPickerPageNum] = React.useState(1);
  // 阈值阶梯校验错误信息（key=节点下标）。t_edit 增强分支，后端未落地时仅前端占位。
  const [thresholdError, setThresholdError] = React.useState<
    Record<number, string | undefined>
  >({});

  const executionModeLabel = t('field.executionModeValue');
  const initiatorLabel = t('field.initiator');
  const authorizedUserLabel = t('field.authorizedUser');

  const { control, register, handleSubmit, reset, watch, setValue, getValues } =
    useForm<WorkflowFormValues>({
      defaultValues: {
        workflowName: '',
        businessCode: '',
        withdrawType: WorkflowSwitch.Yes,
        previousStepType: WorkflowSwitch.Yes,
        escalationType: WorkflowSwitch.Yes,
        nodes: buildInitialNodes(
          initiatorLabel,
          authorizedUserLabel,
          executionModeLabel
        ),
      },
    });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'nodes',
  });

  // 新增态：businessList 加载后默认选第一个 code（旧页 useEffect 行为）。
  React.useEffect(() => {
    if (isEdit) return;
    if (businessList && businessList.length && !getValues('businessCode')) {
      setValue('businessCode', businessList[0].code);
    }
  }, [businessList, isEdit, getValues, setValue]);

  // 编辑态：detail 返回后逆向回填。
  React.useEffect(() => {
    if (!isEdit || !detail) return;
    const nodesArr: WorkflowNodeFormValue[] = [
      {
        stepOrder: 1,
        stepType: initiatorLabel,
        stepName: authorizedUserLabel,
        executionMode: executionModeLabel,
        userId: [],
      },
    ];
    const detailNodes = detail.nodes ?? [];
    const threshold = isThresholdBusiness(detail.businessCode);
    detailNodes.forEach((el) => {
      const userNames = transferToUserNames(el.stepName);
      nodesArr.push({
        stepOrder: el.stepOrder + 1,
        stepType: (el.stepType || 5) as WorkflowStepType,
        stepName: transferToDisplayStepName(el.stepName),
        executionMode: executionModeLabel,
        userId: el.stepUsers.map((u) => u.userId),
        selectUser: userNames,
        enableThreshold: threshold ? false : undefined,
        thresholdAmount: threshold ? null : undefined,
      });
    });
    reset({
      workflowName: detail.workflowName ?? '',
      businessCode: detail.businessCode ?? '',
      withdrawType: detail.withdrawType,
      previousStepType: detail.previousStepType,
      escalationType: detail.escalationType,
      nodes: nodesArr,
    });
    // detail 一次性回填，不随 initiatorLabel 等 i18n 文案变化重跑。
  }, [detail, isEdit]);

  const currentBusinessCode = watch('businessCode');
  const showThreshold = isThresholdBusiness(currentBusinessCode);
  const nodes = watch('nodes');

  /** businessCode 切换：重置节点为初始 2 节点 + 清空已选（旧页 onChange 行为）。 */
  const onBusinessCodeChange = React.useCallback(
    (value: string) => {
      setValue('businessCode', value);
      setPickerIndex(null);
      setValue(
        'nodes',
        buildInitialNodes(
          initiatorLabel,
          authorizedUserLabel,
          executionModeLabel,
          isThresholdBusiness(value)
        )
      );
    },
    [setValue, initiatorLabel, authorizedUserLabel, executionModeLabel]
  );

  /** 打开选人抽屉（某节点的「Selected」按钮）。 */
  const openPicker = React.useCallback(
    (index: number) => {
      setPickerIndex(index);
      // 重置查询参数（每次打开以干净态拉候选用户，对齐旧页 form1.resetFields）。
      setPickerUserName('');
      setPickerPageNum(1);
      setPickerOpen(true);
    },
    []
  );

  // 候选用户查询参数（抽屉打开时才查；按 businessCode + userName + 分页）。
  const candidateParams = React.useMemo(
    () => ({
      page: { pageNum: pickerPageNum, pageSize: WORKFLOW_PAGE_SIZE },
      data: {
        businessCode: currentBusinessCode ?? '',
        userName: pickerUserName || undefined,
      },
    }),
    [currentBusinessCode, pickerUserName, pickerPageNum]
  );
  const candidateQuery = useCandidateUsersQuery(
    PROJECT_ID,
    candidateParams,
    pickerOpen && Boolean(currentBusinessCode)
  );

  // 抽屉初始已选：由当前 pickerIndex 节点的 userId[] + selectUser[] 映射。
  // selectUser 在回填/上次提交时已同步，长度与 userId 一致。
  const pickerSelectedUsers: CandidateUser[] = React.useMemo(() => {
    if (pickerIndex == null) return [];
    const node = nodes[pickerIndex];
    if (!node) return [];
    const userIds: number[] = node.userId ?? [];
    const names: string[] = node.selectUser ?? [];
    return userIds.map((uid, i) => ({
      userId: uid,
      userName: names[i] ?? '',
      roles: [],
    }));
  }, [pickerIndex, nodes]);

  /** 抽屉查询回调（搜索 userName + 翻页）。 */
  const onPickerQueryChange = React.useCallback(
    (userName: string, pageNum: number) => {
      setPickerUserName(userName);
      setPickerPageNum(pageNum);
    },
    []
  );

  /** 抽屉提交：把选中审批人写回当前节点。 */
  const onPickerSubmit = React.useCallback(
    (users: CandidateUser[]) => {
      if (pickerIndex == null) return;
      const userIds = users.map((u) => u.userId);
      const userNames = users.map((u) => u.userName);
      const list = getValues('nodes').slice();
      list[pickerIndex] = {
        ...list[pickerIndex],
        userId: userIds,
        stepName: userNames.join(' / '),
        selectUser: userNames,
      };
      setValue('nodes', list);
      setPickerOpen(false);
      setPickerIndex(null);
    },
    [pickerIndex, getValues, setValue]
  );

  const submitting = createMutation.isPending || updateMutation.isPending;

  const onSubmit = handleSubmit((values) => {
    // 数据变换：过滤首节点 → stepName ' / '→'-' → stepOrder-1 → userId→{userId}[]。
    const nodeList = values.nodes.filter((_, index) => index !== 0);
    const payloadNodes = nodeList.map((el) => ({
      stepName: displayToTransferStepName(el.stepName),
      stepOrder: el.stepOrder - 1,
      stepType: Number(el.stepType) as WorkflowStepType,
      stepUsers: el.userId.map((uid: number) => ({ userId: uid })),
    }));
    const base: WorkflowCreateReq = {
      businessCode: values.businessCode,
      escalationType: values.escalationType as 1 | 2,
      previousStepType: values.previousStepType as 1 | 2,
      withdrawType: values.withdrawType as 1 | 2,
      workflowName: values.workflowName,
      nodes: payloadNodes,
    };
    const onSuccess = () => router.push('/sys/workflow');
    if (isEdit && id) {
      updateMutation.mutate({ workflowId: id, ...base }, { onSuccess });
    } else {
      createMutation.mutate(base, { onSuccess });
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* 基础信息区 */}
      <section className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <div className="mb-6 text-base font-semibold">
          {isEdit ? t('edit.title') : t('create.title')}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              {t('field.workflowName')}
              <span className="ml-0.5 text-red-500">*</span>
            </label>
            <Input
              maxLength={50}
              disabled={isEdit}
              {...register('workflowName', { required: true })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              {t('field.businessName')}
              <span className="ml-0.5 text-red-500">*</span>
            </label>
            <Controller
              control={control}
              name="businessCode"
              rules={{ required: true }}
              render={({ field }) => (
                <Select
                  value={field.value || undefined}
                  onValueChange={onBusinessCodeChange}
                  disabled={isEdit}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('field.businessName')} />
                  </SelectTrigger>
                  <SelectContent>
                    {(businessList ?? []).map((b) => (
                      <SelectItem key={b.code} value={b.code}>
                        {b.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-xs text-theme">{t('business.hint')}</p>
          </div>
        </div>
      </section>

      {/* 审批节点区 */}
      <section className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <div className="mb-4 text-sm font-semibold">{t('process.title')}</div>

        {/* 表头 */}
        <div className="mb-2 flex gap-3 text-xs font-semibold text-muted-foreground">
          <span className="w-12">{t('field.stepOrder')}</span>
          <span className="w-24">{t('field.stepType')}</span>
          <span className="flex-1">{t('field.assignees')}</span>
          {showThreshold ? (
            <>
              <span className="w-32">{t('field.thresholdRule')}</span>
              <span className="w-40">{t('field.thresholdAmount')}</span>
            </>
          ) : null}
          <span className="w-12" />
        </div>

        {fields.map((field, key) => {
          const isInitiator = key === 0;
          const isLast = key === fields.length - 1;
          const canRemove = nodes.length > 2 && isLast;
          return (
            <div key={field.id} className="mb-4">
              <div className="flex items-start gap-3">
                {/* stepOrder */}
                <div className="w-12">
                  <Input
                    disabled
                    className="h-10"
                    {...register(`nodes.${key}.stepOrder` as const)}
                  />
                </div>
                {/* stepType */}
                <div className="w-24">
                  {isInitiator ? (
                    <Input disabled className="h-10" value={initiatorLabel} />
                  ) : (
                    <Controller
                      control={control}
                      name={`nodes.${key}.stepType` as const}
                      render={({ field: f }) => (
                        <Select
                          value={String(f.value)}
                          onValueChange={(v) => f.onChange(Number(v))}
                          disabled
                        >
                          <SelectTrigger className="h-10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[5, 10].map((s) => (
                              <SelectItem key={s} value={String(s)}>
                                {t(`stepType.${s}`)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  )}
                </div>
                {/* stepName（readOnly + Selected 按钮） */}
                <div className="flex-1">
                  {isInitiator ? (
                    <Input disabled className="h-10" value={authorizedUserLabel} />
                  ) : (
                    <Controller
                      control={control}
                      name={`nodes.${key}.stepName` as const}
                      rules={{ required: true }}
                      render={({ field: f }) => (
                        <div className="flex items-center gap-2">
                          <Input
                            readOnly
                            className="h-10"
                            value={f.value}
                            onChange={f.onChange}
                          />
                          <Button
                            type="button"
                            variant="link"
                            className="h-auto p-0"
                            onClick={() => openPicker(key)}
                          >
                            {t('action.selected')}
                          </Button>
                        </div>
                      )}
                    />
                  )}
                </div>
                {/* 阈值列（条件渲染） */}
                {showThreshold && !isInitiator ? (
                  <>
                    <div className="w-32">
                      <Controller
                        control={control}
                        name={`nodes.${key}.enableThreshold` as const}
                        render={({ field: f }) => (
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={Boolean(f.value)}
                              onChange={(e) => {
                                f.onChange(e.target.checked);
                                if (!e.target.checked) {
                                  setValue(
                                    `nodes.${key}.thresholdAmount` as const,
                                    null
                                  );
                                }
                              }}
                            />
                            {t('field.thresholdEnable')}
                          </label>
                        )}
                      />
                    </div>
                    <div className="w-40">
                      <Controller
                        control={control}
                        name={`nodes.${key}.thresholdAmount` as const}
                        render={({ field: f }) => {
                          const enabled = nodes[key]?.enableThreshold;
                          return (
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">&gt;</span>
                              <Input
                                type="number"
                                min={0}
                                disabled={!enabled}
                                className="h-10"
                                value={f.value ?? ''}
                                onChange={(e) => {
                                  const num = e.target.value
                                    ? Number(e.target.value)
                                    : null;
                                  f.onChange(num);
                                  // 阶梯校验（t_edit validateThresholdAmount）。
                                  if (enabled && num != null) {
                                    const prev = validateThresholdAmount(
                                      nodes,
                                      key,
                                      num
                                    );
                                    setThresholdError((m) => ({
                                      ...m,
                                      [key]:
                                        prev != null
                                          ? t('validate.thresholdLt', {
                                              amount: prev,
                                            })
                                          : undefined,
                                    }));
                                  } else {
                                    setThresholdError((m) => ({
                                      ...m,
                                      [key]: undefined,
                                    }));
                                  }
                                }}
                              />
                            </div>
                          );
                        }}
                      />
                      {thresholdError[key] ? (
                        <p className="text-xs text-red-500">
                          {thresholdError[key]}
                        </p>
                      ) : null}
                    </div>
                  </>
                ) : showThreshold && isInitiator ? (
                  <>
                    <div className="w-32" />
                    <div className="w-40" />
                  </>
                ) : null}
                {/* remove */}
                <div className="w-12 pt-2">
                  {canRemove ? (
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-destructive"
                      onClick={() => remove(key)}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
              {/* executionMode（只读文案，旧页列） */}
              <div className="mt-1 pl-12 text-xs text-muted-foreground">
                {t('field.executionMode')}：{executionModeLabel}
              </div>
            </div>
          );
        })}

        {/* Add 节点 */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            append({
              stepOrder: nodes.length + 1,
              stepType: 5 as WorkflowStepType,
              stepName: '',
              executionMode: executionModeLabel,
              userId: [],
              enableThreshold: showThreshold ? false : undefined,
              thresholdAmount: showThreshold ? null : undefined,
            })
          }
        >
          <Plus className="mr-1 h-4 w-4" />
          {t('action.add')}
        </Button>
      </section>

      {/* 三项配置开关 */}
      <section className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <div className="mb-4 text-sm font-semibold">{t('config.title')}</div>
        <div className="space-y-6">
          <SwitchRow
            label={t('field.withdraw')}
            hint={t('config.withdrawHint')}
            control={control}
            name="withdrawType"
          />
          <SwitchRow
            label={t('field.revert')}
            hint={t('config.revertHint')}
            control={control}
            name="previousStepType"
          />
          <SwitchRow
            label={t('field.escalate')}
            hint={t('config.escalateHint')}
            control={control}
            name="escalationType"
          />
        </div>
      </section>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/sys/workflow')}
          disabled={submitting}
        >
          {t('action.cancel')}
        </Button>
        <Button type="submit" disabled={submitting}>
          {t('action.save')}
        </Button>
      </div>

      {/* 选人抽屉 */}
      <ApproverSelector
        open={pickerOpen}
        selectedUsers={pickerSelectedUsers}
        rows={candidateQuery.data?.rows ?? []}
        total={candidateQuery.data?.page?.total ?? 0}
        loading={candidateQuery.isLoading}
        pageNum={pickerPageNum}
        pageSize={WORKFLOW_PAGE_SIZE}
        titleLabel={t('picker.title')}
        userNameLabel={t('field.userName')}
        rolesLabel={t('field.roles')}
        queryLabel={t('query')}
        resetLabel={t('reset')}
        cancelLabel={t('action.cancel')}
        submitLabel={t('action.submit')}
        notFoundHintLabel={t('picker.notFoundHint')}
        goToUserMgmtLabel={t('picker.goToUserMgmt')}
        onQueryChange={onPickerQueryChange}
        onSubmit={onPickerSubmit}
        onClose={() => {
          setPickerOpen(false);
          setPickerIndex(null);
        }}
        onGoToUserMgmt={() => router.push('/sys/user')}
      />
    </form>
  );
}

interface SwitchRowProps {
  label: string;
  hint: string;
  control: import('react-hook-form').Control<WorkflowFormValues>;
  name: 'withdrawType' | 'previousStepType' | 'escalationType';
}

function SwitchRow({ label, hint, control, name }: SwitchRowProps) {
  return (
    <div>
      <Controller
        control={control}
        name={name}
        rules={{ required: true }}
        render={({ field }) => (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">{label}</label>
            <RadioGroup
              value={String(field.value)}
              onValueChange={(v) => field.onChange(Number(v))}
              className="flex gap-6"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value={String(WorkflowSwitch.Yes)} id={`${name}-yes`} />
                <label htmlFor={`${name}-yes`} className="text-sm">
                  <YesNo yes />
                </label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value={String(WorkflowSwitch.No)} id={`${name}-no`} />
                <label htmlFor={`${name}-no`} className="text-sm">
                  <YesNo />
                </label>
              </div>
            </RadioGroup>
          </div>
        )}
      />
      <p className="mt-1 text-xs text-theme">{hint}</p>
    </div>
  );
}

/** Yes/No 文案（复用 useTranslations 顶层文案，避免每行重复传 t）。 */
function YesNo({ yes }: { yes?: boolean }) {
  const t = useTranslations('modules.workflow');
  return <>{yes ? t('yes') : t('no')}</>;
}
