// Metadata for some pools

// Id of eywa pools in sonic factory-stable-ng registry
// Used to only query their api for relevant assets
const EYWA_POOLS_METADATA = [{
  sonicFactoryStableNgPoolId: 2,
  shortName: 'CrossCurve CRV',
}, {
  taikoFactoryStableNgPoolId: 5,
  shortName: 'CrossCurve Stable',
}, {
  taikoFactoryStableNgPoolId: 6,
  shortName: 'CrossCurve WETH',
}];

const SONIC_FACTO_STABLE_NG_EYWA_POOL_IDS = EYWA_POOLS_METADATA.map(({ sonicFactoryStableNgPoolId }) => sonicFactoryStableNgPoolId).filter((str) => !!str);
const TAIKO_FACTO_STABLE_NG_EYWA_POOL_IDS = EYWA_POOLS_METADATA.map(({ taikoFactoryStableNgPoolId }) => taikoFactoryStableNgPoolId).filter((str) => !!str);

export {
  EYWA_POOLS_METADATA,
  SONIC_FACTO_STABLE_NG_EYWA_POOL_IDS,
  TAIKO_FACTO_STABLE_NG_EYWA_POOL_IDS,
};
