const STORAGE_KEY = "bj_device_token";
const PSEUDO_KEY = "bj_pseudo";

export function getStoredDeviceToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function storeDeviceToken(token: string) {
  window.localStorage.setItem(STORAGE_KEY, token);
}

export function getStoredPseudo(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(PSEUDO_KEY);
}

export function storePseudo(pseudo: string) {
  window.localStorage.setItem(PSEUDO_KEY, pseudo);
}
