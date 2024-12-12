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
import configsPromise from '#root/constants/configs/configs.js';

export default fn(async ({ blockchainId }) => {
  const config = (await configsPromise)[blockchainId];
  if (typeof config === 'undefined') {
    throw new NotFoundError(`No deployment data for blockchainId "${blockchainId}"`);
  }

  return config.rawYamlConfig;
}, {
  maxAge: 10 * 60,
  cacheKey: ({ blockchainId }) => `getDeployment-${blockchainId}`,
});
