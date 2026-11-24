'use client';

/**
 * Logo control for the UI Settings brand card.
 *
 * Shows a live preview, a text input for emoji/short text, and an image
 * upload button. Uploaded files (SVG included) are rasterized to PNG before
 * the parent form receives them, so the backend never sees SVG.
 */
import * as React from 'react';
import { Image as ImageIcon, ImagePlus, X } from 'lucide-react';

import {
  Button,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
} from '@myorg/shared/ui';
import {
  DEFAULT_BRAND,
  isImageLogo,
} from '@myorg/modules/kissen-gateway/data-access';

import {
  fileToLogoDataUrl,
  LOGO_ACCEPT,
  LOGO_HINT,
  LOGO_MAX_TEXT_LENGTH,
  LOGO_UNREADABLE_MESSAGE,
  textLogoValue,
} from './brand-logo';

export interface BrandLogoFieldProps {
  /** Current logo: short text or a PNG data URL. */
  value: string;
  /** Portal name used as the preview image's alt text. */
  portalName: string;
  /** Inline validation message owned by the form. */
  error?: string;
  disabled?: boolean;
  onChange: (logo: string) => void;
}

export function BrandLogoField({
  value,
  portalName,
  error,
  disabled = false,
  onChange,
}: BrandLogoFieldProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string>();

  const imageLogo = isImageLogo(value);
  const message = error ?? uploadError;

  // An external reset (Restore Default / brand refresh) clears stale errors.
  React.useEffect(() => {
    setUploadError(undefined);
  }, [value]);

  function selectLogo(next: string) {
    setUploadError(undefined);
    onChange(next);
  }

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;

    setUploading(true);
    setUploadError(undefined);
    try {
      selectLogo(await fileToLogoDataUrl(file));
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : LOGO_UNREADABLE_MESSAGE,
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <Field>
      <FieldLabel htmlFor="brand-logo">
        Logo <span className="text-destructive">*</span>
      </FieldLabel>
      <div className="flex items-start gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/60 bg-muted/30">
          {imageLogo ? (
            <img
              src={value}
              alt={portalName.trim() || 'Portal logo'}
              className="h-full w-full object-contain"
            />
          ) : value ? (
            <span className="max-w-full break-all px-1 text-center text-2xl leading-none">
              {value}
            </span>
          ) : (
            <ImageIcon
              aria-hidden="true"
              className="h-6 w-6 text-muted-foreground"
            />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id="brand-logo"
              value={textLogoValue(value)}
              maxLength={LOGO_MAX_TEXT_LENGTH}
              placeholder="emoji or short text"
              className="w-[150px]"
              disabled={disabled || uploading}
              aria-invalid={message ? true : undefined}
              onChange={(event) => selectLogo(event.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              loading={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus aria-hidden="true" />
              Upload image
            </Button>
            {imageLogo ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                disabled={disabled || uploading}
                onClick={() => selectLogo(DEFAULT_BRAND.logo)}
              >
                <X aria-hidden="true" />
                Remove image
              </Button>
            ) : null}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={LOGO_ACCEPT}
            className="hidden"
            tabIndex={-1}
            disabled={disabled || uploading}
            onChange={onFileChange}
          />
          <FieldDescription>{LOGO_HINT}</FieldDescription>
          <FieldError>{message}</FieldError>
        </div>
      </div>
    </Field>
  );
}
