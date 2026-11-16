import {
  BagItemCrop,
  MaisonEditCategory,
  MaisonEditProduct,
  MaisonEditStoreId,
} from '../types';
import {
  saveSharedSectionToFirestore,
  syncCatalogCollectionToFirestore,
} from './firebase';

const CDN = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/';
const H = (file: string, w: number) =>
  `https://images.higgs.ai/?default=1&output=webp&url=${encodeURIComponent(CDN + file)}&w=${w}&q=88`;

export const ME_MODEL_FILES = {
  base: 'hf_20261113_132636_5eabfff6-e1ee-4368-b3a9-6582c1f1397b.png',
  t2: 'hf_20261113_132720_0affdcfe-f56e-4943-a986-c2e87f5c57ff.png',
  t3: 'hf_20261113_132720_f30c45fe-a7d7-4392-97f3-de87f324f3b2.png',
  k2: 'hf_20261113_132721_9d39ba54-b830-4e1e-9076-1f45f5be7621.png',
  k3: 'hf_20261113_132720_0986c806-cb61-488a-acf7-daa9d1c32adc.png',
  s2: 'hf_20261113_132720_8c9da93a-bc4f-4496-957c-56cf9ac47131.png',
  s3: 'hf_20261113_132719_dd94cd18-2c72-4272-a4d9-829761077f19.png',
  g2: 'hf_20261113_132721_feb73af1-d27a-4122-848a-727dae3be59f.png',
  g3: 'hf_20261113_132729_883f3a83-2c13-418d-a959-79708075153f.png',
} as const;

export const ME_MODEL_URLS: Record<keyof typeof ME_MODEL_FILES, string> = {
  base: H(ME_MODEL_FILES.base, 1000),
  t2: H(ME_MODEL_FILES.t2, 1000),
  t3: H(ME_MODEL_FILES.t3, 1000),
  k2: H(ME_MODEL_FILES.k2, 1000),
  k3: H(ME_MODEL_FILES.k3, 1000),
  s2: H(ME_MODEL_FILES.s2, 1000),
  s3: H(ME_MODEL_FILES.s3, 1000),
  g2: H(ME_MODEL_FILES.g2, 1000),
  g3: H(ME_MODEL_FILES.g3, 1000),
};

export const ME_PRODUCT_SHEET_URL = H(
  'hf_20261113_132845_faa91ba1-ab25-49d9-8de1-44b84b0d65f7.png',
  1000
);

export const ME_AR_ROOM_URL = H(
  'hf_20261113_132845_2fe30a71-4937-4877-b8df-92bba80bbabe.png',
  1800
);

export const ME_SHEET_W = 1744;
export const ME_SHEET_H = 2336;
export const ME_TILE_W = 523;
export const ME_TILE_H = 537;
export const ME_TILE_X = [44, 610, 1177] as const;
export const ME_TILE_Y = [42, 611, 1180, 1749] as const;

export function getMaisonEditCrop(col = 0, row = 0): BagItemCrop {
  const safeCol = Math.max(0, Math.min(2, col));
  const safeRow = Math.max(0, Math.min(3, row));
  return {
    x: ME_TILE_X[safeCol],
    y: ME_TILE_Y[safeRow],
    w: ME_TILE_W,
    h: ME_TILE_H,
    sheetW: ME_SHEET_W,
    sheetH: ME_SHEET_H,
  };
}

export function getMaisonEditPtStyle(col = 0, row = 0, ch = 400): {
  backgroundImage: string;
  backgroundSize: string;
  backgroundPosition: string;
} {
  const safeCol = Math.max(0, Math.min(2, col));
  const safeRow = Math.max(0, Math.min(3, row));
  const tx = ME_TILE_X[safeCol];
  const ty = ME_TILE_Y[safeRow];
  const xPct = (tx / (ME_SHEET_W - ME_TILE_W)) * 100;
  const ySize = (ME_SHEET_H / ch) * 100;
  const yPct = ((ty + (ME_TILE_H - ch) / 2) / (ME_SHEET_H - ch)) * 100;
  return {
    backgroundImage: `url("${ME_PRODUCT_SHEET_URL}")`,
    backgroundSize: `333.46% ${ySize.toFixed(2)}%`,
    backgroundPosition: `${xPct.toFixed(3)}% ${yPct.toFixed(3)}%`,
  };
}

export const ME_STORES: Record<MaisonEditStoreId, { id: MaisonEditStoreId; label: string; styleClass: string }> = {
  norra: { id: 'norra', label: 'NORRA', styleClass: 'st-norra' },
  lune: { id: 'lune', label: 'Lune&Co', styleClass: 'st-lune' },
  meridian: { id: 'meridian', label: 'MERIDIAN', styleClass: 'st-meridian' },
  ode: { id: 'ode', label: 'ODE STUDIO', styleClass: 'st-ode' },
};

export const ME_SLOT_KEYS = [
  { key: 't1', label: 'Top 1 — Off-shoulder Ivory Top (Base)', category: 'tops' as MaisonEditCategory },
  { key: 't2', label: 'Top 2 — Black Ribbed Turtleneck', category: 'tops' as MaisonEditCategory },
  { key: 't3', label: 'Top 3 — Burgundy Cropped Cardigan', category: 'tops' as MaisonEditCategory },
  { key: 'k1', label: 'Skirt 1 — Charcoal Pleated Mini (Base)', category: 'skirts' as MaisonEditCategory },
  { key: 'k2', label: 'Skirt 2 — Light-blue Denim Mini', category: 'skirts' as MaisonEditCategory },
  { key: 'k3', label: 'Skirt 3 — Cream Bouclé Tweed Mini', category: 'skirts' as MaisonEditCategory },
  { key: 's1', label: 'Shoes 1 — Black Leather Knee Boots (Base)', category: 'shoes' as MaisonEditCategory },
  { key: 's2', label: 'Shoes 2 — White Leather Sneakers', category: 'shoes' as MaisonEditCategory },
  { key: 's3', label: 'Shoes 3 — Burgundy Knee-High Boots', category: 'shoes' as MaisonEditCategory },
  { key: 'g1', label: 'Bag 1 — Black Buckle Shoulder Bag (Base)', category: 'bags' as MaisonEditCategory },
  { key: 'g2', label: 'Bag 2 — Cream Quilted Mini Bag', category: 'bags' as MaisonEditCategory },
  { key: 'g3', label: 'Bag 3 — Burgundy Top-Handle Bag', category: 'bags' as MaisonEditCategory },
];

export const ME_STYLES = [
  { name: 'Monochrome minimal', look: { tops: 't2', skirts: 'k1', shoes: 's1', bags: 'g1' } },
  { name: 'Wine romance', look: { tops: 't3', skirts: 'k3', shoes: 's3', bags: 'g3' } },
  { name: 'Weekend denim', look: { tops: 't1', skirts: 'k2', shoes: 's2', bags: 'g2' } },
  { name: 'Soft contrast', look: { tops: 't2', skirts: 'k3', shoes: 's3', bags: 'g2' } },
  { name: 'Campus cool', look: { tops: 't3', skirts: 'k2', shoes: 's2', bags: 'g3' } },
] as const;

export const DEFAULT_MAISON_EDIT_ITEMS: MaisonEditProduct[] = [
  {
    id: 't1',
    slotKey: 't1',
    category: 'tops',
    store: 'norra',
    name: 'Off-shoulder top',
    price: 29.9,
    sheetCol: 0,
    sheetRow: 0,
    tags: ['minimal', 'soft'],
    sizes: ['XS', 'S', 'M', 'L'],
    fitDescription: 'Soft ribbed off-shoulder jersey with clean neckline.',
  },
  {
    id: 't2',
    slotKey: 't2',
    category: 'tops',
    store: 'meridian',
    name: 'Ribbed turtleneck',
    price: 34.9,
    sheetCol: 1,
    sheetRow: 0,
    tags: ['minimal', 'sharp'],
    sizes: ['XS', 'S', 'M', 'L'],
    fitDescription: 'Fine-gauge fitted turtleneck in ink black.',
  },
  {
    id: 't3',
    slotKey: 't3',
    category: 'tops',
    store: 'lune',
    name: 'Cropped knit cardigan',
    price: 45.0,
    sheetCol: 2,
    sheetRow: 0,
    tags: ['romantic', 'wine'],
    sizes: ['XS', 'S', 'M', 'L'],
    fitDescription: 'Cropped merino-blend cardigan in deep wine.',
  },
  {
    id: 'k1',
    slotKey: 'k1',
    category: 'skirts',
    store: 'meridian',
    name: 'Pleated mini skirt',
    price: 49.99,
    sheetCol: 0,
    sheetRow: 1,
    tags: ['minimal', 'sharp'],
    sizes: ['XS', 'S', 'M', 'L'],
    fitDescription: 'Knife-pleated charcoal wool-blend mini skirt.',
  },
  {
    id: 'k2',
    slotKey: 'k2',
    category: 'skirts',
    store: 'norra',
    name: 'Denim mini skirt',
    price: 39.9,
    sheetCol: 1,
    sheetRow: 1,
    tags: ['casual'],
    sizes: ['XS', 'S', 'M', 'L'],
    savedDefault: true,
    fitDescription: 'Low-rise washed cotton denim mini skirt.',
  },
  {
    id: 'k3',
    slotKey: 'k3',
    category: 'skirts',
    store: 'ode',
    name: 'Bouclé tweed skirt',
    price: 59.0,
    sheetCol: 2,
    sheetRow: 1,
    tags: ['romantic', 'soft'],
    sizes: ['XS', 'S', 'M', 'L'],
    fitDescription: 'Cream textured bouclé mini skirt with fringed trim.',
  },
  {
    id: 's1',
    slotKey: 's1',
    category: 'shoes',
    store: 'norra',
    name: 'Leather knee boots',
    price: 129.0,
    sheetCol: 0,
    sheetRow: 2,
    tags: ['minimal', 'sharp'],
    sizes: ['36', '37', '38', '39', '40'],
    fitDescription: 'Smooth black calf-leather block-heel knee boots.',
  },
  {
    id: 's2',
    slotKey: 's2',
    category: 'shoes',
    store: 'ode',
    name: 'Leather sneakers',
    price: 89.0,
    sheetCol: 1,
    sheetRow: 2,
    tags: ['casual'],
    sizes: ['36', '37', '38', '39', '40'],
    fitDescription: 'Crisp optic-white court sneakers with crew socks.',
  },
  {
    id: 's3',
    slotKey: 's3',
    category: 'shoes',
    store: 'lune',
    name: 'Wine knee boots',
    price: 139.0,
    sheetCol: 2,
    sheetRow: 2,
    tags: ['romantic', 'wine'],
    sizes: ['36', '37', '38', '39', '40'],
    fitDescription: 'Oxblood glacé leather knee-high heeled boots.',
  },
  {
    id: 'g1',
    slotKey: 'g1',
    category: 'bags',
    store: 'ode',
    name: 'Buckle shoulder bag',
    price: 189.0,
    sheetCol: 0,
    sheetRow: 3,
    tags: ['minimal', 'sharp'],
    sizes: ['One Size'],
    fitDescription: 'Structured black calfskin shoulder bag with silver buckle.',
  },
  {
    id: 'g2',
    slotKey: 'g2',
    category: 'bags',
    store: 'lune',
    name: 'Quilted mini bag',
    price: 159.0,
    sheetCol: 1,
    sheetRow: 3,
    tags: ['romantic', 'soft'],
    sizes: ['One Size'],
    fitDescription: 'Ivory matelassé mini bag with brass chain.',
  },
  {
    id: 'g3',
    slotKey: 'g3',
    category: 'bags',
    store: 'meridian',
    name: 'Wine top-handle bag',
    price: 175.0,
    sheetCol: 2,
    sheetRow: 3,
    tags: ['romantic', 'wine'],
    sizes: ['One Size'],
    fitDescription: 'Sculpted burgundy top-handle leather satchel.',
  },
];

const STORAGE_KEY_MAISON_EDIT = 'runway_maison_edit_v1';

export function getStoredMaisonEditItems(): MaisonEditProduct[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MAISON_EDIT);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Remove the old built-in demo catalog from browsers that cached it before
    // products were managed from the shared store.
    const isLegacyDemo =
      parsed.length === DEFAULT_MAISON_EDIT_ITEMS.length &&
      DEFAULT_MAISON_EDIT_ITEMS.every((demo) =>
        parsed.some((item: any) =>
          item?.id === demo.id && item?.name === demo.name && Number(item?.price) === demo.price
        )
      );
    return isLegacyDemo ? [] : (parsed as MaisonEditProduct[]);
  } catch (e) {
    console.error('Failed to read Maison Edit items from storage', e);
    return [];
  }
}

export function saveMaisonEditItems(items: MaisonEditProduct[], persistCloud = true): void {
  try {
    localStorage.setItem(STORAGE_KEY_MAISON_EDIT, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('runway:maison_edit_updated'));
    if (persistCloud) {
      void Promise.all([
        syncCatalogCollectionToFirestore('maison_edit_items', items),
        saveSharedSectionToFirestore('shared_maison_edit', { items }),
      ]).then((results) => {
        results.forEach((res) => {
          if (!res.success) console.error(res.message);
        });
      });
    }
  } catch (e) {
    console.error('Failed to save Maison Edit items', e);
  }
}

export function resetMaisonEditItems(): MaisonEditProduct[] {
  try {
    saveMaisonEditItems([], true);
  } catch (e) {
    console.error('Failed to reset Maison Edit items', e);
  }
  return [];
}
