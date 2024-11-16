import Web3 from 'web3';
import uniq from 'lodash.uniq';
import { differenceInWeeks, fromUnixTime } from 'date-fns';
import GAUGE_REGISTRY_ABI from '#root/constants/abis/gauge-registry.json' assert { type: 'json' };
import GAUGE_REGISTRY_SIDECHAIN_ABI from '#root/constants/abis/gauge-registry-sidechain.json' assert { type: 'json' };
import GAUGE_FACTORY_ABI from '#root/constants/abis/gauge-factory-sidechain.json' assert { type: 'json' };
import sideChainGauge from '#root/constants/abis/sidechain-gauge.json' assert { type: 'json' };
import sideChainRootGauge from '#root/constants/abis/sidechain-root-gauge.json' assert { type: 'json' };
import gaugeControllerAbi from '#root/constants/abis/gauge_controller.json' assert { type: 'json' };
import factorypool3Abi from '#root/constants/abis/factory_swap.json' assert { type: 'json' };
import { multiCall } from '#root/utils/Calls.js';
import { lc } from '#root/utils/String.js';
import { arrayToHashmap, arrayOfIncrements, flattenArray, removeNulls } from '#root/utils/Array.js';
import configsPromise from '#root/constants/configs/index.js';
import { getNowTimestamp } from '#root/utils/Date.js';
import getFactoryV2SidechainGaugeRewards from '#root/utils/data/getFactoryV2SidechainGaugeRewards.js';
import { sequentialPromiseFlatMap } from '#root/utils/Async.js';
import { ethereumWeb3Config } from '#root/utils/Web3/web3.js';
import memoize from 'memoizee';

const getFactoGaugesForPools = memoize(async (poolsData, blockchainId) => {
  const config = (await configsPromise)[blockchainId];

  if (typeof config === 'undefined') {
    throw new Error(`No factory data for blockchainId "${blockchainId}"`);
  }
  if (!config.chainId) {
    throw new Error(`Missing chain id in config for "${blockchainId}"`);
  }

  const web3Side = new Web3(config.rpcUrl);

  // 0xabc is the generic gauge registry address for all sidechains, the config prop allows exceptions
  const gaugeRegistryAddress = config.gaugeRegistryAddress ?? '0xabc000d88f23bb45525e447528dbf656a9d55bf5';
  const gaugeRegistryAddress2 = config.gaugeRegistryAddress2 ?? null;

  const gaugeRegistryAddresses = removeNulls([
    gaugeRegistryAddress,
    gaugeRegistryAddress2,
  ]);

  const gauges = await sequentialPromiseFlatMap(gaugeRegistryAddresses, async (registryAddress) => {
    const [mirroredGaugeCount] = await multiCall([{
      address: registryAddress,
      abi: GAUGE_REGISTRY_ABI,
      methodName: 'get_gauge_count',
      params: [config.chainId],
    }]);

    const [unmirroredGaugeCount] = await multiCall([{
      address: registryAddress,
      abi: GAUGE_REGISTRY_SIDECHAIN_ABI,
      methodName: 'get_gauge_count',
      networkSettings: { web3: web3Side, multicall2Address: config.multicall2Address },
    }]);

    if (Number(mirroredGaugeCount) === 0 && Number(unmirroredGaugeCount) === 0) {
      return [];
    }

    const unfilteredMirroredGaugeList = await multiCall(arrayOfIncrements(mirroredGaugeCount).map((gaugeIndex) => ({
      address: registryAddress,
      abi: GAUGE_REGISTRY_ABI,
      methodName: 'get_gauge',
      params: [config.chainId, gaugeIndex],
    })));

    const unfilteredUnmirroredGaugeList = await multiCall(arrayOfIncrements(unmirroredGaugeCount).map((gaugeIndex) => ({
      address: registryAddress,
      abi: GAUGE_REGISTRY_SIDECHAIN_ABI,
      methodName: 'get_gauge',
      params: [gaugeIndex],
      networkSettings: { web3: web3Side, multicall2Address: config.multicall2Address },
    })));

    const unfilteredGaugeList = uniq([
      ...unfilteredMirroredGaugeList,
      ...unfilteredUnmirroredGaugeList,
    ]);

    const gaugesKilledInfo = await multiCall(unfilteredGaugeList.map((gaugeAddress) => ({
      address: gaugeAddress,
      abi: sideChainRootGauge,
      methodName: 'is_killed',
    })));

    const gaugeList = unfilteredGaugeList;

    const weekSeconds = 86400 * 7;
    const nowTs = +Date.now() / 1000;
    const startOfWeekTs = Math.trunc(nowTs / weekSeconds);
    const currentWeekNumber = differenceInWeeks(fromUnixTime(nowTs), fromUnixTime(0));
    const endOfWeekTs = (startOfWeekTs + 1) * weekSeconds;

    /**
     * Root gauges with emissions meant for their side gauge, but not passed on to it yet
     * (will be passed to side gauge as soon as someone interacts with it). We thus
     * use those pending emissions as the basis to calculate apys for this side gauge.
     */
    const pendingEmissionsRaw = await multiCall(gaugeList.map((gaugeAddress) => ({
      address: gaugeAddress,
      abi: sideChainRootGauge,
      methodName: 'total_emissions',
      metaData: { gaugeAddress },
      networkSettings: { web3: ethereumWeb3Config.web3, multicall2Address: ethereumWeb3Config.multicall2Address },
    })));
    const pendingEmissions = arrayToHashmap(pendingEmissionsRaw.map(({ data, metaData }) => {
      const inflationRate = data / (endOfWeekTs - nowTs);

      return [
        metaData.gaugeAddress,
        inflationRate,
      ];
    }));

    const gaugesDataFromSidechain = await multiCall(flattenArray(gaugeList.map((gaugeAddress) => {
      const baseConfigData = {
        address: gaugeAddress,
        abi: sideChainGauge,
        networkSettings: { web3: web3Side, multicall2Address: config.multicall2Address },
      };

      return [{
        ...baseConfigData,
        methodName: 'lp_token',
        metaData: { gaugeAddress, type: 'lpTokenAddress' },
      }, {
        ...baseConfigData,
        methodName: 'name',
        metaData: { gaugeAddress, type: 'name' },
      }, {
        ...baseConfigData,
        methodName: 'symbol',
        metaData: { gaugeAddress, type: 'symbol' },
      }, {
        ...baseConfigData,
        methodName: 'working_supply',
        metaData: { gaugeAddress, type: 'workingSupply' },
      }, {
        ...baseConfigData,
        methodName: 'totalSupply',
        metaData: { gaugeAddress, type: 'totalSupply' },
      }, {
        ...baseConfigData,
        methodName: 'inflation_rate',
        params: [startOfWeekTs],
        metaData: { gaugeAddress, type: 'inflationRate' },
      }, {
        address: registryAddress,
        abi: GAUGE_FACTORY_ABI,
        methodName: 'is_mirrored',
        params: [gaugeAddress],
        metaData: { gaugeAddress, type: 'isMirrored' },
      }, {
        address: registryAddress,
        abi: GAUGE_FACTORY_ABI,
        methodName: 'last_request',
        params: [gaugeAddress],
        metaData: { gaugeAddress, type: 'lastRequest' },
      }];
    })));

    const gaugeControllerAddress = '0x2F50D538606Fa9EDD2B11E2446BEb18C9D5846bB';
    const gaugesDataFromMainnet = await multiCall(flattenArray(gaugeList.map((gaugeAddress) => {
      const baseConfigData = {
        address: gaugeControllerAddress,
        abi: gaugeControllerAbi,
      };

      return [{
        ...baseConfigData,
        methodName: 'gauge_types',
        params: [gaugeAddress],
        metaData: { gaugeAddress, type: 'hasCrv' },
        superSettings: { returnSuccessState: true },
      }, {
        ...baseConfigData,
        methodName: 'gauge_relative_weight',
        params: [gaugeAddress],
        metaData: { gaugeAddress, type: 'gaugeRelativeWeight' },
      }, {
        ...baseConfigData,
        methodName: 'gauge_relative_weight',
        params: [gaugeAddress, getNowTimestamp() + (7 * 86400)],
        metaData: { gaugeAddress, type: 'gaugeFutureRelativeWeight' },
      }, {
        ...baseConfigData,
        methodName: 'get_gauge_weight',
        params: [gaugeAddress],
        metaData: { gaugeAddress, type: 'getGaugeWeight' },
      }];
    })));

    const gaugesData = gaugeList.map((gaugeAddress) => {
      const gaugeDataFromSidechain = gaugesDataFromSidechain.filter(({ metaData }) => metaData.gaugeAddress === gaugeAddress);
      const gaugeDataFromMainnet = gaugesDataFromMainnet.filter(({ metaData }) => metaData.gaugeAddress === gaugeAddress);

      return {
        address: gaugeAddress,
        ...arrayToHashmap(gaugeDataFromSidechain.map(({ data, metaData: { type } }) => [
          type,
          data,
        ])),
        ...arrayToHashmap(gaugeDataFromMainnet.map(({ data, metaData: { type } }) => [
          type,
          data,
        ])),
      };
    });

    const gaugesDataWithPoolAddressAndType = gaugesData.map((gaugeData) => {
      const poolOrLendingVault = poolsData.find(({ lpTokenAddress, address }) => (
        lc(lpTokenAddress) === lc(gaugeData.lpTokenAddress) ||
        lc(address) === lc(gaugeData.lpTokenAddress)
      ));
      if (typeof poolOrLendingVault === 'undefined') return null;

      const isPool = typeof poolOrLendingVault.vaultShares === 'undefined';

      return {
        ...gaugeData,
        isPool,
        poolAddress: poolOrLendingVault.address,
        lpTokenPrice: (
          isPool ? (
            poolOrLendingVault.usdTotal /
            (poolOrLendingVault.totalSupply / 1e18)
          ) : (poolOrLendingVault.vaultShares.pricePerShare)
        ),
        registryId: poolOrLendingVault.registryId,
      };
    }).filter((o) => o !== null);

    const poolsVirtualPrices = await multiCall(gaugesDataWithPoolAddressAndType.map(({ poolAddress }) => ({
      address: poolAddress,
      abi: factorypool3Abi,
      methodName: 'get_virtual_price',
      networkSettings: { web3: web3Side, multicall2Address: config.multicall2Address },
    })));

    const gaugesDataWithPoolVprice = gaugesDataWithPoolAddressAndType.map((gaugeData, index) => ({
      ...gaugeData,
      poolVirtualPrice: poolsVirtualPrices[index],
    }));

    // Map to the historical data structure for compatibility purposes
    const formattedGaugesData = gaugesDataWithPoolVprice.map(({
      address,
      lpTokenAddress,
      name,
      symbol,
      workingSupply,
      totalSupply,
      inflationRate,
      hasCrv,
      gaugeRelativeWeight,
      gaugeFutureRelativeWeight,
      getGaugeWeight,
      poolAddress,
      lpTokenPrice,
      poolVirtualPrice,
      isMirrored,
      lastRequest,
    }) => {
      const effectiveInflationRate = Number(inflationRate) || (getGaugeWeight > 0 ? pendingEmissions[address] : 0);
      const rewardsNeedNudging = (
        hasCrv &&
        effectiveInflationRate > 0 &&
        isMirrored &&
        (differenceInWeeks(fromUnixTime(lastRequest), fromUnixTime(0)) !== currentWeekNumber)
      );

      return {
        gaugeAddress: address,
        hasCrv,
        gaugeData: {
          workingSupply,
          totalSupply,
          gaugeRelativeWeight,
          gaugeFutureRelativeWeight,
          getGaugeWeight,
          inflationRate: effectiveInflationRate,
        },
        lpTokenPrice,
        poolAddress,
        rewardsNeedNudging,
        areCrvRewardsStuckInBridge: (
          effectiveInflationRate > 0 &&
          Number(inflationRate) === 0 &&
          !rewardsNeedNudging
        ),
        isKilled: gaugesKilledInfo[unfilteredGaugeList.findIndex((gaugeAddress) => lc(gaugeAddress) === lc(address))],
      };
    });

    const sideGaugesRewards = await getFactoryV2SidechainGaugeRewards({ blockchainId, gauges: formattedGaugesData });

    return formattedGaugesData.map(({ gaugeAddress, ...rest }) => ({
      gaugeAddress,
      ...rest,
      extraRewards: (sideGaugesRewards[gaugeAddress.toLowerCase()] || []),
    }));
  });

  return gauges;
}, {
  maxAge: 1 * 60,
  promise: true,
  normalizer: ([
    poolsData,
    blockchainId,
  ]) => {
    const key = `${poolsData.map(({ address }) => address).join(',')}-${blockchainId}`;
    console.log('key', key)
    return key
  },
});

export default getFactoGaugesForPools;
