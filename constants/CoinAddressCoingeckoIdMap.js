/**
 * In order for the whole app to be aware of the entirety of tokens prices, it:
 * 1. Retrieves the price of a few generic and widely-traded tokens like USDC (the "starting point")
 * 2. Derives the price of every single other token in any Curve pool using Curve pools
 *    themselves and the price that assets are trading at in them
 *
 * Hence the list below represents the only tokens that the app queries Coingecko for.
 * (Note: Before a Dec 2023 improvement, all token pairs with no link to other pools to
 * derive a price from had to manually listed here to have a reference price. This is not
 * the case anymore, so most of the addresses listed here are now likely not needed anymore.)
 * See the context surrounding `REGISTRIES_DEPENDENCIES` in `getPools/index.js`, and
 * `deriveMissingCoinPricesSinglePass` in `getPools/_utils.js` to dig deeper into how this works.
 */

const CoinAddressCoingeckoIdMap = {

};

export default CoinAddressCoingeckoIdMap;
