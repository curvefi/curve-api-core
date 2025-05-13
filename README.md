# Description

A simpler, stripped-down version of [`curve-api`](https://github.com/curvefi/curve-api) for [`curve-core`](https://github.com/curvefi/curve-core) deployments

Features:
- List of deployed pools
- List of deployed gauges (with any external rewards distributed through them)

# Documentation

<https://api-core.curve.finance/v1/documentation>

OpenAPI specification: <https://api-core.curve.finance/v1/openapi.json>

# Development

## Adding new chains (aka new curve-core deployments)

Each new curve-core deployment will lead to a new yaml deployment output file being added in this folder: https://github.com/curvefi/curve-core/tree/main/deployments
These are automatically retrieved and served by this API.

## Deployment

When a PR is merged into `main`, the new app is automatically deployed (it takes roughly 15 minutes).

# Data

## Gauge external rewards APYs

For a reward APY to be calculated, the API must be aware of the price of the token being distributed. To that end, this token must be present in at least one Curve pool on the same chain. That pool must have some amount of liquidity (any non-zero liquidity will do, but the more liquidity the more accurate the price), and be paired with another token whose price is already known by Curve.

Example:

- A new token (symbol NEWTKN) is launched. A pool is created for this token: NEWTKN/OTHERTKEN, and gauge is created for this pool to distribute NEWTKN rewards. OTHERTKEN is another token, which is not trading on Curve yet. As a result, token prices for OTHERTKEN and for NEWTKN will be unknown; and NEWTKN rewards being distributed will not be able to have an APY calculated.
- Solution: Assuming that on this chain, there is a token whose symbol is USDT and its price is already known by Curve on this chain, creating a non-empty pool NEWTKN/USDT will allow to calculate all those missing prices and APYs. Creating a non-empty pool OTHERTKEN/USDT would have the same result.

As a rule of thumb, when creating pools for a new token, make sure to pair it with a token that already has a known price on Curve!

## Trading volumes and base APYs

No trading volumes or base APYs are available for curve-core deployments.

## Ethereum LST APYs

When a Curve pool contains an LST, the API includes its staking APY into the pool's base APY.
This is the list of ETH LSTs currently supported by the API: https://github.com/curvefi/curve-api-metadata/blob/main/ethereum-lst-defillama.json
If an ETH LST is missing from this list, feel free to add it: [info on how to do it](https://github.com/curvefi/curve-api-metadata/tree/main?tab=readme-ov-file#files)

# Technical setup

- Environment variables:
  - Dev env variables are injected by dotenv-safe, using `.env.default` as template, and using values from `.env`
  - Prod env variables are injected by ElasticBeanstalk env variables
