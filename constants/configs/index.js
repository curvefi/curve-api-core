import configsPromise from '#root/constants/configs/configs.js';

const getConfigByRpcUrl = async (rpcUrl) => (
  Object.entries(await configsPromise).find(([, config]) => config.rpcUrl === rpcUrl)
);

const allBlockchainIds = configsPromise.then((configs) => Object.keys(configs));

export default configsPromise;
export {
  getConfigByRpcUrl,
  allBlockchainIds,
};
