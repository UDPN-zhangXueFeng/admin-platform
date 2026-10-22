'use client';

/**
 * UI settings page: per-instance branding form and save/reset controls.
 * Palette selection previews the configured theme immediately. Save submits
 * the palette's primary color through the existing PUT /brand contract and
 * persists the selected palette for the next app load.
 *
 * - Restore Default only resets local form state; users must still Save.
- The hex field remains available for custom colors.
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

import { useTheme } from '@myorg/shared/util-config';

import {
  authKeys,
  DEFAULT_BRAND,
  KISSEN_GATEWAY_PROJECT_ID,
  useBrandQuery,
  useUpdateBrandMutation,
  type Brand,
} from '@myorg/modules/kissen-gateway/data-access';
import { PageHead } from './page-head';
import { ThemeSwitcher } from './theme-switcher';


/** #RRGGBB validation (source utils/color.ts isValidHex; same rules as the backend @Pattern). */
function isValidHex(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}

type GatewayTheme = {
  id: string;
  label: string;
  colors: Record<string, string>;
};

const EMPTY_GATEWAY_THEMES: GatewayTheme[] = [];
const GW_THEME_STORAGE_KEY = 'gw-theme';

/** Convert the configured HSL primary token into the Brand API's #RRGGBB shape. */
function primaryColorForTheme(theme: GatewayTheme): string | null {
  const match = theme.colors.primary?.match(
    /^\s*(-?\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%\s*$/,
  );
  if (!match) return null;

  const hueValue = Number(match[1]);
  const saturation = Number(match[2]) / 100;
  const lightness = Number(match[3]) / 100;
  if (
    !Number.isFinite(hueValue) ||
    saturation < 0 ||
    saturation > 1 ||
    lightness < 0 ||
    lightness > 1
  ) {
    return null;
  }

  const hue = (((hueValue % 360) + 360) % 360) / 360;
  const q =
    lightness < 0.5
      ? lightness * (1 + saturation)
      : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;
  function hueToRgb(value: number): number {
    let normalized = value;
    if (normalized < 0) normalized += 1;
    if (normalized > 1) normalized -= 1;
    if (normalized < 1 / 6) return p + (q - p) * 6 * normalized;
    if (normalized < 1 / 2) return q;
    if (normalized < 2 / 3)
      return p + (q - p) * 6 * (2 / 3 - normalized);
    return p;
  }

  return `#${[hueToRgb(hue + 1 / 3), hueToRgb(hue), hueToRgb(hue - 1 / 3)]
    .map((channel) =>
      Math.round(channel * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

function themeIdForPrimaryColor(
  themes: GatewayTheme[],
  primaryColor: string,
): string | undefined {
  const normalizedColor = primaryColor.toUpperCase();
  return themes.find(
    (theme) => primaryColorForTheme(theme)?.toUpperCase() === normalizedColor,
  )?.id;
}

/* ================================================================== */
/* Brand customization card                                           */
/* ================================================================== */

/** Brand customization form with save and restore-default controls. */
function BrandCustomizationCard({ brand }: { brand: Brand }) {
  const themeConfig = useTheme();
  const themes = themeConfig?.themes ?? EMPTY_GATEWAY_THEMES;
  const defaultThemeId = themeConfig?.defaultTheme ?? themes[0]?.id ?? '';
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState<Brand>({ ...brand });
  const [selectedThemeId, setSelectedThemeId] = React.useState(() =>
    typeof document === 'undefined'
      ? defaultThemeId
      : document.documentElement.dataset.theme ?? defaultThemeId,
  );
  const savedThemeIdRef = React.useRef(selectedThemeId);

  // Align refreshed brand data. A saved palette primary color lets UI Setting
  // recover the matching configured palette when opened in another browser.
  React.useEffect(() => {
    setForm({ ...brand });
    const currentThemeId =
      typeof document === 'undefined'
        ? undefined
        : document.documentElement.dataset.theme;
    const fallbackThemeId =
      currentThemeId && themes.some((theme) => theme.id === currentThemeId)
        ? currentThemeId
        : defaultThemeId;
    const nextThemeId =
      themeIdForPrimaryColor(themes, brand.primaryColor) ?? fallbackThemeId;
    savedThemeIdRef.current = nextThemeId;
    setSelectedThemeId(nextThemeId);
    if (nextThemeId) document.documentElement.dataset.theme = nextThemeId;
  }, [brand, themes, defaultThemeId]);

  React.useEffect(() => {
    return () => {
      if (savedThemeIdRef.current) {
        document.documentElement.dataset.theme = savedThemeIdRef.current;
      } else {
        delete document.documentElement.dataset.theme;
      }
    };
  }, []);

  function onThemeSelect(themeId: string) {
    const selectedTheme = themes.find((theme) => theme.id === themeId);
    if (!selectedTheme) return;
    setSelectedThemeId(themeId);
    const primaryColor = primaryColorForTheme(selectedTheme);
    if (primaryColor) {
      setForm((current) => ({ ...current, primaryColor }));
    }
  }

  const invalidateBrand = React.useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: authKeys.brand(KISSEN_GATEWAY_PROJECT_ID),
    });
  }, [queryClient]);

  const updateMutation = useUpdateBrandMutation();
  const [resetConfirmOpen, setResetConfirmOpen] = React.useState(false);
  const saving = updateMutation.isPending;

  // STATIC-FILLER(GAP-GW-06): the backend has no "restore default brand"
  // endpoint; the prototype's Restore Defaults only refills the form with
  // factory defaults locally (not persisted) — the follow-up Save persists,
  // and the toast copy stays aligned ("Save to apply...") and must not claim
  // persistence.
  function onResetDefault() {
    setForm({ ...DEFAULT_BRAND });
    const resetThemeId =
      themeIdForPrimaryColor(themes, DEFAULT_BRAND.primaryColor) ??
      defaultThemeId;
    setSelectedThemeId(resetThemeId);
    if (resetThemeId) document.documentElement.dataset.theme = resetThemeId;
    setResetConfirmOpen(false);
    toast.success('Default branding restored', {
      description: 'Save to apply the restored defaults to the portal.',
    });
  }

  function onSave() {
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
          if (
            selectedThemeId &&
            themes.some((theme) => theme.id === selectedThemeId)
          ) {
            savedThemeIdRef.current = selectedThemeId;
            document.documentElement.dataset.theme = selectedThemeId;
            try {
              window.localStorage.setItem(GW_THEME_STORAGE_KEY, selectedThemeId);
            } catch {
              // Keep the selected palette preview active when storage is blocked.
            }
          }
          invalidateBrand();
          toast.success('Brand configuration saved and applied');
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  }

  return (
    <section className="rounded-lg border border-border/60 bg-card">
      <div className="border-b border-border/50 px-4 py-3">
        <h2 className="text-sm font-semibold leading-5">
          Brand Customization
        </h2>
        <p className="mt-0.5 text-xs leading-4 text-muted-foreground">
          Brand configuration is stored on this instance (per-bank
          customization). After saving, the browser title and login page
          branding take effect immediately — no refresh needed.
        </p>
      </div>
      <div className="p-4">
        <div className="w-full max-w-[380px] space-y-4">
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
              {themes.length > 1 ? (
                <ThemeSwitcher
                  themes={themes}
                  activeThemeId={selectedThemeId}
                  onThemeSelect={onThemeSelect}
                />
              ) : null}
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
      </div>
      {/* Restore-default confirmation (prototype copy verbatim; the confirm
          action maps to a plain AlertDialogAction with no pending state —
          the local refill completes immediately). */}
      <AlertDialog
        open={resetConfirmOpen}
        onOpenChange={setResetConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore default branding?</AlertDialogTitle>
            <AlertDialogDescription>
              Portal name, subtitle, logo and primary colour go back to the
              values this instance shipped with. Your current branding is
              replaced.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onResetDefault}>
              Restore Default
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

/* ================================================================== */
/* Page (registry: /system/ui -> SystemUiPage; export name is fixed)  */
/* ================================================================== */

export function SystemUiPage() {
  const { brand } = useBrandQuery(KISSEN_GATEWAY_PROJECT_ID);

  return (
    <div className="space-y-4">
      <PageHead title="UI Setting" />
      <BrandCustomizationCard brand={brand} />
    </div>
  );
}
