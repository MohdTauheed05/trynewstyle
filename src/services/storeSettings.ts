export interface StoreSettings {
  shopName: string;
  shopTagline: string;
  currencySymbol: string;
  whatsappNumber: string;
}

const STORAGE_KEY_SETTINGS = 'runway_store_settings_v1';

export const DEFAULT_SETTINGS: StoreSettings = {
  shopName: 'Try the Look',
  shopTagline: 'Six looks, styled head to toe. Tap a pin to see the piece.',
  currencySymbol: '$',
  whatsappNumber: import.meta.env.VITE_WHATSAPP_NUMBER || '',
};

export function cleanCurrencySymbol(raw: string | undefined): string {
  if (!raw) return '$';
  let trimmed = raw.trim();
  // If user typed or saved "$AED", "$SAR", "$USD", remove the accidental leading "$"
  if (trimmed.startsWith('$') && trimmed.length > 1 && /[a-zA-Z]/.test(trimmed)) {
    trimmed = trimmed.replace(/^\$+/, '').trim();
  }
  return trimmed || '$';
}

export function formatCurrency(amount: number, symbol: string | undefined): string {
  const clean = cleanCurrencySymbol(symbol);
  const formattedNumber = amount.toFixed(2);
  // Add a space between multi-character currency codes (e.g., "AED 149.00", "SAR 149.00")
  // Keep single symbols snug (e.g., "$149.00", "€149.00", "£149.00", "₹149.00")
  const needsSpace = clean.length > 1 && !clean.endsWith(' ');
  return needsSpace ? `${clean} ${formattedNumber}` : `${clean}${formattedNumber}`;
}

export function getStoredSettings(): StoreSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    // Remove legacy device-local credentials and Firebase config from prior versions.
    if (parsed && typeof parsed === 'object') {
      delete parsed.adminUsername;
      delete parsed.adminPasswordHash;
      delete parsed.firebaseConfig;
    }
    const merged = { ...DEFAULT_SETTINGS, ...parsed };
    if (merged.whatsappNumber === '15551234567') {
      merged.whatsappNumber = import.meta.env.VITE_WHATSAPP_NUMBER || '';
    }
    if (merged.shopName && merged.shopName.toLowerCase().includes('nike')) {
      merged.shopName = 'Try the Look';
    }
    // Auto-clean any $AED, $SAR, etc. to AED, SAR
    merged.currencySymbol = cleanCurrencySymbol(merged.currencySymbol);
    // Persist the sanitized shape so old local passwords are removed from this device.
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(merged));
    return merged;
  } catch (e) {
    console.error('Failed to load store settings', e);
    return DEFAULT_SETTINGS;
  }
}

export function saveStoredSettings(settings: StoreSettings): void {
  try {
    const cleanSettings: StoreSettings = {
      ...settings,
      currencySymbol: cleanCurrencySymbol(settings.currencySymbol),
    };
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(cleanSettings));
    window.dispatchEvent(new CustomEvent('runway:settings_updated'));
  } catch (e) {
    console.error('Failed to save store settings', e);
  }
}
