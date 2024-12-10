import { arrayToHashmap } from '#root/utils/Array.js';
import { lc } from '#root/utils/String.js';
import YAML from 'yaml';
import { Octokit } from '@octokit/rest';
import { sequentialPromiseFlatMap, sequentialPromiseMap } from '#root/utils/Async.js';

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
  'corn_maizenet': {
    url: 'https://cdn.jsdelivr.net/gh/curvefi/curve-core/deployments/prod/corn.yaml',
    isMainnet: true,
  },
  'hyperliquid': {
    url: 'https://cdn.jsdelivr.net/gh/curvefi/curve-core/deployments/devnet/hyperliquid_devnet.yaml',
    isMainnet: false,
  },
};

const configsPromise = (async () => {
  const octokit = new Octokit({
    auth: process.env.GITHUB_FINE_GRAINED_PERSONAL_ACCESS_TOKEN,
    userAgent: process.env.GITHUB_API_UA,
  });

  const filePaths = await sequentialPromiseFlatMap(['prod', 'devnet'], async (folder) => (
    octokit.rest.repos.getContent({
      owner: 'curvefi',
      repo: 'curve-core',
      path: `deployments/${folder}`,
    }).then(({ data }) => data.map(({ path }) => path))
  ));

  const configs = await sequentialPromiseMap(filePaths, async (filePath) => (
    octokit.rest.repos.getContent({
      owner: 'curvefi',
      repo: 'curve-core',
      path: filePath,
    }).then(({ data: { content } }) => {
      const yamlFile = Buffer.from(content, 'base64').toString();
      const yamlConfig = YAML.parse(yamlFile);

      const networkId = yamlConfig.config.file_name;
      const explorerBaseUrlWithTrailingSlash = (
        yamlConfig.config.explorer_base_url.slice(-1) === '/' ?
          yamlConfig.config.explorer_base_url :
          `${yamlConfig.config.explorer_base_url}/`
      );

      const config = {
        isMainnet: filePath.startsWith('deployments/prod'),
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
        referenceTokenAddresses: {
          usdc: yamlConfig.config.reference_token_addresses?.usdc,
          usdt: yamlConfig.config.reference_token_addresses?.usdt,
          weth: yamlConfig.config.reference_token_addresses?.weth,
        },
      };

      return [networkId, config];
    })
  )).then((res) => arrayToHashmap(res));

  return configs;
})();

export default configsPromise;
export { yamlConfigFilesUrls };
