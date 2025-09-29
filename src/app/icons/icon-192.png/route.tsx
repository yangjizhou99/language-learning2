import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET() {
  const size = 192;
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#2563eb',
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


