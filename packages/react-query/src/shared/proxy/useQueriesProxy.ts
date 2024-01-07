import { QueryOptions } from '@tanstack/react-query';
import { TRPCClientError, TRPCUntypedClient } from '@trpc/client';
import {
  AnyProcedure,
  AnyQueryProcedure,
  AnyRootConfig,
  AnyRouter,
  createRecursiveProxy,
  Filter,
  inferProcedureInput,
  inferTransformedProcedureOutput,
} from '@trpc/core';
import { getQueryKeyInternal } from '../../internals/getQueryKey';
import {
  TrpcQueryOptionsForUseQueries,
  TrpcQueryOptionsForUseSuspenseQueries,
} from '../../internals/useQueries';
import { TRPCUseQueryBaseOptions } from '../hooks/types';

type GetQueryOptions<
  TConfig extends AnyRootConfig,
  TProcedure extends AnyProcedure,
> = <TData = inferTransformedProcedureOutput<TConfig, TProcedure>>(
  input: inferProcedureInput<TProcedure>,
  opts?: TrpcQueryOptionsForUseQueries<
    inferTransformedProcedureOutput<TConfig, TProcedure>,
    TData,
    TRPCClientError<TConfig>
  >,
) => TrpcQueryOptionsForUseQueries<
  inferTransformedProcedureOutput<TConfig, TProcedure>,
  TData,
  TRPCClientError<TConfig>
>;

/**
 * @internal
 */
export type UseQueriesProcedureRecord<TRouter extends AnyRouter> = {
  [TKey in keyof Filter<
    TRouter['_def']['record'],
    AnyQueryProcedure | AnyRouter
  >]: TRouter['_def']['record'][TKey] extends AnyRouter
    ? UseQueriesProcedureRecord<TRouter['_def']['record'][TKey]>
    : GetQueryOptions<
        TRouter['_def']['_config'],
        TRouter['_def']['record'][TKey]
      >;
};

type GetSuspenseQueryOptions<
  TConfig extends AnyRootConfig,
  TProcedure extends AnyProcedure,
> = <TData = inferTransformedProcedureOutput<TConfig, TProcedure>>(
  input: inferProcedureInput<TProcedure>,
  opts?: TrpcQueryOptionsForUseSuspenseQueries<
    inferTransformedProcedureOutput<TConfig, TProcedure>,
    TData,
    TRPCClientError<TConfig>
  >,
) => TrpcQueryOptionsForUseSuspenseQueries<
  inferTransformedProcedureOutput<TConfig, TProcedure>,
  TData,
  TRPCClientError<TConfig>
>;

/**
 * @internal
 */
export type UseSuspenseQueriesProcedureRecord<TRouter extends AnyRouter> = {
  [TKey in keyof Filter<
    TRouter['_def']['record'],
    AnyQueryProcedure | AnyRouter
  >]: TRouter['_def']['record'][TKey] extends AnyRouter
    ? UseSuspenseQueriesProcedureRecord<TRouter['_def']['record'][TKey]>
    : GetSuspenseQueryOptions<
        TRouter['_def']['_config'],
        TRouter['_def']['record'][TKey]
      >;
};

/**
 * Create proxy for `useQueries` options
 * @internal
 */
export function createUseQueries<TRouter extends AnyRouter>(
  client: TRPCUntypedClient<TRouter>,
) {
  return createRecursiveProxy((opts) => {
    const arrayPath = opts.path;
    const dotPath = arrayPath.join('.');
    const [input, _opts] = opts.args as [
      unknown,
      Partial<QueryOptions> & TRPCUseQueryBaseOptions,
    ];

    const options: QueryOptions = {
      queryKey: getQueryKeyInternal(arrayPath, input, 'query'),
      queryFn: () => {
        return client.query(dotPath, input, _opts?.trpc);
      },
      ..._opts,
    };

    return options;
  }) as UseQueriesProcedureRecord<TRouter>;
}
