// scripts/api-client.js
// Centralized fetch handling for any block that needs to call an external/internal
// API (e.g. the button block's "API Call" navigation type). Keeps request
// construction, timeout, and error normalization in one place instead of
// duplicated per block.

const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Calls an API endpoint and normalizes the result shape so callers never need
 * to distinguish between network errors, timeouts, and non-2xx responses.
 * @param {string} url
 * @param {object} [options]
 * @param {'GET'|'POST'} [options.method]
 * @param {object} [options.body] JSON-serializable request body (POST only)
 * @param {number} [options.timeoutMs]
 * @returns {Promise<{ok: boolean, status: number, data: unknown, error: string|null}>}
 */
export default async function callApi(url, { method = 'GET', body, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const contentType = resp.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await resp.json().catch(() => null)
      : await resp.text().catch(() => null);
    return {
      ok: resp.ok, status: resp.status, data, error: null,
    };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: e.name === 'AbortError' ? 'timeout' : e.message,
    };
  } finally {
    clearTimeout(timeout);
  }
}
