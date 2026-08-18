/**
 * LP 货币对与资金池域 barrel。
 *
 * pair-pool 页为纯只读（源无 save/update 端点，工作清单禁臆造接口），
 * 故无 mutations 件；仅 model / keys / api / queries 四件（pool 域同模式）。
 * 行类型自公共 ../types 锚定重导出（rate 域同模式），主 barrel 追加
 * `export * from './lib/pair'` 时无同名歧义。
 */
export * from './pair.model';
export * from './pair.keys';
export * from './pair.api';
export * from './pair.queries';
