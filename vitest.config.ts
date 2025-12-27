import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
	test: {
		environment: "node",
		setupFiles: ["./vitest.setup.ts"],
	},
	resolve: {
		alias: {
			obsidian: path.resolve(__dirname, "./__mocks__/obsidian.ts"),
			src: path.resolve(__dirname, "./src"),
			React: path.resolve(__dirname, "./React"),
			main: path.resolve(__dirname, "./main.ts"),
		},
	},
});
