import React from "react";
import { TFile, App } from "obsidian";
import { Icon } from "./Icon";

interface FileListProps {
	files: TFile[];
	obsidianApp: App | undefined;
	iconName: string;
}

export const FileList: React.FC<FileListProps> = ({
	files,
	obsidianApp,
	iconName,
}) => {
	const handleFileClick = (file: TFile) => {
		const leaf = obsidianApp?.workspace.getMostRecentLeaf();
		leaf?.openFile(file);
	};

	return (
		<div className="beautitab-recentlyedited">
			{files.map((file) => (
				<a
					key={file.path}
					className="beautitab-recentlyedited-file"
					data-path={file.path}
					onClick={() => handleFileClick(file)}
				>
					<Icon name={iconName} />
					<span className="beautitab-recentlyedited-file-name">
						{file.basename}
					</span>
				</a>
			))}
		</div>
	);
};
