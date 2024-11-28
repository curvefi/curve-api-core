/**
 * @openapi
 * /getPools/{blockchainId}/{registryId}:
 *   get:
 *     tags:
 *       - Pools
 *     description: |
 *       Returns information on all pools, in a specific registry, on a specific chain.
 *     parameters:
 *       - $ref: '#/components/parameters/blockchainId'
 *       - $ref: '#/components/parameters/registryId'
 *     responses:
 *       200:
 *         description:
 */

import Web3 from 'web3';
import BN from 'bignumber.js';
import groupBy from 'lodash.groupby';
import { fn, ParamError } from '#root/utils/api.js';
import factoryV2RegistryAbi from '#root/constants/abis/factory-v2-registry.json' assert { type: 'json' };
import factoryCryptoRegistryAbi from '#root/constants/abis/factory-crypto-registry.json' assert { type: 'json' };
import factoryTwocryptoRegistryAbi from '#root/constants/abis/factory-twocrypto/registry.json' assert { type: 'json' };
import factoryTricryptoRegistryAbi from '#root/constants/abis/factory-tricrypto/registry.json' assert { type: 'json' };
import factoryStableswapNgRegistryAbi from '#root/constants/abis/factory-stableswap-ng/registry.json' assert { type: 'json' };
import cryptoRegistryAbi from '#root/constants/abis/crypto-registry.json' assert { type: 'json' };
import factoryTwocryptoPoolAbi from '#root/constants/abis/factory-twocrypto/pool.json' assert { type: 'json' };
import factoryTricryptoPoolAbi from '#root/constants/abis/factory-crypto/factory-crypto-pool-2.json' assert { type: 'json' };
import factoryStableNgPoolAbi from '#root/constants/abis/factory-stableswap-ng/pool.json' assert { type: 'json' };
import erc20Abi from '#root/constants/abis/erc20.json' assert { type: 'json' };
import erc20AbiMKR from '#root/constants/abis/erc20_mkr.json' assert { type: 'json' };
import { multiCall } from '#root/utils/Calls.js';
import getPlatformRegistries from '#root/utils/data/curve-platform-registries.js';
import { ZERO_ADDRESS } from '#root/utils/Web3/index.js';
import { flattenArray, sum, arrayToHashmap, arrayOfIncrements } from '#root/utils/Array.js';
import { sequentialPromiseReduce } from '#root/utils/Async.js';
import getAssetsPrices from '#root/utils/data/assets-prices.js';
import getTokensPrices from '#root/utils/data/tokens-prices.js';
import getCrvusdPrice from '#root/utils/data/getCrvusdPrice.js';
import getETHLSTAPYs from '#root/utils/data/getETHLSTAPYs.js';
import getDaiAPYs from '#root/utils/data/getDaiAPYs.js';
import configsPromise from '#root/constants/configs/index.js';
import COIN_ADDRESS_COINGECKO_ID_MAP from '#root/constants/CoinAddressCoingeckoIdMap.js';
import { getImplementation } from '#root/routes/v1/getPools/_utils.js';
import { lc } from '#root/utils/String.js';
import { setTokenPrice, getTokenPrice } from '#root/utils/data/tokens-prices-store.js';
import { IS_DEV } from '#root/constants/AppConstants.js';
import { getAugmentedCoinsFirstPass } from '../_augmentedCoinsUtils.js';
import toSpliced from 'core-js-pure/actual/array/to-spliced.js'; // For compat w/ Node 18
import getFactoGaugesForPools from '#root/utils/data/getFactoGaugesForPools.js';

/* eslint-disable */
const POOL_BALANCE_ABI_UINT256 = [{ "gas": 1823, "inputs": [{ "name": "arg0", "type": "uint256" }], "name": "balances", "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }];
const POOL_BALANCE_ABI_INT128 = [{ "gas": 1823, "inputs": [{ "name": "arg0", "type": "int128" }], "name": "balances", "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }];
const POOL_PRICE_ORACLE_NO_ARGS_ABI = [{ "stateMutability": "view", "type": "function", "name": "price_oracle", "inputs": [], "outputs": [{ "name": "", "type": "uint256" }] }];
const POOL_PRICE_ORACLE_WITH_ARGS_ABI = [{ "stateMutability": "view", "type": "function", "name": "price_oracle", "inputs": [{ "name": "k", "type": "uint256" }], "outputs": [{ "name": "", "type": "uint256" }] }];
const POOL_TOKEN_METHOD_ABI = [{ "stateMutability": "view", "type": "function", "name": "token", "inputs": [], "outputs": [{ "name": "", "type": "address" }], "gas": 468 }, { "stateMutability": "view", "type": "function", "name": "lp_token", "inputs": [], "outputs": [{ "name": "", "type": "address" }], "gas": 468 }];
const POOL_NAME_METHOD_ABI = [{ "stateMutability": "view", "type": "function", "name": "name", "inputs": [], "outputs": [{ "name": "", "type": "string" }] }];
const POOL_SYMBOL_METHOD_ABI = [{ "stateMutability": "view", "type": "function", "name": "symbol", "inputs": [], "outputs": [{ "name": "", "type": "string" }] }];
const POOL_TOTALSUPPLY_METHOD_ABI = [{ "name": "totalSupply", "outputs": [{ "type": "uint256", "name": "" }], "inputs": [], "stateMutability": "view", "type": "function" }];
const REGISTRY_GET_IMPLEMENTATION_ADDRESS_ABI = [factoryV2RegistryAbi.find(({ name }) => name === 'get_implementation_address')]
const REGISTRY_GET_TOKEN_METHOD_ABI = [factoryCryptoRegistryAbi.find(({ name }) => name === 'get_token')]
const REGISTRY_GET_LP_TOKEN_METHOD_ABI = [cryptoRegistryAbi.find(({ name }) => name === 'get_lp_token')]
const ORACLIZED_POOL_DETECTION_ABI = [{ "stateMutability": "view", "type": "function", "name": "oracle_method", "inputs": [], "outputs": [{ "name": "", "type": "uint256" }] }];
/* eslint-enable */
/* eslint-disable object-curly-newline, camelcase */

const MAX_AGE = 5 * 60;

const IGNORED_COINS = {};

// Tokens for which to use Defillama as external price oracle
const EXTERNAL_ORACLE_COINS_ADDRESSES = {};

// Lowercase token address <> symbol to use
const CURVE_POOL_LP_SYMBOLS_OVERRIDES = new Map([]);

// Lowercase token address <> symbol to use
const CURVE_POOL_SYMBOLS_OVERRIDES = new Map([]);

const overrideSymbol = (coin, blockchainId) => ({
  ...coin,
  symbol: (
    CURVE_POOL_LP_SYMBOLS_OVERRIDES.get(lc(coin.address)) ||
    CURVE_POOL_SYMBOLS_OVERRIDES.get(`${blockchainId}-${lc(coin.address)}`) ||
    coin.symbol
  ),
});

const isDefinedCoin = (address) => address !== '0x0000000000000000000000000000000000000000';

/**
 * Params:
 * - blockchainId: any chain where Curve Core is deployed
 * - registryId: 'factory-twocrypto' | 'factory-tricrypto' | 'factory-stable-ng
 */
const getPools = async ({ blockchainId, registryId }) => {
  const config = (await configsPromise)[blockchainId];
  if (typeof config === 'undefined') {
    throw new ParamError(`No config data for blockchainId "${blockchainId}"`);
  }

  const {
    nativeCurrencySymbol,
    rpcUrl,
    factoryImplementationAddressMap: implementationAddressMap,
    getFactoryTwocryptoRegistryAddress,
    getFactoryTricryptoRegistryAddress,
    getFactoryStableswapNgRegistryAddress,
    multicall2Address,
    BASE_POOL_LP_TO_GAUGE_LP_MAP,
    DISABLED_POOLS_ADDRESSES,
    BROKEN_POOLS_ADDRESSES,
  } = config;

  const platformRegistries = (await getPlatformRegistries(blockchainId)).registryIds;

  if (!platformRegistries.includes(registryId)) {
    if (IS_DEV) console.error(`No registry "${registryId}" found for blockchainId "${blockchainId}"`);
    return { poolData: [] };
  }

  const assetTypeMap = new Map([
    ['0', 'usd'],
    ['1', nativeCurrencySymbol.toLowerCase()],
    ['2', 'btc'],
    ['3', 'other'],
  ]);

  const registryAddress = (
    registryId === 'factory-twocrypto' ? await getFactoryTwocryptoRegistryAddress() :
      registryId === 'factory-tricrypto' ? await getFactoryTricryptoRegistryAddress() :
        registryId === 'factory-stable-ng' ? await getFactoryStableswapNgRegistryAddress() :
          undefined
  );
  if (registryAddress === ZERO_ADDRESS || !registryAddress) return { poolData: [], tvlAll: 0 };

  const getIdForPool = (id) => (
    registryId === 'factory-twocrypto' ? `factory-twocrypto-${id}` :
      registryId === 'factory-tricrypto' ? `factory-tricrypto-${id}` :
        registryId === 'factory-stable-ng' ? `factory-stable-ng-${id}` :
          undefined
  );

  const POOL_ABI = (
    registryId === 'factory-twocrypto' ? factoryTwocryptoPoolAbi :
      registryId === 'factory-tricrypto' ? factoryTricryptoPoolAbi :
        registryId === 'factory-stable-ng' ? factoryStableNgPoolAbi :
          undefined
  );

  const REGISTRY_ABI = (
    registryId === 'factory-twocrypto' ? factoryTwocryptoRegistryAbi :
      registryId === 'factory-tricrypto' ? [
        ...factoryTricryptoRegistryAbi,
        ...REGISTRY_GET_IMPLEMENTATION_ADDRESS_ABI, // Hack, see get_implementation_address call for factory-tricrypto for context
      ] :
        registryId === 'factory-stable-ng' ? factoryStableswapNgRegistryAbi :
          undefined
  );


  const web3 = new Web3(rpcUrl);
  const registry = new web3.eth.Contract(REGISTRY_ABI, registryAddress);

  const networkSettingsParam = (
    typeof multicall2Address !== 'undefined' ?
      { networkSettings: { web3, multicall2Address } } :
      undefined
  );

  // Retrieve base pools if any
  let basePoolAddresses = [];
  let finalBasePoolLpAddresses = [];
  const registrySupportsBasePools = REGISTRY_ABI.some(({ name }) => name === 'base_pool_count');

  if (registrySupportsBasePools) {
    const [basePoolCount] = await multiCall([{
      contract: registry,
      methodName: 'base_pool_count',
      ...networkSettingsParam,
    }]);

    if (basePoolCount > 0) {
      const basePoolIds = arrayOfIncrements(basePoolCount);
      basePoolAddresses = (await multiCall(basePoolIds.map((id) => ({
        contract: registry,
        methodName: 'base_pool_list',
        params: [id],
        ...networkSettingsParam,
      })))).map(lc);

      // This array contains all different lp token retrieval methods as used for individual
      // pools further down this script.
      const basePoolLpAddressesRaw = await multiCall(flattenArray(basePoolAddresses.map((address) => [{
        address: registryAddress,
        abi: REGISTRY_GET_TOKEN_METHOD_ABI,
        methodName: 'get_token', // address
        params: [address],
        metaData: { address, type: 'lpTokenAddress_try_3' }, // For factory-crypto registry
        ...networkSettingsParam,
      }, {
        address: registryAddress,
        abi: REGISTRY_GET_LP_TOKEN_METHOD_ABI,
        methodName: 'get_lp_token', // address
        params: [address],
        metaData: { address, type: 'lpTokenAddress_try_4' }, // For crypto registry
        ...networkSettingsParam,
      }])));

      // Make some small changes to received data
      const basePoolLpAddresses = basePoolLpAddressesRaw.map(({ data, metaData }) => {
        // If address isn't null, use this as the definitive lpTokenAddress value
        if (data !== ZERO_ADDRESS) {
          return { data, metaData };
        }

        // If address is null, drop it
        return null;
      }).filter((o) => o !== null);

      finalBasePoolLpAddresses = [
        ...basePoolAddresses.filter((address) => !basePoolLpAddresses.some(({ metaData }) => lc(metaData.address) === lc(address))),
        ...basePoolLpAddresses.map(({ data }) => data),
      ].map(lc);
    }
  }

  const poolCount = Number((await multiCall([{
    contract: registry,
    methodName: 'pool_count',
    ...networkSettingsParam,
  }]))[0]);
  if (poolCount === 0) return { poolData: [], tvlAll: 0, tvl: 0 };

  const unfilteredPoolIds = Array(poolCount).fill(0).map((_, i) => i);

  const unfilteredPoolAddresses = await multiCall(unfilteredPoolIds.map((id) => ({
    contract: registry,
    methodName: 'pool_list',
    params: [id],
    ...networkSettingsParam,
  })));

  // Filter out broken pools, see reason for each in DISABLED_POOLS_ADDRESSES definition
  const poolAddresses = unfilteredPoolAddresses.filter((address) => (
    !DISABLED_POOLS_ADDRESSES.includes(address.toLowerCase())
  ));
  const poolIds = unfilteredPoolIds.filter((id) => (
    !DISABLED_POOLS_ADDRESSES.includes(unfilteredPoolAddresses[id]?.toLowerCase())
  ));

  const otherRegistryPoolsData = []; // Was used for prices from other registries’ pools, but still used for meta pools data, so gotta find another way to get this data now that otherRegistryPoolsData is retired

  const poolDataWithTries = await multiCall(flattenArray(poolAddresses.map((address, i) => {
    const poolId = poolIds[i];
    const poolContract = new web3.eth.Contract([
      ...POOL_ABI,
      ...POOL_TOKEN_METHOD_ABI,
      ...POOL_NAME_METHOD_ABI,
      ...POOL_SYMBOL_METHOD_ABI,
      ...POOL_TOTALSUPPLY_METHOD_ABI,
      ...ORACLIZED_POOL_DETECTION_ABI,
    ], address);

    // Note: reverting for at least some pools, prob non-meta ones: get_underlying_coins, get_underlying_decimals
    return [{
      contract: registry,
      methodName: 'get_coins', // address[4]
      params: [address],
      metaData: { poolId, type: 'coinsAddresses', address },
      ...networkSettingsParam,
    }, {
      contract: registry,
      methodName: 'get_decimals', // address[4]
      params: [address],
      metaData: { poolId, type: 'decimals' },
      ...networkSettingsParam,
    }, {
      contract: poolContract,
      methodName: 'get_virtual_price',
      metaData: { poolId, type: 'virtualPrice' },
      ...networkSettingsParam,
    }, {
      contract: poolContract,
      methodName: 'A',
      metaData: { poolId, type: 'amplificationCoefficient' },
      ...networkSettingsParam,
    }, {
      contract: poolContract,
      methodName: 'oracle_method',
      metaData: { poolId, type: 'oracleMethod' },
      ...networkSettingsParam,
    },
    ...(
      (registryId === 'factory-stable-ng') ? [{
        contract: registry,
        methodName: 'get_underlying_decimals', // address[8]
        params: [address],
        metaData: { poolId, type: 'underlyingDecimals' },
        ...networkSettingsParam,
      }, {
        contract: poolContract,
        methodName: 'totalSupply',
        metaData: { poolId, type: 'totalSupply' },
        ...networkSettingsParam,
      }, {
        contract: poolContract,
        methodName: 'name',
        metaData: { poolId, type: 'name' },
        ...networkSettingsParam,
      }] : []
    ),
    ...(
      (registryId === 'factory-stable-ng') ? [{
        contract: registry,
        methodName: 'get_pool_asset_types',
        params: [address],
        metaData: { poolId, type: 'assetTypes' },
        ...networkSettingsParam,
      }] : []
    ),
    ...(
      (registryId === 'factory-stable-ng') ? [{
        contract: registry,
        methodName: 'get_implementation_address', // address
        params: [address],
        metaData: { poolId, type: 'implementationAddress' },
        ...networkSettingsParam,
      }, {
        contract: poolContract,
        methodName: 'symbol',
        metaData: { poolId, type: 'symbol' },
        ...networkSettingsParam,
      }] : [] // Not fetching totalSupply for main pools because not all pool implementations have a lp token
    ),
    ...(
      registryId === 'factory-tricrypto' ? [{
        contract: poolContract,
        methodName: 'name',
        metaData: { poolId, type: 'name' },
        ...networkSettingsParam,
      }, {
        contract: poolContract,
        methodName: 'symbol',
        metaData: { poolId, type: 'symbol' },
        ...networkSettingsParam,
      }, {
        contract: poolContract,
        methodName: 'totalSupply',
        metaData: { poolId, type: 'totalSupply' },
        ...networkSettingsParam,
      }, {
        contract: registry,
        methodName: 'get_implementation_address',
        params: [address],
        metaData: { poolId, type: 'implementationAddress' },
        ...networkSettingsParam,
        // factory-tricrypto pools on mainnet do not have any view method to read their implementation; currently
        // there's only one implementation available in this registry, so we hardcode it by querying
        // an unexisting method and falling back to the desired value, but we'll need to find
        // another way when another implementation is added.
        superSettings: {
          fallbackValue: '0x66442B0C5260B92cAa9c234ECf2408CBf6b19a6f',
        },
      }] : []
    ),
    ...(
      registryId === 'factory-twocrypto' ? [{
        contract: poolContract,
        methodName: 'name',
        metaData: { poolId, type: 'name' },
        ...networkSettingsParam,
      }, {
        contract: poolContract,
        methodName: 'symbol',
        metaData: { poolId, type: 'symbol' },
        ...networkSettingsParam,
      }, {
        contract: poolContract,
        methodName: 'totalSupply',
        metaData: { poolId, type: 'totalSupply' },
        ...networkSettingsParam,
      }, {
        contract: registry,
        methodName: 'pool_implementations',
        params: [address],
        metaData: { poolId, type: 'implementationAddress', registryId },
      }] : []
    )];
  })));

  const poolDataWithTries2 = registryId === 'factory-stable-ng' ? [] : await multiCall(flattenArray(poolAddresses.map((address) => {
    const poolCoinsAddressesData = poolDataWithTries.find(({ metaData }) => (
      metaData.type === 'coinsAddresses' &&
      address === metaData.address
    ));
    const poolCoinsCount = poolCoinsAddressesData.data.filter((coinAddress) => coinAddress !== '0x0000000000000000000000000000000000000000').length;
    const poolHasMultipleOracles = poolCoinsCount > 2;
    const poolContractForPriceOracleCall = new web3.eth.Contract(poolHasMultipleOracles ? POOL_PRICE_ORACLE_WITH_ARGS_ABI : POOL_PRICE_ORACLE_NO_ARGS_ABI, address);

    // Note: reverting for at least some pools, prob non-meta ones: get_underlying_coins, get_underlying_decimals
    return [
      {
        contract: poolContractForPriceOracleCall,
        methodName: 'price_oracle', // uint256
        params: poolHasMultipleOracles ? [0] : [], // Price oracle for first asset, there are N-1 oracles so we can fetch more if needed
        metaData: { poolId: poolCoinsAddressesData.metaData.poolId, type: 'priceOracle' },
        ...networkSettingsParam,
        superSettings: {
          fallbackValue: null, // Don't default to 0 for pools without price_oracle
        },
      },
      // There are N-1 oracles
      ...(poolHasMultipleOracles ? arrayOfIncrements(poolCoinsCount - 1).map((i) => ({
        contract: poolContractForPriceOracleCall,
        methodName: 'price_oracle', // uint256
        params: [i],
        metaData: { poolId: poolCoinsAddressesData.metaData.poolId, type: 'priceOracles', index: i },
        ...networkSettingsParam,
        superSettings: {
          fallbackValue: null, // Don't default to 0 for pools without price_oracle
        },
      })) : []),
    ];
  })));

  // Make some small changes to received data
  const poolData = [...poolDataWithTries, ...poolDataWithTries2].map(({ data, metaData }) => {
    const isLpTokenAddressTry = metaData.type?.startsWith('lpTokenAddress_try_');
    if (isLpTokenAddressTry) {
      // If address isn't null, use this as the definitive lpTokenAddress value
      if (data !== ZERO_ADDRESS) {
        return {
          data,
          metaData: {
            ...metaData,
            type: 'lpTokenAddress',
          },
        };
      }

      // If address is null, drop it
      return null;
    }

    /**
     * The two-crypto facto has a known issue with pool_implementations()
     * that returns the zero address. This catches this situation and
     * replaces zero address with this factory's first pool implementation.
     */
    const isUnavailableTwoCryptoFactoPoolImplementation = (
      metaData.type === 'implementationAddress' &&
      metaData.registryId === 'factory-twocrypto' &&
      data === ZERO_ADDRESS
    );
    if (isUnavailableTwoCryptoFactoPoolImplementation) {
      return {
        data: '0x04Fd6beC7D45EFA99a27D29FB94b55c56dD07223',
        metaData,
      };
    }

    return { data, metaData };
  }).filter((o) => o !== null);

  const lpTokensWithMetadata = poolData.filter(({ data, metaData }) => (
    metaData.type === 'lpTokenAddress' &&
    data !== ZERO_ADDRESS
  ));

  const lpTokenData = (
    lpTokensWithMetadata.length === 0 ? [] :
      await multiCall(flattenArray(lpTokensWithMetadata.map(({
        data: address,
        metaData,
      }) => {
        const lpTokenContract = new web3.eth.Contract(erc20Abi, address);

        return [{
          contract: lpTokenContract,
          methodName: 'name',
          metaData: { poolId: metaData.poolId, type: 'name' },
          ...networkSettingsParam,
        }, {
          contract: lpTokenContract,
          methodName: 'symbol',
          metaData: { poolId: metaData.poolId, type: 'symbol' },
          ...networkSettingsParam,
        }, {
          contract: lpTokenContract,
          methodName: 'totalSupply',
          metaData: { poolId: metaData.poolId, type: 'totalSupply' },
          ...networkSettingsParam,
        }];
      })))
  );

  const augmentedPoolData = [
    ...poolData,
    ...lpTokenData,
  ];

  const emptyData = poolIds.map((id) => ({ id: getIdForPool(id) }));
  const mergedPoolData = augmentedPoolData.reduce((accu, { data, metaData: { poolId, type, ...otherMetaData } }) => {
    const index = accu.findIndex(({ id }) => id === getIdForPool(poolId));
    const poolInfo = accu[index];

    // eslint-disable-next-line no-param-reassign
    accu[index] = {
      ...poolInfo,
      address: poolAddresses[index],
      [type]: (
        (type === 'priceOracle' && data !== null) ? (data / 1e18) :
          (type === 'priceOracles' && data !== null) ? toSpliced((poolInfo.priceOracles ?? []), otherMetaData.index, 0, (data / 1e18)) :
            data
      ),
    };

    return accu;
  }, emptyData);

  const allCoinAddresses = augmentedPoolData.reduce((accu, { data, metaData: { poolId, type } }) => {
    if (type === 'coinsAddresses') {
      const poolCoins = data.filter(isDefinedCoin);
      return accu.concat(poolCoins.map((address) => ({ poolId, address })));
    }

    return accu;
  }, []);

  let coinAddressesAndPricesMapFallback;
  let crvusdTokenAddresseAndPriceMapFallback;
  const coinsFallbackPricesFromCgId = (
    COIN_ADDRESS_COINGECKO_ID_MAP[blockchainId] ?
      await getAssetsPrices(Array.from(Object.values(COIN_ADDRESS_COINGECKO_ID_MAP[blockchainId]))) :
      {}
  );

  const coinAddressesAndPricesMapFallbackFromCgId = (
    COIN_ADDRESS_COINGECKO_ID_MAP[blockchainId] ?
      arrayToHashmap(
        Array.from(Object.entries(COIN_ADDRESS_COINGECKO_ID_MAP[blockchainId]))
          .map(([address, coingeckoId]) => [
            address.toLowerCase(),
            coinsFallbackPricesFromCgId[coingeckoId],
          ])
      ) :
      {}
  );

  const coinsFallbackPricesFromAddress = (
    EXTERNAL_ORACLE_COINS_ADDRESSES[blockchainId] ?
      await getTokensPrices(EXTERNAL_ORACLE_COINS_ADDRESSES[blockchainId], blockchainId) :
      {}
  );

  const coinAddressesAndPricesMapFallbackFromAddress = (
    EXTERNAL_ORACLE_COINS_ADDRESSES[blockchainId] ?
      arrayToHashmap(
        EXTERNAL_ORACLE_COINS_ADDRESSES[blockchainId].map((address) => [
          address,
          coinsFallbackPricesFromAddress[address],
        ])
      ) :
      {}
  );

  coinAddressesAndPricesMapFallback = {
    ...coinAddressesAndPricesMapFallbackFromCgId,
    ...coinAddressesAndPricesMapFallbackFromAddress,
  };

  crvusdTokenAddresseAndPriceMapFallback = await getCrvusdPrice(blockchainId);

  const coinData = await multiCall(flattenArray(allCoinAddresses.map(({ poolId, address }) => {
    const isNativeEth = address.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

    const hasByte32Symbol = (
      blockchainId === 'ethereum' &&
      address.toLowerCase() === '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2'
    );
    const coinContract = (
      isNativeEth ? undefined :
        hasByte32Symbol ? new web3.eth.Contract(erc20AbiMKR, address) :
          new web3.eth.Contract(erc20Abi, address)
    );

    const poolAddress = poolAddresses[poolIds.indexOf(poolId)];
    const poolContractUint256 = new web3.eth.Contract(POOL_BALANCE_ABI_UINT256, poolAddress);
    const poolContractInt128 = new web3.eth.Contract(POOL_BALANCE_ABI_INT128, poolAddress);
    const coinIndex = poolData.find(({ metaData }) => (
      metaData.type === 'coinsAddresses' &&
      metaData.poolId === poolId
    )).data.findIndex((coinAddress) => coinAddress.toLowerCase() === address.toLowerCase());

    return [...(isNativeEth ? [{
      contract: poolContractUint256,
      methodName: 'balances',
      params: [coinIndex],
      metaData: { poolId, poolAddress, coinAddress: address, isNativeEth, type: 'poolBalance' },
      ...networkSettingsParam,
    }] : [{
      contract: coinContract,
      methodName: 'decimals',
      metaData: { poolId, poolAddress, coinAddress: address, isNativeEth, type: 'decimals' },
      ...networkSettingsParam,
    }, {
      contract: coinContract,
      methodName: 'symbol',
      metaData: { poolId, poolAddress, coinAddress: address, isNativeEth, type: 'symbol' },
      ...networkSettingsParam,
    }, {
      contract: poolContractUint256,
      methodName: 'balances',
      params: [coinIndex],
      metaData: { poolId, poolAddress, coinAddress: address, isNativeEth, type: 'poolBalanceUint256' },
      ...networkSettingsParam,
    }, {
      contract: poolContractInt128,
      methodName: 'balances',
      params: [coinIndex],
      metaData: { poolId, poolAddress, coinAddress: address, isNativeEth, type: 'poolBalanceInt128' },
      ...networkSettingsParam,
    }]), ...(
      /**
       * On Ethereum factory, meta pools keep the base pool's lp in balance due to gas considerations;
       * we have to take into account any amount staked. On sidechain factories, meta pools have
       * their whole base pool balance as gauge lp, so we don't look at staked amount else it'd lead
       * to double-counting.
       */
      (blockchainId === 'ethereum' && typeof BASE_POOL_LP_TO_GAUGE_LP_MAP !== 'undefined' && BASE_POOL_LP_TO_GAUGE_LP_MAP.has(address)) ?
        [{
          contract: new web3.eth.Contract(erc20Abi, BASE_POOL_LP_TO_GAUGE_LP_MAP.get(address)),
          methodName: 'balanceOf',
          params: [poolAddress],
          metaData: { poolId, poolAddress, coinAddress: address, isNativeEth, type: 'poolStakedBalance' },
          ...networkSettingsParam,
        }] :
        []
    )];
  })));

  const mergedCoinData = coinData.reduce((accu, { data, metaData: { poolId, poolAddress, coinAddress, type, isNativeEth } }) => {
    const key = `${getIdForPool(poolId)}-${coinAddress}`;
    const coinInfo = accu[key];

    const coinPrice = (
      (IGNORED_COINS[blockchainId] || []).includes(coinAddress.toLowerCase()) ? 0 :
        (
          crvusdTokenAddresseAndPriceMapFallback[coinAddress.toLowerCase()] ||
          coinAddressesAndPricesMapFallback[coinAddress.toLowerCase()] ||
          (getTokenPrice(coinAddress, blockchainId) ?? null) ||
          null
        )
    );

    const hardcodedInfoForNativeEth = {
      decimals: 18,
      symbol: nativeCurrencySymbol,
    };

    const poolInfo = mergedPoolData.find(({ id }) => id === getIdForPool(poolId))
    const poolImplementation = getImplementation({
      registryId,
      config,
      poolInfo,
      implementationAddressMap,
    });

    const isPermissionlessRegistry = registryId.startsWith('factory');
    const hasMetaPoolImplementation = poolImplementation.includes('meta');

    // eslint-disable-next-line no-param-reassign
    accu[key] = {
      ...coinInfo,
      address: coinAddress,
      usdPrice: coinPrice,
      ...(
        // Most pool contracts expect a coin index as uint256, which we retrieve in poolBalanceUint256
        type === 'poolBalanceUint256' ? { poolBalance: data } :
          // Some pool contracts expect a coin index as int128, which we retrieve in poolBalanceInt128,
          // and use as fallback value for poolBalance
          type === 'poolBalanceInt128' ? { poolBalance: BN.max(coinInfo.poolBalance, data).toFixed() } :
            type === 'poolStakedBalance' ? { poolBalance: BN(coinInfo.poolBalance).plus(data).toFixed() } :
              { [type]: data }
      ),
      ...(isNativeEth ? hardcodedInfoForNativeEth : {}),
      isBasePoolLpToken: (
        (
          finalBasePoolLpAddresses.includes(lc(coinAddress))
        ) &&
        (!isPermissionlessRegistry || hasMetaPoolImplementation)
      ),
    };

    return accu;
  }, {});

  // Fetch get_dy() between all coins in all pools in order to derive prices within a pool where necessary.
  // This is only for "factory" pools; not "main", not "crypto", not "factory-crypto", which all have other
  // methods of deriving internal prices.
  const rawInternalPoolsPrices = (
    await multiCall(flattenArray(mergedPoolData.map((poolInfo) => {
      const {
        id,
        address,
        coinsAddresses: unfilteredCoinsAddresses,
        decimals,
        totalSupply,
      } = poolInfo;

      const implementation = getImplementation({
        registryId,
        config,
        poolInfo,
        implementationAddressMap,
      });
      const isUsdMetaPool = implementation.startsWith('metausd') || implementation.startsWith('v1metausd');

      const SMALL_AMOUNT_UNIT = BN(isUsdMetaPool ? 10000 : 1);
      if (Number(totalSupply) < SMALL_AMOUNT_UNIT.times(1e18)) return []; // Ignore empty pools

      const coinsAddresses = unfilteredCoinsAddresses.filter(isDefinedCoin);
      const poolContract = new web3.eth.Contract(POOL_ABI, address);

      return flattenArray(coinsAddresses.map((_, i) => {
        const iDecimals = Number(decimals[i]);
        const smallAmount = SMALL_AMOUNT_UNIT.times(BN(10).pow(iDecimals)).toFixed();

        return coinsAddresses.map((__, j) => {
          if (j === i) return null;

          return {
            contract: poolContract,
            methodName: 'get_dy',
            params: [i, j, smallAmount],
            metaData: {
              poolId: id,
              i,
              j,
              jDivideBy: SMALL_AMOUNT_UNIT.times(BN(10).pow(Number(decimals[j]))),
            },
            ...networkSettingsParam,
          };
        }).filter((call) => call !== null);
      }));
    })))
  );

  const internalPoolsPrices = groupBy(rawInternalPoolsPrices.map(({
    data,
    metaData: { poolId, i, j, jDivideBy },
  }) => {
    const rate = data / jDivideBy;
    return { rate, poolId, i, j };
  }), 'poolId');

  const augmentedDataPart1 = await sequentialPromiseReduce(mergedPoolData, async (poolInfo, i, wipMergedPoolData) => {
    const implementation = getImplementation({
      registryId,
      config,
      poolInfo,
      implementationAddressMap,
    });

    const isUsdMetaPool = implementation.startsWith('metausd') || implementation.startsWith('v1metausd');
    const isBtcMetaPool = implementation.startsWith('metabtc') || implementation.startsWith('v1metabtc');

    // We derive asset type (i.e. used as the reference asset on the FE) from pool implementation if possible,
    // and fall back to the assetType prop.
    const assetTypeName = (
      (implementation === 'plain2eth' || implementation === 'plain2ethema' || implementation === 'plain2ethema2' || implementation === 'plain3eth' || implementation === 'plain4eth') ? nativeCurrencySymbol.toLowerCase() :
        isBtcMetaPool ? 'btc' :
          isUsdMetaPool ? 'usd' :
            (assetTypeMap.get(poolInfo.assetType) || 'unknown')
    );

    const augmentedCoins = await getAugmentedCoinsFirstPass({
      poolInfo,
      mergedCoinData,
      blockchainId,
      registryId,
      wipMergedPoolData,
      internalPoolsPrices,
    });

    return {
      ...poolInfo,
      implementation,
      assetTypeName,
      coins: augmentedCoins,
    };
  });

  const augmentedDataPart2 = await sequentialPromiseReduce(augmentedDataPart1, async (poolInfo, i, wipMergedPoolData) => {
    const augmentedCoins = poolInfo.coins;

    const usdTotal = (
      (BROKEN_POOLS_ADDRESSES || []).includes(lc(poolInfo.address)) ? 0 :
        sum(augmentedCoins.map(({ usdPrice, poolBalance, decimals }) => (
          poolBalance / (10 ** decimals) * usdPrice
        )))
    );

    const usdTotalExcludingBasePool = (
      (BROKEN_POOLS_ADDRESSES || []).includes(lc(poolInfo.address)) ? 0 :
        sum(augmentedCoins.filter(({ isBasePoolLpToken }) => !isBasePoolLpToken).map(({ usdPrice, poolBalance, decimals }) => (
          poolBalance / (10 ** decimals) * usdPrice
        )))
    );

    const metaPoolBasePoolLpToken = augmentedCoins.find(({ isBasePoolLpToken }) => isBasePoolLpToken);
    const isMetaPool = typeof metaPoolBasePoolLpToken !== 'undefined';

    // here need to be able to retrieve from getPools/ethereum/base-pools, a special endpoint that returns only base pools, so it can be a cheap dependency
    const underlyingPool = (
      isMetaPool ? (
        [...wipMergedPoolData, ...otherRegistryPoolsData].find(({ lpTokenAddress, address }) => (
          (lpTokenAddress || address).toLowerCase() === metaPoolBasePoolLpToken.address.toLowerCase()
        ))
      ) : undefined
    );

    // How much does that pool own, in its balances, of the underlying pool
    const underlyingPoolLpOwnershipRate = (
      (isMetaPool && underlyingPool) ? (
        (metaPoolBasePoolLpToken.poolBalance / 1e18) / (underlyingPool.totalSupply / 1e18)
      ) : undefined
    );

    const underlyingPoolCoins = (
      (isMetaPool && underlyingPool) ? (
        underlyingPool.coins.map((coin) => ({
          ...coin,
          poolBalance: BN(coin.poolBalance).times(underlyingPoolLpOwnershipRate).toFixed(0),
        }))
      ) : undefined
    );

    const underlyingCoins = (
      (isMetaPool && underlyingPool) ? (
        flattenArray(augmentedCoins.map((coin) => (
          coin.isBasePoolLpToken ? underlyingPoolCoins : coin
        )))
      ) : undefined
    );

    const poolsUrlsIds = [
      (config.poolsBaseUrl ? poolInfo.id : null),
      (config.poolsBaseUrlOld ? poolInfo.id : null),
    ];

    const poolUrls = [
      (poolsUrlsIds[0] !== null ? `${config.poolsBaseUrl}${poolsUrlsIds[0]}` : null),
      (poolsUrlsIds[1] !== null ? `${config.poolsBaseUrlOld}${poolsUrlsIds[1]}` : null),
    ];

    const detailedPoolUrls = {
      swap: [
        (poolUrls[0] !== null ? `${poolUrls[0]}/swap` : null),
        (poolUrls[1] !== null ? `${poolUrls[1]}` : null),
      ].filter((o) => o !== null),
      deposit: [
        (poolUrls[0] !== null ? `${poolUrls[0]}/deposit` : null),
        (poolUrls[1] !== null ? `${poolUrls[1]}/deposit` : null),
      ].filter((o) => o !== null),
      withdraw: [
        (poolUrls[0] !== null ? `${poolUrls[0]}/withdraw` : null),
        (poolUrls[1] !== null ? `${poolUrls[1]}/withdraw` : null),
      ].filter((o) => o !== null),
    };

    /**
    * Detect pools with oracles: oracle_method must be present (if not present,
    * call returns default value of zero) and non-zero
    */
    const usesRateOracle = Number(poolInfo.oracleMethod) !== 0;
    const [
      ethereumLSTAPYs,
      ethereumDaiAPYs,
    ] = await Promise.all([
      getETHLSTAPYs(),
      getDaiAPYs(),
    ]);

    if (isMetaPool && typeof underlyingPool === 'undefined') {
      throw new Error(`Pool ${poolInfo.address} is a meta pool, yet we couldn’t retrieve its underlying pool. Please check METAPOOL_REGISTRIES_DEPENDENCIES, its base pool’s registry is likely missing.`)
    }

    const augmentedPool = {
      ...poolInfo,
      poolUrls: detailedPoolUrls,
      lpTokenAddress: (poolInfo.lpTokenAddress || poolInfo.address),
      coins: augmentedCoins.map((coin) => {
        const ethLsdApyData = ethereumLSTAPYs.find(({ lstAddress, blockchainId: lstBlockchainId }) => (
          lstBlockchainId === blockchainId &&
          lstAddress === lc(coin.address)
        ));
        const ethDaiApyData = ethereumDaiAPYs.find(({ address }) => address === lc(coin.address));

        return ({
          ...overrideSymbol(coin, blockchainId),
          ...(typeof ethLsdApyData !== 'undefined' ? { ethLsdApy: ethLsdApyData.stakingApy } : {}),
          ...(typeof ethDaiApyData !== 'undefined' ? { ethLsdApy: ethDaiApyData.apy } : {}), // Stuffed in the same prop as LSTs apys
        });
      }),
      usdTotal,
      isMetaPool,
      basePoolAddress: (isMetaPool ? underlyingPool.address : undefined),
      underlyingDecimals: (isMetaPool ? poolInfo.underlyingDecimals : undefined),
      underlyingCoins,
      usdTotalExcludingBasePool,
      oracleMethod: undefined, // Don't return this value, unneeded for api consumers
      assetTypes: undefined, // Don't return this value, unneeded for api consumers
      usesRateOracle,
      isBroken: (BROKEN_POOLS_ADDRESSES || []).includes(lc(poolInfo.address)),
    };

    // Save token prices with accurate poolUsdTotal attached
    augmentedPool.coins.forEach(({
      usdPrice,
      address,
    }) => {
      if (usdPrice !== null) {
        setTokenPrice({
          blockchainId,
          address,
          price: usdPrice,
          poolAddress: augmentedPool.address,
          poolUsdTotal: augmentedPool.usdTotal,
        });
      }
    });

    return augmentedPool;
  });

  const gaugesData = await getFactoGaugesForPools(augmentedDataPart2, blockchainId);
  const augmentedDataPart3 = augmentedDataPart2.map((poolData) => {
    const gaugeData = gaugesData.find(({ poolAddress }) => poolAddress === poolData.address);

    return {
      ...poolData,
      gaugeAddress: gaugeData?.gaugeAddress,
      lpTokenPrice: gaugeData?.lpTokenPrice,
      gaugeExtraRewards: gaugeData?.extraRewards,
      gaugeIsKilled: gaugeData?.isKilled,
    };
  });

  const augmentedData = augmentedDataPart3;

  return {
    poolData: augmentedData,
    tvlAll: sum(augmentedData.map(({ usdTotalExcludingBasePool }) => usdTotalExcludingBasePool)),
  };
};

const getPoolsFn = fn(getPools, {
  maxAge: MAX_AGE,
  cacheKey: ({ blockchainId, registryId }) => `getPools-${blockchainId}-${registryId}`,
});

export default getPoolsFn;
