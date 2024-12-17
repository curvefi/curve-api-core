/**
 * In-memory token prices cache, regularly saved to a Redis cache
 * and restored from that same Redis cache on instance start.
 *
 * This is an always-on source of prices, which are updated frequently
 * from price calculations happening in getPools. Being a separate entity,
 * it allows pools to have access to each other’s token prices w/o
 * creating physical dependencies between them (like is currently the case
 * in `curve-api`)
 *
 * Shape of the store:
 * {
 *   'NETWORKNAME': {
 *     '0xTOKENADDRESS': {
 *       '0xPOOLADDRESS': {
 *         price: Number,
 *         poolUsdTotal: Number,
 *       },
 *       …
 *     },
 *     …
 *   },
 *   …
 * }
 */

import { lc } from '#root/utils/String.js';
import { storage } from '#root/utils/swr.js';
import { getNowTimestamp } from '#root/utils/Date.js';

let PRICES_CACHE = {};
const REDIS_CACHE_KEY = 'tokens-prices-store';
const PRICE_TIME_TO_STALE = 5 * 60;

const setTokenPrice = ({ blockchainId, address, price, poolAddress, poolUsdTotal }) => {
  if (typeof PRICES_CACHE[blockchainId] === 'undefined') {
    PRICES_CACHE[blockchainId] = {};
  }

  let {
    matchedTokenPriceData: existingTokenPriceData,
    entireTokenPriceData,
  } = getTokenPrice(address, blockchainId, true) ?? {};
  existingTokenPriceData = existingTokenPriceData ?? {};
  entireTokenPriceData = entireTokenPriceData ?? {};

  // 0 and 1 are special values for poolUsdTotal that represent inexactitude
  const isNewDataLessPreciseThanExisting = (
    poolUsdTotal === 0 && ((existingTokenPriceData.poolUsdTotal ?? 0) > 0) ||
    poolUsdTotal === 1 && ((existingTokenPriceData.poolUsdTotal ?? 0) > 1)
  );
  if (isNewDataLessPreciseThanExisting) {
    return;
  }

  // Prevent bumping `ts` when presenting the exact same data to `setTokenPrice`
  // This prevents the system being stuck with the same price while considering it fresh
  // if it's called quickly enough in succession (since the system feeds on itself)
  const isSameData = (
    (existingTokenPriceData?.ts ?? 0) + PRICE_TIME_TO_STALE >= getNowTimestamp() && // not stale
    existingTokenPriceData.price === price
  );
  if (isSameData) return;

  PRICES_CACHE[blockchainId][lc(address)] = {
    ...entireTokenPriceData,
    [lc(poolAddress)]: {
      price,
      poolUsdTotal,
      ts: getNowTimestamp(),
    },
  };
};

const getTokenPrice = (address, blockchainId, returnEntireObject = false) => {
  const tokenPriceData = PRICES_CACHE[blockchainId]?.[lc(address)] ?? {};

  const entireTokenPriceData = Object.values(tokenPriceData).sort(({ poolUsdTotal: poolUsdTotalA }, { poolUsdTotal: poolUsdTotalB }) => (
    poolUsdTotalA > poolUsdTotalB ? -1 :
      poolUsdTotalA < poolUsdTotalB ? 1 : 0
  ));
  const matchedTokenPriceData = entireTokenPriceData?.[0];

  const isStale = (matchedTokenPriceData?.ts ?? 0) + PRICE_TIME_TO_STALE < getNowTimestamp();
  if (isStale) return undefined;
  if (returnEntireObject) return { entireTokenPriceData, matchedTokenPriceData };

  return matchedTokenPriceData.price;
};

setTimeout(async () => {
  const remotePriceCache = await storage.getItem(REDIS_CACHE_KEY);
  if (remotePriceCache !== null) PRICES_CACHE = JSON.parse(remotePriceCache);
}, 0);

// setInterval(() => {
//   console.log('inside PRICES_CACHE:', JSON.stringify(PRICES_CACHE));
// }, 10000)

setInterval(() => {
  if (Object.keys(PRICES_CACHE).length > 0) {
    storage.setItem(REDIS_CACHE_KEY, JSON.stringify(PRICES_CACHE));
  }
}, 60 * 1000);

export {
  setTokenPrice,
  getTokenPrice,
};
