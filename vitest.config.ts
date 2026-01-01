import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
	test: {
		environment: "node",
		setupFiles: ["./vitest.setup.ts"],
		exclude: ["e2e/**", "packages/**", "node_modules/**"],
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
