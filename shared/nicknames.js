/** @typedef {'pl' | 'en'} Lang */

/** @type {Record<string, Record<Lang, string>>} */
const ADJ = {
  green: { pl: 'Zielony', en: 'Green' },
  blue: { pl: 'Niebieski', en: 'Blue' },
  red: { pl: 'Czerwony', en: 'Red' },
  purple: { pl: 'Fioletowy', en: 'Purple' },
  orange: { pl: 'Pomarańczowy', en: 'Orange' },
  fast: { pl: 'Szybki', en: 'Fast' },
  happy: { pl: 'Wesoły', en: 'Happy' },
  quiet: { pl: 'Cichy', en: 'Quiet' },
  young: { pl: 'Młody', en: 'Young' },
  big: { pl: 'Duży', en: 'Big' },
  small: { pl: 'Mały', en: 'Small' },
  gold: { pl: 'Złoty', en: 'Gold' },
};

/** @type {Record<string, Record<Lang, string>>} */
const ANIMAL = {
  cat: { pl: 'Kot', en: 'Cat' },
  dog: { pl: 'Pies', en: 'Dog' },
  fox: { pl: 'Lis', en: 'Fox' },
  eagle: { pl: 'Orzeł', en: 'Eagle' },
  panda: { pl: 'Panda', en: 'Panda' },
  whale: { pl: 'Wieloryb', en: 'Whale' },
  dolphin: { pl: 'Delfin', en: 'Dolphin' },
  owl: { pl: 'Sowa', en: 'Owl' },
  rabbit: { pl: 'Królik', en: 'Rabbit' },
  bear: { pl: 'Niedźwiedź', en: 'Bear' },
  wolf: { pl: 'Wilk', en: 'Wolf' },
  deer: { pl: 'Jelen', en: 'Deer' },
  seal: { pl: 'Foka', en: 'Seal' },
};

const ADJ_KEYS = Object.keys(ADJ);
const ANIMAL_KEYS = Object.keys(ANIMAL);
const SLUG_RE = /^([a-z]+)_([a-z]+)_(\d{2,4})$/i;

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const randomNum = () => String(Math.floor(Math.random() * 900) + 100);

/**
 * @param {Set<string>} used
 * @returns {string}
 */
function generateNicknameSlug(used) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const slug = `${pick(ADJ_KEYS)}_${pick(ANIMAL_KEYS)}_${randomNum()}`;
    if (!used.has(slug)) return slug;
  }
  return `guest_${Math.random().toString(36).slice(2, 6)}_${randomNum()}`;
}

/**
 * @param {string} slug
 * @param {Lang} [lang='pl']
 * @returns {string}
 */
function displayNickname(slug, lang = 'pl') {
  const m = String(slug).match(SLUG_RE);
  if (!m) return slug;
  const [, adjKey, animalKey, num] = m;
  const adj = ADJ[adjKey.toLowerCase()]?.[lang] || adjKey;
  const animal = ANIMAL[animalKey.toLowerCase()]?.[lang] || animalKey;
  return `${adj}_${animal}_${num}`;
}

module.exports = { generateNicknameSlug, displayNickname, ADJ, ANIMAL };
