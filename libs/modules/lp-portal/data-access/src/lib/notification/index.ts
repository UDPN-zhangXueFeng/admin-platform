/**
 * LP 通知域 barrel（通知中心：Header 铃铛抽屉消费）。
 *
 * 五件套 + mutations（markRead 写操作）；样式按 feature 抽屉侧局部码表
 * （syslog BIZ_BADGE 同模式），域内只出文案与判定。
 */
export * from './notification.model';
export * from './notification.keys';
export * from './notification.api';
export * from './notification.queries';
export * from './notification.mutations';
