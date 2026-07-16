'use client';

import * as React from 'react';
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '@myorg/shared/ui';
import type { CandidateUser } from '@myorg/modules/workflow/util';

/**
 * NOTE on dependency direction：
 * ui 层禁止依赖 data-access（@nx/enforce-module-boundaries 限定 type:ui 只能依赖
 * ui/util/model）。故 CandidateUser 类型不直接从 data-access 引入——由 util 层
 * 本地声明结构等价类型（structural typing 下与 data-access 的 CandidateUser 兼容）。
 */
export interface ApproverSelectorProps {
  /** 抽屉是否打开。 */
  open: boolean;
  /**
   * 进入抽屉时已选的审批人全集（由调用方从当前节点 userId/selectUser 映射）。
   * 抽屉以此初始化勾选态。
   */
  selectedUsers: CandidateUser[];
  /** 候选用户当前页数据（由 feature 层查询后传入，保持 ui 纯展示）。 */
  rows: CandidateUser[];
  /** 候选用户总数（分页用）。 */
  total: number;
  /** 候选用户加载态。 */
  loading: boolean;
  /** 当前页码（1-based）。 */
  pageNum: number;
  /** 每页条数。 */
  pageSize: number;
  /** 文案：标题。 */
  titleLabel: string;
  /** 文案：用户名列。 */
  userNameLabel: string;
  /** 文案：角色列。 */
  rolesLabel: string;
  /** 文案：查询按钮。 */
  queryLabel: string;
  /** 文案：重置按钮。 */
  resetLabel: string;
  /** 文案：取消按钮。 */
  cancelLabel: string;
  /** 文案：提交按钮。 */
  submitLabel: string;
  /** 文案：找不到用户的提示文案。 */
  notFoundHintLabel: string;
  /** 文案：跳转 User Management 的链接文案。 */
  goToUserMgmtLabel: string;
  /** 查询回调（搜索 userName + 分页变化由 feature 层接管实际请求）。 */
  onQueryChange: (userName: string, pageNum: number) => void;
  /** 提交回调：返回最终选中的审批人全集（去重，按勾选顺序）。 */
  onSubmit: (users: CandidateUser[]) => void;
  /** 关闭回调（取消/X/点击遮罩）。 */
  onClose: () => void;
  /** 跳转 /sys/user 回调（由调用方接管路由，保持 ui 层不直接依赖 router）。 */
  onGoToUserMgmt?: () => void;
}

/**
 * ApproverSelector — 审批人选择抽屉（edit 表单选人）。
 *
 * 迁移自 td-manage edit.tsx 选人 Drawer。项目未安装 antd，故用 Dialog（居中弹层）
 * + 自渲染 Checkbox 表格替代 Drawer/Table，零新依赖（参考 role 自渲染思路）。
 *
 * 跨页多选状态机（workflow.md §6.3，最易踩坑）——**保留旧逻辑语义**（Rule 11）：
 * 旧实现用三段状态（selectedRowKeys / selectedRowsData / removeKeys ref）+ 三个
 * rowSelection 回调协作实现「翻页累积选择」。此处等价为单一 `Map<userId, row>`
 * 作为已选全集的真相源：
 *   - 单选/全选变化时，把当前页的勾选态合并入 Map（选中 add / 取消 delete）；
 *   - 旧码的 removeKeys 仅用于 onChange 时过滤「已在前序操作中取消」的 key，单 Map
 *     方案下不需要该过滤（Map 直接 delete 即生效），故省去 removeKeys，逻辑更简且
 *     语义等价（Map 是真集合，天然去重，无需 Set/array 拼接）。
 *
 * 服务端分页：翻页不丢已选（Map 跨页累积），每页勾选态由 Map 派生。
 * 数据获取与分页控制在 feature 层（onQueryChange），ui 层只负责展示与勾选态。
 */
export function ApproverSelector({
  open,
  selectedUsers,
  rows,
  total,
  loading,
  pageNum,
  pageSize,
  titleLabel,
  userNameLabel,
  rolesLabel,
  queryLabel,
  resetLabel,
  cancelLabel,
  submitLabel,
  notFoundHintLabel,
  goToUserMgmtLabel,
  onQueryChange,
  onSubmit,
  onClose,
  onGoToUserMgmt,
}: ApproverSelectorProps) {
  // 已选全集：跨页累积。open 时由 selectedUsers 初始化；勾选变化即时更新。
  const [selectedMap, setSelectedMap] = React.useState<
    Map<number, CandidateUser>
  >(new Map());
  // 搜索 userName 输入态（提交查询时才回传 feature 层）。
  const [userNameInput, setUserNameInput] = React.useState('');

  // 打开抽屉时：重置为调用方传入的当前节点已选人 + 重置搜索。
  React.useEffect(() => {
    if (!open) return;
    const m = new Map<number, CandidateUser>();
    selectedUsers.forEach((u) => m.set(u.userId, u));
    setSelectedMap(m);
    setUserNameInput('');
  }, [open, selectedUsers]);

  /** 单行勾选切换：更新 Map。 */
  const toggleRow = React.useCallback((row: CandidateUser, checked: boolean) => {
    setSelectedMap((prev) => {
      const next = new Map(prev);
      if (checked) next.set(row.userId, row);
      else next.delete(row.userId);
      return next;
    });
  }, []);

  /** 当前页全选/全不选：把当前页所有行加入或移出 Map。 */
  const togglePageAll = React.useCallback(
    (checked: boolean) => {
      setSelectedMap((prev) => {
        const next = new Map(prev);
        rows.forEach((r) => {
          if (checked) next.set(r.userId, r);
          else next.delete(r.userId);
        });
        return next;
      });
    },
    [rows]
  );

  const pageChecked = rows.length > 0 && rows.every((r) => selectedMap.has(r.userId));
  const pageIndeterminate =
    rows.some((r) => selectedMap.has(r.userId)) && !pageChecked;

  /** 提交：返回 Map 全集（按插入顺序，天然去重）。 */
  const handleSubmit = React.useCallback(() => {
    onSubmit(Array.from(selectedMap.values()));
  }, [selectedMap, onSubmit]);

  /** 查询（form1 onFinish 等价）：回传 userName + 回到第 1 页。 */
  const handleQuery = React.useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onQueryChange(userNameInput, 1);
    },
    [userNameInput, onQueryChange]
  );

  /** 重置：清空 userName + 回到第 1 页。 */
  const handleReset = React.useCallback(() => {
    setUserNameInput('');
    onQueryChange('', 1);
  }, [onQueryChange]);

  /** 翻页：回传当前 userName + 目标页。 */
  const goPage = React.useCallback(
    (delta: number) => {
      onQueryChange(userNameInput, pageNum + delta);
    },
    [userNameInput, pageNum, onQueryChange]
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] w-[min(900px,92vw)] overflow-hidden">
        <DialogHeader>
          <DialogTitle>{titleLabel}</DialogTitle>
        </DialogHeader>

        {/* 搜索栏（form1） */}
        <form onSubmit={handleQuery} className="flex items-end gap-3 px-1">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              {userNameLabel}
            </label>
            <Input
              value={userNameInput}
              onChange={(e) => setUserNameInput(e.target.value)}
              className="w-60"
              placeholder={userNameLabel}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm">
              {queryLabel}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleReset}>
              {resetLabel}
            </Button>
          </div>
        </form>

        {/* 候选用户表（自渲染 Checkbox 行） */}
        <div className="max-h-[50vh] overflow-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/50">
              <tr>
                <th className="w-10 px-3 py-2 text-left">
                  <Checkbox
                    checked={
                      pageIndeterminate ? 'indeterminate' : pageChecked
                    }
                    onCheckedChange={(v) => togglePageAll(v === true)}
                  />
                </th>
                <th className="px-3 py-2 text-left font-medium">{userNameLabel}</th>
                <th className="px-3 py-2 text-left font-medium">{rolesLabel}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                    …
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                    —
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const checked = selectedMap.has(row.userId);
                  return (
                    <tr key={row.userId} className="border-t">
                      <td className="px-3 py-2">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => toggleRow(row, v === true)}
                        />
                      </td>
                      <td className="px-3 py-2">{row.userName}</td>
                      <td className="px-3 py-2">{row.roles.join('、')}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        <div className="flex items-center justify-between px-1 text-sm">
          <span className="text-muted-foreground">{total}</span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pageNum <= 1}
              onClick={() => goPage(-1)}
            >
              ‹
            </Button>
            <span>
              {pageNum} / {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pageNum >= totalPages}
              onClick={() => goPage(1)}
            >
              ›
            </Button>
          </div>
        </div>

        {/* 找不到用户提示 */}
        {(notFoundHintLabel || goToUserMgmtLabel) && (
          <div className="px-1 text-sm text-theme">
            <span>{notFoundHintLabel}</span>
            {onGoToUserMgmt && goToUserMgmtLabel ? (
              <button
                type="button"
                className="ml-1 cursor-pointer underline"
                onClick={onGoToUserMgmt}
              >
                {goToUserMgmtLabel}
              </button>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button type="button" onClick={handleSubmit}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
