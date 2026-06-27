import type { SeoLang } from '@/lib/seo/site';

/** Tytuł i meta description pod Google (ok. 50–60 i 140–160 znaków). */
export type PageSeoCopy = {
  title: string;
  description: string;
};

const PAGE_SEO: Record<string, Record<SeoLang, PageSeoCopy>> = {
  'send-wifi': {
    pl: {
      title: 'Wyślij plik przez WiFi bez aplikacji',
      description:
        'Prześlij pliki między telefonem a komputerem w tej samej sieci LAN. Bez chmury, konta i instalacji. P2P lokalnie.',
    },
    en: {
      title: 'Send files over WiFi without an app',
      description:
        'Transfer files between phone and PC on the same LAN. No cloud, account, or install. Local P2P with pliki.vxh.pl.',
    },
  },
  'lan-transfer': {
    pl: {
      title: 'Przesyłanie plików w sieci LAN',
      description:
        'Szybki transfer plików w sieci lokalnej między laptopami, telefonami i tabletami. Bez uploadu do chmury. Działa w przeglądarce.',
    },
    en: {
      title: 'LAN file transfer in your browser',
      description:
        'Fast local network file transfer between laptops, phones, and tablets. No cloud upload. Works in the browser on pliki.vxh.pl.',
    },
  },
  'phone-pc': {
    pl: {
      title: 'Telefon na komputer: pliki przez WiFi',
      description:
        'Wyślij zdjęcia, filmy i dokumenty z telefonu na PC (i odwrotnie) bez kabla USB. Wystarczy ta sama sieć WiFi i przeglądarka.',
    },
    en: {
      title: 'Phone to PC: send files over WiFi',
      description:
        'Send photos, videos, and documents from phone to PC (and back) without USB. Same WiFi and a browser on pliki.vxh.pl.',
    },
  },
  'android-iphone': {
    pl: {
      title: 'Android i iPhone: pliki w jednej WiFi',
      description:
        'Przesyłaj pliki między Androidem a iPhone bez AirDrop. Wspólna sieć WiFi i przeglądarka wystarczą. Poradnik krok po kroku.',
    },
    en: {
      title: 'Android and iPhone file transfer',
      description:
        'Move files between Android and iPhone without AirDrop. Shared WiFi and a browser are enough. Step-by-step on pliki.vxh.pl.',
    },
  },
  'photos-no-cloud': {
    pl: {
      title: 'Zdjęcia bez chmury: transfer w WiFi',
      description:
        'Udostępniaj zdjęcia lokalnie w domu lub biurze. Pliki nie trafiają na serwery chmurowe. Prywatny transfer P2P w LAN.',
    },
    en: {
      title: 'Photos without the cloud: WiFi transfer',
      description:
        'Share photos locally at home or work. Files stay off third-party cloud servers. Private P2P transfer on your LAN.',
    },
  },
  'large-video': {
    pl: {
      title: 'Duże filmy MOV i MP4 przez WiFi',
      description:
        'Wyślij duże pliki wideo w sieci lokalnej. Wskazówki dla iPhone (Safari, PWA) i stabilny odbiór. Bez limitu chmury.',
    },
    en: {
      title: 'Large MOV and MP4 videos over WiFi',
      description:
        'Send large video files on your local network. iPhone tips (Safari, PWA) and reliable receiving. No cloud upload cap.',
    },
  },
  'p2p-offline': {
    pl: {
      title: 'Transfer P2P w LAN bez chmury',
      description:
        'Pliki idą bezpośrednio między urządzeniami (WebRTC). Serwer tylko pokazuje listę peerów w sieci. Dane zostają lokalnie.',
    },
    en: {
      title: 'P2P file transfer on LAN',
      description:
        'Files go directly between devices via WebRTC. The server only lists peers on your network. Data stays local.',
    },
  },
  'fast-wifi': {
    pl: {
      title: 'Szybki transfer plików w WiFi',
      description:
        'Wykorzystaj prędkość domowej lub biurowej sieci WiFi zamiast uploadu do chmury. Transfer lokalny między urządzeniami.',
    },
    en: {
      title: 'Fast WiFi file transfer',
      description:
        'Use home or office WiFi speed instead of cloud upload and download. Local transfer between devices in the browser.',
    },
  },
  'office-lan': {
    pl: {
      title: 'Pliki w biurze: udostępnianie w LAN',
      description:
        'Prześlij PDF, prezentacje i archiwa kolegom w tej samej sieci biurowej. Bez pendrive i bez instalacji programu.',
    },
    en: {
      title: 'Office LAN file sharing',
      description:
        'Send PDFs, decks, and archives to colleagues on the office LAN. No USB sticks and no software install.',
    },
  },
  'home-network': {
    pl: {
      title: 'Pliki w domowej sieci WiFi',
      description:
        'Rodzina w domu: telefony, tablety i PC w jednej sieci LAN. Szybkie wysyłanie plików przez przeglądarkę bez konfiguracji NAS.',
    },
    en: {
      title: 'Home network file sharing',
      description:
        'Family at home: phones, tablets, and PCs on one WiFi. Quick browser file sharing without NAS setup.',
    },
  },
  'privacy-local': {
    pl: {
      title: 'Prywatne przesyłanie plików lokalnie',
      description:
        'Bez konta i bez trwałego przechowywania plików na serwerze. Transfer tylko do wybranego urządzenia w Twojej sieci.',
    },
    en: {
      title: 'Private local file transfer',
      description:
        'No account and no permanent file storage on the server. Transfer only to the device you pick on your network.',
    },
  },
  'how-it-works': {
    pl: {
      title: 'Jak działa wysyłanie plików P2P?',
      description:
        'Ta sama sieć LAN, lista urządzeń, WebRTC i sekcja „Odebrane pliki”. Instrukcja: wiele plików, paczki, drag and drop i PWA.',
    },
    en: {
      title: 'How P2P file sending works',
      description:
        'Same WiFi, device list, WebRTC, and “Received files”. Guide: multi-file send, bundles, drag and drop, and PWA.',
    },
  },
  faq: {
    pl: {
      title: 'FAQ: wysyłanie plików w WiFi',
      description:
        'Odpowiedzi: ta sama sieć, iPhone Safari, wiele plików, miejsce w przeglądarce i bezpieczeństwo. pliki.vxh.pl bez konta.',
    },
    en: {
      title: 'FAQ: WiFi file transfer',
      description:
        'Answers: same network, iPhone Safari, multiple files, browser storage, and security. pliki.vxh.pl with no account.',
    },
  },
  'iphone-safari': {
    pl: {
      title: 'iPhone i Safari: najlepszy odbiór plików',
      description:
        'Na iPhone używaj Safari zamiast Chrome do dużych plików. Dodaj stronę do ekranu początkowego (PWA) dla stabilności.',
    },
    en: {
      title: 'iPhone Safari for receiving files',
      description:
        'On iPhone use Safari instead of Chrome for large files. Add pliki.vxh.pl to Home Screen (PWA) for stability.',
    },
  },
  'no-account': {
    pl: {
      title: 'Wyślij plik bez konta i logowania',
      description:
        'Wejdź na stronę, dostaniesz nick i od razu widzisz urządzenia w sieci. Bez rejestracji i bez formularzy.',
    },
    en: {
      title: 'Send files without account or login',
      description:
        'Open the page, get a nickname, and see devices on the network. No signup and no forms.',
    },
  },
  'vs-cloud': {
    pl: {
      title: 'LAN czy chmura: co wybrać?',
      description:
        'Porównanie szybkości, prywatności i limitów. Gdy urządzenia są obok siebie w WiFi, transfer lokalny wygrywa.',
    },
    en: {
      title: 'LAN vs cloud: which to choose?',
      description:
        'Compare speed, privacy, and limits. When devices are nearby on WiFi, local transfer wins.',
    },
  },
  'documents-pdf': {
    pl: {
      title: 'PDF i dokumenty przez WiFi',
      description:
        'Wyślij PDF, DOCX, ZIP i inne pliki w LAN. Podgląd zawartości ZIP bez rozpakowania. Bez zmiany jakości pliku.',
    },
    en: {
      title: 'PDF and documents over WiFi',
      description:
        'Send PDF, DOCX, ZIP, and more on LAN. Browse ZIP contents without extracting. No file quality changes.',
    },
  },
  'music-files': {
    pl: {
      title: 'Muzyka i audio: transfer w WiFi',
      description:
        'MP3, WAV, FLAC bit w bit. Miniatura z falą dźwiękową i podgląd przed zapisem na liście odebranych plików.',
    },
    en: {
      title: 'Music and audio over WiFi',
      description:
        'MP3, WAV, FLAC bit-for-bit. Waveform thumb and preview before save in the received files list.',
    },
  },
  'security-p2p': {
    pl: {
      title: 'Bezpieczeństwo transferu P2P w LAN',
      description:
        'Pliki między urządzeniami w sieci lokalnej. Używaj zaufanej WiFi i znanych odbiorców. Poradnik ryzyk i dobrych praktyk.',
    },
    en: {
      title: 'P2P transfer security on LAN',
      description:
        'Files between devices on your local network. Use trusted WiFi and known receivers. Risks and best practices.',
    },
  },
  'pwa-install': {
    pl: {
      title: 'PWA: dodaj pliki.vxh.pl na ekran',
      description:
        'Zainstaluj skrót na iPhone (Safari), Androidzie i komputerze. Więcej miejsca na duże pliki i szybszy dostęp.',
    },
    en: {
      title: 'PWA: add pliki.vxh.pl to Home Screen',
      description:
        'Install a shortcut on iPhone (Safari), Android, and desktop. More storage for large files and quicker access.',
    },
  },
  'drag-drop': {
    pl: {
      title: 'Przeciągnij i upuść pliki (PC, PWA)',
      description:
        'Wysyłaj pliki przez drag and drop na kartę urządzenia lub na stronę. Działa w przeglądarce na komputerze i w PWA.',
    },
    en: {
      title: 'Drag and drop to send files',
      description:
        'Send files by dragging onto a device card or the page. Works in desktop browser and installed PWA.',
    },
  },
  'file-bundles': {
    pl: {
      title: 'Wiele plików naraz i paczki',
      description:
        'Jedna wysyłka, wiele plików. Odbiorca widzi paczkę, zapisuje ZIP lub pojedyncze pliki. Poradnik paczek.',
    },
    en: {
      title: 'Multiple files and bundles',
      description:
        'One send, many files. Receiver sees a bundle, saves ZIP or individual files. Bundle guide.',
    },
  },
  'camera-share': {
    pl: {
      title: 'Zakładka Camera: kamera w LAN i OBS',
      description:
        'Podgląd kamery na żywo w LAN, bez chmury. Link do OBS Browser Source, PIN, mikrofon i widoczność w całej sieci lokalnej.',
    },
    en: {
      title: 'Camera tab: LAN video and OBS',
      description:
        'Live camera on LAN, no cloud. OBS Browser Source link, PIN, optional mic, visible to everyone on the local network.',
    },
  },
};

const HUB_SEO: Record<SeoLang, PageSeoCopy> = {
  pl: {
    title: 'Poradniki: pliki w WiFi bez aplikacji',
    description:
      'Poradniki pliki.vxh.pl: LAN, P2P, iPhone, paczki, drag and drop, PWA i zakładka Camera (OBS). Wyszukaj temat lub otwórz aplikację w tej samej sieci LAN.',
  },
  en: {
    title: 'Guides: WiFi file transfer, no app',
    description:
      'pliki.vxh.pl guides: LAN, P2P, iPhone, bundles, drag and drop, PWA, and the Camera tab (OBS). Search a topic or open the app on the same LAN.',
  },
};

export function getPageSeoMeta(pageId: string, lang: SeoLang): PageSeoCopy {
  const copy = PAGE_SEO[pageId]?.[lang];
  if (copy) return copy;
  return {
    title: 'Poradnik | pliki.vxh.pl',
    description:
      lang === 'pl'
        ? 'Przesyłaj pliki w sieci lokalnej bez aplikacji i chmury na pliki.vxh.pl.'
        : 'Transfer files on your local network without an app or cloud on pliki.vxh.pl.',
  };
}

export function getHubSeoMeta(lang: SeoLang): PageSeoCopy {
  return HUB_SEO[lang];
}

/** Tytuł z sufiksem marki (unika podwójnego template z layout). */
export function formatMetaTitle(title: string, lang: SeoLang) {
  const brand = 'pliki.vxh.pl';
  if (title.includes(brand)) return title;
  const sep = lang === 'pl' ? ' | ' : ' | ';
  const combined = `${title}${sep}${brand}`;
  return combined.length <= 65 ? combined : title;
}
