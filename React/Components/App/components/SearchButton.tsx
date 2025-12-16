import React from "react";
import { Icon } from "./Icon";

interface SearchButtonProps {
	onClick: () => void;
	label: string;
	iconName?: string;
}

export const SearchButton: React.FC<SearchButtonProps> = ({
	onClick,
	label,
	iconName = "search",
}) => (
	<a className="beautitab-iconbutton" onClick={onClick}>
		<span className="beautitab-iconbutton-text">{label}</span>
		<Icon name={iconName} />
	</a>
);
