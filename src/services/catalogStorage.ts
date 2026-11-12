import { syncCatalogCollectionToFirestore } from './firebase';
import { DEFAULT_LOOKS, DEFAULT_PRODUCTS } from '../data/defaultCatalog';
import { Look, Product } from '../types';

const STORAGE_KEY_PRODUCTS = 'runway_products_v2';
const STORAGE_KEY_LOOKS = 'runway_looks_v2';

function cleanProduct(p: Product): Product {
  const isNike =
    p.vendor?.toLowerCase().includes('nike') ||
    p.url?.toLowerCase().includes('nike') ||
    p.name?.toLowerCase().includes('jordan');
  if (!isNike) return p;

  return {
    ...p,
    vendor: p.vendor?.replace(/nikey\s*\|\s*password:\s*1/gi, 'Studio Footwear').replace(/nike/gi, 'Studio Collection') || 'Studio Collection',
    url: p.url?.includes('nike') ? '#/products/' + p.id : p.url,
    name: p.name?.replace(/air jordan 12 retro/gi, 'Retro Court High Sneaker').replace(/tatum 5 orbit/gi, 'Orbit Performance Trainer').replace(/luka 5/gi, 'Low Monochrome Court Trainer') || p.name,
  };
}

export function getStoredProducts(): Product[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PRODUCTS) || localStorage.getItem('runway_products_v1');
    if (!raw) return DEFAULT_PRODUCTS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const sanitized = parsed.map(cleanProduct);
      return sanitized;
    }
  } catch (e) {
    console.error('Failed to load products from storage', e);
  }
  return DEFAULT_PRODUCTS;
}

export function saveProducts(products: Product[], persistCloud = true): void {
  try {
    const sanitized = products.map(cleanProduct);
    localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(sanitized));
    if (persistCloud) {
      void syncCatalogCollectionToFirestore('products', sanitized).then((result) => {
        if (!result.success) console.error(result.message);
      });
    }
    window.dispatchEvent(new CustomEvent('runway:catalog_updated'));
  } catch (e) {
    console.error('Failed to save products to storage', e);
  }
}

function cleanLook(look: Look): Look {
  return {
    ...look,
    productIds: look.productIds.map((id) => (id === 'air-jordan-12-retro-copy' ? 'court-trainer-black' : id)),
    pins: look.pins.map((pin) => ({
      ...pin,
      productId: pin.productId === 'air-jordan-12-retro-copy' ? 'court-trainer-black' : pin.productId,
    })),
  };
}

export function getStoredLooks(): Look[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LOOKS) || localStorage.getItem('runway_looks_v1');
    if (!raw) return DEFAULT_LOOKS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map(cleanLook);
    }
  } catch (e) {
    console.error('Failed to load looks from storage', e);
  }
  return DEFAULT_LOOKS;
}

export function saveLooks(looks: Look[], persistCloud = true): void {
  try {
    const sanitized = looks.map(cleanLook);
    localStorage.setItem(STORAGE_KEY_LOOKS, JSON.stringify(sanitized));
    if (persistCloud) {
      void syncCatalogCollectionToFirestore('looks', sanitized).then((result) => {
        if (!result.success) console.error(result.message);
      });
    }
    window.dispatchEvent(new CustomEvent('runway:catalog_updated'));
  } catch (e) {
    console.error('Failed to save looks to storage', e);
  }
}

export function resetToDefaults(): { products: Product[]; looks: Look[] } {
  try {
    localStorage.removeItem(STORAGE_KEY_PRODUCTS);
    localStorage.removeItem(STORAGE_KEY_LOOKS);
    localStorage.removeItem('runway_products_v1');
    localStorage.removeItem('runway_looks_v1');
    window.dispatchEvent(new CustomEvent('runway:catalog_updated'));
  } catch (e) {
    console.error('Failed to reset catalog', e);
  }
  return { products: DEFAULT_PRODUCTS, looks: DEFAULT_LOOKS };
}
