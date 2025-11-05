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

const HIDDEN_POOLS_IDS = {
  hyperliquid: [
    'factory-stable-ng-6', // test pool, team asked to hide it
    'factory-stable-ng-11', // test pool, team asked to hide it
  ],
  xdc: [
    'factory-tricrypto-1', // test pool, team asked to hide it
  ],  
  tac: [
    'factory-stable-ng-0', // pool redeployed, team asked to hide it
    'factory-stable-ng-1', // pool redeployed, team asked to hide it 
    'factory-twocrypto-4', // pool redeployed, team asked to hide it 
    'factory-stable-ng-5', // pool redeployed, team asked to hide it
    'factory-stable-ng-13', // team asked to hide it
    'factory-twocrypto-0', // team asked to hide it
  ],
  etherlink: [
    'factory-stable-ng-5', // wrong deployed pool, team asked to hide
  ],
  plume: [
    'factory-stable-ng-34', // spam
    'factory-stable-ng-39', // spam
    'factory-stable-ng-41', // spam
    'factory-twocrypto-30', // spam
    'factory-twocrypto-31', // spam
    'factory-tricrypto-7', // spam
  ],
  unichain: [
    'factory-stable-ng-0', // wrong deployed pool
  ],
};

export default fn(async () => HIDDEN_POOLS_IDS, {
  maxAge: 60 * 60,
  cacheKey: 'getHiddenPools',
});
