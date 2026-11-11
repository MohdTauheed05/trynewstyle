import { BagItem, BagItemCrop, Product } from '../types';

const STORAGE_KEY_BAG = 'runway-styling-bag-v4';
const LEGACY_STORAGE_KEY_BAG = 'runway-styling-bag-v3';

export function getStoredBag(): BagItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BAG);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (item) =>
            item &&
            item.name &&
            typeof item.price === 'number' &&
            item.quantity >= 1
        );
      }
    }

    // Attempt migration from legacy key if v4 is empty
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY_BAG);
    if (legacyRaw) {
      // Legacy entries were just {id, quantity}
      localStorage.removeItem(LEGACY_STORAGE_KEY_BAG);
    }
  } catch (e) {
    console.error('Failed to read bag from storage', e);
  }
  return [];
}

export function saveBag(items: BagItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_BAG, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('runway:bag_updated'));
  } catch (e) {
    console.error('Failed to save bag to storage', e);
  }
}

export function getBagCount(): number {
  const items = getStoredBag();
  return items.reduce((sum, item) => sum + (item.quantity || 1), 0);
}

// Guards against one physical click/tap being turned into several cart adds
// (double-click, touch + click, overlapping hit-areas, re-render replays).
let lastAdd: { key: string; t: number } = { key: '', t: 0 };
const ADD_GUARD_MS = 700;

function isDuplicateAdd(key: string): boolean {
  const now = Date.now();
  if (lastAdd.key === key && now - lastAdd.t < ADD_GUARD_MS) return true;
  lastAdd = { key, t: now };
  return false;
}

export function clearBag(): void {
  saveBag([]);
}

export function addBagItem(
  item: {
    id?: string | number;
    productId: string;
    name: string;
    size?: string;
    price: number;
    image: string;
    url?: string;
    quantity?: number;
    crop?: BagItemCrop;
  },
  onToast?: (msg: string) => void
): void {
  const targetSize = item.size || 'One Size';
  if (isDuplicateAdd(`${item.productId}|${targetSize}`)) return;
  const current = getStoredBag();
  const qtyToAdd = item.quantity || 1;

  // Check if item already in bag with same productId and size
  const existingIndex = current.findIndex(
    (e) => e.productId === item.productId && e.size === targetSize
  );

  if (existingIndex >= 0) {
    current[existingIndex].quantity = Math.min(
      20,
      current[existingIndex].quantity + qtyToAdd
    );
  } else {
    current.push({
      id: item.id || `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      productId: item.productId,
      name: item.name,
      size: targetSize,
      price: item.price,
      image: item.image,
      url: item.url || '#',
      quantity: qtyToAdd,
      ...(item.crop ? { crop: item.crop } : {}),
    });
  }

  saveBag(current);

  const toastMsg = `"${item.name}" added to your cart`;
  if (onToast) {
    onToast(toastMsg);
  } else {
    showToast(toastMsg);
  }
}

export function addToBag(
  items: Array<{ variantId: number; product: Product; size: string }>,
  onToast?: (msg: string) => void
): void {
  if (items.length === 0) return;
  if (
    isDuplicateAdd(
      items.map((i) => `${i.product.id}|${i.size}`).join(',')
    )
  )
    return;
  const current = getStoredBag();

  for (const item of items) {
    const targetSize = item.size || item.product.sizes[0] || 'One Size';
    const existingIndex = current.findIndex(
      (e) => e.productId === item.product.id && e.size === targetSize
    );

    if (existingIndex >= 0) {
      current[existingIndex].quantity = Math.min(
        20,
        current[existingIndex].quantity + 1
      );
    } else {
      current.push({
        id: `${item.product.id}-${targetSize}-${item.variantId}`,
        productId: item.product.id,
        name: item.product.name,
        size: targetSize,
        price: item.product.price,
        image: item.product.image,
        url: item.product.url || '#',
        quantity: 1,
      });
    }
  }

  saveBag(current);

  const toastMsg =
    items.length > 1
      ? `${items.length} pieces added to your cart`
      : `"${items[0].product.name}" added to your cart`;

  if (onToast) {
    onToast(toastMsg);
  } else {
    showToast(toastMsg);
  }
}

export function removeFromBag(itemId: string | number): void {
  const current = getStoredBag();
  const next = current.filter((e) => String(e.id) !== String(itemId));
  saveBag(next);
}

export function updateBagQuantity(itemId: string | number, quantity: number): void {
  const current = getStoredBag();
  if (quantity <= 0) {
    removeFromBag(itemId);
    return;
  }
  const item = current.find((e) => String(e.id) === String(itemId));
  if (item) {
    item.quantity = Math.min(20, quantity);
    saveBag(current);
  }
}

export function getBagDetailedItems(_allProducts?: Product[]): BagItem[] {
  return getStoredBag();
}

export function showToast(message: string): void {
  const toast = document.getElementById('bag-status');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('is-on');
  if ((window as any).__toastTimer) {
    clearTimeout((window as any).__toastTimer);
  }
  (window as any).__toastTimer = setTimeout(() => {
    toast.classList.remove('is-on');
  }, 2500);
}
