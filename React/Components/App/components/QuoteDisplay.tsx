import React from "react";
import { Quote } from "../hooks/useQuote";

interface QuoteDisplayProps {
	quote: Quote | null;
	showQuote: boolean;
}

export const QuoteDisplay: React.FC<QuoteDisplayProps> = ({ quote, showQuote }) => {
	if (!quote || !showQuote) return null;

	return (
		<div className="beautitab-quote">
			<div className="beautitab-quote-content">
				&quot;{quote.content}&quot;
			</div>
			<div className="beautitab-quote-author">{quote.author}</div>
		</div>
	);
};
