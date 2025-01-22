// Metadata for some pools

// Id of eywa pools in sonic factory-stable-ng registry
// Used to only query their api for relevant assets
const EYWA_POOLS_METADATA = [{
  sonicFactoryStableNgPoolId: 2,
  shortName: 'CrossCurve CRV',
}];

const FACTO_STABLE_NG_EYWA_POOL_IDS = EYWA_POOLS_METADATA.map(({ sonicFactoryStableNgPoolId }) => sonicFactoryStableNgPoolId);

export {
  EYWA_POOLS_METADATA,
  FACTO_STABLE_NG_EYWA_POOL_IDS,
};
