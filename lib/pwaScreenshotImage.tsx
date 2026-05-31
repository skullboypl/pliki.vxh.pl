import { ImageResponse } from 'next/og';

type ScreenshotFormFactor = 'wide' | 'narrow';

/** Matches simplified PWA UI (body.is-pwa) — used for install store screenshots. */
const C = {
  bg: '#0a0a0a',
  panel: '#111111',
  border: '#1c1c1c',
  text: '#eeeeee',
  muted: '#666666',
  sub: '#555555',
  green: '#6cbe45',
  greenBtn: '#6cbe45',
  pillBg: '#142010',
  pillBorder: '#2a4020',
  avatarBg: '#1a1a1a',
  avatarBorder: '#252525',
};

function PeerCard({
  wide,
  name,
  device,
  showBtn,
}: {
  wide: boolean;
  name: string;
  device: string;
  showBtn?: boolean;
}) {
  const avatar = wide ? 48 : 42;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: wide ? 12 : 10,
        padding: wide ? 16 : 14,
        background: C.panel,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: avatar,
            height: avatar,
            borderRadius: 12,
            background: C.avatarBg,
            border: `1px solid ${C.avatarBorder}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: avatar * 0.45,
              height: avatar * 0.45,
              borderRadius: avatar * 0.45,
              background: C.green,
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
          <span style={{ color: C.text, fontSize: wide ? 17 : 16, fontWeight: 500 }}>{name}</span>
          <span style={{ color: C.sub, fontSize: wide ? 13 : 12 }}>{device}</span>
        </div>
        <div
          style={{
            width: wide ? 20 : 18,
            height: wide ? 16 : 14,
            borderRadius: 3,
            border: `2px solid ${C.sub}`,
          }}
        />
      </div>
      {showBtn ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: wide ? '14px 16px' : '13px 14px',
            borderRadius: 12,
            background: C.greenBtn,
            color: '#0a0a0a',
            fontSize: wide ? 16 : 15,
            fontWeight: 600,
          }}
        >
          <span style={{ fontSize: wide ? 18 : 17 }}>↑</span>
          <span>Wybierz pliki i wyślij</span>
        </div>
      ) : null}
    </div>
  );
}

/** PWA install UI screenshots — mirrors standalone app shell (not website chrome). */
export function renderAppScreenshot(formFactor: ScreenshotFormFactor) {
  const wide = formFactor === 'wide';
  const width = wide ? 1280 : 540;
  const height = 720;
  const pad = wide ? 48 : 16;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: C.bg,
          padding: `${wide ? 40 : 24}px ${pad}px ${wide ? 40 : 20}px`,
          fontFamily: 'system-ui, Segoe UI, Ubuntu, sans-serif',
        }}
      >
        {/* top-bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: wide ? 16 : 14,
          }}
        >
          <div style={{ display: 'flex', gap: 6, color: '#555', fontSize: wide ? 14 : 13 }}>
            <span style={{ color: '#fff' }}>PL</span>
            <span>|</span>
            <span>EN</span>
          </div>
          <span
            style={{
              fontSize: wide ? 12 : 11,
              padding: '4px 10px',
              borderRadius: 999,
              background: C.pillBg,
              color: C.green,
              border: `1px solid ${C.pillBorder}`,
            }}
          >
            Połączono
          </span>
        </div>

        {/* app-title (compact PWA header) */}
        <span
          style={{
            color: C.text,
            fontSize: wide ? 24 : 22,
            fontWeight: 500,
            marginBottom: wide ? 14 : 12,
          }}
        >
          Wyślij plik
        </span>

        {/* you-block (compact) */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '4px 10px',
            padding: wide ? '10px 14px' : '10px 12px',
            marginBottom: wide ? 18 : 16,
            background: C.panel,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
          }}
        >
          <span style={{ color: C.muted, fontSize: wide ? 13 : 12 }}>Jesteś w sieci jako</span>
          <span style={{ color: C.text, fontSize: wide ? 17 : 16, fontWeight: 500, flex: 1 }}>
            Zielony Pingwin
          </span>
          <span style={{ color: C.green, fontSize: wide ? 14 : 13, textDecoration: 'underline' }}>
            Zmień imię
          </span>
        </div>

        {/* devices */}
        <span
          style={{
            color: '#dddddd',
            fontSize: wide ? 16 : 15,
            fontWeight: 500,
            marginBottom: wide ? 10 : 8,
          }}
        >
          Urządzenia w sieci
        </span>

        <div style={{ display: 'flex', flexDirection: 'column', gap: wide ? 10 : 8, flex: 1 }}>
          <PeerCard wide={wide} name="Szybki Lis" device="Telefon" showBtn />
          {wide ? <PeerCard wide={wide} name="Mądry Borsuk" device="Komputer" /> : null}
        </div>

        {/* downloads heading (PWA — no hint text) */}
        <span
          style={{
            color: '#dddddd',
            fontSize: wide ? 16 : 15,
            fontWeight: 500,
            marginTop: wide ? 20 : 16,
          }}
        >
          Odebrane pliki
        </span>
      </div>
    ),
    { width, height },
  );
}

export const PWA_SCREENSHOT_SPECS = {
  wide: { width: 1280, height: 720, path: '/screenshot-wide' },
  narrow: { width: 540, height: 720, path: '/screenshot-narrow' },
} as const;
