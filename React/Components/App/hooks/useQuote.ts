import { useState, useEffect } from "react";
import getQuote from "React/Utils/getQuote";
import { QUOTE_SOURCE } from "src/Types/Enums";
import { CustomQuote } from "src/Types/Interfaces";

export interface Quote {
	content: string;
	author: string;
}

export const useQuote = (
	quoteSource: QUOTE_SOURCE,
	customQuotes: CustomQuote[]
): Quote | null => {
	const [quote, setQuote] = useState<Quote | null>(null);

	useEffect(() => {
		getQuote(quoteSource, customQuotes).then((newQuote: Quote) => {
			setQuote(newQuote);
		});
	}, [quoteSource, customQuotes]);

	return quote;
};
