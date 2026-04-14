export const runtime = 'nodejs';

export async function GET() {
  return Response.json(
    {
      status: 'ok',
      service: 'linhacash-api',
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}
