/**
 * LP 资金池域 barrel。
 *
 * Pool 页当前只消费真实只读列表；开池/切换端点由后端兼容保留，页面不暴露
 * 写入口，但 data-access 定义继续保留以支持存量审批闭环。
 */
export * from './pool.model';
export * from './pool.keys';
export * from './pool.api';
export * from './pool.queries';
export * from './pool.mutations';
