import { requestUrl } from "obsidian";
import { QUOTE_SOURCE } from "src/Types/Enums";
import { CustomQuote } from "src/Types/Interfaces";

/**
 * Based on the configured quoteSource, gets a random quote from Quoteable, a custom quote, or both.
 * @param quoteSource
 * @param customQuotes
 */
const getQuote = async (
	quoteSource: QUOTE_SOURCE,
	customQuotes: CustomQuote[]
) => {
	let actualQuoteSource = quoteSource;
	let quote: any = {};

	// If set to both, pick one of the two at random
	if (quoteSource === QUOTE_SOURCE.BOTH) {
		actualQuoteSource = [QUOTE_SOURCE.QUOTEABLE, QUOTE_SOURCE.MY_QUOTES][
			Math.floor(Math.random() * 2)
		];
	}

	if (actualQuoteSource === QUOTE_SOURCE.QUOTEABLE) {
		try {
			const response = await requestUrl("https://dummyjson.com/quotes/random");
			if (response.status === 200) {
				const data = response.json;
				quote = { content: data.quote, author: data.author };
			} else {
				throw new Error("Status not 200");
			}
		} catch (e) {
			console.error("Failed to fetch quote", e);
			quote = {
				content:
					"Oops! We couldn't fetch a quote for you. Please check your internet connection.",
				author: "Beautitab",
			};
		}
	} else if (actualQuoteSource === QUOTE_SOURCE.MY_QUOTES) {
		const randomQuote =
			customQuotes[Math.floor(Math.random() * customQuotes.length)]
				?? { text: "No quotes available.", author: "Beautitab" };
		quote = { content: randomQuote.text, author: randomQuote.author };
	}

	return quote;
};

export default getQuote;
