import BN from 'bignumber.js';

const DECIMALS_WEI = 1e18;
const DECIMALS_GWEI = 1e9;
const MAX_UINT256 = BN(2).pow(256).minus(1);

export {
  DECIMALS_WEI,
  DECIMALS_GWEI,
  MAX_UINT256,
};
