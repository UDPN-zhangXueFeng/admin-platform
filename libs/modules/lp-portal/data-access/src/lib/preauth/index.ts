/**
 * LP 预授权域 barrel。
 *
 * preauth 页为纯只读快照（源仅 POST /preauth/list 一个端点，工作清单禁
 * 臆造接口），故无 mutations 件；仅 model / keys / api / queries 四件
 * （pair 域同模式）。主 barrel 追加 `export * from './lib/preauth'`
 * 时无同名歧义（PreauthRow 未出现在公共 ../types，该处仅有内嵌
 * PreauthItem）。
 */
export * from './preauth.model';
export * from './preauth.keys';
export * from './preauth.api';
export * from './preauth.queries';
