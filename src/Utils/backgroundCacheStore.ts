import {
	BackgroundCache
} from "src/Types/Interfaces";
import {
	normalizeBackgroundCache
} from "src/Utils/backgroundCache";
import store from "store2";

// Namespace for background cache in store2
const CACHE_KEY = "beautitab:backgroundCache";

export const readBackgroundCache = async (): Promise<BackgroundCache> => {
	const cache = (store.get(CACHE_KEY) as BackgroundCache | undefined) ?? {};
	return normalizeBackgroundCache(cache);
};

export const saveBackgroundCache = async (
	cache: BackgroundCache
): Promise<void> => {
	store.set(CACHE_KEY, cache);
};

export const clearBackgroundCache = async (): Promise<void> => {
	store.remove(CACHE_KEY);
};
