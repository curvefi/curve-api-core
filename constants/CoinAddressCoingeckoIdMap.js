/**
 * In order for the whole app to be aware of the entirety of tokens prices, it:
 * 1. Retrieves the price of a few generic and widely-traded tokens like USDC (the "starting point")
 * 2. Derives the price of every single other token in any Curve pool using Curve pools
 *    themselves and the price that assets are trading at in them
 */

const CoinAddressCoingeckoIdMap = {
  'arbitrum-sepolia': {

  },
  'taiko': {
    '0xc8F4518ed4bAB9a972808a493107926cE8237068': 'crvusd',
    '0x07d83526730c7438048D55A4fc0b850e2aaB6f0b': 'usd-coin',
  },
  'neondevnet': {
    '0xc659b2633ed725e5346396a609d8f31794d6ac50': 'usd-coin',
    '0xaa24a5a5e273efaa64a960b28de6e27b87ffdffc': 'tether',
  },
  'corn': {
    '0xEAEdD2B1b3F0fEC6388A4d6b2fE500B59Fd9f755': 'crvusd',
  },
};

export default CoinAddressCoingeckoIdMap;
