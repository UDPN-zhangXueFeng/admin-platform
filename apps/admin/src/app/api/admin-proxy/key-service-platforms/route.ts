import { NextResponse } from 'next/server';

const UPSTREAM_PATH = '/api/manage/v1/key/config/listKeyService';

/**
 * Adapts the legacy GET contract used by the signed-transactions feature to
 * the current backend POST endpoint for key-service platforms.
 *
 * The feature library remains unchanged: this app-local proxy is the narrow
 * compatibility boundary for the deployed backend contract.
 */
export async function GET(request: Request): Promise<Response> {
  const backendUrl = process.env.NEXT_SERVICE_SERVER_URL?.replace(/\/+$/, '');

  if (!backendUrl) {
    return NextResponse.json(
      { code: 500, message: 'NEXT_SERVICE_SERVER_URL is not configured' },
      { status: 500 },
    );
  }

  const headers = new Headers({ 'content-type': 'application/json' });
  const token = request.headers.get('token');
  const cookie = request.headers.get('cookie');

  if (token) headers.set('token', token);
  if (cookie) headers.set('cookie', cookie);

  try {
    const response = await fetch(`${backendUrl}${UPSTREAM_PATH}`, {
      method: 'POST',
      headers,
      body: '{}',
      cache: 'no-store',
    });

    return new NextResponse(await response.arrayBuffer(), {
      status: response.status,
      headers: {
        'content-type':
          response.headers.get('content-type') ?? 'application/json',
      },
    });
  } catch {
    return NextResponse.json(
      { code: 502, message: 'Key-service platform request failed' },
      { status: 502 },
    );
  }
}
