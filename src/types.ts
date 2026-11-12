export interface ProductVariant {
  id: number;
  a: boolean; // available
  o: string[]; // option values e.g. ["42"] or ["M"]
}

export interface Product {
  id: string; // catalog id
  name: string;
  vendor: string;
  price: number;
  image: string;
  imageWidth?: number;
  imageHeight?: number;
  mobileImageWidth?: number;
  mobileImageHeight?: number;
  optionLegend: string; // "Size" | "Shoe size"
  sizes: string[];
  variants: ProductVariant[];
  url: string;
  tag?: string; // e.g. "New"
  category?: 'shoes' | 'top' | 'hoodie' | 'sweatshirt' | 'pants' | 'accessory';
  /** Western Wear 3D female look this store product belongs to. */
  virtualStudioLook?: string;
  fitDescription?: string; // e.g. "Relaxed boxy cut with ribbed collar"
  defaultPinX?: number; // percentage 0-100
  defaultPinY?: number; // percentage 0-100
}

export interface LookPin {
  num: number;
  productId: string;
  left: number; // percentage 0-100
  top: number; // percentage 0-100
}

export interface Look {
  id: string; // unique look identifier or key
  key: string; // e.g. bndthK
  name: string;
  description: string;
  src640: string;
  srcset1080: string;
  productIds: string[];
  pins: LookPin[];
  isCustom?: boolean;
  modelGroup?: 'men' | 'ladies' | 'western';
}

export interface BagItem {
  id: string | number;
  productId: string;
  name: string;
  size: string;
  price: number;
  image: string;
  url: string;
  quantity: number;
  /** Optional crop of a shared sprite-sheet image (for pieces cut from one sheet) */
  crop?: BagItemCrop;
}

export interface BagItemCrop {
  x: number;
  y: number;
  w: number;
  h: number;
  sheetW: number;
  sheetH: number;
}

export interface LadiesPiece {
  id: string;
  name: string;
  price: number;
  lookNumber: number; // e.g. 15, 16, 17, 18, 19, 20
  pieceNumber: number; // 1 or 2
  box?: [number, number, number, number]; // [x0, x1, y0, y1] on 960x720 sheet
  customImage?: string;
  category?: string;
}

export interface LadiesSectionSettings {
  seasonTitle: string;
  subtitle: string;
  firstLookNumber: number;
}

