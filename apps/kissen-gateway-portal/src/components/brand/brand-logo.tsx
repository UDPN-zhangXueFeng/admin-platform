import { isImageLogo } from '@myorg/modules/kissen-gateway/data-access';

export interface BrandLogoProps {
  logo: string;
  name: string;
  /** Extra classes applied to whichever element is rendered. */
  className?: string;
  /** Extra classes for the uploaded-image state. */
  imageClassName?: string;
  /** Extra classes for the text/emoji state. */
  textClassName?: string;
}

/**
 * 品牌 logo：后端上传的图片以 `data:image/...` 返回时渲染为图片，
 * 其余（含历史 emoji）按文本渲染。
 */
export function BrandLogo({
  logo,
  name,
  className,
  imageClassName,
  textClassName,
}: BrandLogoProps) {
  if (isImageLogo(logo)) {
    return (
      <img
        src={logo}
        alt={name}
        draggable={false}
        className={['object-contain', imageClassName, className]
          .filter(Boolean)
          .join(' ')}
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={name}
      className={[textClassName, className].filter(Boolean).join(' ')}
    >
      {logo || '🏦'}
    </span>
  );
}
