import { useMemo } from "react";
import { TFile, TAbstractFile, App } from "obsidian";

export const useRecentFiles = (
	obsidianApp: App | undefined,
	limit: number = 5
): TFile[] => {
	const allVaultFiles = obsidianApp?.vault.getAllLoadedFiles();

	return useMemo(() => {
		if (!allVaultFiles) return [];

		const files = allVaultFiles.filter(
			(file): file is TFile =>
				file instanceof TFile && file.extension === "md"
		);

		files.sort((a, b) => b.stat.mtime - a.stat.mtime);

		return files.slice(0, limit);
	}, [allVaultFiles, limit]);
};
