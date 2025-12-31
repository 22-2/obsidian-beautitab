import { useState, useEffect } from "react";
import getQuote from "React/Utils/getQuote";
import { QUOTE_SOURCE, CustomQuote } from "React/Components/App/hooks/background/types";

export interface Quote {
	content: string;
	author: string;
}

export const useQuote = (
	quoteSource: QUOTE_SOURCE,
	customQuotes: CustomQuote[],
	showQuote: boolean = true
): Quote | null => {
	const [quote, setQuote] = useState<Quote | null>(null);

	useEffect(() => {
		if (!showQuote) {
			setQuote(null);
			return;
		}

		getQuote(quoteSource, customQuotes).then((newQuote: Quote) => {
			setQuote(newQuote);
		});
	}, [quoteSource, customQuotes, showQuote]);

	return quote;
};
