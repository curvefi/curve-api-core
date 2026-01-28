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
    getOldMainRegistryAddress,
    getOldFactoryStableRegistryAddress,
    getOldCryptoRegistryAddress,
    getOldFactoryCryptoRegistryAddress,
    getFactoryEywaRegistryAddress,
  } = config;

  const registryIds = [
    (typeof getFactoryTwocryptoRegistryAddress === 'function' ? 'factory-twocrypto' : null),
    (typeof getFactoryTricryptoRegistryAddress === 'function' ? 'factory-tricrypto' : null),
    (typeof getFactoryStableswapNgRegistryAddress === 'function' ? 'factory-stable-ng' : null),
    (typeof getOldMainRegistryAddress === 'function' ? 'main' : null),
    (typeof getOldFactoryStableRegistryAddress === 'function' ? 'factory-v2' : null),
    (typeof getOldCryptoRegistryAddress === 'function' ? 'crypto' : null),
    (typeof getOldFactoryCryptoRegistryAddress === 'function' ? 'factory-crypto' : null),
    (typeof getFactoryEywaRegistryAddress === 'function' ? 'factory-eywa' : null),
  ];

  const registryAddresses = [
    (typeof getFactoryTwocryptoRegistryAddress === 'function' ? (await getFactoryTwocryptoRegistryAddress()) : null),
    (typeof getFactoryTricryptoRegistryAddress === 'function' ? (await getFactoryTricryptoRegistryAddress()) : null),
    (typeof getFactoryStableswapNgRegistryAddress === 'function' ? (await getFactoryStableswapNgRegistryAddress()) : null),
    (typeof getOldMainRegistryAddress === 'function' ? (await getOldMainRegistryAddress()) : null),
    (typeof getOldFactoryStableRegistryAddress === 'function' ? (await getOldFactoryStableRegistryAddress()) : null),
    (typeof getOldCryptoRegistryAddress === 'function' ? (await getOldCryptoRegistryAddress()) : null),
    (typeof getOldFactoryCryptoRegistryAddress === 'function' ? (await getOldFactoryCryptoRegistryAddress()) : null),
    (typeof getFactoryEywaRegistryAddress === 'function' ? (await getFactoryEywaRegistryAddress()) : null),
  ];

  return {
    registryIds: registryIds.filter((o, i) => o !== null && registryAddresses[i] !== ZERO_ADDRESS),
    registryAddresses: registryAddresses.filter((o) => o !== null && o !== ZERO_ADDRESS),
  };
}, {
  promise: true,
});

export default getPlatformRegistries;
