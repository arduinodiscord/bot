/**
 * Whether startup loading (blocklist, keywords) has finished. The image
 * automod does nothing until then, so a confirmed scam image posted during a
 * restart is not mistaken for an unknown one.
 */
let ready = false;

export const isAutomodReady = (): boolean => ready;

export function markAutomodReady(value = true): void {
  ready = value;
}
