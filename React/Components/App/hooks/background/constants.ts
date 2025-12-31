/**
 * Background hook constants
 */

/** How long before data is considered stale (1 hour) */
export const STALE_TIME = 1000 * 60 * 60;

/** How long to keep unused data in cache (24 hours) */
export const GC_TIME = 1000 * 60 * 60 * 24;

/** How long prefetched data stays fresh (5 minutes) */
export const PREFETCH_STALE_TIME = 1000 * 60 * 5;

