'use client';

/**
 * 个人中心（源 `views/profile/index.vue`；G1 对照改造）。
 *
 * AppShell 内（(app) 路由组，firstLogin 锁与会话门禁由 LpAppShell 承担）：
 * 账号信息卡 + 修改密码入口卡。会话读本地持久化的 LoginRespVO（kissen-lp.user，
 * 源 profile 直读 store.userInfo；无服务端读端点）。第三行「所属 LP」：
 * lpName 主值 + 副行 (lpCode)，空值兜底 '-'（迁移矩阵 D11「所属 LP(lpName(lpCode))」）。
 * 此前注释误判源无 lpName/lpCode 字段并降级渲染 LP ID，FAIL 修复 A 更正回源语义。
 *
 * 改造点：改密表单不再内嵌于本页（源卡2「修改密码表单」），收敛为入口跳转
 * /change-pwd —— useLpSessionQuery 读会话、useRouter 跳转（自动携带 locale
 * 前缀，同仓路由惯例，禁止裸 next/link）。表单唯一实现在 ChangePwdPage
 * （同规则集），成功后清会话回登录页。
 */
import { useRouter } from '@myorg/shared/util-i18n';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@myorg/shared/ui';
import {
  LP_PROJECT_ID,
  useLpSessionQuery,
} from '@myorg/modules/lp-portal/data-access';

const LBL = {
  eyebrow: 'ACCOUNT',
  title: 'Personal Center',
};

export function ProfilePage() {
  const router = useRouter();
  const { data: session } = useLpSessionQuery(LP_PROJECT_ID);

  // 源 el-descriptions :column="1" 三行；空值兜底 '-' 与源 ||'-'/??'-' 一致。
  const info: { label: string; value: string; sub?: string }[] = [
    { label: 'Login Name', value: session?.loginName || '-' },
    { label: 'Name', value: session?.userName || '-' },
    {
      label: 'Affiliated LP',
      // 源语义：lpName 主值，副行 (lpCode)；lpName 空回退 '-'（矩阵 D11），
      // lpCode 空则不渲染副行（避免主副双 '-'）。
      value: session?.lpName ? session.lpName : '-',
      sub: session?.lpCode ? `(${session.lpCode})` : undefined,
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col section-gap">
      {/* 源 page-head：eyebrow ACCOUNT + 页标题（dashboard t-supporting/t-page-title 范式） */}
      <div>
        <div className="t-supporting uppercase tracking-widest text-muted-foreground">
          {LBL.eyebrow}
        </div>
        <h1 className="t-page-title">{LBL.title}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="divide-y overflow-hidden rounded-md border">
            {info.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <dt className="text-sm text-muted-foreground">
                  {item.label}
                </dt>
                <dd className="min-w-0">
                  <div className="truncate text-sm font-medium">{item.value}</div>
                  {item.sub && (
                    <div className="truncate text-xs text-muted-foreground">
                      {item.sub}
                    </div>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>
            Update your sign-in password. After the change you will be signed
            out and returned to the login page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => router.push('/change-pwd')}>
            Change Password
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
