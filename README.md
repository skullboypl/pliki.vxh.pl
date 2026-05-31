# pliki.vxh.pl

**Send files on the same WiFi — no cloud, no account.**

[English](#english) · [Polski](#polski)

---

<a id="english"></a>

## English

**pliki.vxh.pl** is a lightweight web app for sending files between phones, tablets, and computers on the same local network. Data travels **directly between devices** over **WebRTC**. The server only handles **Socket.io** signaling — files never pass through the backend.

**Live:** [https://pliki.vxh.pl](https://pliki.vxh.pl)

### Web app

![pliki.vxh.pl — web app (English UI)](docs/assets/WEBEN.png)

![pliki.vxh.pl — aplikacja web (interfejs PL)](docs/assets/WEBPL.png)

### Features

**P2P transfer on LAN**  
Open the site on two devices on the same WiFi, pick a receiver, and send one or many files in a row.

**Paste & quick send**  
Paste text or an image from the clipboard into the inline field under each device — no extra dialogs.

**Text notes**  
Send short messages as `.txt` files with a readable preview (Markdown & HTML rendering, copy to clipboard).

**Received files**  
Thumbnails for images, video, and text. Preview with Video.js for video. Download single files, whole bundles, or a **ZIP** of a batch.

**No login, no cloud**  
No account. No third-party file storage.

**PWA**  
Install to your home screen for a focused, app-like UI (recommended on iPhone via Safari).

![pliki.vxh.pl — PWA standalone (English)](docs/assets/PWAEN.png)

![pliki.vxh.pl — PWA standalone (Polski)](docs/assets/PWAPL.png)

**SEO guides**  
Static help pages in Polish and English at `/pl` and `/en`.

**Share the app**  
Quick share via WhatsApp, Telegram, X, email, or copy link.

### How it works

1. Open [pliki.vxh.pl](https://pliki.vxh.pl) on two devices on the **same WiFi**.
2. Devices on the network appear under **Devices on the network**.
3. Tap the green button to pick files, or paste text/image into the field below.
4. On the other device, files show up under **Received files**.

### Local development

Requirements: **Node.js 22+**, **pnpm 10+**

```bash
pnpm install
pnpm dev
```

App URL: `http://localhost:3000`

Production build locally:

```bash
pnpm build
pnpm start
```

### Production (CapRover)

1. Create an app in CapRover.
2. Enable **WebSocket Support** in HTTP Settings.
3. Deploy this repo (`Dockerfile` + `captain-definition`).
4. Container port: **80**.

Copy `.env.example` → `.env` for local dev (`.env` is gitignored).

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `80` (Docker) / `3000` (dev) | Listen port |
| `HOSTNAME` | `0.0.0.0` | Bind address |
| `NEXT_PUBLIC_SITE_URL` | `https://pliki.vxh.pl` | Canonical URL |
| `VISIT_DATA_DIR` | `data/` / `/app/data` | Visit counter file directory |

### Visit counter persistence

Counter data lives in `visits.json`. Mount persistent storage at **`/app/data`** in CapRover (**Has Persistent Data** → Persistent Directories).

### Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 15, React 19 |
| File transfer | WebRTC DataChannels |
| Signaling | Socket.io (`server.js`) |
| Video preview | Video.js |
| Deploy | Docker, CapRover |

### Project layout

```
app/              Next.js routes (app + SEO)
components/       UI
lib/              WebRTC, PWA, notes, bundles, SEO
server.js         Next.js + Socket.io + API
server/           Visit counter, service worker
docs/assets/      README screenshots (WEB*.png, PWA*.png)
styles/           CSS
```

### Known limitations

On **iPhone / mobile**, receiving very large files may hit browser memory limits. Prefer Safari, install as PWA, and receive huge videos on a desktop when possible.

### Security

Files go device-to-device on the LAN. The server does not store transferred content. Signaling groups peers by public IP (same network).

### License

[MIT](LICENSE) · © 2026 [skullmedia.pl](https://skullmedia.pl)

---

<a id="polski"></a>

## Polski

**Szybkie wysyłanie plików w tej samej sieci WiFi — bez chmury, bez konta.**

**pliki.vxh.pl** to lekka aplikacja webowa do transferu plików między telefonem, tabletem i komputerem w sieci lokalnej. Pliki lecą **bezpośrednio między urządzeniami** przez **WebRTC**. Serwer obsługuje tylko sygnalizację **Socket.io** — pliki **nie przechodzą** przez backend.

**Strona:** [https://pliki.vxh.pl](https://pliki.vxh.pl)

### Aplikacja web

![pliki.vxh.pl — web app (English UI)](docs/assets/WEBEN.png)

![pliki.vxh.pl — aplikacja web (interfejs PL)](docs/assets/WEBPL.png)

### Funkcje

**Transfer P2P w LAN**  
Wejdź na stronę na dwóch urządzeniach w tej samej WiFi, wybierz odbiorcę i wyślij jeden lub wiele plików.

**Wklejka i szybkie wysyłanie**  
Pole pod urządzeniem: wklej tekst lub obraz ze schowka — bez dodatkowych okien.

**Notatki tekstowe**  
Krótkie wiadomości jako `.txt` z podglądem (Markdown i HTML), kopiowaniem treści do schowka.

**Odebrane pliki**  
Miniaturki obrazów, wideo i tekstu. Podgląd wideo przez Video.js. Pobieranie pojedynczo, całej paczki albo **ZIP** z wielu plików.

**Bez logowania i chmury**  
Bez konta i zewnętrznego storage.

**PWA**  
Dodaj do ekranu początkowego — uproszczony interfejs jak aplikacja (na iPhone: Safari → Udostępnij → Dodaj do ekranu początkowego).

![pliki.vxh.pl — PWA standalone (English)](docs/assets/PWAEN.png)

![pliki.vxh.pl — PWA standalone (Polski)](docs/assets/PWAPL.png)

**Poradniki SEO**  
Statyczne strony PL/EN pod `/pl` i `/en`.

**Udostępnianie**  
WhatsApp, Telegram, X, e-mail, kopiuj link.

### Jak to działa

1. Otwórz [pliki.vxh.pl](https://pliki.vxh.pl) na dwóch urządzeniach w **tej samej WiFi**.
2. Urządzenia pojawią się w **Urządzenia w sieci**.
3. Zielony przycisk → wybór plików, albo wklejka w polu poniżej.
4. Na drugim urządzeniu pliki trafiają do **Odebrane pliki**.

### Uruchomienie lokalne

Wymagania: **Node.js 22+**, **pnpm 10+**

```bash
pnpm install
pnpm dev
```

Adres: `http://localhost:3000`

Tryb produkcyjny lokalnie:

```bash
pnpm build
pnpm start
```

### Produkcja (CapRover)

1. Utwórz aplikację w CapRover.
2. Włącz **WebSocket Support** w HTTP Settings.
3. Wdróż repozytorium (`Dockerfile`, `captain-definition`).
4. Port kontenera: **80**.

Lokalnie: `.env.example` → `.env` (`.env` jest w gitignore).

| Zmienna | Domyślnie | Opis |
|---------|-----------|------|
| `PORT` | `80` / `3000` | Port |
| `HOSTNAME` | `0.0.0.0` | Bind |
| `NEXT_PUBLIC_SITE_URL` | `https://pliki.vxh.pl` | URL kanoniczny |
| `VISIT_DATA_DIR` | `data/` / `/app/data` | Katalog licznika odwiedzin |

### Licznik odwiedzin — persistence

Dane w `visits.json`. W CapRover zamontuj wolumen na **`/app/data`** (Has Persistent Data → Persistent Directories).

### Stack

| Warstwa | Technologia |
|---------|-------------|
| Frontend | Next.js 15, React 19 |
| Transfer | WebRTC DataChannels |
| Sygnalizacja | Socket.io (`server.js`) |
| Wideo | Video.js |
| Deploy | Docker, CapRover |

### Struktura

```
app/              Trasy Next.js
components/       UI
lib/              WebRTC, PWA, notatki, paczki, SEO
server.js         Next.js + Socket.io
server/           Licznik, service worker
docs/assets/      Zrzuty do README (WEB*.png, PWA*.png)
styles/           CSS
```

### Znane ograniczenia

Na **iPhone / telefonie** bardzo duże pliki przy odbiorze mogą przekroczyć limity pamięci przeglądarki. Safari + PWA pomaga; duże wideo lepiej odbierać na komputerze.

### Bezpieczeństwo

Pliki tylko między urządzeniami w LAN. Serwer nie przechowuje przesyłanych plików. Sygnalizacja grupuje peerów po publicznym IP (ta sama sieć).

### Licencja

[MIT](LICENSE) · © 2026 [skullmedia.pl](https://skullmedia.pl)
