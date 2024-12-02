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

import YAML from 'yaml';
import { fn, NotFoundError } from '#root/utils/api.js';
import { yamlConfigFilesUrls } from '#root/constants/configs/configs.js';

export default fn(async ({ blockchainId }) => {
  const { url: configFileUrl } = yamlConfigFilesUrls[blockchainId] ?? {};

  if (typeof configFileUrl === 'undefined') {
    throw new NotFoundError(`No deployment data for blockchainId "${blockchainId}"`);
  }

  const yamlFile = await (await fetch(configFileUrl)).text();
  const yamlConfig = YAML.parse(yamlFile);

  return yamlConfig;
}, {
  maxAge: 10 * 60,
  cacheKey: ({ blockchainId }) => `getDeployment-${blockchainId}`,
});
