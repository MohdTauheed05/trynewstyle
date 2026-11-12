import { saveSharedSectionToFirestore } from './firebase';
export interface RailItem {
  id: string;
  name: string;
  price: number;
  image?: string; // Custom uploaded image data URL or web URL
  spriteIndex?: number; // 0-9 if using built-in high-res sprite sheet
}

export const DEFAULT_RAIL_ITEMS: RailItem[] = [
  { id: 'rail-0', name: 'Winged Skull Tee', price: 48, spriteIndex: 0 },
  { id: 'rail-1', name: 'Heavy Blank Tee — Black', price: 38, spriteIndex: 1 },
  { id: 'rail-2', name: 'Heavy Blank Tee — White', price: 38, spriteIndex: 2 },
  { id: 'rail-3', name: 'Longsleeve Crew', price: 55, spriteIndex: 3 },
  { id: 'rail-4', name: 'Rose & Chain Graphic Tee', price: 52, spriteIndex: 4 },
  { id: 'rail-5', name: 'Varsity Leather Jacket', price: 240, spriteIndex: 5 },
  { id: 'rail-6', name: 'Signature Longsleeve', price: 58, spriteIndex: 6 },
  { id: 'rail-7', name: 'Arch Logo Heavy Hoodie', price: 95, spriteIndex: 7 },
  { id: 'rail-8', name: 'Barbed Heart Tee', price: 48, spriteIndex: 8 },
  { id: 'rail-9', name: 'Black Zip Heavy Hoodie', price: 98, spriteIndex: 9 },
];

const STORAGE_KEY_RAIL = 'runway_rail_items_v2';

export function getStoredRailItems(): RailItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RAIL);
    if (!raw) return DEFAULT_RAIL_ITEMS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (e) {
    console.error('Failed to load rail items from storage', e);
  }
  return DEFAULT_RAIL_ITEMS;
}

export function saveRailItems(items: RailItem[], persistCloud = true): void {
  try {
    localStorage.setItem(STORAGE_KEY_RAIL, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('runway:rail_updated'));
    if (persistCloud) {
      void saveSharedSectionToFirestore('shared_rail', { items }).then((result) => {
        if (!result.success) console.error(result.message);
      });
    }
  } catch (e) {
    console.error('Failed to save rail items to storage', e);
  }
}

export function resetRailItems(): RailItem[] {
  try {
    localStorage.removeItem(STORAGE_KEY_RAIL);
    window.dispatchEvent(new CustomEvent('runway:rail_updated'));
    void saveSharedSectionToFirestore('shared_rail', { items: DEFAULT_RAIL_ITEMS }).then((result) => {
      if (!result.success) console.error(result.message);
    });
  } catch (e) {
    console.error('Failed to reset rail items', e);
  }
  return DEFAULT_RAIL_ITEMS;
}
