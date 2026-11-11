import React from 'react';
import { BagItem } from '../types';

/**
 * Product image that also supports pieces cut out of one shared sprite sheet
 * (SVG viewBox crop + "meet" scaling = contain, no distortion).
 * Size it with `className` (e.g. "w-full h-full").
 */
export const ProductThumb: React.FC<{
  item: Pick<BagItem, 'image' | 'name' | 'crop'>;
  className?: string;
  style?: React.CSSProperties;
}> = ({ item, className, style }) => {
  const c = item.crop;
  if (c) {
    return (
      <svg
        role="img"
        aria-label={item.name}
        className={className}
        style={{ display: 'block', ...style }}
        viewBox={`${c.x} ${c.y} ${c.w} ${c.h}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <image href={item.image} width={c.sheetW} height={c.sheetH} />
      </svg>
    );
  }
  return (
    <img
      src={item.image}
      alt={item.name}
      className={className}
      style={{ objectFit: 'contain', ...style }}
      loading="lazy"
    />
  );
};
