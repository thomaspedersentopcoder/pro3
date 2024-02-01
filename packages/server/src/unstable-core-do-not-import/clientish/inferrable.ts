import type { AnyRootTypes } from '../rootConfig';

export type AnyClientRootTypes = Pick<
  AnyRootTypes,
  'errorShape' | 'transformer'
>;

/**
 * Result of `initTRPC.create()`
 */
type InitLike = {
  _config: {
    $types: AnyClientRootTypes;
  };
};

/**
 * Result of `initTRPC.create().router()`
 */
type RouterLike = {
  _def: InitLike;
};

/**
 * Result of `initTRPC.create()._config`
 */
type RootConfigLike = {
  $types: AnyClientRootTypes;
};

/**
 * Anything that can be inferred to the root config types needed for a TRPC client
 */
export type InferrableClientTypes =
  | RouterLike
  | InitLike
  | RootConfigLike
  | AnyClientRootTypes;

/**
 * Infer the root types from a InferrableClientTypes
 */
export type inferRootTypes<TInferrable extends InferrableClientTypes> =
  TInferrable extends AnyClientRootTypes
    ? TInferrable
    : TInferrable extends RootConfigLike
    ? TInferrable['$types']
    : TInferrable extends InitLike
    ? TInferrable['_config']['$types']
    : TInferrable extends RouterLike
    ? TInferrable['_def']['_config']['$types']
    : never;

export type inferErrorShape<TInferrable extends InferrableClientTypes> =
  inferRootTypes<TInferrable>['errorShape'];
