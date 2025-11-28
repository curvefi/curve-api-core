/**
 * @openapi
 * /getDeployment/{blockchainId}:
 *   get:
 *     tags:
 *       - Misc
 *     description: |
 *       Returns deployment information on a specific chain
 *     parameters:
 *       - $ref: '#/components/parameters/blockchainId'
 *     responses:
 *       200:
 *         description:
 */

import { fn, NotFoundError } from '#root/utils/api.js';
import getConfigs from '#root/constants/configs/configs.js';
import { getAllBlockchainIds } from '#root/constants/configs/index.js';

/**
* Some networks are disabled (e.g. not functioning public rpc) but need their deployment
* config to be available through this endpoint, hence we also return configs for disabled
* deployments, in this endpoint only.
*/
export default fn(async ({ blockchainId }) => {
  let config = (await getConfigs())[blockchainId];
  if (typeof config === 'undefined') {
    config = (await getConfigs(false))[blockchainId];

    if (typeof config === 'undefined') {
      throw new NotFoundError(`No deployment data for blockchainId "${blockchainId}"`);
    }
  }

  return config.rawYamlConfig;
}, {
  maxAge: 10 * 60,
  cacheKey: ({ blockchainId }) => `getDeployment-${blockchainId}`,
  paramSanitizers: {
    blockchainId: async ({ blockchainId }) => ({
      isValid: (await getAllBlockchainIds(false)).includes(blockchainId),
    }),
  },
});
