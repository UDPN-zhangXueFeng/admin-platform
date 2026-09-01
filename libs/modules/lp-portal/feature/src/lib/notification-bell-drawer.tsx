'use client';

/**
 * NotificationBellDrawer —— Header 铃铛入口 + 380px 通知抽屉（工作清单 G6，
 * 源 `layout/MainLayout.vue` 内联通知中心 + el-badge 铃铛 1:1 语义迁移）。
 *
 * 保真点（源逐条对照，勿「顺手修正」）：
 * - 抽屉宽固定 380px（源 el-drawer size="380px"）；
 * - badge 上限 99（99+ 展示），unreadCount===0 时整体隐藏（源 el-badge
 *   :max=99 / :hidden）；
 * - 每次打开都拉 POST /lp/notification/list page(1,20)（源 onBell 必调
 *   loadNotifications；由 enabled 开关驱动每开重取）；
 * - 条目 tag：type===2 水位告警（amber，pool/syslog 页警示色族同款），
 *   其余系统通知（secondary）——文案经域模型 NOTIFICATION_TYPE_TEXT 英文化；
 * - 时间走共享 formatTime（任务裁决：秒级共享实现取代源私有 fmtTime 的
 *   分钟精度，签名/空值语义一致，域内不另造格式化器）；
 * - 已读条目 opacity 0.62（源 .is-read），未读正常；
 * - 点击未读 → markRead 成功本地置已读；失败静默不发 toast（源 catch{}，
 *   全局拦截器提示与源 request.ts 同层承担）；
 * - unreadCount 由当前页 rows 过滤 readFlag===0 推导，无全局轮询；
 * - 空态英文 'No notifications'。
 *
 * 装配：LpAppShell 经 AppShell/SidebarLayout 新 trailing 直通槽喂入 Header
 * 右侧动作区（header.tsx 既有 opt-in 插槽，本组件不改 header）。
 */
import * as React from 'react';
import { Bell } from 'lucide-react';

import { Badge, Button, Skeleton } from '@myorg/shared/ui';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@myorg/shared/ui';
import { cn } from '@myorg/shared/util-classnames';
import {
  LP_PROJECT_ID,
  NOTIFICATION_TYPE_TEXT,
  isWaterLevelAlert,
  useNotificationListQuery,
  useNotificationMarkReadMutation,
  type NotificationRow,
} from '@myorg/modules/lp-portal/data-access';

import { formatTime } from './format';

/** 界面文案全英文（约束①）。 */
const COPY = {
  title: 'Notifications',
  bellLabel: 'Notifications',
  empty: 'No notifications',
  error: 'Failed to load notifications',
} as const;

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

/** 源 el-tag type 分支 → Badge 呈现（warning 无原生 variant，amber 近似色）。 */
const TYPE_BADGE: Record<
  string,
  { variant?: BadgeVariant; className?: string }
> = {
  warning: { className: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  info: { variant: 'secondary' },
};

/** type → 条目 tag（未知码兜底 info/'System'，syslog BizTag 同模式）。 */
function TypeTag({ type }: { type: number }) {
  const style = TYPE_BADGE[isWaterLevelAlert(type) ? 'warning' : 'info'];
  return <Badge {...style}>{NOTIFICATION_TYPE_TEXT[type] ?? 'System'}</Badge>;
}

/** 加载中 / 空态共用居中占位（源 .notify-empty 版式语义）。 */
function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="py-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

/** 单条通知：tag + 时间 / 标题 / 正文；已读整卡 0.62 灰显。 */
function NotifyItem({
  row,
  onRead,
}: {
  row: NotificationRow;
  onRead: (row: NotificationRow) => void;
}) {
  return (
    <div
      className={cn(
        'cursor-pointer rounded-lg border bg-card p-3 transition-colors hover:bg-accent/60',
        row.readFlag === 1 && 'opacity-[0.62]',
      )}
      onClick={() => onRead(row)}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <TypeTag type={row.type} />
        <span className="text-xs tabular-nums text-muted-foreground">
          {formatTime(row.createTime)}
        </span>
      </div>
      <div className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
        {row.readFlag === 0 && (
          <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
        )}
        {row.title}
      </div>
      <div className="whitespace-pre-wrap break-all text-xs leading-relaxed text-muted-foreground">
        {row.content}
      </div>
    </div>
  );
}

/**
 * 铃铛 + 抽屉一体入口。列表 query 常驻本组件（徽标需在抽屉关闭期间仍能
 * 从缓存行推导 unreadCount）；`enabled` 随 open 翻转实现每次打开重拉首页。
 */
export function NotificationBellDrawer() {
  const [open, setOpen] = React.useState(false);
  const listQuery = useNotificationListQuery(LP_PROJECT_ID, { enabled: open });
  const markRead = useNotificationMarkReadMutation(LP_PROJECT_ID);

  const rows = listQuery.data ?? [];
  const unreadCount = rows.filter((n) => n.readFlag === 0).length;
  const badgeText = unreadCount > 99 ? '99+' : String(unreadCount);

  const handleRead = (row: NotificationRow) => {
    if (row.readFlag === 1) return;
    markRead.mutate(row.notifyId);
  };

  return (
    <>
      <span className="relative inline-flex">
        <Button
          variant="ghost"
          size="icon"
          aria-label={COPY.bellLabel}
          title={COPY.bellLabel}
          onClick={() => setOpen(true)}
        >
          <Bell className="h-4 w-4" />
        </Button>
        {unreadCount > 0 && (
          <Badge className="absolute -right-1 -top-1 h-4 min-w-4 px-1 text-[10px] tabular-nums">
            {badgeText}
          </Badge>
        )}
      </span>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="flex w-[380px] max-w-[380px] flex-col">
          <DrawerHeader>
            <DrawerTitle>{COPY.title}</DrawerTitle>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            {listQuery.isFetching ? (
              <div className="space-y-2.5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="rounded-lg border bg-card p-3">
                    <div className="mb-1.5 flex items-center justify-between">
                      <Skeleton className="h-5 w-16" />
                      <Skeleton className="h-3.5 w-20" />
                    </div>
                    <Skeleton className="mb-1 h-4 w-2/5" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-3/5" />
                  </div>
                ))}
              </div>
            ) : listQuery.isError ? (
              <Placeholder>{COPY.error}</Placeholder>
            ) : rows.length === 0 ? (
              <Placeholder>{COPY.empty}</Placeholder>
            ) : (
              <div className="space-y-2.5">
                {rows.map((row) => (
                  <NotifyItem key={row.notifyId} row={row} onRead={handleRead} />
                ))}
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
