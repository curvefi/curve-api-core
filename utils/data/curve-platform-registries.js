import memoize from 'memoizee';
import getConfigs from '#root/constants/configs/index.js';
import { ZERO_ADDRESS } from '#root/utils/Web3/index.js';

const getPlatformRegistries = memoize(async (blockchainId) => {
  const config = (await getConfigs())[blockchainId];
  if (typeof config === 'undefined') {
    throw new Error(`No config data for blockchainId "${blockchainId}"`);
  }

  const {
    getFactoryTwocryptoRegistryAddress,
    getFactoryTricryptoRegistryAddress,
    getFactoryStableswapNgRegistryAddress,
  } = config;

  const registryIds = [
    (typeof getFactoryTwocryptoRegistryAddress === 'function' ? 'factory-twocrypto' : null),
    (typeof getFactoryTricryptoRegistryAddress === 'function' ? 'factory-tricrypto' : null),
    (typeof getFactoryStableswapNgRegistryAddress === 'function' ? 'factory-stable-ng' : null),
  ];

  const registryAddresses = [
    (typeof getFactoryTwocryptoRegistryAddress === 'function' ? (await getFactoryTwocryptoRegistryAddress()) : null),
    (typeof getFactoryTricryptoRegistryAddress === 'function' ? (await getFactoryTricryptoRegistryAddress()) : null),
    (typeof getFactoryStableswapNgRegistryAddress === 'function' ? (await getFactoryStableswapNgRegistryAddress()) : null),
  ];

  return {
    registryIds: registryIds.filter((o, i) => o !== null && registryAddresses[i] !== ZERO_ADDRESS),
    registryAddresses: registryAddresses.filter((o) => o !== null && o !== ZERO_ADDRESS),
  };
}, {
  promise: true,
});

export default getPlatformRegistries;
