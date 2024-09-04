/**
 * In order for the whole app to be aware of the entirety of tokens prices, it:
 * 1. Retrieves the price of a few generic and widely-traded tokens like USDC (the "starting point")
 * 2. Derives the price of every single other token in any Curve pool using Curve pools
 *    themselves and the price that assets are trading at in them
 */

const CoinAddressCoingeckoIdMap = {
  'arbitrum-sepolia': {

  },
};

export default CoinAddressCoingeckoIdMap;
