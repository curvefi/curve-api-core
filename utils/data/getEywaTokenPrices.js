import memoize from 'memoizee';
import { arrayToHashmap } from '#root/utils/Array.js';
import groupBy from 'lodash.groupby';
import { SONIC_FACTO_STABLE_NG_EYWA_POOL_IDS, TAIKO_FACTO_STABLE_NG_EYWA_POOL_IDS } from '#root/constants/PoolMetadata.js';
import getConfigs from '#root/constants/configs/index.js';

// Eywa API isn’t reliable, this keeps a copy last prices for when live prices aren’t available
const LAST_PRICES_CACHE = new Map();

const getEywaTokenPrice = memoize((address, chainId) => (
  fetch(`https://api.crosscurve.fi/prices/${address}/${chainId}`)
    .then((res) => res.json())
    .then((str) => Number(str))
    .then((usdPrice) => {
      LAST_PRICES_CACHE.set(address, usdPrice);
      return usdPrice;
    })
    .catch(() => LAST_PRICES_CACHE.get(address)) // Fallback to last known value
), {
  promise: true,
  maxAge: 60 * 1000,
});

const getEywaTokenPrices = memoize(async (
  allCoinAddresses,
  registryId,
  blockchainId
) => {
  const config = (await getConfigs())[blockchainId];

  const filteredCoinAddresses = allCoinAddresses.filter(({ poolId }) => (
    (blockchainId === 'sonic' && SONIC_FACTO_STABLE_NG_EYWA_POOL_IDS.includes(poolId)) ||
    (blockchainId === 'taiko' && TAIKO_FACTO_STABLE_NG_EYWA_POOL_IDS.includes(poolId))
  ));
  const firstTokenOfEachEywaPool = Array.from(Object.values(groupBy(filteredCoinAddresses, 'poolId'))).map(([{ address }]) => address);
  const allTokenAddresses = [
    ...firstTokenOfEachEywaPool,
  ];
  const prices = await Promise.all(allTokenAddresses.map((address) => getEywaTokenPrice(address, config.chainId)));

  const EywaTokensPrices = arrayToHashmap(allTokenAddresses.map((address, i) => [address.toLowerCase(), prices[i]]));

  return EywaTokensPrices;
}, {
  promise: true,
  maxAge: 15 * 60 * 1000,
  preFetch: true,
});

export default getEywaTokenPrices;
