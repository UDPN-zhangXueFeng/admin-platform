'use client';

/**
 * UI 设置页（源 `views/system/ui.vue`，bcfad98 由占位页实页化：品牌定制 + 外观两卡）。
 * 路由对齐源 `/system/ui`（registry：/system/ui → SystemUiPage，键名不可改）。
 *
 * - 品牌定制卡：名称/副标题/Logo/主题色表单 + 8 预设色 + 实时预览面板
 *   （所见即所得，未保存仅预览区生效）；保存 PUT /brand 后 invalidate brand
 *   query → BrandProvider 重应用（document.title 等即时生效）；「恢复默认」
 *   AlertDialog 确认后 PUT DEFAULT_BRAND（源 ElMessageBox.confirm 语义）。
 * - 外观卡：浅色/暗色二值切换，写 `html.dark` + localStorage `gw-appearance`
 *   （与调色板轴 `gw-theme` 正交：.dark 管表面色、data-theme 管品牌色）。
 *
 * 有意 diverge（详见迁移矩阵 §7-36/37，a39f51d 裁决）：
 * - 上游品牌色派生 EP 九级色阶注入全站，下游 --primary/--ring 归调色板主题
 *   系统所有，品牌 primaryColor 不覆盖激活调色板；预览用 color-mix 现算。
 * - el-color-picker → 原生 `<input type="color">` + hex 文本框（零新增依赖）。
 */
import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Field,
  FieldLabel,
  Input,
  useToast,
} from '@myorg/shared/ui';

import {
  authKeys,
  DEFAULT_BRAND,
  KISSEN_GATEWAY_PROJECT_ID,
  useBrandQuery,
  useResetBrandMutation,
  useUpdateBrandMutation,
  type Brand,
} from '@myorg/modules/kissen-gateway/data-access';

import { PageHead } from './page-head';

/** 源 PRESET_COLORS（ui.vue:71）逐字。 */
const PRESET_COLORS = [
  '#0B6B53',
  '#1E3A5F',
  '#2563EB',
  '#7C3AED',
  '#B7791F',
  '#C2453A',
  '#0F766E',
  '#4B5563',
];

/** localStorage 键，须与 root layout 防闪脚本一致（src/app/layout.tsx）。 */
const GW_APPEARANCE_KEY = 'gw-appearance';

type AppearanceMode = 'light' | 'dark';

/** #RRGGBB 校验（源 utils/color.ts isValidHex，与后端 @Pattern 同口径）。 */
function isValidHex(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}

/** 读取本浏览器外观偏好（源 utils/theme.ts loadThemePreference；无记录/异常 → light）。 */
function loadAppearancePreference(): AppearanceMode {
  if (typeof window === 'undefined') return 'light';
  try {
    return window.localStorage.getItem(GW_APPEARANCE_KEY) === 'dark'
      ? 'dark'
      : 'light';
  } catch {
    return 'light';
  }
}

/** 应用外观：html.dark class + 本地持久化（源 applyTheme；防闪脚本首帧前已就位）。 */
function applyAppearance(mode: AppearanceMode) {
  document.documentElement.classList.toggle('dark', mode === 'dark');
  try {
    window.localStorage.setItem(GW_APPEARANCE_KEY, mode);
  } catch {
    /* 隐私模式等存储不可用时静默——本会话内切换仍生效 */
  }
}

/* ================================================================== */
/* 品牌定制卡                                                          */
/* ================================================================== */

/**
 * 实时预览面板（源 .preview：缩微侧栏 + 主/次按钮 + success tag 示意）。
 * 品牌色按表单当前值 color-mix 现算（未保存即所见即所得，仅预览区生效）；
 * 表面色走语义 token，暗色模式自动适配（上游 light-9 派生的等价表达）。
 */
function BrandPreview({ form }: { form: Brand }) {
  const color = isValidHex(form.primaryColor)
    ? form.primaryColor.toUpperCase()
    : DEFAULT_BRAND.primaryColor;

  return (
    <div className="flex min-w-[320px] max-w-[460px] flex-1 overflow-hidden rounded-lg border border-border/60">
      <div className="w-[168px] shrink-0 border-r border-border/60 bg-card p-3">
        <div className="flex items-center gap-2 border-b border-border/60 px-1.5 pb-2.5">
          <span className="text-lg leading-none" aria-hidden="true">
            {form.logo || '🏦'}
          </span>
          <span className="text-xs font-semibold text-foreground">
            {form.name || 'Portal Name'}
          </span>
        </div>
        <p className="px-1.5 pb-2.5 pt-2 text-[11px] text-muted-foreground">
          {form.subtitle || 'Subtitle'}
        </p>
        <div
          className="mx-1.5 my-[3px] flex h-8 items-center rounded-lg px-2.5 text-xs font-medium text-foreground"
          style={{
            background: `color-mix(in srgb, ${color} 8%, transparent)`,
          }}
        >
          Dashboard
        </div>
        <div className="mx-1.5 my-[3px] flex h-8 items-center rounded-lg px-2.5 text-xs text-muted-foreground">
          Token Management
        </div>
      </div>
      <div className="flex-1 p-3">
        <span className="text-[11px] text-muted-foreground">Preview</span>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            aria-hidden="true"
            tabIndex={-1}
            style={{ background: color }}
          >
            Primary
          </Button>
          <Button type="button" size="sm" variant="outline" aria-hidden="true" tabIndex={-1}>
            Secondary
          </Button>
          <span
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
            style={{
              background: `color-mix(in srgb, ${color} 12%, transparent)`,
              color,
            }}
          >
            Active
          </span>
        </div>
      </div>
    </div>
  );
}

/** 品牌定制卡（表单 + 预览 + 保存/恢复默认）。 */
function BrandCustomizationCard({ brand }: { brand: Brand }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState<Brand>({ ...brand });

  // 查询数据到达/失效刷新后对齐表单（brand query 仅保存/恢复后 invalidate，
  // 不会在编辑中静默刷新——staleTime Infinity）。
  React.useEffect(() => {
    setForm({ ...brand });
  }, [brand]);

  const invalidateBrand = React.useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: authKeys.brand(KISSEN_GATEWAY_PROJECT_ID),
    });
  }, [queryClient]);

  const updateMutation = useUpdateBrandMutation();
  const resetMutation = useResetBrandMutation();
  const [resetConfirmOpen, setResetConfirmOpen] = React.useState(false);
  const saving = updateMutation.isPending || resetMutation.isPending;

  function onResetDefault() {
    resetMutation.mutate(undefined, {
      onSuccess: () => {
        setForm({ ...DEFAULT_BRAND });
        invalidateBrand();
        toast.success('Brand restored to default');
      },
      onError: (e) => toast.error((e as Error).message),
    });
  }

  function onSave() {
    // 源 onSave 校验逐字：名称非空 + 主题色合法（warning toast，不发请求）。
    if (!form.name.trim()) {
      toast.warning('Please enter the portal name');
      return;
    }
    if (!isValidHex(form.primaryColor)) {
      toast.warning('Primary color must be a valid hex value (e.g. #0B6B53)');
      return;
    }
    updateMutation.mutate(
      { ...form },
      {
        onSuccess: () => {
          invalidateBrand();
          toast.success('Brand configuration saved and applied');
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  }

  return (
    <section className="rounded-lg border border-border/60 bg-card panel-pad space-y-3">
      <h2 className="text-sm font-semibold">Brand Customization</h2>
      <div className="flex flex-wrap items-start gap-7">
        <div className="w-[380px] shrink-0 space-y-4">
          <Field>
            <FieldLabel htmlFor="brand-name">
              Portal Name <span className="text-destructive">*</span>
            </FieldLabel>
            <Input
              id="brand-name"
              value={form.name}
              maxLength={50}
              placeholder="Browser title and sidebar brand name"
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="brand-subtitle">Subtitle</FieldLabel>
            <Input
              id="brand-subtitle"
              value={form.subtitle}
              maxLength={100}
              placeholder="Description text on the login page and sidebar"
              onChange={(e) =>
                setForm((f) => ({ ...f, subtitle: e.target.value }))
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="brand-logo">
              Logo <span className="text-destructive">*</span>
            </FieldLabel>
            <Input
              id="brand-logo"
              value={form.logo}
              maxLength={4}
              className="w-[140px]"
              placeholder="emoji or short text, e.g. 🏦"
              onChange={(e) => setForm((f) => ({ ...f, logo: e.target.value }))}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="brand-color">
              Primary Color <span className="text-destructive">*</span>
            </FieldLabel>
            <div className="flex flex-wrap items-center gap-2.5">
              {PRESET_COLORS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  aria-label={`Use ${preset}`}
                  title={preset}
                  onClick={() =>
                    setForm((f) => ({ ...f, primaryColor: preset }))
                  }
                  className="h-6 w-6 rounded-full border border-black/10 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  style={{
                    background: preset,
                    boxShadow:
                      form.primaryColor.toUpperCase() === preset
                        ? '0 0 0 2px hsl(var(--background)), 0 0 0 4px hsl(var(--primary))'
                        : undefined,
                  }}
                />
              ))}
              {/* el-color-picker 替代：原生取色器 + hex 文本（零新增依赖） */}
              <input
                type="color"
                aria-label="Pick a custom primary color"
                value={
                  isValidHex(form.primaryColor)
                    ? form.primaryColor
                    : DEFAULT_BRAND.primaryColor
                }
                onChange={(e) =>
                  setForm((f) => ({ ...f, primaryColor: e.target.value }))
                }
                className="h-7 w-9 cursor-pointer rounded border border-border bg-transparent p-0.5"
              />
              <Input
                id="brand-color"
                value={form.primaryColor}
                onChange={(e) =>
                  setForm((f) => ({ ...f, primaryColor: e.target.value }))
                }
                className="w-[110px] font-mono text-[13px]"
                placeholder="#0B6B53"
              />
            </div>
          </Field>
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => setResetConfirmOpen(true)}
            >
              Restore Default
            </Button>
            <Button type="button" disabled={saving} onClick={onSave}>
              Save
            </Button>
          </div>
        </div>
        <BrandPreview form={form} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Brand configuration is stored on this instance (per-bank customization).
        After saving, the browser title and login page branding take effect
        immediately — no refresh needed.
      </p>

      {/* 恢复默认确认（源 ElMessageBox.confirm type=warning） */}
      <AlertDialog
        open={resetConfirmOpen}
        onOpenChange={setResetConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Default</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore the default portal brand (name, subtitle, logo,
              and primary color). Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant="destructive"
                disabled={resetMutation.isPending}
                onClick={onResetDefault}
              >
                {resetMutation.isPending ? 'Restoring…' : 'Restore Default'}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

/* ================================================================== */
/* 外观卡                                                              */
/* ================================================================== */

/** 外观卡：浅色/暗色即时切换（源 radio-group light/dark）。 */
function AppearanceCard() {
  const [mode, setMode] = React.useState<AppearanceMode>(() =>
    loadAppearancePreference(),
  );

  function onThemeChange(next: AppearanceMode) {
    applyAppearance(next);
    setMode(next);
  }

  return (
    <section className="rounded-lg border border-border/60 bg-card panel-pad space-y-3">
      <h2 className="text-sm font-semibold">Appearance</h2>
      <div
        role="radiogroup"
        aria-label="Appearance mode"
        className="inline-flex overflow-hidden rounded-md border border-border"
      >
        {(['light', 'dark'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => onThemeChange(m)}
            className={
              mode === m
                ? 'bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground'
                : 'bg-transparent px-4 py-1.5 text-sm text-foreground hover:bg-accent hover:text-accent-foreground'
            }
          >
            {m === 'light' ? 'Light' : 'Dark'}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Appearance preference is stored in this browser. Switching devices or
        clearing browser data restores light mode.
      </p>
    </section>
  );
}

/* ================================================================== */
/* 页面（registry：/system/ui → SystemUiPage，名字不可改）              */
/* ================================================================== */

export function SystemUiPage() {
  const { brand } = useBrandQuery(KISSEN_GATEWAY_PROJECT_ID);

  return (
    <div className="space-y-4">
      <PageHead eyebrow="SYSTEM" title="UI Setting" />
      <BrandCustomizationCard brand={brand} />
      <AppearanceCard />
    </div>
  );
}
