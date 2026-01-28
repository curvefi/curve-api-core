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
    '0x2247B5A46BB79421a314aB0f0b67fFd11dd37Ee4': 'midas-basis-trading-token', // mBASIS
  },
  'plasma': {
    '0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb': 'usdt0', // USDT0
    '0x5d3a1ff2b6bab83b63cd9ad0787074081a52ef34': 'ethena-usde', // USDe
    '0x9895D81bB462A195b4922ED7De0e3ACD007c32CB': 'weth', // WETH
    '0xe561FE05C39075312Aa9Bc6af79DdaE981461359': 'wrapped-rseth', // wrsETH
  },
  'unichain': {
    '0xc02fE7317D4eb8753a02c35fe019786854A92001': 'wrapped-steth', // wstETH
    '0x4200000000000000000000000000000000000006': 'weth', // WETH
  },
  'monad': {
    '0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a': 'agora-dollar', // AUSD
    '0x754704Bc059F8C67012fEd69BC8A327a5aafb603': 'usd-coin', // USDC
    '0xe7cd86e13AC4309349F30B3435a9d337750fC82D': 'usdt0', // USDT0
    '0xEE8c0E9f1BFFb4Eb878d8f15f368A02a35481242': 'weth', // WETH
    '0x10Aeaf63194db8d453d4D85a06E5eFE1dd0b5417': 'wrapped-steth', // wstETH
    '0xA3D68b74bF0528fdD07263c60d6488749044914b': 'wrapped-eeth', // weETH
    '0x0555E30da8f98308EdB960aa94C0Db47230d2B9c': 'wrapped-bitcoin', // WBTC
    '0xecAc9C5F704e954931349Da37F60E39f515c11c1': 'lombard-staked-btc', // LBTC
    '0xB0F70C0bD6FD87dbEb7C10dC692a2a6106817072': 'bitcoin-avalanche-bridged-btc-b', // BTC.b
    '0x2416092f143378750bb29b79eD961ab195CcEea5': 'renzo-restaked-eth', // ezETH
  },
  avalanche: {
    '0xd586e7f844cea2f87f50152665bcbc2c279d8d70': 'dai', // DAI
    '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e': 'usd-coin', // USDC
    '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7': 'tether', // USDT
    '0x47afa96cdc9fab46904a55a6ad4bf6660b53c38a': 'dai', // avDAI
    '0x82E64f49Ed5EC1bC6e43DAD4FC8Af9bb3A2312EE': 'dai', // aAvaDAI
    '0x46a51127c3ce23fb7ab1de06226147f446e4a857': 'usd-coin', // avUSDC
    '0x625E7708f30cA75bfd92586e17077590C60eb4cD': 'usd-coin', // aAvaUSDC
    '0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664': 'usd-coin', // USDC.e
    '0x532e6537fea298397212f09a61e03311686f548e': 'tether', // avUSDT
    '0x6ab707Aca953eDAeFBc4fD23bA73294241490620': 'tether', // aAvaUSDT
    '0xc7198437980c041c805A1EDcbA50c1Ce5db95118': 'tether', // USDT.e
    '0x686bef2417b6dc32c50a3cbfbcc3bb60e1e9a15d': 'wrapped-bitcoin', // avWBTC
    '0xdbf31df14b66535af65aac99c32e9ea844e14501': 'renbtc',
    '0x53f7c5869a859f0aec3d334ee8b4cf01e3492f21': 'weth', // avWETH
    '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB': 'weth', // WETH.e
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee': 'avalanche-2',
    '0x6807ed4369d9399847f306d7d835538915fa749d': 'dai', // bDAI
    '0xc53a6eda2c847ce9f10b5c8d51bc2a9ed2fe3d44': 'avalanche-2', // u.AVAX
    '0x264c1383EA520f73dd837F915ef3a732e204a493': 'binancecoin', // BNB
    '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7': 'wrapped-avax', // WAVAX
    '0x6feFd97F328342a8A840546A55FDcfEe7542F9A8': 'ageur', // agEUR
    '0x9fB1d52596c44603198fB0aee434fac3a679f702': 'jarvis-synthetic-euro', // jEUR
    '0x152b9d0fdc40c096757f570a51e494bd4b943e50': 'bitcoin-avalanche-bridged-btc-b', // BTC.b
    '0x14A84F1a61cCd7D1BE596A6cc11FE33A36Bc1646': 'treehouse-avax', // tAVAX
    '0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE': 'benqi-liquid-staked-avax', // sAVAX
    '0x580d5E1399157FD0d58218b7A514b60974F2AB01': 'staked-uty', // yUTY
    '0x9eE1963f05553eF838604Dd39403be21ceF26AA4': 'parallel-usdp', // USDp
    '0x80Eede496655FB9047dd39d9f418d5483ED600df': 'frax-usd', // frxUSD
  },
  fantom: {
    '0x74b23882a30290451a17c44f4f05243b6b58c76d': 'weth', // WETH
    '0x321162cd933e2be498cd2267a90534a804051b11': 'wrapped-bitcoin', // WBTC
    '0x4e15361fd6b4bb609fa63c81a2be19d873717870': 'fantom', // FTM
    '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE': 'fantom', // FTM
    '0x8d11ec38a3eb5e956b052f67da8bdc9bef8abf3e': 'dai', // DAI
    '0x07E6332dD090D287d3489245038daF987955DCFB': 'dai', // gDAI
    '0x04068da6c83afcfa0e13ba15a6696662335d5b75': 'usd-coin', // USDC
    '0x049d68029688eabf473097a2fc38ef61633a3c7a': 'tether', // fUSDT
    '0x1e4f97b9f9f913c46f1632781732927b9019c68b': 'curve-dao-token', // CRV
    '0xC931f61B1534EB21D8c11B24f3f5Ab2471d4aB50': 'binance-usd', // BUSD
    '0x0ac7e2f9f78de2ccc467139d43b6f32473454dd9': 'tether', // sUSDT_BSC, base price for price inferences on eywa facto pools
    '0xE35177E61d09bFDb61Ea29db92d19B5E05EdDa8f': 'usd-coin', // sUSDC_BSC, base price for price inferences on eywa facto pools
    '0x88486E058865611c939D1077725F293378E7bD75': 'dai', // sDAI_BSC, base price for price inferences on eywa facto pools
    '0xC4417bE9c9b3f682fd03224A4B29e01CE34602fE': 'true-usd', // sTUSD_BSC, base price for price inferences on eywa facto pools
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
