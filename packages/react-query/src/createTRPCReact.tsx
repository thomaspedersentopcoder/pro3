import type { TRPCClientErrorLike } from '@trpc/client';
import type {
  AnyMutationProcedure,
  AnyProcedure,
  AnyQueryProcedure,
  AnyRootConfig,
  AnyRouter,
  AnySubscriptionProcedure,
  inferProcedureInput,
  inferTransformedProcedureOutput,
  inferTransformedSubscriptionOutput,
  ProcedureRouterRecord,
  ProtectedIntersection,
} from '@trpc/core';
import { createFlatProxy } from '@trpc/core';
import * as React from 'react';
import type {
  TRPCUseQueries,
  TRPCUseSuspenseQueries,
} from './internals/useQueries';
import type { CreateReactUtils } from './shared';
import { createReactDecoration, createReactQueryUtils } from './shared';
import type { CreateReactQueryHooks } from './shared/hooks/createHooksInternal';
import { createRootHooks } from './shared/hooks/createHooksInternal';
import type {
  CreateClient,
  DefinedUseTRPCQueryOptions,
  DefinedUseTRPCQueryResult,
  TRPCProvider,
  UseDehydratedState,
  UseTRPCInfiniteQueryOptions,
  UseTRPCInfiniteQueryResult,
  UseTRPCMutationOptions,
  UseTRPCMutationResult,
  UseTRPCQueryOptions,
  UseTRPCQueryResult,
  UseTRPCSubscriptionOptions,
  UseTRPCSuspenseInfiniteQueryOptions,
  UseTRPCSuspenseInfiniteQueryResult,
  UseTRPCSuspenseQueryOptions,
  UseTRPCSuspenseQueryResult,
} from './shared/hooks/types';
import type { CreateTRPCReactOptions } from './shared/types';

/**
 * @internal
 */
export interface ProcedureUseQuery<
  TConfig extends AnyRootConfig,
  TProcedure extends AnyProcedure,
> {
  <
    TQueryFnData extends inferTransformedProcedureOutput<
      TConfig,
      TProcedure
    > = inferTransformedProcedureOutput<TConfig, TProcedure>,
    TData = TQueryFnData,
  >(
    input: inferProcedureInput<TProcedure>,
    opts: DefinedUseTRPCQueryOptions<
      TQueryFnData,
      TData,
      TRPCClientErrorLike<TConfig>,
      inferTransformedProcedureOutput<TConfig, TProcedure>
    >,
  ): DefinedUseTRPCQueryResult<TData, TRPCClientErrorLike<TConfig>>;

  <
    TQueryFnData extends inferTransformedProcedureOutput<
      TConfig,
      TProcedure
    > = inferTransformedProcedureOutput<TConfig, TProcedure>,
    TData = TQueryFnData,
  >(
    input: inferProcedureInput<TProcedure>,
    opts?: UseTRPCQueryOptions<
      TQueryFnData,
      TData,
      TRPCClientErrorLike<TConfig>,
      inferTransformedProcedureOutput<TConfig, TProcedure>
    >,
  ): UseTRPCQueryResult<TData, TRPCClientErrorLike<TConfig>>;
}

/**
 * @remark `void` is here due to https://github.com/trpc/trpc/pull/4374
 */
type CursorInput = {
  cursor?: any;
} | void;

/**
 * @internal
 */
export type MaybeDecoratedInfiniteQuery<
  TProcedure extends AnyProcedure,
  TConfig extends AnyRootConfig,
> = inferProcedureInput<TProcedure> extends CursorInput
  ? {
      /**
       * @link https://trpc.io/docs/v11/client/react/suspense#useinfinitesuspensequery
       */
      useInfiniteQuery: (
        input: Omit<inferProcedureInput<TProcedure>, 'cursor'>,
        opts: UseTRPCInfiniteQueryOptions<
          inferProcedureInput<TProcedure>,
          inferTransformedProcedureOutput<TConfig, TProcedure>,
          TRPCClientErrorLike<TConfig>
        >,
      ) => UseTRPCInfiniteQueryResult<
        inferTransformedProcedureOutput<TConfig, TProcedure>,
        TRPCClientErrorLike<TConfig>,
        inferProcedureInput<TProcedure>
      >;
      /**
       * @link https://trpc.io/docs/v11/client/react/suspense
       */
      useSuspenseInfiniteQuery: (
        input: Omit<inferProcedureInput<TProcedure>, 'cursor'>,
        opts: UseTRPCSuspenseInfiniteQueryOptions<
          inferProcedureInput<TProcedure>,
          inferTransformedProcedureOutput<TConfig, TProcedure>,
          TRPCClientErrorLike<TConfig>
        >,
      ) => UseTRPCSuspenseInfiniteQueryResult<
        inferTransformedProcedureOutput<TConfig, TProcedure>,
        TRPCClientErrorLike<TConfig>,
        inferProcedureInput<TProcedure>
      >;
    }
  : object;

/**
 * @internal
 */
export type DecoratedQueryMethods<
  TConfig extends AnyRootConfig,
  TProcedure extends AnyProcedure,
> = {
  /**
   * @link https://trpc.io/docs/v11/client/react/useQuery
   */
  useQuery: ProcedureUseQuery<TConfig, TProcedure>;
  /**
   * @link https://trpc.io/docs/v11/client/react/suspense#usesuspensequery
   */
  useSuspenseQuery: <
    TQueryFnData extends inferTransformedProcedureOutput<
      TConfig,
      TProcedure
    > = inferTransformedProcedureOutput<TConfig, TProcedure>,
    TData = TQueryFnData,
  >(
    input: inferProcedureInput<TProcedure>,
    opts?: UseTRPCSuspenseQueryOptions<
      TQueryFnData,
      TData,
      TRPCClientErrorLike<TConfig>
    >,
  ) => UseTRPCSuspenseQueryResult<TData, TRPCClientErrorLike<TConfig>>;
};

/**
 * @internal
 */
export type DecoratedQuery<
  TConfig extends AnyRootConfig,
  TProcedure extends AnyProcedure,
> = MaybeDecoratedInfiniteQuery<TProcedure, TConfig> &
  DecoratedQueryMethods<TConfig, TProcedure>;

/**
 * @internal
 */
export interface DecoratedMutation<
  TConfig extends AnyRootConfig,
  TProcedure extends AnyProcedure,
> {
  /**
   * @link https://trpc.io/docs/v11/client/react/useMutation
   */
  useMutation: <TContext = unknown>(
    opts?: UseTRPCMutationOptions<
      inferProcedureInput<TProcedure>,
      TRPCClientErrorLike<TConfig>,
      inferTransformedProcedureOutput<TConfig, TProcedure>,
      TContext
    >,
  ) => UseTRPCMutationResult<
    inferTransformedProcedureOutput<TConfig, TProcedure>,
    TRPCClientErrorLike<TConfig>,
    inferProcedureInput<TProcedure>,
    TContext
  >;
}

/**
 * @internal
 */
export type DecorateProcedure<
  TConfig extends AnyRootConfig,
  TProcedure extends AnyProcedure,
  _TFlags,
> = TProcedure extends AnyQueryProcedure
  ? DecoratedQuery<TConfig, TProcedure>
  : TProcedure extends AnyMutationProcedure
  ? DecoratedMutation<TConfig, TProcedure>
  : TProcedure extends AnySubscriptionProcedure
  ? {
      /**
       * @link https://trpc.io/docs/v11/subscriptions
       */
      useSubscription: (
        input: inferProcedureInput<TProcedure>,
        opts?: UseTRPCSubscriptionOptions<
          inferTransformedSubscriptionOutput<TConfig, TProcedure>,
          TRPCClientErrorLike<TConfig>
        >,
      ) => void;
    }
  : never;

/**
 * @internal
 */
export type DecoratedProcedureRecord<
  TConfig extends AnyRootConfig,
  TProcedures extends ProcedureRouterRecord,
  TFlags,
> = {
  [TKey in keyof TProcedures]: TProcedures[TKey] extends AnyRouter
    ? DecoratedProcedureRecord<
        TConfig,
        TProcedures[TKey]['_def']['record'],
        TFlags
      >
    : TProcedures[TKey] extends AnyProcedure
    ? DecorateProcedure<TConfig, TProcedures[TKey], TFlags>
    : never;
};

/**
 * @internal
 */
export type CreateTRPCReactBase<TRouter extends AnyRouter, TSSRContext> = {
  /**
   * @deprecated renamed to `useUtils` and will be removed in a future tRPC version
   *
   * @link https://trpc.io/docs/v11/client/react/useUtils
   */
  useContext(): CreateReactUtils<TRouter, TSSRContext>;
  /**
   * @link https://trpc.io/docs/v11/client/react/useUtils
   */
  useUtils(): CreateReactUtils<TRouter, TSSRContext>;
  Provider: TRPCProvider<TRouter, TSSRContext>;
  createClient: CreateClient<TRouter>;
  useQueries: TRPCUseQueries<TRouter>;
  useSuspenseQueries: TRPCUseSuspenseQueries<TRouter>;
  useDehydratedState: UseDehydratedState<TRouter>;
};

export type CreateTRPCReact<
  TRouter extends AnyRouter,
  TSSRContext,
  TFlags,
> = ProtectedIntersection<
  CreateTRPCReactBase<TRouter, TSSRContext>,
  DecoratedProcedureRecord<
    TRouter['_def']['_config'],
    TRouter['_def']['record'],
    TFlags
  >
>;

/**
 * @internal
 */
export function createHooksInternal<
  TRouter extends AnyRouter,
  TSSRContext = unknown,
  TFlags = null,
>(trpc: CreateReactQueryHooks<TRouter, TSSRContext>) {
  type CreateHooksInternal = CreateTRPCReact<TRouter, TSSRContext, TFlags>;

  return createFlatProxy<CreateHooksInternal>((key) => {
    if (key === 'useContext' || key === 'useUtils') {
      return () => {
        const context = trpc.useUtils();
        // create a stable reference of the utils context
        return React.useMemo(() => {
          return (createReactQueryUtils as any)(context);
        }, [context]);
      };
    }

    if (trpc.hasOwnProperty(key)) {
      return (trpc as any)[key];
    }

    return createReactDecoration(key, trpc);
  });
}

export function createTRPCReact<
  TRouter extends AnyRouter,
  TSSRContext = unknown,
  TFlags = null,
>(
  opts?: CreateTRPCReactOptions<TRouter>,
): CreateTRPCReact<TRouter, TSSRContext, TFlags> {
  const hooks = createRootHooks<TRouter, TSSRContext>(opts);
  const proxy = createHooksInternal<TRouter, TSSRContext, TFlags>(hooks);

  return proxy as any;
}
