const KEY = 'mars_pos_settings';

export interface StoreSettings {
  businessName: string;
  address: string;
  logoUrl: string;
  phone?: string;
  email?: string;
}

const defaults: StoreSettings = {
  businessName: 'Mars Kitchen Essentials',
  address: 'Kikuubo Skylight Arcade L2-43',
  logoUrl: '',
  phone: '0703666646',
  email: 'info@marskitchenessentials.com',
};

export function getSettings(): StoreSettings {
  try {
    const s = localStorage.getItem(KEY);
    if (s) return { ...defaults, ...JSON.parse(s) };
  } catch (_) {}
  return { ...defaults };
}

export function setSettings(settings: Partial<StoreSettings>): void {
  const current = getSettings();
  const next = { ...current, ...settings };
  localStorage.setItem(KEY, JSON.stringify(next));
}
