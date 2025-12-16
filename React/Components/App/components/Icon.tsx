import React from "react";
import { getIcon } from "obsidian";

interface IconProps {
	name: string;
}

/**
 * Given an icon name, converts an Obsidian icon to a usable SVG string and embeds it into a span.
 */
export const Icon: React.FC<IconProps> = ({ name }) => {
	const iconText = new XMLSerializer().serializeToString(
		getIcon(name) || new Node()
	);

	return (
		<span
			className="beautitab-icon"
			dangerouslySetInnerHTML={{
				__html: iconText,
			}}
		/>
	);
};
