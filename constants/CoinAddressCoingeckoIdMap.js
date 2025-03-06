/**
 * In order for the whole app to be aware of the entirety of tokens prices, it:
 * 1. Retrieves the price of a few generic and widely-traded tokens like USDC (the "starting point")
 * 2. Derives the price of every single other token in any Curve pool using Curve pools
 *    themselves and the price that assets are trading at in them
 */

import getConfigs from '#root/constants/configs/index.js'
import { arrayToHashmap } from '#root/utils/Array.js';
import merge from 'lodash.merge';
import memoize from 'memoizee';

// For deployments before yaml configs started exposing these properties
// Can also be used to fill in some blanks if needed (if the set of initial
// reference tokens isn't wide enough for a specific deployment, which should
// be avoided but at least that's an available fallback)
const HARDCODED_DATA = {
  'arbitrum-sepolia': {

  },
  'taiko': {
    '0xc8F4518ed4bAB9a972808a493107926cE8237068': 'crvusd',
    '0x07d83526730c7438048D55A4fc0b850e2aaB6f0b': 'usd-coin',
    '0x09413312b263fd252c16e592a45f4689f26cb79d': 'curve-dao-token',
  },
  'neon': {
    '0xc659b2633ed725e5346396a609d8f31794d6ac50': 'usd-coin',
    '0xaa24a5a5e273efaa64a960b28de6e27b87ffdffc': 'tether',
  },
  'corn': {
    '0xEAEdD2B1b3F0fEC6388A4d6b2fE500B59Fd9f755': 'crvusd',
  },
  'sonic': {
    '0x7fff4c4a827c84e32c5e175052834111b2ccd270': 'crvusd',
    '0x6047828dc181963ba44974801ff68e538da5eaf9': 'tether',
    '0x3bcE5CB273F0F148010BbEa2470e7b5df84C7812': 'rings-sc-eth',
  },
};

const getCoinAddressCoingeckoIdMap = memoize(async () => {
  const configs = await getConfigs();

  const configData = arrayToHashmap(Object.entries(configs).map(([networkId, { referenceTokenAddresses }]) => [
    networkId,
    arrayToHashmap((
      Object.entries(referenceTokenAddresses)
        .filter(([tokenId, tokenAddress]) => !!tokenAddress) // Filter out undefineds
        // Map config coin ids to coingecko ids
        .map(([tokenId, tokenAddress]) => [tokenAddress, (
          tokenId === 'usdc' ? 'usd-coin' :
            tokenId === 'usdt' ? 'tether' :
              tokenId === 'weth' ? 'ethereum' :
                null
        )])
    )),
  ]));

  return merge(configData, HARDCODED_DATA);
}, {
  maxAge: 1 * 60 * 1000,
});

export default getCoinAddressCoingeckoIdMap;
