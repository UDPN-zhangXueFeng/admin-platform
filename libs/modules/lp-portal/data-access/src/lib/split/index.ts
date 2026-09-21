/**
 * LP 我的分成域 barrel。
 *
 * split 页为纯只读（源仅 list/detail 两个查询端点，工作清单禁臆造接口），
 * 故无 mutations 件；仅 model / keys / api / queries 四件（pair 域同模式）。
 * 主 barrel 追加 `export * from './lib/split'` 时无同名歧义：
 * SplitRow/SplitDetailRow 未出现在公共 ../types（该处仅 settle 行内含
 * lpSplit* 字段），状态码表带 SPLIT_ 前缀避开 pair 域 PAIR_STATUS_TEXT。
 */
export * from './split.model';
export * from './split.keys';
export * from './split.api';
export * from './split.queries';
