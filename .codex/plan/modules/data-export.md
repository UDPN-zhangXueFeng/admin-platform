# data-export 模块迁移记录

## 1. 业务概述

Data Export 展示当前登录用户的异步导出任务，支持查看数据来源、文件 ID、文件哈希、导出时间和任务状态；任务完成后下载导出文件。

## 2. 源与目标

| 项目 | 路径 |
|---|---|
| 源页面 | `/Users/rnail/orca/td-manage/src/pages/data-export/index.tsx` |
| 源基线 | `feature/zxf@d6eba908` |
| 目标页面 | `libs/modules/td-admin/feature/src/lib/data-export/data-export-page.tsx` |
| 目标数据访问 | `libs/modules/td-admin/data-access/src/lib/data-export/` |
| 目标 namespace | `modules.data-export` |
| 目标路由 | `/data-export` |

## 3. API

| Method | Endpoint | 用途 |
|---|---|---|
| POST | `/api/manage/v1/export/task/list/my` | 当前用户导出任务分页列表 |
| POST | `/api/manage/v1/export/task/download` | 下载已完成任务的二进制文件，参数为 `busId`、`busType` |

## 4. 已迁移行为

- 分页查询当前用户的导出任务；
- 展示模块类型、文件 ID、文件哈希、导出时间、创建人和状态；
- 仅 `exportState === 2` 的任务允许下载；
- 下载通过 blob 响应创建浏览器文件；
- `configs/stablecoin.json` 已启用 `data-export`；
- en-US/zh-CN 使用独立 `modules.data-export` namespace，避免依赖不存在的 `modules.financial`。

## 5. 验收状态

- 静态：已完成页面、registry、API、路由配置和两种 locale 的 namespace 装配。
- 运行时：待真实后端登录环境验证列表分页、状态展示和 blob 下载。
- 不将静态通过率记为运行时 acceptance；验证结果应补充到本文件。
