import getConfigs from '#root/constants/configs/configs.js';

const getConfigByRpcUrl = async (rpcUrl) => (
  Object.entries(await getConfigs()).find(([, config]) => config.rpcUrl === rpcUrl)
);

const allBlockchainIds = getConfigs().then((configs) => Object.keys(configs));

export default getConfigs;
export {
  getConfigByRpcUrl,
  allBlockchainIds,
};
