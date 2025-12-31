import PQueue from "p-queue";
//@ts-ignore - This is a polyfill for fetch and work using --lib dom
import { fetch as fetchPolyfill } from "whatwg-fetch";

/**
 * Rate-limited fetch queue to prevent excessive API requests.
 * - concurrency: 1 (one request at a time)
 * - interval: 500ms between requests
 */
const fetchQueue = new PQueue({
	concurrency: 1,
	interval: 500,
	intervalCap: 1,
});

/**
 * Queued version of fetchPolyfill to prevent request flooding
 */
export const fetchPolyfillSafe = (
	input: RequestInfo | URL,
	init?: RequestInit
): Promise<Response> => {
	return fetchQueue.add(() => fetchPolyfill(input, init)) as Promise<Response>;
};
