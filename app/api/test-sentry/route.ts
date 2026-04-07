import * as Sentry from '@sentry/nextjs';

export async function GET() {
  try {
    throw new Error('LinhaCash Sentry verification test');
  } catch (error) {
    Sentry.captureException(error);
  }

  return new Response('Sentry test event sent.', {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
