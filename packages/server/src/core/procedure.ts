import { AnyRootConfig } from './internals/config';
import {
  ProcedureBuilderDef,
  ProcedureCallOptions,
} from './internals/procedureBuilder';
import { UnsetMarker } from './internals/utils';
import { ProcedureType } from './types';

type ClientContext = Record<string, unknown>;

/**
 * @internal
 */
export interface ProcedureOptions {
  /**
   * Client-side context
   */
  context?: ClientContext;
  signal?: AbortSignal;
}

/**
 * @internal
 */
export type AnyProcedureParams = {
  _config: AnyRootConfig;
  _meta: unknown;
  _ctx_out: unknown;
  _input_in: unknown;
  _input_out: unknown;
  _output_in: unknown;
  _output_out: unknown;
};

/**
 * @internal
 */
export type ProcedureParams<TParams extends AnyProcedureParams> = TParams;

/**
 * @internal
 */
export type ProcedureArgs<TParams extends ProcedureParams<AnyProcedureParams>> =
  TParams['_input_in'] extends UnsetMarker
    ? [input?: undefined | void, opts?: ProcedureOptions]
    : undefined extends TParams['_input_in']
    ? [input?: TParams['_input_in'] | void, opts?: ProcedureOptions]
    : [input: TParams['_input_in'], opts?: ProcedureOptions];

/**
 *
 * @internal
 */
export interface Procedure<
  TType extends ProcedureType,
  TParams extends ProcedureParams<AnyProcedureParams>,
> {
  _type: TType;
  _def: ProcedureBuilderDef<TParams> & TParams;
  _procedure: true;
  /**
   * @internal
   */
  (opts: ProcedureCallOptions): Promise<unknown>;
}

export type AnyQueryProcedure = Procedure<'query', any>;
export type AnyMutationProcedure = Procedure<'mutation', any>;
export type AnySubscriptionProcedure = Procedure<'subscription', any>;
export type AnyProcedure = Procedure<ProcedureType, any>;
