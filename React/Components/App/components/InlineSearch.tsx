import React from "react";
import { Icon } from "./Icon";

interface InlineSearchProps {
	onClick: () => void;
}

export const InlineSearch: React.FC<InlineSearchProps> = ({ onClick }) => (
	<div className="beautitab-search">
		<a className="beautitab-search-wrapper" onClick={onClick}>
			<Icon name="search" />
			<span className="beautitab-search-text">Search</span>
		</a>
	</div>
);
