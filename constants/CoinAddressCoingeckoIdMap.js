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
    '0xda5dDd7270381A7C2717aD10D1c0ecB19e3CDFb2': 'wrapped-bitcorn',
    '0x44f49ff0da2498bcb1d3dc7c0f999578f67fd8c6': 'corn-3', // CORN
    '0x9Cf9F00F3498c2ac856097087e041523dfdD71fF': 'corn-3', // popCORN
  },
  'sonic': {
    '0x7fff4c4a827c84e32c5e175052834111b2ccd270': 'crvusd',
    '0x6047828dc181963ba44974801ff68e538da5eaf9': 'tether',
    '0x3bcE5CB273F0F148010BbEa2470e7b5df84C7812': 'rings-sc-eth',
  },
  'hyperliquid': {
    '0x5555555555555555555555555555555555555555': 'wrapped-hype',
  },
  'plume': {
    '0xdddD73F5Df1F0DC31373357beAC77545dC5A6f3F': 'plume-usd',
  },
  'tac': {
    '0xB63B9f0eb4A6E6f191529D71d4D88cc8900Df2C9': 'tac', // wTAC
    '0xecAc9C5F704e954931349Da37F60E39f515c11c1': 'lombard-staked-btc', // LBTC
    '0x61D66bC21fED820938021B06e9b2291f3FB91945': 'ethereum', // wETH
    '0xAf368c91793CB22739386DFCbBb2F1A9e4bCBeBf': 'wrapped-steth', // wstETH
    '0xae4efbc7736f963982aacb17efa37fcbab924cb3': 'solv-btc', // SolvBTC
    '0xF9775085d726E782E83585033B58606f7731AB18': 'universal-btc', // uniBTC
    '0xb76d91340F5CE3577f0a056D29f6e3Eb4E88B140': 'the-open-network', // TON
    '0x27e4Ade13d78Aad45bea31D448f5504031e4871E': 'dogwifcoin', // WIF
    '0x4CBE838E2BD3B46247f80519B6aC79363298aa09': 'satlayer-restaked-unibtc', // satuniBTC
    '0x7048c9e4aBD0cf0219E95a17A8C6908dfC4f0Ee4': 'coinbase-wrapped-btc', // cbBTC
  },
  'etherlink': {
    '0xecAc9C5F704e954931349Da37F60E39f515c11c1': 'lombard-staked-btc', // LBTC
    '0xbFc94CD2B1E55999Cfc7347a9313e88702B83d0F': 'wrapped-bitcoin', // WBTC
    '0xc9B53AB2679f573e480d01e0f49e2B5CFB7a3EAb': 'wrapped-xtz', // WXTZ
    '0x01F07f4d78d47A64F4C3B2b65f513f15Be6E1854': 'stacy-staked-xtz', // stXTZ
    '0x733d504435a49FC8C4e9759e756C2846c92f0160': 'midas-mre7yield', // mRe7YIELD
  },
  'plasma': {
    '0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb': 'usdt0', // USDT0
    '0x5d3a1ff2b6bab83b63cd9ad0787074081a52ef34': 'ethena-usde', // USDe
    '0x9895D81bB462A195b4922ED7De0e3ACD007c32CB': 'weth', // WETH
    '0xe561FE05C39075312Aa9Bc6af79DdaE981461359': 'wrapped-rseth', // wrsETH
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
