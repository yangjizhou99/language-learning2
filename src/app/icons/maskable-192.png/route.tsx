import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET() {
  const size = 192;
  const radius = Math.round(size * 0.18);
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#2563eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius,
          color: 'white',
          fontSize: size * 0.42,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          fontFamily: 'system-ui, Arial, sans-serif',
        }}
      >
        LT
      </div>
    ),
    { width: size, height: size },
  );
}


