import { ImageResponse } from 'next/og';

export const contentType = 'image/png';

const ICON_SIZES = [
  { id: '32', size: { width: 32, height: 32 } },
  { id: '48', size: { width: 48, height: 48 } },
  { id: '192', size: { width: 192, height: 192 } },
  { id: '512', size: { width: 512, height: 512 } },
] as const;

export function generateImageMetadata() {
  return ICON_SIZES.map(({ id, size }) => ({
    id,
    size,
    contentType,
  }));
}

function LinhaCashMark() {
  return (
    <svg width="68%" height="68%" viewBox="0 0 100 100" fill="none" aria-hidden="true">
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

export default async function Icon({ id }: { id: Promise<string> }) {
  const resolvedId = await id;
  const iconConfig = ICON_SIZES.find((entry) => entry.id === resolvedId) ?? ICON_SIZES[0];
  const { width, height } = iconConfig.size;

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
      width,
      height,
    }
  );
}
