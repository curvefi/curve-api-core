/**
 * @openapi
 * /getFactoGaugesCrvRewards/{blockchainId}:
 *   get:
 *     tags:
 *       - Volumes and APYs
 *     description: Returns unboosted CRV APRs for sidechain facto gauges
 *     parameters:
 *       - $ref: '#/components/parameters/blockchainId'
 *     responses:
 *       200:
 *         description:
 */

import { fn } from '#root/utils/api.js';
import getAssetsPrices from '#root/utils/data/assets-prices.js';
import getFactoGaugesFn from '#root/routes/v1/getFactoGauges/[blockchainId].js';
import { lc } from '#root/utils/String.js';
import getAllCurvePoolsData from '#root/utils/data/curve-pools-data.js';

const NON_STANDARD_OUTDATED_GAUGES = [].map(lc);

export default fn(async ({ blockchainId }) => {
  const { gauges } = await getFactoGaugesFn.straightCall({ blockchainId });
  const [poolsData] = await Promise.all([
    getAllCurvePoolsData([blockchainId]),
  ]);

  const sideChainGauges = gauges.filter(({
    side_chain: isSideChain,
    name,
    is_killed: isKilled,
    gauge,
  }) => (
    isSideChain &&
    // name.startsWith(`${blockchainId}-`) &&
    !isKilled &&
    !NON_STANDARD_OUTDATED_GAUGES.includes(`${blockchainId}-${lc(gauge)}`)
  ));

  if (sideChainGauges.length === 0) {
    return { sideChainGaugesApys: [] };
  }

  const { 'curve-dao-token': crvPrice } = await getAssetsPrices(['curve-dao-token']);
  const sideChainGaugesApys = sideChainGauges.map(({
    swap,
    name,
    gauge_data: {
      inflation_rate: rate, // This already takes gauge_relative_weight into account in side facto gauges
      totalSupply,
    },
    areCrvRewardsStuckInBridge,
  }) => {
    const lcAddress = swap.toLowerCase();
    // Not all pools have an lpTokenAddress
    const pool = poolsData.find(({ address }) => (
      address.toLowerCase() === lcAddress
    ));
    if (!pool) throw new Error(`Can't find pool or lending vault data for address "${lcAddress}"`);
    const isPool = !!pool;

    const lpTokenUsdValue = (pool.usdTotal / (pool.totalSupply / 1e18));
    const gaugeUsdValue = totalSupply / 1e18 * lpTokenUsdValue;

    const apy = (
      areCrvRewardsStuckInBridge ? 0 :
        ((rate / 1e18) * (86400 * 365) / gaugeUsdValue * 0.4 * crvPrice * 100)
    );

    return {
      address: lcAddress,
      name,
      apy,
      areCrvRewardsStuckInBridge,
    };
  });

  return { sideChainGaugesApys };
}, {
  maxAge: 5 * 60,
  cacheKey: ({ blockchainId }) => `getFactoGaugesCrvRewards-${blockchainId}`,
});
