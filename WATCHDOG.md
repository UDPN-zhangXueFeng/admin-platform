# Watchdog notes

评审本仓库变更时，优先检查以下项目风险；只报告能由代码或配置证实、可能造成行为或架构回归的问题，并指出具体位置与影响。

- **应用边界：** `apps/admin` 与 Kissen 门户保持业务模块隔离；`libs/shared` 不得依赖 `libs/modules/*`。`feature` 可依赖 `data-access` 和 `shared`，`data-access` 不得依赖 `feature`。
- **配置与路由：** 菜单或模块变更需核对 `configs/*.json`、对应应用的 locale App Router 和 app-local module registry；路由保留 `/en-US/...`、`/zh-CN/...` 前缀。
- **会话与密钥：** Kissen 门户的 middleware session guard 不应被绕过；服务器内部地址和密钥不得暴露给客户端或提交到仓库。
- **迁移语义：** 迁移 `td-manage` 功能时保留业务语义，不照搬旧项目的耦合结构。
