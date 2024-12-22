import { deriveMissingCoinPrices } from '#root/routes/v1/getPools/_utils.js';

const isDefinedCoin = (address) => address !== '0x0000000000000000000000000000000000000000';

const getAugmentedCoinsFirstPass = async ({
  poolInfo,
  mergedCoinData,
  blockchainId,
  registryId,
  wipMergedPoolData,
  internalPoolsPrices,
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
    internalPoolPrices: internalPoolsPrices[poolInfo.id] || [],
  });

  return augmentedCoins;
};

export {
  getAugmentedCoinsFirstPass,
};
