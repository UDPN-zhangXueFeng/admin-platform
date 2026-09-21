import { NextResponse } from 'next/server';

const UPSTREAM_PATH = '/api/manage/v1/user/wallet/list';

interface UpstreamWalletListResponse {
  code?: number;
  message?: string;
  data?: {
    page?: { total?: number };
    rows?: unknown[];
  };
}

const UPSTREAM_PAGE_SIZE = 100;

async function fetchWalletPage(
  backendUrl: string,
  headers: Headers,
  pageNum: number,
): Promise<UpstreamWalletListResponse> {
  const response = await fetch(`${backendUrl}${UPSTREAM_PATH}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      data: {},
      page: { pageNum, pageSize: UPSTREAM_PAGE_SIZE },
    }),
    cache: 'no-store',
  });

  const payload = (await response.json()) as UpstreamWalletListResponse;

  if (!response.ok || payload.code !== 0) {
    throw new Error(payload.message || 'User-wallet upstream request failed');
  }

  return payload;
}

/**
 * Adapts the legacy GET contract used by key-management user wallets to the
 * current paginated POST endpoint exposed by the backend.
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
    const firstPage = await fetchWalletPage(backendUrl, headers, 1);
    const total = firstPage.data?.page?.total ?? 0;
    const pageCount = Math.ceil(total / UPSTREAM_PAGE_SIZE);
    const remainingPages = await Promise.all(
      Array.from({ length: Math.max(pageCount - 1, 0) }, (_, index) =>
        fetchWalletPage(backendUrl, headers, index + 2),
      ),
    );
    const rows = [
      ...(firstPage.data?.rows ?? []),
      ...remainingPages.flatMap((page) => page.data?.rows ?? []),
    ].slice(0, total);

    return NextResponse.json({
      code: 0,
      message: firstPage.message,
      data: {
        list: rows,
        total,
      },
    });
  } catch {
    return NextResponse.json(
      { code: 502, message: 'User-wallet request failed' },
      { status: 502 },
    );
  }
}
