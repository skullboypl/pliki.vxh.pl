import { ADJ, ANIMAL, displayNickname as displaySlug, generateNicknameSlug } from '../shared/nicknames.js';

export type Lang = 'pl' | 'en';

export { ADJ, ANIMAL, generateNicknameSlug };

const SLUG_RE = /^([a-z]+)_([a-z]+)_(\d{2,4})$/i;

export function isGeneratedNick(name: string) {
  return SLUG_RE.test(name);
}

export function displayNickname(name: string, lang: Lang = 'pl') {
  return displaySlug(name, lang);
}

export function peerAnimalKey(name: string): string {
  const m = String(name).match(SLUG_RE);
  return m ? m[2].toLowerCase() : 'guest';
}
