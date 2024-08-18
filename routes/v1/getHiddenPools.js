/**
 * @openapi
 * /getHiddenPools:
 *   get:
 *     tags:
 *       - Pools
 *     description: Returns a list of pool ids, grouped by chain id, that are known to be dysfunctional in some way. This list can be used by front-ends to avoid displaying these pools, and protect users from interacting with these pools.
 *     responses:
 *       200:
 *         description:
 */

import { fn } from '#root/utils/api.js';

const HIDDEN_POOLS_IDS = {};

export default fn(async () => HIDDEN_POOLS_IDS, {
  maxAge: 60 * 60,
  cacheKey: 'getHiddenPools',
});
