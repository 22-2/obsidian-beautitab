// This is a worker file that will be inlined by esbuild-plugin-inline-worker
// It handles the timing for background prefetching

let intervalId: number | null = null;

self.onmessage = (e: MessageEvent) => {
	const { type, payload } = e.data;

	if (type === "start") {
		if (intervalId) clearInterval(intervalId);

		// Check every minute
		intervalId = self.setInterval(() => {
			self.postMessage({ type: "check" });
		}, 1000 * 60);
	}

	if (type === "stop") {
		if (intervalId) {
			clearInterval(intervalId);
			intervalId = null;
		}
	}
};
