import { ImageResponse } from 'next/og';

export const size = {
  width: 180,
  height: 180,
};

export const contentType = 'image/png';

function LinhaCashMark() {
  return (
    <svg width="66%" height="66%" viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <path
        d="M14 78 L14 28 C14 24 17 21 21 21 H26 C30 21 33 24 33 28 V57 H42 V38 C42 34 45 31 49 31 H54 C58 31 61 34 61 38 V57 H70 V19 C70 15 73 12 77 12 H82 C86 12 89 15 89 19 V63 C89 67 86 70 82 70 H21 C17 70 14 74 14 78Z"
        fill="#00E676"
      />
      <path
        d="M16 78 L84 10"
        stroke="#00E676"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path d="M66 10 H84 V28" stroke="#00E676" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#000000',
        }}
      >
        <LinhaCashMark />
      </div>
    ),
    {
      ...size,
    }
  );
}
