import Image, { type ImageProps } from "next/image";

const DEFAULT_FALLBACK = "/Upload/default-cover.jpg";

type Props = Omit<ImageProps, "src"> & {
  src: string | null | undefined;
  fallbackSrc?: string;
};

// Normalizes empty/null src to a local fallback so card grids never render
// next/image with an empty string. Runtime 404s on rotted external URLs will
// show the browser's broken-image glyph; that's an acceptable trade vs.
// shipping a client component for every image on the site.
export function SafeImage({ src, fallbackSrc = DEFAULT_FALLBACK, alt, ...rest }: Props) {
  const finalSrc = src && src.trim() ? src : fallbackSrc;
  return <Image {...rest} alt={alt} src={finalSrc} />;
}
