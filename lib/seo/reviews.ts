import type { SeoLang } from '@/lib/seo/site';

export type ReviewItem = {
  id: string;
  rating: number;
  author: string;
  role: string;
  device: string;
  date: string;
  quote: Record<SeoLang, string>;
  highlight?: Record<SeoLang, string>;
};

export const REVIEWS: ReviewItem[] = [
  {
    id: 'r1',
    rating: 5,
    author: 'Marta K.',
    role: 'grafik',
    device: 'iPhone → Mac',
    date: '2026-04',
    highlight: { pl: 'Mockupy na Maca', en: 'Mockups to Mac' },
    quote: {
      pl: 'Słuchajcie, hit. Siedzę u klienta, on ze swoim Makiem, ja tylko z telefonem. Musiałam mu podrzucić ciężką paczkę PSD. Zamiast bawić się w podpinanie pod jego chmurę czy szukanie pendrive\'a, odpaliłam to w biurowym WiFi i pliki po prostu przeleciały w sekundy. Bez żadnego: „czekaj, generuje się link”. No bajka.',
      en: 'Okay this is a win. I\'m at a client\'s, they\'ve got a Mac, I only have my phone. Had to send a heavy PSD bundle. Instead of messing with their cloud or hunting for a USB stick, I opened this on office WiFi and the files just flew over. No “hold on, generating the link”. Love it.',
    },
  },
  {
    id: 'r2',
    rating: 5,
    author: 'Tomek W.',
    role: 'student',
    device: 'Android → laptop',
    date: '2026-03',
    highlight: { pl: 'Nagrania z wykładu', en: 'Lecture recordings' },
    quote: {
      pl: 'Kumpel zaspał na wykład, więc nagrałem mu całość telefonem. Plik ważył tonę, ale po wykładzie usiedliśmy w akademiku, ta sama sieć i pyk – zrzuciłem mu to na laptopa dosłownie w moment. Najlepsze, że nikt nie musiał nic instalować ani zakładać kont.',
      en: 'My mate overslept the lecture so I recorded the whole thing on my phone. File was huge, but after class we sat in the dorm, same network, boom – dropped it on his laptop in no time. Best part: nobody installed anything or made an account.',
    },
  },
  {
    id: 'r3',
    rating: 5,
    author: 'Ania R.',
    role: 'mama',
    device: 'iPhone → iPad',
    date: '2026-02',
    highlight: { pl: 'Zdjęcia dzieci', en: 'Kids photos' },
    quote: {
      pl: 'Mam już serdecznie dość komunikatów, że skończyło mi się miejsce w iCloud przez miliard zdjęć z placu zabaw. Teraz po prostu przerzucam wszystko hurtowo na iPada i mam spokój. Super jest to, że jak zamykam kartę, to na tablecie nie zostaje żaden śmietnik w pobranych.',
      en: 'I\'m so done with “iCloud full” because of a billion playground photos. Now I just bulk-move everything to the iPad and I\'m fine. Closing the tab means no junk left in Downloads on the tablet.',
    },
  },
  {
    id: 'r4',
    rating: 4,
    author: 'Piotr J.',
    role: 'IT',
    device: 'PC → PC',
    date: '2026-01',
    highlight: { pl: 'Logi w biurze', en: 'Office logs' },
    quote: {
      pl: 'Do szybkiego przerzucania zipów z logami między kompami w biurze nic więcej mi nie trzeba. Mega opcją jest to, że mogę podejrzeć zawartość ZIP-a bez rozpakowywania całego archiwum – oszczędza mi to masę czasu. Jedyny minus: no, trzeba pilnować, żeby oba kompy były w tej samej podsieci.',
      en: 'All I need for shoving log zips between office PCs. Being able to peek inside a ZIP without unpacking the whole thing saves me loads of time. Only catch: both machines really need to be on the same subnet.',
    },
  },
  {
    id: 'r5',
    rating: 5,
    author: 'Kasia L.',
    role: 'montaż wideo',
    device: 'iPhone (Safari PWA)',
    date: '2025-12',
    highlight: { pl: 'Duże klipy', en: 'Big clips' },
    quote: {
      pl: 'Na iPhonie w Chromie wiecznie mi rwało transfery przy dużych plikach .MOV. Dodałam sobie tę stronę jako PWA (ikonę na ekranie głównym) przez Safari i w końcu ruszyło, odbieram całe materiały bez błędu. Nie mam pojęcia, jak to działa od strony technicznej, ale działa i ratuje mi tyłek.',
      en: 'On iPhone Chrome kept killing big .MOV transfers. Added the site to Home Screen via Safari and it finally works – I get full files, no error. No clue how it works technically, but it saves my butt.',
    },
  },
  {
    id: 'r6',
    rating: 5,
    author: 'Olek S.',
    role: 'muzyk',
    device: 'laptop → telefon',
    date: '2025-11',
    highlight: { pl: 'WAV przed koncertem', en: 'WAV before gig' },
    quote: {
      pl: 'Zrzucam podkład na telefon i przed samym wyjściem na scenę odsłuchuję go jeszcze w podglądzie, żeby upewnić się, że to dobra aranżacja. Dopiero jak kliknę „zapisz”, ląduje w pamięci. Raz w pośpiechu puściłem złą wersję i wolę potrójnie dmuchać na zimne.',
      en: 'I drop the backing track on my phone and right before going on I preview it to make sure it\'s the right arrangement. Only when I hit save does it stick. Once sent the wrong take in a rush – I triple-check now.',
    },
  },
  {
    id: 'r7',
    rating: 4,
    author: 'Ewa M.',
    role: 'księgowa',
    device: 'tablet → PC',
    date: '2025-10',
    highlight: { pl: 'Skany na PC', en: 'Scans to PC' },
    quote: {
      pl: 'Skanuję fakturę tabletem i sekunda – jest już na moim komputerze stacjonarnym. Koniec z wysyłaniem maili do samej siebie z tematem „asdasd” albo czekaniem, aż Dysk Google raczy się zsynchronizować. No, czasem muszę odświeżyć stronę, jak zgubi połączenie, ale i tak jest szybciej.',
      en: 'I scan an invoice on the tablet and boom – it\'s on my desktop. No more emailing myself with subject “asdasd” or waiting for Google Drive to wake up. Yeah, sometimes I refresh when it loses the other device, still faster.',
    },
  },
  {
    id: 'r8',
    rating: 5,
    author: 'Michał D.',
    role: 'fotograf',
    device: 'Android → Mac',
    date: '2025-09',
    highlight: { pl: 'Selekcja na planie', en: 'On-set selects' },
    quote: {
      pl: 'Klient na planie stoi mi nad głową i chce „na już” zobaczyć pierwsze strzały. Zamiast szukać kabla w torbie, zaznaczam paczkę JPEG-ów i leci prosto na jego Maca. On widzi pasek postępu, więc nie marudzi i wie, że się zgrywa. Ja mam święty spokój.',
      en: 'Client on set breathing down my neck wants selects “right now”. Instead of digging for a cable I send a JPEG bundle straight to their Mac. They see the progress bar so they know it\'s copying. Peace for me.',
    },
  },
  {
    id: 'r9',
    rating: 4,
    author: 'Julia P.',
    role: 'UX',
    device: 'Mac → iPhone',
    date: '2025-08',
    highlight: { pl: 'Prototyp na telefon', en: 'Proto on phone' },
    quote: {
      pl: 'Warsztaty u klienta: oni pracują na Windowsie, ja na Macu, a testujemy na iPhonie. AirDrop leży i kwiczy w takim setupie. Tutaj wystarczyło, że złapaliśmy to samo WiFi. Raz nas rozłączyło, ale szybki F5 i poszło dalej.',
      en: 'Client workshop: they\'re on Windows, I\'m on Mac, we test on iPhone. AirDrop is useless there. Same WiFi was enough. Dropped once, quick F5 and we were good.',
    },
  },
  {
    id: 'r10',
    rating: 5,
    author: 'Rafał G.',
    role: 'programista',
    device: 'PC (PWA)',
    date: '2025-07',
    highlight: { pl: 'Build na telefon', en: 'Build to phone' },
    quote: {
      pl: 'Zamiast tworzyć kolejny dedykowany kanał na Slacku tylko po to, żeby wysłać testerce plik instalacyjny (.apk), po prostu przeciągam build z mojego Windowsa na jej kartę w przeglądarce. Szybko, czysto i bez śmiecenia w komunikatorach.',
      en: 'Instead of making another Slack channel just to send the tester an .apk, I drag the build from my Windows machine onto her card in the browser. Quick, clean, no chat clutter.',
    },
  },
  {
    id: 'r11',
    rating: 5,
    author: 'Nina T.',
    role: 'nauczycielka',
    device: 'laptop → tablety',
    date: '2025-06',
    highlight: { pl: 'PDF na lekcję', en: 'PDF for class' },
    quote: {
      pl: 'Wchodzę do klasy, dzieciaki odpalają szkolne tablety, mówię im tylko: „wejdźcie na tę stronę” i w sekundę mają u siebie PDF-a z zadaniami. Zero tłumaczenia jak coś zainstalować, zero logowania. Przy trzydziestu 10-latkach to ratuje moje zdrowie psychiczne.',
      en: 'I walk in, kids open school tablets, I say “go to this page” and they have the assignment PDF in seconds. No install talk, no login. With thirty 10-year-olds that saves my sanity.',
    },
  },
  {
    id: 'r12',
    rating: 5,
    author: 'Damian H.',
    role: 'freelancer',
    device: 'różne',
    date: '2025-05',
    highlight: { pl: 'Spotkanie z klientem', en: 'Client meeting' },
    quote: {
      pl: 'Zamiast wrzucać prezentacje na Drive\'a i czekać na wygenerowanie linku (i liczyć, że klient ma uprawnienia), puszczam pliki lokalnie w trakcie rozmowy. Siedzimy w jednej salce, wszystko leci przez LAN. Klient ma pliki od razu, a ja nie muszę pytać: „i jak, doszedł mail?”.',
      en: 'Instead of uploading decks to Drive and praying the link works (and permissions), I send files locally during the meeting. Same room, over LAN. Client has files now, I don\'t ask “so… did the email land?”.',
    },
  },
  {
    id: 'r13',
    rating: 5,
    author: 'Kuba N.',
    role: 'uczeń liceum',
    device: 'telefon → telefon',
    date: '2025-04',
    highlight: { pl: 'Memy i wideo', en: 'Memes and clips' },
    quote: {
      pl: 'Mój brat ma iPhone\'a, ja Androida, więc wiecznie był problem z przesyłaniem czegokolwiek. Teraz w domu na tym samym WiFi ciskamy sobie długie filmiki i memy. Nic nie traci na jakości przez kompresję na Messengerze czy WhatsAppie. Ojciec się śmieje, że zrobiliśmy sobie własny internet.',
      en: 'Brother\'s on iPhone, I\'m on Android, sending stuff was always a pain. Now at home on the same WiFi we chuck long videos and memes at each other. No Messenger/WhatsApp crush. Dad says we built our own internet.',
    },
  },
  {
    id: 'r14',
    rating: 5,
    author: 'Irena W.',
    role: 'emerytka',
    device: 'telefon → laptop',
    date: '2025-03',
    highlight: { pl: 'Zdjęcia na laptop syna', en: 'Photos to son\'s laptop' },
    quote: {
      pl: 'Sama bym tego nie wymyśliła, wnuczek mi pokazał! Jak przyjeżdżam w odwiedziny, to zdjęcia z telefonu zgrywam na laptopa syna przez przeglądarkę. Bardzo to proste, po prostu wchodzi się na stronę, tylko trzeba pamiętać, żeby być połączonym z tym samym domowym internetem.',
      en: 'Wouldn\'t have figured it out alone, my grandson showed me. When I visit I move photos from my phone to my son\'s laptop in the browser. Dead simple – open the page, just be on the same home WiFi.',
    },
  },
  {
    id: 'r15',
    rating: 5,
    author: 'Krzysztof B.',
    role: 'kierownik budowy',
    device: 'tablet → smartfon',
    date: '2026-05',
    highlight: { pl: 'Plany na budowie', en: 'Site plans' },
    quote: {
      pl: 'Sytuacja z wczoraj: stoimy na budowie, inwestor nagle zmienia zdanie co do ścianki. Mam poprawiony rzut w PDF-ie na tablecie, a podwykonawca ma tylko stary telefon z Androidem. Udostępniłem mu neta z mojego telefonu, weszliśmy na stronę i rzuciłem mu ten plik bezpośrednio na ekran. Bez szukania zasięgu do wysyłania maili w szczerym polu.',
      en: 'Yesterday on site: investor changes their mind about a wall. I\'ve got the revised PDF on my tablet, subcontractor has an old Android. I shared hotspot from my phone, opened the page, sent the file to his screen. No hunting signal in a field to email it.',
    },
  },
  {
    id: 'r16',
    rating: 5,
    author: 'Magda W.',
    role: 'copywriter',
    device: 'Mac → PC',
    date: '2026-05',
    highlight: { pl: 'Praca w pociągu', en: 'Train work' },
    quote: {
      pl: 'Często pracuję w podróży. Ja na MacBooku, kolega z teamu na ThinkPadzie. Udostępniam hotspot z telefonu dla nas obu i normalnie przerzucamy między sobą paczki z tekstami i grafikami przez przeglądarkę. Działa to mega stabilnie, nawet jak pociąg jedzie przez las i sieć komórkowa prawie nie istnieje, bo transfer idzie lokalnie.',
      en: 'I work on trains a lot. Me on MacBook, teammate on ThinkPad. I share phone hotspot for both of us and we swap text and image bundles in the browser. Stays solid even through forest stretches – transfer is local, not up to patchy mobile.',
    },
  },
  {
    id: 'r17',
    rating: 5,
    author: 'Łukasz T.',
    role: 'vlogger',
    device: 'telefon → laptop',
    date: '2026-04',
    highlight: { pl: 'Surówki w hotelu', en: 'Hotel offload' },
    quote: {
      pl: 'W hotelu na wyjeździe zgrywam surówki wideo z telefonu na laptopa, żeby zwolnić miejsce na kartach. Hotelowe WiFi potrafi być koszmarne, jeśli chodzi o wysyłanie czegokolwiek w chmurę, ale lokalnie między urządzeniami śmiga aż miło. Nie muszę wyciągać hubów i kabli USB-C.',
      en: 'On trips I dump video rushes from phone to laptop to free card space. Hotel WiFi is awful for cloud uploads but device-to-device locally is smooth. No USB-C hubs and cables.',
    },
  },
  {
    id: 'r18',
    rating: 5,
    author: 'Kamil S.',
    role: 'właściciel restauracji',
    device: 'PC → tablet',
    date: '2026-04',
    highlight: { pl: 'Menu przed otwarciem', en: 'Menu before open' },
    quote: {
      pl: 'Zmieniły się ceny i składniki w menu, a managerka na sali musiała pilnie zaktualizować tablety kelnerskie przed otwarciem lokalu. Zamiast biegać z pendrive\'em do każdego urządzenia, wrzuciłem pliki konfiguracyjne ze stacjonarnego komputera z zaplecza prosto na tablety podpięte pod naszą sieć gastro. Pięć minut i po krzyku.',
      en: 'Prices and ingredients changed and the floor manager had to update waiter tablets before opening. Instead of running with a USB stick to each device I pushed config files from the back-office PC to tablets on our restaurant LAN. Five minutes, done.',
    },
  },
  {
    id: 'r19',
    rating: 5,
    author: 'Karolina D.',
    role: 'bookstagramerka',
    device: 'telefon → czytnik',
    date: '2026-03',
    highlight: { pl: 'Ebook na czytnik', en: 'Ebook to ereader' },
    quote: {
      pl: 'Kupiłam nowego ebooka na telefonie i chciałam go od razu wrzucić na czytnik z Androidem. Zamiast logować się na pocztę przez tę toporną przeglądarkę w czytniku, odpaliłam tę stronę na obu urządzeniach i po prostu przeciągnęłam plik .epub. Najwygodniejszy sposób na świecie.',
      en: 'Bought an ebook on my phone and wanted it on my Android ereader right away. Instead of fighting the ereader\'s mail browser I opened the page on both and dragged the .epub. Easiest way I\'ve tried.',
    },
  },
  {
    id: 'r20',
    rating: 5,
    author: 'dr inż. Andrzej K.',
    role: 'wykładowca',
    device: 'Mac → PC',
    date: '2026-02',
    highlight: { pl: 'Prezentacja na mównicę', en: 'Deck to lectern PC' },
    quote: {
      pl: 'Prelegenci na konferencjach wiecznie biegają z zawirusowanymi pendrive\'ami do komputera na mównicy. Ja podszedłem, połączyłem się z tą samą siecią konferencyjną i wrzuciłem moją prezentację w Keynote prosto do komputera technicznego przez przeglądarkę. Szybko, nowocześnie i bez strachu, że złapię jakiegoś złośliwego softu.',
      en: 'Speakers still run around with sketchy USB sticks for the lectern PC. I joined the conference WiFi and sent my Keynote deck to the tech laptop in the browser. Fast, modern, no fear of random malware.',
    },
  },
];

export function getReviewsAggregate() {
  const count = REVIEWS.length;
  const sum = REVIEWS.reduce((a, r) => a + r.rating, 0);
  const average = Math.round((sum / count) * 10) / 10;
  const five = REVIEWS.filter((r) => r.rating === 5).length;
  const four = REVIEWS.filter((r) => r.rating === 4).length;
  return { count, average, five, four };
}

export function getReviewsCopy(lang: SeoLang) {
  const agg = getReviewsAggregate();
  const starsBreakdown =
    lang === 'pl'
      ? `${agg.five}× ocena 5★${agg.four ? `, ${agg.four}× 4★` : ''}`
      : `${agg.five}× 5★${agg.four ? `, ${agg.four}× 4★` : ''}`;

  return lang === 'pl'
    ? {
        metaTitle: 'Opinie użytkowników pliki.vxh.pl',
        metaDescription: `Ocena ${agg.average}/5 na podstawie ${agg.count} opinii. Jak ludzie używają pliki.vxh.pl do wysyłki plików w WiFi bez aplikacji i chmury.`,
        h1: 'Opinie o pliki.vxh.pl',
        lead: `Średnia ${agg.average}/5 · ${agg.count} opinii (${starsBreakdown}). Luźne historie z domu, biura, szkoły, budowy i podróży.`,
        aggregateLabel: 'Średnia ocena',
        reviewsLabel: 'opinii',
        fiveStars: 'ocen 5★',
        openApp: 'Wypróbuj aplikację',
        openAppHint: 'Ta sama WiFi na dwóch urządzeniach.',
        allGuides: 'Poradniki',
        filterAll: 'Wszystkie',
        filterStars: '{n} gwiazdek',
        sortNewest: 'Najnowsze',
        sortRating: 'Najwyższa ocena',
        empty: 'Brak opinii dla tego filtra.',
        breadcrumb: 'Opinie',
      }
    : {
        metaTitle: 'pliki.vxh.pl user reviews',
        metaDescription: `Rated ${agg.average}/5 from ${agg.count} reviews. How people use pliki.vxh.pl to send files on WiFi without an app or cloud.`,
        h1: 'Reviews of pliki.vxh.pl',
        lead: `Average ${agg.average}/5 · ${agg.count} reviews (${starsBreakdown}). Stories from home, work, school, job sites, and travel.`,
        aggregateLabel: 'Average rating',
        reviewsLabel: 'reviews',
        fiveStars: '5★ ratings',
        openApp: 'Try the app',
        openAppHint: 'Same WiFi on two devices.',
        allGuides: 'Guides',
        filterAll: 'All',
        filterStars: '{n} stars',
        sortNewest: 'Newest',
        sortRating: 'Highest rating',
        empty: 'No reviews for this filter.',
        breadcrumb: 'Reviews',
      };
}

export function reviewsUrl(lang: SeoLang) {
  return lang === 'pl' ? '/reviews' : '/en/reviews';
}
