import type { ImgHTMLAttributes } from "react";

/** GitHub Pages 构建使用的 NextImage 兼容属性。 */
type StaticImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  /** NextImage 的填充布局参数，静态构建由 CSS 负责尺寸。 */
  fill?: boolean;
  /** NextImage 的优先加载参数。 */
  priority?: boolean;
};

/** 在纯静态页面中使用原生图片元素兼容 NextImage 调用。 */
export default function StaticImage({ fill, priority, alt = "", ...props }: StaticImageProps) {
  /** 模拟 NextImage 的填充布局，保持网页端原有图片尺寸。 */
  const imageStyle = fill ? { position: "absolute" as const, inset: 0, width: "100%", height: "100%", ...props.style } : props.style;
  // GitHub Pages 纯静态构建必须使用原生图片元素。
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...props} style={imageStyle} alt={alt} loading={priority ? "eager" : props.loading} />;
}
