import { arrayToHashmap } from '#root/utils/Array.js';
import { lc } from '#root/utils/String.js';
import YAML from 'yaml';

// Todo: automate retrieval of these entries from github repo
const yamlConfigFilesUrls = {
  'arbitrum-sepolia': {
    url: 'https://cdn.jsdelivr.net/gh/curvefi/curve-core/deployments/devnet/tutorial_arb_sepolia.yaml',
    isMainnet: false,
  },
  'taiko': {
    url: 'https://cdn.jsdelivr.net/gh/curvefi/curve-core/deployments/prod/taiko.yaml',
    isMainnet: true,
  },
  'neondevnet': {
    url: 'https://cdn.jsdelivr.net/gh/curvefi/curve-core/deployments/devnet/neondevnet.yaml',
    isMainnet: false,
  },
  'corn': {
    url: 'https://cdn.jsdelivr.net/gh/curvefi/curve-core/deployments/prod/corn.yaml',
    isMainnet: true,
  },
  'hyperliquid': {
    url: 'https://cdn.jsdelivr.net/gh/curvefi/curve-core/deployments/devnet/hyperliquid_devnet.yaml',
    isMainnet: false,
  },
};

const configsPromise = Promise.all(Object.entries(yamlConfigFilesUrls).map(async ([networkId, {
  url: configUrl,
  isMainnet,
}]) => {
  const yamlFile = await (await fetch(configUrl)).text();
  const yamlConfig = YAML.parse(yamlFile);

  const explorerBaseUrlWithTrailingSlash = (
    yamlConfig.config.explorer_base_url.slice(-1) === '/' ?
      yamlConfig.config.explorer_base_url :
      `${yamlConfig.config.explorer_base_url}/`
  );

  const config = {
    isMainnet,
    hasNoMainRegistry: true, // No main registry deployed nor address provider
    poolsBaseUrlOld: null,
    poolsBaseUrl: `https://core.curve.fi/#/${networkId}/pools/`,
    shortId: networkId,
    name: yamlConfig.config.network_name,
    nativeCurrencySymbol: yamlConfig.config.native_currency_symbol,
    chainId: yamlConfig.config.chain_id,
    nativeCurrencyCoingeckoId: yamlConfig.config.native_currency_coingecko_id,
    platformCoingeckoId: yamlConfig.config.platform_coingecko_id,
    rpcUrl: yamlConfig.config.public_rpc_url,
    explorerBaseUrl: explorerBaseUrlWithTrailingSlash,
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
export { yamlConfigFilesUrls };
