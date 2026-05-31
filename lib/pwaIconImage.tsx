import { ImageResponse } from 'next/og';

type IconSize = 180 | 192 | 512;

/** PNG renderer matching public/icon.svg — used for PWA manifest + apple touch. */
export function renderAppIcon(size: IconSize) {
  const s = size / 512;
  const radius = Math.round(96 * s);
  const barH = Math.round(48 * s);
  const bar1W = Math.round(192 * s);
  const bar2W = Math.round(144 * s);
  const bar3W = Math.round(192 * s);
  const barLeft = Math.round(160 * s);
  const bar1Top = Math.round(176 * s);
  const bar2Top = Math.round(272 * s);
  const bar3Top = Math.round(368 * s);
  const dotSize = Math.round(112 * s);
  const dotLeft = Math.round(344 * s);
  const dotTop = Math.round(312 * s);
  const plus = Math.round(48 * s);
  const plusStroke = Math.max(2, Math.round(12 * s));

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: 'flex',
          position: 'relative',
          background: '#131313',
          borderRadius: radius,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: barLeft,
            top: bar1Top,
            width: bar1W,
            height: barH,
            background: '#77d34c',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: barLeft,
            top: bar2Top,
            width: bar2W,
            height: barH,
            background: '#77d34c',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: barLeft,
            top: bar3Top,
            width: bar3W,
            height: barH,
            background: '#77d34c',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: dotLeft,
            top: dotTop,
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize,
            background: '#6cbe45',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: plus,
              height: plusStroke,
              background: '#131313',
              position: 'absolute',
            }}
          />
          <div
            style={{
              width: plusStroke,
              height: plus,
              background: '#131313',
              position: 'absolute',
            }}
          />
        </div>
      </div>
    ),
    { width: size, height: size }
  );
}

export const PWA_ICON_SIZES = [192, 512] as const;
