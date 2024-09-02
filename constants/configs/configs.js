import { arrayToHashmap } from '#root/utils/Array.js';
import { lc } from '#root/utils/String.js';
import YAML from 'yaml';

const yamlConfigFilesUrls = {
  sepolia: 'https://cdn.jsdelivr.net/gh/curvefi/curve-core/deployments/tutorial_arb_sepolia.yaml',
};

const configsPromise = Promise.all(Object.entries(yamlConfigFilesUrls).map(async ([networkId, configUrl]) => {
  const yamlFile = await (await fetch(configUrl)).text();
  const yamlConfig = YAML.parse(yamlFile);

  const config = {
    hasNoMainRegistry: true, // No main registry deployed nor address provider
    poolsBaseUrlOld: null,
    poolsBaseUrl: `https://core.curve.fi/#/${networkId}/pools/`,
    shortId: networkId,
    nativeCurrencySymbol: yamlConfig.config.native_currency_symbol,
    chainId: yamlConfig.config.chain_id,
    nativeCurrencyCoingeckoId: yamlConfig.config.native_currency_coingecko_id,
    platformCoingeckoId: yamlConfig.config.platform_coingecko_id,
    rpcUrl: yamlConfig.config.public_rpc_url,
    multicall2Address: '0xca11bde05977b3631167028862be2a173976ca11', // Assumes multicall is deployed on all chains at this same address
    getFactoryTricryptoRegistryAddress: async () => yamlConfig.contracts.amm.tricryptoswap.factory.address,
    getFactoryTwocryptoRegistryAddress: async () => yamlConfig.contracts.amm.twocryptoswap.factory.address,
    getFactoryStableswapNgRegistryAddress: async () => yamlConfig.contracts.amm.stableswap.factory.address,
    gaugeRegistryAddress: yamlConfig.contracts.gauge.child_gauge.factory.address,
    factoryImplementationAddressMap: new Map([
      [lc(yamlConfig.contracts.amm.stableswap.implementation.address), 'plainstableng'],
      [lc(yamlConfig.contracts.amm.stableswap.meta_implementation.address), 'metausdstableng'],
      [lc(yamlConfig.contracts.amm.twocryptoswap.implementation.address), 'twocrypto-optimized'],
      [lc(yamlConfig.contracts.amm.tricryptoswap.implementation.address).toLowerCase(), 'tricrypto-optimized'],
    ]),
    BASE_POOL_LP_TO_GAUGE_LP_MAP: new Map([]),
    DISABLED_POOLS_ADDRESSES: [].map(lc),
  };

  return [networkId, config];
})).then((res) => arrayToHashmap(res));

export default configsPromise;
