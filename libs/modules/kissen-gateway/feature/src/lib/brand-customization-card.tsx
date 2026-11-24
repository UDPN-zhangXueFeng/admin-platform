'use client';

/**
 * Brand customization card for UI Settings: name, subtitle, logo, palette
 * preview and primary color. Restore Default only refills the local form;
 * Save persists through PUT /brand. The logo is sent only when touched.
 */
import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, Button, Field, FieldError, FieldLabel, Input, useToast,
} from '@myorg/shared/ui';
import { useTheme } from '@myorg/shared/util-config';
import {
  authKeys, DEFAULT_BRAND, KISSEN_GATEWAY_PROJECT_ID,
  useUpdateBrandMutation, type Brand,
} from '@myorg/modules/kissen-gateway/data-access';

import {
  buildBrandUpdatePayload, validateBrandForm, type BrandFormErrors,
} from './brand-logo';
import { BrandLogoField } from './brand-logo-field';
import { ThemeSwitcher } from './theme-switcher';

type GatewayTheme = { id: string; label: string; colors: Record<string, string> };

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
    !Number.isFinite(hueValue) || saturation < 0 || saturation > 1 ||
    lightness < 0 || lightness > 1
  ) {
    return null;
  }

  const hue = (((hueValue % 360) + 360) % 360) / 360;
  const q = lightness < 0.5
    ? lightness * (1 + saturation)
    : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;
  const channel = (value: number): number => {
    let normalized = value;
    if (normalized < 0) normalized += 1;
    if (normalized > 1) normalized -= 1;
    if (normalized < 1 / 6) return p + (q - p) * 6 * normalized;
    if (normalized < 1 / 2) return q;
    if (normalized < 2 / 3) return p + (q - p) * 6 * (2 / 3 - normalized);
    return p;
  };
  return `#${[channel(hue + 1 / 3), channel(hue), channel(hue - 1 / 3)]
    .map((value) => Math.round(value * 255).toString(16).padStart(2, '0'))
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

/** Brand customization form with save and restore-default controls. */
export function BrandCustomizationCard({ brand }: { brand: Brand }) {
  const themeConfig = useTheme();
  const themes = themeConfig?.themes ?? EMPTY_GATEWAY_THEMES;
  const defaultThemeId = themeConfig?.defaultTheme ?? themes[0]?.id ?? '';
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState<Brand>({ ...brand });
  const [logoDirty, setLogoDirty] = React.useState(false);
  const [errors, setErrors] = React.useState<BrandFormErrors>({});
  const [selectedThemeId, setSelectedThemeId] = React.useState(() =>
    typeof document === 'undefined'
      ? defaultThemeId
      : document.documentElement.dataset.theme ?? defaultThemeId,
  );
  const savedThemeIdRef = React.useRef(selectedThemeId);

  // Align refreshed brand data; a saved palette primary color recovers the
  // matching configured palette when opened in another browser.
  React.useEffect(() => {
    setForm({ ...brand });
    setLogoDirty(false);
    setErrors({});
    const currentThemeId = typeof document === 'undefined'
      ? undefined
      : document.documentElement.dataset.theme;
    const fallbackThemeId =
      currentThemeId && themes.some((theme) => theme.id === currentThemeId)
        ? currentThemeId : defaultThemeId;
    const nextThemeId =
      themeIdForPrimaryColor(themes, brand.primaryColor) ?? fallbackThemeId;
    savedThemeIdRef.current = nextThemeId;
    setSelectedThemeId(nextThemeId);
    if (nextThemeId) document.documentElement.dataset.theme = nextThemeId;
  }, [brand, themes, defaultThemeId]);

  React.useEffect(() => {
    return () => {
      const themeId = savedThemeIdRef.current;
      if (themeId) document.documentElement.dataset.theme = themeId;
      else delete document.documentElement.dataset.theme;
    };
  }, []);

  function patchForm(patch: Partial<Brand>, errorKey?: keyof BrandFormErrors) {
    setForm((current) => ({ ...current, ...patch }));
    if (!errorKey) return;
    setErrors((current) => {
      const next = { ...current };
      next[errorKey] = undefined;
      return next;
    });
  }

  function onThemeSelect(themeId: string) {
    const selectedTheme = themes.find((theme) => theme.id === themeId);
    if (!selectedTheme) return;
    setSelectedThemeId(themeId);
    const primaryColor = primaryColorForTheme(selectedTheme);
    if (primaryColor) patchForm({ primaryColor }, 'primaryColor');
  }

  function onLogoChange(logo: string) {
    patchForm({ logo }, 'logo');
    setLogoDirty(true);
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
  // endpoint; Restore Default only refills the form locally (not persisted).
  // The follow-up Save persists; the toast copy must not claim persistence.
  function onResetDefault() {
    setForm({ ...DEFAULT_BRAND });
    setLogoDirty(true);
    setErrors({});
    const resetThemeId = themeIdForPrimaryColor(themes, DEFAULT_BRAND.primaryColor)
      ?? defaultThemeId;
    setSelectedThemeId(resetThemeId);
    if (resetThemeId) document.documentElement.dataset.theme = resetThemeId;
    setResetConfirmOpen(false);
    toast.success('Default branding restored', {
      description: 'Save to apply the restored defaults to the portal.',
    });
  }

  function onSave() {
    const nextErrors = validateBrandForm(form, logoDirty);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    updateMutation.mutate(buildBrandUpdatePayload(form, logoDirty), {
      onSuccess: () => {
        setLogoDirty(false);
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
    });
  }

  return (
    <section className="rounded-lg border border-border/60 bg-card">
      <div className="border-b border-border/50 px-4 py-3">
        <h2 className="text-sm font-semibold leading-5">Brand Customization</h2>
        <p className="mt-0.5 text-xs leading-4 text-muted-foreground">
          Brand configuration is stored on this instance (per-bank
          customization). After saving, the browser title and login page
          branding take effect immediately — no refresh needed.
        </p>
      </div>
      <div className="p-4">
        <div className="w-full max-w-[420px] space-y-4">
          <Field>
            <FieldLabel htmlFor="brand-name">
              Portal Name <span className="text-destructive">*</span>
            </FieldLabel>
            <Input
              id="brand-name"
              value={form.name}
              maxLength={50}
              placeholder="Browser title and sidebar brand name"
              aria-invalid={errors.name ? true : undefined}
              onChange={(e) => patchForm({ name: e.target.value }, 'name')}
            />
            <FieldError>{errors.name}</FieldError>
          </Field>
          <Field>
            <FieldLabel htmlFor="brand-subtitle">Subtitle</FieldLabel>
            <Input
              id="brand-subtitle"
              value={form.subtitle}
              maxLength={100}
              placeholder="Description text on the login page and sidebar"
              onChange={(e) => patchForm({ subtitle: e.target.value })}
            />
          </Field>
          <BrandLogoField value={form.logo} portalName={form.name}
            error={errors.logo} disabled={saving} onChange={onLogoChange} />
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
                className="w-[110px] font-mono text-[13px]"
                placeholder="#0B6B53"
                aria-invalid={errors.primaryColor ? true : undefined}
                onChange={(e) =>
                  patchForm({ primaryColor: e.target.value }, 'primaryColor')
                }
              />
            </div>
            <FieldError>{errors.primaryColor}</FieldError>
          </Field>
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" disabled={saving}
              onClick={() => setResetConfirmOpen(true)}>
              Restore Default
            </Button>
            <Button type="button" disabled={saving} onClick={onSave}>
              Save
            </Button>
          </div>
        </div>
      </div>
      <AlertDialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
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
