/**
 * @openapi
 * /getPlatforms:
 *   get:
 *     tags:
 *       - Misc
 *     description: |
 *       Returns platforms (also known as `blockchainId` in other API endpoints) that Curve is deployed on, and which pool registries are available on each platform.
 *       Useful to then query e.g. [`/api/getPools/{blockchainId}/{registryId}`](#/default/get_getPools__blockchainId___registryId_)
 *     responses:
 *       200:
 *         description:
 */

import { getAllBlockchainIds } from '#root/constants/configs/index.js';
import getConfigs from '#root/constants/configs/configs.js';
import { arrayToHashmap } from '#root/utils/Array.js';
import { fn } from '#root/utils/api.js';
import getPlatformRegistries from '#root/utils/data/curve-platform-registries.js';

export default fn(async () => ({
  platforms: arrayToHashmap(await Promise.all((await getAllBlockchainIds()).map(async (blockchainId) => [
    blockchainId,
    (await getPlatformRegistries(blockchainId)).registryIds,
  ]))),
  platformsMetadata: arrayToHashmap(await Promise.all((await getAllBlockchainIds()).map(async (blockchainId) => {
    const { isMainnet, rpcUrl, name, chainId, explorerBaseUrl, nativeCurrencySymbol } = (await getConfigs())[blockchainId];

    return [blockchainId, {
      isMainnet,
      rpcUrl,
      name,
      chainId,
      explorerBaseUrl,
      nativeCurrencySymbol,
    }];
  }))),
}), {
  maxAge: 10 * 60,
  cacheKey: 'getPlatforms',
});
