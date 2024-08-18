import { deriveMissingCoinPrices } from '#root/routes/v1/getPools/_utils.js';
import { lc } from '#root/utils/String.js';

const isDefinedCoin = (address) => address !== '0x0000000000000000000000000000000000000000';

const getAugmentedCoinsFirstPass = async ({
  poolInfo,
  mergedCoinData,
  blockchainId,
  registryId,
  wipMergedPoolData,
  internalPoolsPrices,
  otherRegistryTokensPricesMap,
}) => {
  let augmentedCoins;
  const coins = poolInfo.coinsAddresses
    .filter(isDefinedCoin)
    .map((coinAddress) => {
      const key = `${poolInfo.id}-${coinAddress}`;

      return {
        ...mergedCoinData[key],
        usdPrice: (
          mergedCoinData[key]?.usdPrice === 0 ? 0 :
            (mergedCoinData[key]?.usdPrice || null)
        ),
      };
    });

  augmentedCoins = await deriveMissingCoinPrices({
    blockchainId,
    registryId,
    coins,
    poolInfo,
    otherPools: wipMergedPoolData,
    internalPoolPrices: internalPoolsPrices[poolInfo.id] || [], //
    otherRegistryTokensPricesMap, //
  });

  return augmentedCoins;
};

const getAugmentedCoinsSecondPass = async ({
  poolInfo,
  blockchainId,
  registryId,
  wipMergedPoolData,
  internalPoolsPrices,
  otherRegistryTokensPricesMap,
  missingCoinPrices,
}) => {
  const coins = poolInfo.coins.map((coinData) => ({
    ...coinData,
    usdPrice: (
      coinData.usdPrice !== null ? coinData.usdPrice :
        typeof missingCoinPrices[lc(coinData.address)] !== 'undefined' ? missingCoinPrices[lc(coinData.address)] :
          null
    ),
  }));

  const augmentedCoins = await deriveMissingCoinPrices({
    blockchainId,
    registryId,
    coins,
    poolInfo,
    otherPools: wipMergedPoolData,
    internalPoolPrices: internalPoolsPrices[poolInfo.id] || [], //
    otherRegistryTokensPricesMap, //
  });

  return augmentedCoins;
};

export {
  getAugmentedCoinsFirstPass,
  getAugmentedCoinsSecondPass,
};
