import type { SeoLang } from '@/lib/seo/site';

export type SeoTopicIconId =
  | 'wifi'
  | 'lan'
  | 'phone'
  | 'cross'
  | 'photos'
  | 'video'
  | 'p2p'
  | 'speed'
  | 'office'
  | 'home'
  | 'privacy'
  | 'howto'
  | 'faq'
  | 'iphone'
  | 'account'
  | 'cloud'
  | 'documents'
  | 'music'
  | 'security'
  | 'pwa'
  | 'drag'
  | 'bundle'
  | 'zip'
  | 'camera';

export interface SeoSection {
  title: string;
  paragraphs: string[];
}

export interface SeoPage {
  id: string;
  icon: SeoTopicIconId;
  plSlug: string;
  enSlug: string;
  title: Record<SeoLang, string>;
  description: Record<SeoLang, string>;
  keywords: Record<SeoLang, string[]>;
  h1: Record<SeoLang, string>;
  sections: Record<SeoLang, SeoSection[]>;
  /** Opcjonalny przycisk CTA (np. zakładka Camera zamiast głównej aplikacji). */
  cta?: {
    href: string;
    label: Record<SeoLang, string>;
    hint?: Record<SeoLang, string>;
  };
}

export const SEO_PAGES: SeoPage[] = [
  {
    id: 'send-wifi',
    icon: 'wifi',
    plSlug: 'wyslij-plik-wifi',
    enSlug: 'send-file-wifi',
    title: {
      pl: 'Wyślij plik przez WiFi: szybko i bez chmury | pliki.vxh.pl',
      en: 'Send files over WiFi: fast, no cloud | pliki.vxh.pl',
    },
    description: {
      pl: 'Wyślij plik między telefonem a komputerem w tej samej sieci LAN. Bez rejestracji i bez limitu chmury. Transfer P2P lokalnie.',
      en: 'Send files between phone and PC on the same LAN. No signup and no cloud quota. Direct local P2P transfer.',
    },
    keywords: {
      pl: ['wyślij plik wifi', 'transfer plików', 'lan', 'p2p'],
      en: ['send file wifi', 'file transfer', 'lan', 'p2p'],
    },
    h1: {
      pl: 'Wyślij plik przez WiFi w kilka sekund',
      en: 'Send files over WiFi in seconds',
    },
    sections: {
      pl: [
        {
          title: 'Jak to działa',
          paragraphs: [
            'Otwórz pliki.vxh.pl na dwóch urządzeniach w tej samej sieci LAN (WiFi, Ethernet albo hotspot). Ustaw nick (opcjonalnie), wybierz odbiorcę z listy i wyślij jeden lub wiele plików naraz. Możesz też przeciągnąć pliki na kartę urządzenia albo upuścić je na stronie (PC i PWA).',
            'Dane idą bezpośrednio między urządzeniami (WebRTC). Serwer pomaga tylko pokazać listę urządzeń w sieci, nie trzyma Twoich plików.',
          ],
        },
        {
          title: 'Co znajdziesz w aplikacji',
          paragraphs: [
            'Odebrane pliki z podglądem zdjęć, wideo, tekstu i audio. Paczki wielu plików, podgląd zawartości ZIP, zapis na dysk lub jako archiwum ZIP. Limit miejsca w przeglądarce widać na panelu przed odbiorem dużych plików.',
          ],
        },
      ],
      en: [
        {
          title: 'How it works',
          paragraphs: [
            'Open pliki.vxh.pl on two devices on the same LAN (WiFi, Ethernet, or hotspot). Set a nickname (optional), pick a receiver, and send one or many files at once. You can also drag files onto a device card or drop them on the page (desktop and PWA).',
            'Data goes device-to-device via WebRTC. The server only helps devices find each other; it does not store your files.',
          ],
        },
        {
          title: 'In the app',
          paragraphs: [
            'Received files with previews for images, video, text, and audio. Multi-file bundles, ZIP contents preview, save to disk or as a ZIP archive. Browser storage limits are shown before accepting very large files.',
          ],
        },
      ],
    },
  },
  {
    id: 'lan-transfer',
    icon: 'lan',
    plSlug: 'przesylanie-plikow-lan',
    enSlug: 'lan-file-transfer',
    title: {
      pl: 'Przesyłanie plików w sieci LAN: lokalnie | pliki.vxh.pl',
      en: 'LAN file transfer: local network | pliki.vxh.pl',
    },
    description: {
      pl: 'Przesyłaj pliki w sieci lokalnej LAN między laptopami, telefonami i tabletami. Idealne do biura i domu.',
      en: 'Transfer files on your local LAN between laptops, phones and tablets. Great for home and office.',
    },
    keywords: {
      pl: ['lan', 'sieć lokalna', 'przesyłanie plików'],
      en: ['lan', 'local network', 'file transfer'],
    },
    h1: { pl: 'Przesyłanie plików w sieci LAN', en: 'LAN file transfer' },
    sections: {
      pl: [{ title: 'Zalety LAN', paragraphs: ['Szybkość WiFi w domu lub biurze często przewyższa upload do chmury. Transfer lokalny nie zużywa limitu operatora.'] }],
      en: [{ title: 'Why LAN', paragraphs: ['Home or office WiFi is often faster than uploading to the cloud. Local transfer does not use your mobile data cap.'] }],
    },
  },
  {
    id: 'phone-pc',
    icon: 'phone',
    plSlug: 'telefon-komputer-wifi',
    enSlug: 'phone-to-pc-wifi',
    title: {
      pl: 'Telefon → komputer: wyślij plik przez WiFi | pliki.vxh.pl',
      en: 'Phone to PC: send files over WiFi | pliki.vxh.pl',
    },
    description: {
      pl: 'Wyślij zdjęcia, filmy i dokumenty z telefonu na komputer (lub odwrotnie) bez kabla USB i bez chmury.',
      en: 'Send photos, videos and documents from phone to PC (or back) without USB cables or cloud apps.',
    },
    keywords: { pl: ['telefon komputer', 'wifi', 'android', 'iphone'], en: ['phone pc', 'wifi', 'android', 'iphone'] },
    h1: { pl: 'Pliki z telefonu na komputer przez WiFi', en: 'Phone to PC over WiFi' },
    sections: {
      pl: [{ title: 'Bez kabla', paragraphs: ['Wystarczy ta sama sieć WiFi i przeglądarka. Na iPhone polecamy Safari dla najlepszej kompatybilności.'] }],
      en: [{ title: 'No cable', paragraphs: ['Same WiFi and a browser is enough. On iPhone, Safari works best for large files.'] }],
    },
  },
  {
    id: 'android-iphone',
    icon: 'cross',
    plSlug: 'android-iphone-wifi',
    enSlug: 'android-iphone-wifi',
    title: {
      pl: 'Android ↔ iPhone: pliki przez WiFi | pliki.vxh.pl',
      en: 'Android ↔ iPhone: files over WiFi | pliki.vxh.pl',
    },
    description: {
      pl: 'Przesyłaj pliki między Androidem a iPhone bez AirDrop ani kabli, wspólna sieć WiFi wystarczy.',
      en: 'Move files between Android and iPhone without AirDrop or cables. Shared WiFi is enough.',
    },
    keywords: { pl: ['android iphone', 'transfer', 'wifi'], en: ['android iphone', 'transfer', 'wifi'] },
    h1: { pl: 'Android i iPhone w jednej sieci', en: 'Android and iPhone on one network' },
    sections: {
      pl: [{ title: 'Cross-platform', paragraphs: ['Aplikacja działa w przeglądarce, nie musisz instalować tego samego programu na obu systemach.'] }],
      en: [{ title: 'Cross-platform', paragraphs: ['Works in the browser, no need to install matching apps on both systems.'] }],
    },
  },
  {
    id: 'photos-no-cloud',
    icon: 'photos',
    plSlug: 'zdjecia-bez-chmury',
    enSlug: 'photos-without-cloud',
    title: {
      pl: 'Zdjęcia bez chmury: wyślij przez WiFi | pliki.vxh.pl',
      en: 'Photos without cloud: send over WiFi | pliki.vxh.pl',
    },
    description: {
      pl: 'Udostępnij zdjęcia i albumy lokalnie. Pliki nie trafiają na obce serwery chmurowe.',
      en: 'Share photos and albums locally. Files are not uploaded to third-party cloud servers.',
    },
    keywords: { pl: ['zdjęcia', 'bez chmury', 'prywatność'], en: ['photos', 'no cloud', 'privacy'] },
    h1: { pl: 'Zdjęcia bez chmury', en: 'Photos without the cloud' },
    sections: {
      pl: [{ title: 'Prywatność', paragraphs: ['Transfer P2P w LAN oznacza, że treść zostaje w Twojej sieci domowej lub biurowej.'] }],
      en: [{ title: 'Privacy', paragraphs: ['P2P on LAN keeps content inside your home or office network.'] }],
    },
  },
  {
    id: 'large-video',
    icon: 'video',
    plSlug: 'duze-filmy-wifi',
    enSlug: 'large-videos-wifi',
    title: {
      pl: 'Duże filmy przez WiFi. MOV, MP4 | pliki.vxh.pl',
      en: 'Large videos over WiFi. MOV, MP4 | pliki.vxh.pl',
    },
    description: {
      pl: 'Wyślij duże pliki wideo (MOV, MP4) w sieci lokalnej. Na telefonie używaj Safari i OPFS dla stabilnego odbioru.',
      en: 'Send large video files (MOV, MP4) on your local network. Use Safari on phones for reliable receiving.',
    },
    keywords: { pl: ['film', 'mov', 'mp4', 'duży plik'], en: ['video', 'mov', 'mp4', 'large file'] },
    h1: { pl: 'Duże filmy w sieci WiFi', en: 'Large videos on WiFi' },
    sections: {
      pl: [
        {
          title: 'Wskazówka iOS',
          paragraphs: [
            'Na iPhone Chrome ma ograniczenia pamięci. Do dużych plików użyj Safari lub dodaj stronę do ekranu początkowego (PWA).',
            'W aplikacji wideo możesz obejrzeć podgląd przed zapisaniem. Przy małym wolnym miejscu w przeglądarce pojawi się pytanie, czy odebrać mimo to.',
          ],
        },
      ],
      en: [
        {
          title: 'iOS tip',
          paragraphs: [
            'On iPhone, Chrome has memory limits. Use Safari or Add to Home Screen (PWA) for large files.',
            'The app offers video preview before saving. When browser storage is tight, you can choose to receive anyway or free space first.',
          ],
        },
      ],
    },
  },
  {
    id: 'p2p-offline',
    icon: 'p2p',
    plSlug: 'p2p-bez-internetu',
    enSlug: 'p2p-without-internet',
    title: {
      pl: 'P2P w LAN: bez wysyłania do internetu | pliki.vxh.pl',
      en: 'P2P on LAN: files stay local | pliki.vxh.pl',
    },
    description: {
      pl: 'Pliki nie są uploadowane do chmury, połączenie WebRTC w sieci lokalnej. Serwer służy tylko do znalezienia urządzeń.',
      en: 'Files are not uploaded to the cloud. WebRTC connects devices on LAN. The server only helps devices find each other.',
    },
    keywords: { pl: ['p2p', 'webrtc', 'lokalnie'], en: ['p2p', 'webrtc', 'local'] },
    h1: { pl: 'Transfer P2P w sieci lokalnej', en: 'P2P transfer on your LAN' },
    sections: {
      pl: [{ title: 'Architektura', paragraphs: ['Sygnalizacja (nick, lista urządzeń) idzie przez serwer; bajty pliku, bezpośrednio między peerami.'] }],
      en: [{ title: 'Architecture', paragraphs: ['Signaling (names, peer list) uses the server; file bytes go directly between peers.'] }],
    },
  },
  {
    id: 'fast-wifi',
    icon: 'speed',
    plSlug: 'szybki-transfer-wifi',
    enSlug: 'fast-wifi-transfer',
    title: {
      pl: 'Szybki transfer plików WiFi | pliki.vxh.pl',
      en: 'Fast WiFi file transfer | pliki.vxh.pl',
    },
    description: {
      pl: 'Wykorzystaj pełną prędkość WiFi w domu, bez czekania na upload i download z chmury.',
      en: 'Use full WiFi speed at home, no waiting for cloud upload and download.',
    },
    keywords: { pl: ['szybki transfer', 'wifi'], en: ['fast transfer', 'wifi'] },
    h1: { pl: 'Szybki transfer w WiFi', en: 'Fast transfer on WiFi' },
    sections: {
      pl: [{ title: 'Prędkość', paragraphs: ['Im lepszy router, tym szybszy transfer między urządzeniami w tej samej sieci.'] }],
      en: [{ title: 'Speed', paragraphs: ['Better router means faster transfers between devices on the same network.'] }],
    },
  },
  {
    id: 'office-lan',
    icon: 'office',
    plSlug: 'biuro-pliki-lan',
    enSlug: 'office-lan-files',
    title: {
      pl: 'Pliki w biurze: sieć LAN | pliki.vxh.pl',
      en: 'Office files. LAN sharing | pliki.vxh.pl',
    },
    description: {
      pl: 'Prześlij prezentacje, PDF i archiwa kolegom w tej samej sieci biurowej bez pendrive.',
      en: 'Send decks, PDFs and archives to colleagues on the office LAN without USB sticks.',
    },
    keywords: { pl: ['biuro', 'lan', 'pdf'], en: ['office', 'lan', 'pdf'] },
    h1: { pl: 'Udostępnianie plików w biurze', en: 'File sharing at the office' },
    sections: {
      pl: [{ title: 'LAN w firmie', paragraphs: ['Upewnij się, że oba urządzenia są w tej samej sieci (nie gość WiFi odcięty od LAN).'] }],
      en: [{ title: 'Corporate LAN', paragraphs: ['Make sure both devices are on the same network (guest WiFi may be isolated).'] }],
    },
  },
  {
    id: 'home-network',
    icon: 'home',
    plSlug: 'domowa-siec-pliki',
    enSlug: 'home-network-files',
    title: {
      pl: 'Domowa sieć: wyślij pliki między urządzeniami | pliki.vxh.pl',
      en: 'Home network: send files between devices | pliki.vxh.pl',
    },
    description: {
      pl: 'Rodzina w domu: telefony, tablety, PC, jedna strona, ta sama WiFi, szybkie wysyłanie.',
      en: 'Family at home: phones, tablets, PCs, one page, same LAN, quick sharing.',
    },
    keywords: { pl: ['dom', 'wifi', 'rodzina'], en: ['home', 'wifi', 'family'] },
    h1: { pl: 'Pliki w domowej sieci', en: 'Files on your home network' },
    sections: {
      pl: [{ title: 'Prosto', paragraphs: ['Bez konfiguracji NAS, wystarczy przeglądarka na obu urządzeniach.'] }],
      en: [{ title: 'Simple', paragraphs: ['No NAS setup, just a browser on both devices.'] }],
    },
  },
  {
    id: 'privacy-local',
    icon: 'privacy',
    plSlug: 'prywatnosc-lokalnie',
    enSlug: 'privacy-local-transfer',
    title: {
      pl: 'Prywatne przesyłanie plików lokalnie | pliki.vxh.pl',
      en: 'Private local file transfer | pliki.vxh.pl',
    },
    description: {
      pl: 'Bez konta, bez trwałego przechowywania plików na serwerze, transfer między Twoimi urządzeniami.',
      en: 'No account, no permanent file storage on server, transfer between your devices only.',
    },
    keywords: { pl: ['prywatność', 'lokalnie', 'bez konta'], en: ['privacy', 'local', 'no account'] },
    h1: { pl: 'Prywatność przy transferze', en: 'Privacy-first transfer' },
    sections: {
      pl: [{ title: 'Dane', paragraphs: ['Pliki nie są indeksowane ani udostępniane publicznie, tylko wybrany odbiorca w sieci.'] }],
      en: [{ title: 'Your data', paragraphs: ['Files are not indexed or public. Only the peer you pick on the network.'] }],
    },
  },
  {
    id: 'how-it-works',
    icon: 'howto',
    plSlug: 'jak-dziala',
    enSlug: 'how-it-works',
    title: {
      pl: 'Jak działa wysyłanie plików P2P? | pliki.vxh.pl',
      en: 'How does P2P file sending work? | pliki.vxh.pl',
    },
    description: {
      pl: 'Krok po kroku: ta sama sieć LAN, lista urządzeń, WebRTC, odebrane pliki. Bez magii chmury.',
      en: 'Step by step: same LAN, device list, WebRTC, received files. No cloud magic.',
    },
    keywords: { pl: ['jak działa', 'webrtc', 'instrukcja'], en: ['how it works', 'webrtc', 'guide'] },
    h1: { pl: 'Jak to działa?', en: 'How it works' },
    sections: {
      pl: [
        {
          title: 'Kroki',
          paragraphs: [
            '1. Otwórz stronę na dwóch urządzeniach w tej samej sieci LAN (WiFi, Ethernet albo hotspot). Użyj HTTPS lub localhost.',
            '2. Ustaw nick albo zostaw losowy. Zobacz drugie urządzenie na liście.',
            '3. Wyślij: zielony przycisk (wiele plików naraz), przeciągnij na kartę urządzenia lub upuść na stronie.',
            '4. Na odbiorcy pliki trafiają do „Odebrane pliki”. Możesz je podejrzeć, zapisać na dysk lub usunąć z listy.',
          ],
        },
        {
          title: 'Paczki i podgląd',
          paragraphs: [
            'Wiele plików z jednej wysyłki grupuje się w paczkę. W paczce możesz zapisać wszystko osobno lub jako jeden ZIP.',
            'ZIP z listy możesz podejrzeć bez rozpakowywania. Zdjęcia, tekst, audio i wideo mają podgląd w aplikacji.',
          ],
        },
        {
          title: 'Po odebraniu',
          paragraphs: [
            'Odebrane pliki są w pamięci przeglądarki (OPFS). Znikają po zamknięciu karty lub aplikacji PWA, nie po odświeżeniu strony (F5).',
          ],
        },
      ],
      en: [
        {
          title: 'Steps',
          paragraphs: [
            '1. Open the page on two devices on the same LAN (WiFi, Ethernet, or hotspot). Use HTTPS or localhost.',
            '2. Set a nickname or keep the random one. See the other device in the list.',
            '3. Send via the green button (multiple files), drag onto a device card, or drop on the page.',
            '4. On the receiver, files appear under “Received files”. Preview, save to disk, or remove from the list.',
          ],
        },
        {
          title: 'Bundles and preview',
          paragraphs: [
            'Multiple files from one send are grouped as a bundle. Save all separately or as one ZIP.',
            'ZIP archives can be browsed without extracting. Images, text, audio, and video have in-app preview.',
          ],
        },
        {
          title: 'After receiving',
          paragraphs: [
            'Received files live in browser storage (OPFS). They disappear when you close the tab or PWA, not when you refresh (F5).',
          ],
        },
      ],
    },
  },
  {
    id: 'faq',
    icon: 'faq',
    plSlug: 'faq',
    enSlug: 'faq',
    title: {
      pl: 'FAQ: częste pytania | pliki.vxh.pl',
      en: 'FAQ: common questions | pliki.vxh.pl',
    },
    description: {
      pl: 'Odpowiedzi: ta sama WiFi, iPhone Safari, duże pliki, bezpieczeństwo, brak konta.',
      en: 'Answers: same LAN, iPhone Safari, large files, security, no account.',
    },
    keywords: { pl: ['faq', 'pytania'], en: ['faq', 'questions'] },
    h1: { pl: 'Najczęstsze pytania', en: 'Frequently asked questions' },
    sections: {
      pl: [
        {
          title: 'Czy potrzebuję internetu?',
          paragraphs: [
            'Potrzebujesz sieci lokalnej (WiFi). Pliki nie muszą wychodzić do internetu, ale strona musi być wcześniej załadowana w przeglądarce (HTTPS).',
          ],
        },
        {
          title: 'Dlaczego nie widzę drugiego urządzenia?',
          paragraphs: [
            'Sprawdź tę samą sieć WiFi (sieć gościa często jest odcięta). Upewnij się, że serwis jest online (zielony status połączenia).',
          ],
        },
        {
          title: 'Czy mogę wysłać wiele plików naraz?',
          paragraphs: [
            'Tak. Przycisk „Wybierz pliki” pozwala zaznaczyć wiele pozycji. Na komputerze możesz też przeciągnąć pliki na urządzenie lub upuścić na stronie.',
          ],
        },
        {
          title: 'Gdzie znikają odebrane pliki?',
          paragraphs: [
            'Po zamknięciu karty lub aplikacji PWA. Odświeżenie strony (F5) ich nie kasuje, dopóki nie zamkniesz całej karty.',
          ],
        },
        {
          title: 'Komunikat o małym miejscu w przeglądarce',
          paragraphs: [
            'Przeglądarka ma limit miejsca na witrynę. Panel pokazuje zajęcie. Możesz usunąć stare odebrane pliki albo spróbować odebrać mimo to.',
          ],
        },
      ],
      en: [
        {
          title: 'Do I need the internet?',
          paragraphs: [
            'You need a local network (WiFi). Files need not leave your LAN, but the page must be loaded in the browser over HTTPS.',
          ],
        },
        {
          title: 'Why is the other device missing?',
          paragraphs: [
            'Check the same LAN (guest WiFi networks are often isolated). Make sure the service connection is online (green status).',
          ],
        },
        {
          title: 'Can I send multiple files?',
          paragraphs: [
            'Yes. The file picker accepts multiple items. On desktop you can also drag onto a device or drop on the page.',
          ],
        },
        {
          title: 'When do received files disappear?',
          paragraphs: [
            'When you close the browser tab or PWA. Refreshing (F5) does not clear them until the tab is closed.',
          ],
        },
        {
          title: 'Low browser storage warning',
          paragraphs: [
            'Browsers cap per-site storage. The panel shows usage. Delete old received files or try receiving anyway.',
          ],
        },
      ],
    },
  },
  {
    id: 'iphone-safari',
    icon: 'iphone',
    plSlug: 'iphone-safari',
    enSlug: 'iphone-safari',
    title: {
      pl: 'iPhone i Safari: najlepszy odbiór plików | pliki.vxh.pl',
      en: 'iPhone & Safari: best for receiving files | pliki.vxh.pl',
    },
    description: {
      pl: 'Na iPhone używaj Safari zamiast Chrome do dużych plików i OPFS. Możesz dodać stronę do ekranu początkowego.',
      en: 'On iPhone use Safari instead of Chrome for large files and OPFS. Add to Home Screen for a PWA-like experience.',
    },
    keywords: { pl: ['iphone', 'safari', 'ios'], en: ['iphone', 'safari', 'ios'] },
    h1: { pl: 'iPhone: Safari zamiast Chrome', en: 'iPhone: use Safari' },
    sections: {
      pl: [{ title: 'Wskazówka', paragraphs: ['Chrome na iOS nie obsługuje OPFS, duże pliki mogą być obcięte. Safari + „Dodaj do ekranu początkowego” działa najlepiej.'] }],
      en: [{ title: 'Tip', paragraphs: ['Chrome on iOS lacks OPFS, large files may truncate. Safari + Add to Home Screen works best.'] }],
    },
  },
  {
    id: 'no-account',
    icon: 'account',
    plSlug: 'bez-konta',
    enSlug: 'no-account',
    title: {
      pl: 'Wyślij plik bez konta i logowania | pliki.vxh.pl',
      en: 'Send files without account or login | pliki.vxh.pl',
    },
    description: {
      pl: 'Bez rejestracji, losowy nick w sieci, od razu wysyłasz pliki w LAN.',
      en: 'No signup, random nickname on the network, start sending on LAN immediately.',
    },
    keywords: { pl: ['bez konta', 'bez logowania'], en: ['no account', 'no login'] },
    h1: { pl: 'Bez konta', en: 'No account needed' },
    sections: {
      pl: [{ title: 'Start', paragraphs: ['Wejdź na stronę. Dostajesz nick (np. Niebieski Lis) i widzisz inne urządzenia w sieci.'] }],
      en: [{ title: 'Get started', paragraphs: ['Open the page, you get a nickname and see other devices on the network.'] }],
    },
  },
  {
    id: 'vs-cloud',
    icon: 'cloud',
    plSlug: 'porownanie-chmura',
    enSlug: 'vs-cloud-storage',
    title: {
      pl: 'LAN vs chmura: kiedy wybrać WiFi? | pliki.vxh.pl',
      en: 'LAN vs cloud: when to use WiFi? | pliki.vxh.pl',
    },
    description: {
      pl: 'Porównanie: szybkość, prywatność, brak limitu rozmiaru po stronie chmury, transfer lokalny wygrywa w domu i biurze.',
      en: 'Compare speed, privacy, no cloud size quota, local transfer wins at home and office.',
    },
    keywords: { pl: ['chmura', 'porównanie', 'lan'], en: ['cloud', 'comparison', 'lan'] },
    h1: { pl: 'LAN czy chmura?', en: 'LAN or cloud?' },
    sections: {
      pl: [{ title: 'Kiedy LAN', paragraphs: ['Gdy oba urządzenia są obok siebie w tej samej sieci, najszybciej i najprywatniej.'] }],
      en: [{ title: 'When LAN', paragraphs: ['When both devices are nearby on the same network, fastest and most private.'] }],
    },
  },
  {
    id: 'documents-pdf',
    icon: 'documents',
    plSlug: 'dokumenty-pdf-wifi',
    enSlug: 'documents-pdf-wifi',
    title: {
      pl: 'PDF i dokumenty przez WiFi | pliki.vxh.pl',
      en: 'PDF & documents over WiFi | pliki.vxh.pl',
    },
    description: {
      pl: 'Wyślij PDF, DOCX, ZIP i inne dokumenty między urządzeniami w sieci lokalnej.',
      en: 'Send PDF, DOCX, ZIP and other documents between devices on your local network.',
    },
    keywords: { pl: ['pdf', 'dokumenty', 'zip'], en: ['pdf', 'documents', 'zip'] },
    h1: { pl: 'Dokumenty w sieci WiFi', en: 'Documents on WiFi' },
    sections: {
      pl: [
        {
          title: 'Formaty',
          paragraphs: [
            'PDF, DOCX, ZIP i inne typy bez zmiany jakości. Archiwum ZIP możesz podejrzeć z listy odebranych (przycisk „Zawartość”) bez rozpakowania na dysku.',
          ],
        },
      ],
      en: [
        {
          title: 'Formats',
          paragraphs: [
            'PDF, DOCX, ZIP, and more without recompression. ZIP archives can be browsed from the received list (“Contents”) without extracting to disk.',
          ],
        },
      ],
    },
  },
  {
    id: 'music-files',
    icon: 'music',
    plSlug: 'muzyka-pliki-wifi',
    enSlug: 'music-files-wifi',
    title: {
      pl: 'Muzyka i audio: transfer WiFi | pliki.vxh.pl',
      en: 'Music & audio. WiFi transfer | pliki.vxh.pl',
    },
    description: {
      pl: 'Prześlij MP3, FLAC, WAV między telefonem a komputerem bez kabla.',
      en: 'Transfer MP3, FLAC, WAV between phone and PC without cables.',
    },
    keywords: { pl: ['muzyka', 'mp3', 'audio'], en: ['music', 'mp3', 'audio'] },
    h1: { pl: 'Pliki audio w LAN', en: 'Audio files on LAN' },
    sections: {
      pl: [
        {
          title: 'Jakość i podgląd',
          paragraphs: [
            'MP3, WAV, FLAC i inne formaty docierają bit w bit. Na liście odebranych widać miniaturę z falą dźwiękową, a w podglądzie możesz odsłuchać plik przed zapisem.',
          ],
        },
      ],
      en: [
        {
          title: 'Quality and preview',
          paragraphs: [
            'MP3, WAV, FLAC, and more arrive bit-for-bit. The list shows a waveform thumb; preview lets you listen before saving.',
          ],
        },
      ],
    },
  },
  {
    id: 'security-p2p',
    icon: 'security',
    plSlug: 'bezpieczenstwo-p2p',
    enSlug: 'p2p-security',
    title: {
      pl: 'Bezpieczeństwo transferu P2P w LAN | pliki.vxh.pl',
      en: 'P2P transfer security on LAN | pliki.vxh.pl',
    },
    description: {
      pl: 'Pliki idą między urządzeniami w sieci lokalnej. Używaj zaufanej WiFi i znanych odbiorców.',
      en: 'Files go between devices on your LAN. Use trusted WiFi and known receivers.',
    },
    keywords: { pl: ['bezpieczeństwo', 'p2p', 'webrtc'], en: ['security', 'p2p', 'webrtc'] },
    h1: { pl: 'Bezpieczeństwo', en: 'Security' },
    sections: {
      pl: [{ title: 'Zaufana sieć', paragraphs: ['Publiczne WiFi może być monitorowane. w domu i biurze transfer jest bezpieczniejszy.'] }],
      en: [{ title: 'Trusted network', paragraphs: ['Public WiFi may be monitored. home and office networks are safer.'] }],
    },
  },
  {
    id: 'pwa-install',
    icon: 'pwa',
    plSlug: 'aplikacja-pwa',
    enSlug: 'pwa-install',
    title: {
      pl: 'Dodaj do ekranu: aplikacja PWA | pliki.vxh.pl',
      en: 'Add to Home Screen. PWA | pliki.vxh.pl',
    },
    description: {
      pl: 'Zainstaluj pliki.vxh.pl na telefonie: Safari → Udostępnij → Dodaj do ekranu początkowego.',
      en: 'Install pliki.vxh.pl on your phone: Safari → Share → Add to Home Screen.',
    },
    keywords: { pl: ['pwa', 'ekran początkowy', 'ios'], en: ['pwa', 'home screen', 'ios'] },
    h1: { pl: 'Aplikacja na ekranie', en: 'App on your home screen' },
    sections: {
      pl: [
        {
          title: 'Telefon (iOS)',
          paragraphs: [
            'Safari → Udostępnij → Dodaj do ekranu początkowego. PWA ma więcej miejsca na duże pliki i stabilniejszy odbiór niż zwykła karta.',
          ],
        },
        {
          title: 'Telefon (Android) i komputer',
          paragraphs: [
            'Android: menu Chrome → Zainstaluj aplikację. Windows/macOS: przycisk „Zainstaluj aplikację” w sekcji informacji na stronie (Chrome/Edge).',
          ],
        },
      ],
      en: [
        {
          title: 'Phone (iOS)',
          paragraphs: [
            'Safari → Share → Add to Home Screen. The PWA gets more storage for large files than a regular tab.',
          ],
        },
        {
          title: 'Android and desktop',
          paragraphs: [
            'Android: Chrome menu → Install app. Windows/macOS: “Install app” in the info section on the page (Chrome/Edge).',
          ],
        },
      ],
    },
  },
  {
    id: 'drag-drop',
    icon: 'drag',
    plSlug: 'przeciagnij-i-upusc',
    enSlug: 'drag-and-drop-send',
    title: {
      pl: 'Przeciągnij i upuść pliki (PC, PWA) | pliki.vxh.pl',
      en: 'Drag and drop files (desktop, PWA) | pliki.vxh.pl',
    },
    description: {
      pl: 'Wysyłaj pliki przeciągając je na kartę urządzenia lub upuszczając na stronie. Działa w przeglądarce na komputerze i w zainstalowanej PWA.',
      en: 'Send files by dragging onto a device card or dropping on the page. Works in the desktop browser and installed PWA.',
    },
    keywords: {
      pl: ['przeciągnij', 'drag drop', 'pwa', 'komputer'],
      en: ['drag', 'drop', 'pwa', 'desktop'],
    },
    h1: { pl: 'Przeciągnij i upuść pliki', en: 'Drag and drop to send' },
    sections: {
      pl: [
        {
          title: 'Jak wysłać',
          paragraphs: [
            'Gdy na liście jest jedno wolne urządzenie, upuść plik gdziekolwiek na podświetlonej strefie. Przy kilku urządzeniach upuść plik na wybraną kartę (nie na przyciemnione tło).',
            'Możesz też przeciągnąć pliki bezpośrednio na kartę urządzenia bez otwierania okna wyboru plików.',
          ],
        },
        {
          title: 'Wymagania',
          paragraphs: [
            'Ta sama sieć LAN, ustawiony nick i aktywne połączenie z serwisem. Urządzenie zajęte wysyłką lub odbiorem nie przyjmie kolejnego pliku od razu.',
          ],
        },
      ],
      en: [
        {
          title: 'How to send',
          paragraphs: [
            'With one available device, drop a file anywhere in the highlighted zone. With several devices, drop on the chosen card (not the dimmed backdrop).',
            'You can also drag files straight onto a device card without using the file picker.',
          ],
        },
        {
          title: 'Requirements',
          paragraphs: [
            'Same WiFi, a nickname set, and an online service connection. A busy device (sending or receiving) may reject another file until it finishes.',
          ],
        },
      ],
    },
  },
  {
    id: 'file-bundles',
    icon: 'bundle',
    plSlug: 'wiele-plikow-paczka',
    enSlug: 'multiple-files-bundle',
    title: {
      pl: 'Wiele plików naraz i paczki | pliki.vxh.pl',
      en: 'Multiple files and bundles | pliki.vxh.pl',
    },
    description: {
      pl: 'Wyślij wiele plików jednym transferem. Odbiorca widzi paczkę z listą, zapisem ZIP lub pojedynczymi plikami.',
      en: 'Send many files in one transfer. The receiver sees a bundle with a file list, ZIP download, or individual saves.',
    },
    keywords: {
      pl: ['wiele plików', 'paczka', 'zip', 'batch'],
      en: ['multiple files', 'bundle', 'zip', 'batch'],
    },
    h1: { pl: 'Wiele plików i paczki', en: 'Multiple files and bundles' },
    sections: {
      pl: [
        {
          title: 'Wysyłka',
          paragraphs: [
            'Przycisk „Wybierz pliki” pozwala zaznaczyć wiele pozycji. Postęp pokazuje numer pliku w partii. Anulowanie przerywa bieżącą wysyłkę.',
          ],
        },
        {
          title: 'Odbiór',
          paragraphs: [
            'Pliki z jednej partii grupują się w paczkę z liczbą plików i rozmiarem. Rozwiń listę, zapisz całość jako ZIP albo każdy plik osobno. Usuń całą paczkę jednym przyciskiem.',
          ],
        },
      ],
      en: [
        {
          title: 'Sending',
          paragraphs: [
            '“Choose files” accepts multiple items. Progress shows the file index in the batch. Cancel stops the current send.',
          ],
        },
        {
          title: 'Receiving',
          paragraphs: [
            'Files from one batch are grouped as a bundle with count and size. Expand the list, save as ZIP or individually, or remove the whole bundle at once.',
          ],
        },
      ],
    },
  },
  {
    id: 'camera-share',
    icon: 'camera',
    plSlug: 'udostepnianie-kamery-lan',
    enSlug: 'camera-share-lan',
    title: {
      pl: 'Udostępnianie kamery w LAN i OBS | pliki.vxh.pl',
      en: 'LAN camera share and OBS | pliki.vxh.pl',
    },
    description: {
      pl: 'Zakładka Camera: podgląd kamery na żywo w tej samej sieci LAN, bez chmury. Link do OBS Browser Source, PIN i widoczność w całej sieci.',
      en: 'Camera tab: live camera preview on the same LAN, no cloud. OBS Browser Source link, PIN, and visibility for everyone on the network.',
    },
    keywords: {
      pl: ['kamera lan', 'obs browser source', 'webrtc wideo', 'camera share', 'transmisja kamery'],
      en: ['camera lan', 'obs browser source', 'webrtc video', 'camera share', 'live camera'],
    },
    h1: {
      pl: 'Zakładka Camera: kamera w sieci lokalnej',
      en: 'Camera tab: live camera on your LAN',
    },
    cta: {
      href: '/camera',
      label: {
        pl: 'Otwórz zakładkę Camera',
        en: 'Open the Camera tab',
      },
      hint: {
        pl: 'Ta sama sieć WiFi/LAN. Kamera wymaga HTTPS lub localhost. Mikrofon opcjonalny.',
        en: 'Same WiFi/LAN. Camera requires HTTPS or localhost. Microphone optional.',
      },
    },
    sections: {
      pl: [
        {
          title: 'Pliki i Camera: dwie zakładki',
          paragraphs: [
            'Główna strona pliki.vxh.pl służy do wysyłania plików między urządzeniami w LAN. Zakładka Camera (u góry: Pliki | Camera) to osobna funkcja: podgląd kamery na żywo przez WebRTC, bez uploadu do chmury.',
            'Lista urządzeń w zakładce Camera jest oddzielona od listy w Pliki. Widzisz tylko urządzenia, które też otworzyły Camera w tej samej sieci LAN.',
          ],
        },
        {
          title: 'Jak udostępnić obraz',
          paragraphs: [
            'Na urządzeniu z kamerą (telefon, laptop) wejdź na /camera, zezwól na dostęp do kamery i wybierz odbiorcę z listy. Kliknij „Udostępnij" przy urządzeniu, na którym chcesz oglądać strumień. Mikrofon możesz włączyć przed startem lub w trakcie.',
            'Odbiorca widzi obraz z Twojej kamery. Przycisk „Odbij obraz" zmienia orientację u nadawcy i u odbiorcy jednocześnie. Po rozłączeniu strumienia interfejs wraca do stanu początkowego.',
          ],
        },
        {
          title: 'OBS Browser Source',
          paragraphs: [
            'W sekcji „Link OBS" wygeneruj URL i PIN. Wklej adres w OBS jako Browser Source (np. 1920×1080 lub rozmiar Auto dopasowany do kamery). OBS pojawi się na liście jako urządzenie OBS #1, widoczne dla każdego w tej samej sieci LAN, nawet jeśli to nie on wygenerował link.',
            'Link i PIN dla danej sieci nie wygasają: możesz zostawić ten sam URL w OBS na stałe. Przy udostępnianiu do OBS podaj PIN z ekranu lub skopiuj go prawym przyciskiem na stronie odbioru OBS.',
          ],
        },
        {
          title: 'Wymagania i jakość',
          paragraphs: [
            'Urządzenia muszą być w tej samej sieci WiFi/LAN (także Ethernet albo hotspot). Kamera wymaga HTTPS lub localhost. Jakość wideo jest ustawiana pod transfer lokalny (m.in. 1080p, wysoki bitrate WebRTC).',
            'To nie jest nagrywanie w chmurze ani publiczny stream: wideo idzie bezpośrednio między urządzeniami, serwer pomaga tylko przy połączeniu i liście peerów.',
          ],
        },
      ],
      en: [
        {
          title: 'Files and Camera: two tabs',
          paragraphs: [
            'The main pliki.vxh.pl page is for sending files between devices on your LAN. The Camera tab (top bar: Pliki | Camera) is a separate feature: live camera preview over WebRTC with no cloud upload.',
            'The device list in Camera is separate from Files. You only see peers that also opened Camera on the same LAN.',
          ],
        },
        {
          title: 'How to share video',
          paragraphs: [
            'On the device with a camera (phone, laptop), open /camera, allow camera access, and pick a receiver from the list. Tap “Share” on the device where you want to watch. You can enable the microphone before starting or during the stream.',
            'The receiver sees your camera feed. “Flip image” updates orientation for both sender and viewer. When the stream ends, the UI resets to the idle state.',
          ],
        },
        {
          title: 'OBS Browser Source',
          paragraphs: [
            'Under “OBS link”, generate a URL and PIN. Paste the URL in OBS as a Browser Source (e.g. 1920×1080 or Auto size matched to the camera). OBS shows up as OBS #1 on the device list, visible to everyone on the same LAN, even if they did not generate the link.',
            'The link and PIN for your network do not expire: you can keep the same URL in OBS permanently. When sharing to OBS, enter the PIN from the screen or copy it via right-click on the OBS receiver page.',
          ],
        },
        {
          title: 'Requirements and quality',
          paragraphs: [
            'Devices must be on the same WiFi/LAN (also Ethernet or hotspot). Camera access requires HTTPS or localhost. Video quality is tuned for local transfer (including 1080p and a high WebRTC bitrate).',
            'This is not cloud recording or a public stream: video goes directly between devices; the server only helps with signaling and the peer list.',
          ],
        },
      ],
    },
  },
];

export function getSlug(page: SeoPage, lang: SeoLang) {
  return lang === 'pl' ? page.plSlug : page.enSlug;
}

export function findPageBySlug(lang: SeoLang, slug: string): SeoPage | undefined {
  return SEO_PAGES.find((p) => (lang === 'pl' ? p.plSlug : p.enSlug) === slug);
}

export function getAlternateSlug(page: SeoPage, lang: SeoLang) {
  return lang === 'pl' ? page.enSlug : page.plSlug;
}

export function getAllStaticParams() {
  return SEO_PAGES.flatMap((page) => [
    { lang: 'pl' as const, slug: page.plSlug },
    { lang: 'en' as const, slug: page.enSlug },
  ]);
}

export function getHubLabels(lang: SeoLang) {
  return lang === 'pl'
    ? {
        title: 'Wyślij plik w WiFi bez aplikacji, poradniki | pliki.vxh.pl',
        description:
          'Przesyłaj pliki w LAN między telefonem a komputerem: wiele plików, przeciągnij i upuść, paczki, podgląd i PWA. Zakładka Camera: kamera na żywo i OBS. Poradniki krok po kroku.',
        h1: 'Poradniki: wysyłanie plików w sieci lokalnej',
        intro:
          'pliki.vxh.pl działa w przeglądarce w tej samej sieci LAN: wysyłka wielu plików, drag and drop na PC, paczki, podgląd, PWA oraz zakładka Camera (kamera w LAN i link do OBS). Wybierz temat poniżej lub uruchom aplikację.',
        openApp: 'Otwórz aplikację',
        allTopics: 'Wszystkie tematy',
        langSwitch: 'English version',
      }
    : {
        title: 'Send files on WiFi without an app, guides | pliki.vxh.pl',
        description:
          'LAN file transfer between phone and PC: multi-file send, drag and drop, bundles, previews, and PWA. Camera tab: live LAN video and OBS. Step-by-step guides.',
        h1: 'Guides: local network file transfer',
        intro:
          'pliki.vxh.pl runs in the browser on the same LAN: multi-file send, desktop drag and drop, bundles, previews, PWA, and the Camera tab (LAN video and OBS link). Pick a topic below or open the app.',
        openApp: 'Open the app',
        allTopics: 'All topics',
        langSwitch: 'Wersja polska',
      };
}

export function getHubFeatures(lang: SeoLang) {
  return lang === 'pl'
    ? {
        heading: 'Co potrafi aplikacja',
        items: [
          {
            icon: 'drag' as const,
            title: 'Przeciągnij i upuść',
            text: 'Na komputerze i w PWA: upuść plik na urządzenie lub na stronę.',
          },
          {
            icon: 'bundle' as const,
            title: 'Wiele plików i paczki',
            text: 'Jedna wysyłka, wiele plików. Odbiorca zapisuje paczkę lub ZIP.',
          },
          {
            icon: 'zip' as const,
            title: 'Podgląd ZIP',
            text: 'Lista plików w archiwum bez rozpakowywania.',
          },
          {
            icon: 'music' as const,
            title: 'Audio i wideo',
            text: 'Miniatura z falą, odtwarzacz i podgląd przed zapisem.',
          },
          {
            icon: 'pwa' as const,
            title: 'PWA',
            text: 'Dodaj do ekranu: więcej miejsca na duże pliki (Safari, Chrome).',
          },
          {
            icon: 'camera' as const,
            title: 'Zakładka Camera',
            text: 'Kamera na żywo w LAN, opcjonalny mikrofon i link do OBS Browser Source.',
          },
        ],
      }
    : {
        heading: 'What the app does',
        items: [
          {
            icon: 'drag' as const,
            title: 'Drag and drop',
            text: 'On desktop and PWA: drop onto a device or the page.',
          },
          {
            icon: 'bundle' as const,
            title: 'Multi-file bundles',
            text: 'One send, many files. Receiver saves a bundle or ZIP.',
          },
          {
            icon: 'zip' as const,
            title: 'ZIP preview',
            text: 'Browse archive contents without extracting.',
          },
          {
            icon: 'music' as const,
            title: 'Audio and video',
            text: 'Waveform thumb, player, and preview before save.',
          },
          {
            icon: 'pwa' as const,
            title: 'PWA',
            text: 'Add to Home Screen for more storage (Safari, Chrome).',
          },
          {
            icon: 'camera' as const,
            title: 'Camera tab',
            text: 'Live LAN camera, optional mic, and OBS Browser Source link.',
          },
        ],
      };
}
