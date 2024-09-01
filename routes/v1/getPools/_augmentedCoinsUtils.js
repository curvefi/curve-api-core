import { deriveMissingCoinPrices } from '#root/routes/v1/getPools/_utils.js';
import { setTokenPrice } from '#root/utils/data/tokens-prices-store.js';

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

  // Save token prices
  augmentedCoins.forEach(({
    usdPrice,
    address,
  }) => {
    if (usdPrice !== null) {
      // We don’t know the pool’s usdTotal at this point yet, so instead use a number
      // that represents whether this empty or not to give some very rough precedence.
      const dumbPoolUsdTotal = Number(poolInfo.totalSupply) === 0 ? 0 : 1;

      setTokenPrice({
        blockchainId,
        address,
        price: usdPrice,
        poolAddress: poolInfo.address,
        poolUsdTotal: dumbPoolUsdTotal,
      });
    }
  });

  return augmentedCoins;
};

export {
  getAugmentedCoinsFirstPass,
};
