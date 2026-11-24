'use client';

/**
 * Brand logo helpers: pure form/payload validation plus the browser-only
 * rasterization pipeline used by the UI Settings logo field.
 *
 * The backend accepts a three-state logo: omitted keeps the current value,
 * <=4 characters is a text logo, and a `data:image/...` URL is an image logo.
 * SVG is not accepted by the API, and every uploaded raster is normalized to
 * PNG so the stored payload is predictable.
 */
import {
  isImageLogo,
  type Brand,
  type BrandUpdatePayload,
} from '@myorg/modules/kissen-gateway/data-access';

export const LOGO_MAX_TEXT_LENGTH = 4;
export const LOGO_ACCEPT =
  'image/png,image/jpeg,image/gif,image/bmp,image/svg+xml,.png,.jpg,.jpeg,.gif,.bmp,.svg';
export const LOGO_HINT =
  'PNG, JPEG, GIF, BMP or SVG · max 1 MB · stored as PNG';
export const LOGO_REQUIRED_MESSAGE = 'Logo is required';
export const LOGO_UNREADABLE_MESSAGE = 'Logo image could not be read';
export const LOGO_UNSUPPORTED_MESSAGE =
  'Unsupported image type. Use PNG, JPEG, GIF, BMP, or SVG.';
export const LOGO_FILE_TOO_LARGE_MESSAGE =
  'Logo file is too large. Choose an image under 10 MB.';
export const LOGO_COMPRESSED_TOO_LARGE_MESSAGE =
  'Logo image is still over 1 MB after compression. Choose a smaller or simpler image.';

/** Pre-decode guard for the browser file picker. */
const LOGO_MAX_FILE_BYTES = 10 * 1024 * 1024;
/** Hard backend limit for the decoded PNG payload. */
const LOGO_MAX_DECODED_BYTES = 1024 * 1024;
/** Preferred payload size; larger renders retry at smaller edges. */
const LOGO_TARGET_DECODED_BYTES = 512 * 1024;
/** Contain-fit edges tried in order (largest first). */
const LOGO_EDGE_STEPS = [512, 384, 256, 192] as const;

const ACCEPTED_MIME_TYPES: Record<string, true> = {
  'image/png': true,
  'image/jpeg': true,
  'image/gif': true,
  'image/bmp': true,
  'image/svg+xml': true,
};
const ACCEPTED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg'];

export interface BrandFormErrors {
  name?: string;
  logo?: string;
  primaryColor?: string;
}

/** #RRGGBB validation (source utils/color.ts isValidHex; same as the backend @Pattern). */
export function isValidHex(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}

/** Text input value: an image logo is never pasted into the short-text field. */
export function textLogoValue(logo: string): string {
  return isImageLogo(logo) ? '' : logo;
}

/** Inline form validation; an untouched logo is never validated. */
export function validateBrandForm(
  form: Brand,
  logoDirty: boolean,
): BrandFormErrors {
  const errors: BrandFormErrors = {};
  if (!form.name.trim()) errors.name = 'Portal name is required';

  if (logoDirty) {
    const logo = form.logo.trim();
    if (!logo) {
      errors.logo = LOGO_REQUIRED_MESSAGE;
    } else if (!isImageLogo(logo) && logo.length > LOGO_MAX_TEXT_LENGTH) {
      errors.logo = `Logo text must be ${LOGO_MAX_TEXT_LENGTH} characters or fewer`;
    }
  }

  if (!isValidHex(form.primaryColor.trim())) {
    errors.primaryColor =
      'Primary color must be a valid hex value (e.g. #0B6B53)';
  }
  return errors;
}

/**
 * Build the PUT /brand payload. The logo is included only when the user
 * touched it, so an untouched logo keeps the server's current value.
 */
export function buildBrandUpdatePayload(
  form: Brand,
  logoDirty: boolean,
): BrandUpdatePayload {
  const payload: BrandUpdatePayload = {
    name: form.name.trim(),
    subtitle: form.subtitle.trim(),
    primaryColor: form.primaryColor.trim(),
  };
  if (logoDirty) payload.logo = form.logo.trim();
  return payload;
}

/** Decoded byte length of a base64 data URL payload. */
export function dataUrlDecodedBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return 0;
  const base64 = dataUrl.slice(comma + 1);
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

function hasAcceptedExtension(name: string): boolean {
  const lower = name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

/** The MIME type or extension must match; the `<img>` decode stays the final gate. */
export function isAcceptedLogoFile(file: File): boolean {
  return (
    ACCEPTED_MIME_TYPES[file.type.toLowerCase()] === true ||
    hasAcceptedExtension(file.name)
  );
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = src;
  try {
    await image.decode();
  } catch {
    throw new Error(LOGO_UNREADABLE_MESSAGE);
  }
  return image;
}

interface IntrinsicSize {
  width: number;
  height: number;
}

/** Some browsers report 0x0 for SVG blobs; fall back to the markup's size. */
function svgSizeFromMarkup(markup: string): IntrinsicSize | null {
  const tag = markup.match(/<svg\b[^>]*>/i)?.[0];
  if (!tag) return null;

  const width = tag.match(/\bwidth\s*=\s*["']?([\d.]+)(?:px)?["'\s/>]/i)?.[1];
  const height = tag.match(/\bheight\s*=\s*["']?([\d.]+)(?:px)?["'\s/>]/i)?.[1];
  if (width && height) {
    return { width: Number(width), height: Number(height) };
  }

  const viewBox = tag.match(
    /\bviewBox\s*=\s*["']\s*[-\d.]+[,\s]+[-\d.]+[,\s]+([\d.]+)[,\s]+([\d.]+)/i,
  );
  if (!viewBox) return null;
  const vbWidth = Number(viewBox[1]);
  const vbHeight = Number(viewBox[2]);
  if (vbWidth <= 0 || vbHeight <= 0) return null;
  // Vector coordinates have no pixel size; render them at the target edge.
  const scale = LOGO_EDGE_STEPS[0] / Math.max(vbWidth, vbHeight);
  return { width: vbWidth * scale, height: vbHeight * scale };
}

async function svgIntrinsicSize(file: File): Promise<IntrinsicSize | null> {
  const isSvg =
    file.type.toLowerCase() === 'image/svg+xml' ||
    file.name.toLowerCase().endsWith('.svg');
  if (!isSvg) return null;
  try {
    return svgSizeFromMarkup(await file.text());
  } catch {
    return null;
  }
}

function rasterizeToPng(
  image: HTMLImageElement,
  maxEdge: number,
  fallbackSize?: IntrinsicSize | null,
): string {
  const sourceWidth =
    fallbackSize?.width || image.naturalWidth || image.width;
  const sourceHeight =
    fallbackSize?.height || image.naturalHeight || image.height;
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error(LOGO_UNREADABLE_MESSAGE);
  }

  const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error(LOGO_UNREADABLE_MESSAGE);

  // Leave the canvas transparent (no background fill) and draw contained.
  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  try {
    return canvas.toDataURL('image/png');
  } catch {
    throw new Error(LOGO_UNREADABLE_MESSAGE);
  }
}

/**
 * Read a user-picked image into a PNG data URL (long edge <= 512, never
 * upscaled). Every format, including SVG, goes through `<img>` and canvas so
 * the backend always receives a raster PNG. The object URL is revoked even
 * when decoding fails.
 */
export async function fileToLogoDataUrl(file: File): Promise<string> {
  if (file.size > LOGO_MAX_FILE_BYTES) {
    throw new Error(LOGO_FILE_TOO_LARGE_MESSAGE);
  }
  if (!isAcceptedLogoFile(file)) {
    throw new Error(LOGO_UNSUPPORTED_MESSAGE);
  }

  const fallbackSize = await svgIntrinsicSize(file);
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    let lastDataUrl = '';

    for (const edge of LOGO_EDGE_STEPS) {
      lastDataUrl = rasterizeToPng(image, edge, fallbackSize);
      if (dataUrlDecodedBytes(lastDataUrl) <= LOGO_TARGET_DECODED_BYTES) {
        return lastDataUrl;
      }
    }

    if (dataUrlDecodedBytes(lastDataUrl) <= LOGO_MAX_DECODED_BYTES) {
      return lastDataUrl;
    }
    throw new Error(LOGO_COMPRESSED_TOO_LARGE_MESSAGE);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
