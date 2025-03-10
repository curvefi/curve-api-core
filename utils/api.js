import { getAllBlockchainIds } from '#root/constants/configs/index.js';
import swr from '#root/utils/swr.js';
import { IS_DEV } from '#root/constants/AppConstants.js';
import { arrayToHashmap } from '#root/utils/Array.js';
import { addTtlRandomness } from '#root/utils/Number.js';
import { getFunctionParamObjectKeys } from '#root/utils/Function.js';
import { sequentialPromiseReduce } from '#root/utils/Async.js';
import CACHE_SETTINGS from '#root/constants/CacheSettings.js';

const getNowMs = () => Number(Date.now());
const allRegistryIds = [
  'factory-stable-ng',
  'factory-twocrypto',
  'factory-tricrypto',
];

const formatJsonSuccess = ({ generatedTimeMs, ...data }, success = true) => ({
  success: true,
  data,
  generatedTimeMs,
});

const formatJsonError = (err) => ({
  success: false,
  err: err.toString ? err.toString() : err,
});

const addGeneratedTime = async (res) => ({
  ...await res,
  generatedTimeMs: getNowMs(),
});

// cacheKey is undefined for pass-through functions that are deliberately not cached
const logRuntime = async (fn, cacheKey) => {
  const startMs = getNowMs();

  const res = await fn();

  const endMs = getNowMs();

  // Important: do not alter this log statement, it's used for analytics and alarms
  console.log('Run time (ms):', endMs - startMs, cacheKey);

  return res;
};

class ParamError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
  }
}

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * A param sanitizer function must return an object of shape:
 * ```
 * {
 *   isValid: Boolean, // required; if the param is defined, tells whether it is valid
 *   defaultValue: Any, // optional; if the param is undefined, this value will be used
 * }
 * ```
 */
const sanitizeParams = async (cb, query, paramSanitizers) => {
  const fnParamKeys = getFunctionParamObjectKeys(cb);

  // Run sanitizers
  const sanitizedParams = arrayToHashmap(await sequentialPromiseReduce(fnParamKeys, async (key, i, sanitizedParamsAccu) => {
    const sanitizerFn = paramSanitizers[key];
    if (typeof sanitizerFn === 'undefined') {
      throw new Error(`Missing param sanitizer function for param ${key}`);
    }

    const partlySanitizedQuery = {
      ...query,
      ...arrayToHashmap(sanitizedParamsAccu),
    };

    const { isValid, defaultValue } = await sanitizerFn(partlySanitizedQuery);
    if (typeof partlySanitizedQuery[key] === 'undefined') {
      if (typeof defaultValue !== 'undefined') {
        return [key, defaultValue];
      } else {
        throw new ParamError(`Param "${key}" must not be undefined`);
      }
    } else if (isValid === true) {
      return [key, partlySanitizedQuery[key]];
    } else {
      throw new ParamError(`Invalid value for param "${key}": "${partlySanitizedQuery[key]}"`);
    }
  }, []));

  return sanitizedParams;
};

const DEFAULT_OPTIONS = {
  maxAge: null, // Caching duration for both redis and CDN, in seconds
  cacheKey: undefined,
  maxAgeCDN: null,
  returnFlatData: false,
  appendGeneratedTime: true,
  paramSanitizers: {
    blockchainId: async ({ blockchainId }) => ({
      isValid: (await getAllBlockchainIds()).includes(blockchainId),
    }),
    // Note: we could technically go as far as checking if the registry is part of
    // the provided blockchainId (since both params are always passed together), but
    // the `getPools` endpoint needs, for historical reasons, to return a plain
    // 200 response with an empty array in case of a non-existing registryId<>blockchainId
    // combination, so we let the api endpoint logic handle this case and remain generic.
    registryId: ({ registryId }) => ({
      isValid: allRegistryIds.includes(registryId),
      defaultValue: allRegistryIds[0],
    }),
  },
};



const fn = (cb, options = {}) => {
  const {
    maxAge: maxAgeSec = null, // Caching duration for both redis and CDN, in seconds
    cacheKey, // Either a function that's passed the call's params and returns a string, or a static string
    cacheKeyCDN = null, // Either a function that's passed the call's params and returns a string, or a static string. Note: Cloudfront doesn't use this as a cache key, but our internal logging and monitoring system uses it to identify endpoints usage.
    maxAgeCDN = null, // Caching duration for CDN only, in seconds
    returnFlatData = false,
    appendGeneratedTime,
    paramSanitizers,
  } = {
    ...DEFAULT_OPTIONS,
    ...options,
    paramSanitizers: {
      ...DEFAULT_OPTIONS.paramSanitizers,
      ...(options.paramSanitizers || {}),
    },
  };

  const rMaxAgeSec = maxAgeSec !== null ? addTtlRandomness(maxAgeSec) : null;
  // const rMaxAgeCDN = maxAgeCDN !== null ? addTtlRandomness(maxAgeCDN) : null;
  const rMaxAgeCDN = maxAgeCDN; // No upside to adding randomness there

  if (rMaxAgeSec !== null && rMaxAgeCDN !== null) {
    throw new Error('cacheKey and cacheKeyCDN cannot be both defined: cacheKey applies to both Redis and CDN, while cacheKeyCDN applies only to CDN. Use cacheKey if the entry must be cached in both caches, or cacheKeyCDN if it must be cached only at the CDN level.');
  }

  if (rMaxAgeSec !== null && !cacheKey) {
    throw new Error('cacheKey not defined: a cacheKey must be set when using maxAge');
  }

  if (rMaxAgeCDN !== null && cacheKeyCDN === null) {
    throw new Error('cacheKeyCDN not defined: cacheKeyCDN must be set when using maxAgeCDN');
  }

  const addGeneratedTimeFn = appendGeneratedTime ? addGeneratedTime : (o) => o;

  const callback = (
    rMaxAgeSec !== null ? (
      async (query) => {
        const params = await sanitizeParams(cb, query, paramSanitizers);
        const cacheKeyStr = (typeof cacheKey === 'function' ? cacheKey(params) : cacheKey);

        return (await swr(
          cacheKeyStr,
          async () => logRuntime(() => addGeneratedTimeFn(cb(params)), cacheKeyStr),
          { minTimeToStale: rMaxAgeSec * 1000 } // See CacheSettings.js
        )).value;
      }
    ) : (
      async (query) => {
        const params = await sanitizeParams(cb, query, paramSanitizers);
        const cacheKeyStr = (typeof cacheKeyCDN === 'function' ? cacheKeyCDN(params) : cacheKeyCDN);

        return logRuntime(() => addGeneratedTimeFn(cb(params)), cacheKeyStr);
      }
    )
  );

  const apiCall = async (req, res) => (
    Promise.resolve(callback({
      ...req.query,
      ...req.params,
    }))
      .catch((err) => {
        const code = (
          (err instanceof ParamError) ? 400 :
            (err instanceof NotFoundError) ? 400 :
              500
        );

        if (code === 500) throw err;
        else return err;
      })
      .then((data) => {
        // rMaxAgeSec is reduced so that the two swr caches don't add up to twice the caching time
        const maxAgeCdnValue = rMaxAgeCDN ?? Math.trunc(maxAgeSec / 1.2);
        const maxAgeBrowserValue = IS_DEV ? 0 : Math.min(30, maxAgeCdnValue / 2);
        const cdnHardExpiryValue = CACHE_SETTINGS.maxTimeToLive / 1000;

        // Send a 200 response for expected errors
        const isSoftError = (
          (data instanceof ParamError) ||
          (data instanceof NotFoundError)
        );
        if (isSoftError) {
          data = {
            err: data.toString(),
          };
        }

        if (rMaxAgeSec !== null || rMaxAgeCDN !== null) {
          /**
          * Docs: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Expiration.html#stale-content
          * Caching strategy:
          * - Browser: cache for 30s, or half of `maxAgeCdnValue`, whichever is lowest
          * - CloudFront:
          *   - Cache for `maxAgeCdnValue`
          *   - After this duration, return value from origin (swr=0) and cache it again
          *   - If origin errors, keep returning stale value for long, safe duration (sie=`cdnHardExpiryValue`)
          * Advantages of this strategy: good caching, and guaranteed fresh data for cold edges, and regular refreshes for warm edges; no downtime in case of errors.
          * Possible downside: load placed on origin.
          * Alternative strategy: much lower cache duration, and larger swr duration, to regularly refresh the cache without impacting edge latency, but would still lead to stale data being served for cold edges.
          */
          res.setHeader('Cache-Control', `max-age=${maxAgeBrowserValue}, s-maxage=${maxAgeCdnValue}, stale-while-revalidate=0, stale-if-error=${cdnHardExpiryValue}`);
        }
        const success = !isSoftError;
        res.status(200).json(
          returnFlatData ?
            data :
            formatJsonSuccess(data, success)
        );
      })
      .catch((err) => {
        res.status(500).json(formatJsonError(err));
      })
  );

  apiCall.straightCall = callback;

  return apiCall;
};

export {
  fn,
  formatJsonError,
  ParamError,
  NotFoundError,
  allRegistryIds,
};
