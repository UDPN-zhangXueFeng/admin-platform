/**
 * Jest manual mock for `@myorg/shared/data-access-api`.
 *
 * The real apiClient unwraps the `{ code, message, data }` envelope and would
 * need an axios instance + next-intl's ESM build to run under @swc/jest — that
 * is out of scope for an endpoint-coverage spec. Here we record every call's
 * (url, data) pair AND allow the spec to stub a per-URL response, so we can
 * assert: every documented endpoint is wired to the right URL with the right
 * payload (pageNum/pageSize 分页字段、detial 拼写、blob 下载 URL）。
 *
 * 对齐 mmf.data-access 的 __mocks__/data-access-api.ts（已验收范本），结构一致。
 */

type ApiRequestConfig = { signal?: AbortSignal };

interface RecordedCall {
  url: string;
  data?: unknown;
  config?: ApiRequestConfig;
}

const calls: RecordedCall[] = [];
const responses = new Map<string, unknown>();

function resetCalls() {
  calls.length = 0;
  responses.clear();
}

function getCalls(): RecordedCall[] {
  return calls;
}

/** Stub the resolved value returned for a given URL (covers both get & post). */
function setResponse(url: string, value: unknown) {
  responses.set(url, value);
}

export const apiClient = {
  async post<T>(
    url: string,
    data?: unknown,
    config?: ApiRequestConfig,
  ): Promise<T> {
    calls.push({ url, data, config });
    return (responses.has(url) ? responses.get(url) : undefined) as T;
  },
  async get<T>(url: string, config?: ApiRequestConfig): Promise<T> {
    calls.push({ url, config });
    return (responses.has(url) ? responses.get(url) : undefined) as T;
  },
};

export type { ApiRequestConfig };
export { calls, resetCalls, getCalls, setResponse };
