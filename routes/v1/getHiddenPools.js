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
  monad: [
    'factory-stable-ng-5', // Team asked to hide
    'factory-stable-ng-7', // Team asked to hide
    'factory-stable-ng-17', // Pool deployed incorrectly
    'factory-stable-ng-20', // Pool deployed incorrectly, team asked to hide
  ],
  robinhood: [
    'factory-stable-ng-4', // Malicious oracle
    'factory-stable-ng-5', // Malicious oracle
    'factory-stable-ng-6', // Malicious oracle
    'factory-stable-ng-7', // Malicious oracle
    'factory-stable-ng-8', // Malicious oracle
    'factory-stable-ng-9', // Malicious oracle
    'factory-stable-ng-10', // Malicious oracle
    'factory-stable-ng-12', // Malicious oracle
    'factory-stable-ng-13', // Malicious oracle
    'factory-stable-ng-14', // Malicious oracle
    'factory-stable-ng-15', // Malicious oracle
    'factory-stable-ng-16', // Malicious oracle
    'factory-stable-ng-17', // Malicious oracle
    'factory-stable-ng-18', // Malicious oracle
    'factory-stable-ng-19', // Malicious oracle
    'factory-stable-ng-20', // Malicious oracle
    'factory-stable-ng-21', // Malicious oracle
    'factory-stable-ng-22', // Malicious oracle
    'factory-stable-ng-23', // Malicious oracle
    'factory-stable-ng-24', // Malicious oracle
    'factory-stable-ng-25', // Malicious oracle
    'factory-stable-ng-26', // Malicious oracle
    'factory-stable-ng-27', // Malicious oracle
    'factory-stable-ng-28', // Malicious oracle
    'factory-stable-ng-29', // Malicious oracle
    'factory-stable-ng-30', // Malicious oracle
    'factory-stable-ng-31', // Malicious oracle
    'factory-stable-ng-32', // Malicious oracle
    'factory-stable-ng-33', // Malicious oracle
    'factory-stable-ng-34', // Malicious oracle
    'factory-stable-ng-35', // Malicious oracle
    'factory-stable-ng-36', // Malicious oracle
    'factory-stable-ng-37', // Malicious oracle
    'factory-stable-ng-38', // Malicious oracle
    'factory-stable-ng-39', // Malicious oracle
    'factory-stable-ng-40', // Malicious oracle
    'factory-stable-ng-41', // Malicious oracle
    'factory-stable-ng-42', // Malicious oracle
    'factory-stable-ng-43', // Malicious oracle
    'factory-stable-ng-44', // Malicious oracle
    'factory-stable-ng-45', // Malicious oracle
    'factory-stable-ng-46', // Malicious oracle
    'factory-stable-ng-47', // Malicious oracle
    'factory-stable-ng-48', // Malicious oracle
    'factory-stable-ng-49', // Malicious oracle
    'factory-stable-ng-50', // Malicious oracle
    'factory-stable-ng-51', // Malicious oracle
    'factory-stable-ng-52', // Malicious oracle
    'factory-stable-ng-53', // Malicious oracle
    'factory-stable-ng-54', // Malicious oracle
    'factory-stable-ng-55', // Malicious oracle
    'factory-stable-ng-56', // Malicious oracle
    'factory-stable-ng-57', // Malicious oracle
    'factory-stable-ng-58', // Malicious oracle
    'factory-stable-ng-59', // Malicious oracle
    'factory-stable-ng-60', // Malicious oracle
    'factory-stable-ng-61', // Malicious oracle
    'factory-stable-ng-62', // Malicious oracle
  ],
};

export default fn(async () => HIDDEN_POOLS_IDS, {
  maxAge: 60 * 60,
  cacheKey: 'getHiddenPools',
});
