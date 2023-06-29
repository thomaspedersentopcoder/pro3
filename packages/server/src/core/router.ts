import { DefaultErrorShape, defaultFormatter } from '../error/formatter';
import { TRPCError } from '../error/TRPCError';
import { getHTTPStatusCodeFromError } from '../http/getHTTPStatusCode';
import { TRPC_ERROR_CODES_BY_KEY } from '../rpc';
import { createRecursiveProxy } from '../shared/createProxy';
import { defaultTransformer } from '../transformer';
import { AnyRootConfig } from './internals/config';
import { omitPrototype } from './internals/omitPrototype';
import { ProcedureCallOptions } from './internals/procedureBuilder';
import { AnyProcedure, ProcedureArgs } from './procedure';
import { ProcedureType } from './types';

/** @internal **/
export type ProcedureRecord = Record<string, AnyProcedure>;

export interface ProcedureRouterRecord {
  [key: string]: AnyProcedure | AnyRouter;
}

export interface RouterDef<
  TConfig extends AnyRootConfig,
  TRecord extends ProcedureRouterRecord,
> {
  _config: TConfig;
  router: true;
  procedures: TRecord;
  record: TRecord;
}

export type AnyRouterDef<TConfig extends AnyRootConfig = AnyRootConfig> =
  RouterDef<TConfig, any>;

type DecorateProcedure<TProcedure extends AnyProcedure> = (
  input: ProcedureArgs<TProcedure['_def']>[0],
) => Promise<TProcedure['_def']['_output_out']>;

/**
 * @internal
 */
type DecoratedProcedureRecord<TProcedures extends ProcedureRouterRecord> = {
  [TKey in keyof TProcedures]: TProcedures[TKey] extends AnyRouter
    ? DecoratedProcedureRecord<TProcedures[TKey]['_def']['record']>
    : TProcedures[TKey] extends AnyProcedure
    ? DecorateProcedure<TProcedures[TKey]>
    : never;
};

/**
 * @internal
 */
type RouterCaller<TDef extends AnyRouterDef> = (
  ctx: TDef['_config']['$types']['ctx'],
) => DecoratedProcedureRecord<TDef['record']>;

export interface Router<TDef extends AnyRouterDef> {
  _def: TDef;
  createCaller: RouterCaller<TDef>;

  /**
   * @deprecated
   * FIXME: use the new standalone `getErrorShape` instead
   */
  getErrorShape(opts: {
    error: TRPCError;
    type: ProcedureType | 'unknown';
    path: string | undefined;
    input: unknown;
    ctx: TDef['_config']['$types']['ctx'] | undefined;
  }): TDef['_config']['$types']['errorShape'];
}

export type AnyRouter = Router<AnyRouterDef>;

function isRouter(
  procedureOrRouter: AnyProcedure | AnyRouter,
): procedureOrRouter is AnyRouter {
  return 'router' in procedureOrRouter._def;
}

const emptyRouter = {
  _ctx: null as any,
  _errorShape: null as any,
  _meta: null as any,
  queries: {},
  mutations: {},
  subscriptions: {},
  errorFormatter: defaultFormatter,
  transformer: defaultTransformer,
};

/**
 * Reserved words that can't be used as router or procedure names
 */
const reservedWords = [
  /**
   * Then is a reserved word because otherwise we can't return a promise that returns a Proxy
   * since JS will think that `.then` is something that exists
   */
  'then',
];

/**
 * @internal
 */
export type CreateRouterInner<
  TConfig extends AnyRootConfig,
  TProcRouterRecord extends ProcedureRouterRecord,
> = Router<RouterDef<TConfig, TProcRouterRecord>> &
  /**
   * This adds ability to call procedures directly but is primarily used for quick access in type inference
   */
  TProcRouterRecord;

/**
 * @internal
 */
export function createRouterFactory<TConfig extends AnyRootConfig>(
  config: TConfig,
) {
  return function createRouterInner<
    TProcRouterRecord extends ProcedureRouterRecord,
  >(
    procedures: TProcRouterRecord,
  ): CreateRouterInner<TConfig, TProcRouterRecord> {
    const reservedWordsUsed = new Set(
      Object.keys(procedures).filter((v) => reservedWords.includes(v)),
    );
    if (reservedWordsUsed.size > 0) {
      throw new Error(
        'Reserved words used in `router({})` call: ' +
          Array.from(reservedWordsUsed).join(', '),
      );
    }

    const routerProcedures: ProcedureRecord = omitPrototype({});
    function recursiveGetPaths(procedures: ProcedureRouterRecord, path = '') {
      for (const [key, procedureOrRouter] of Object.entries(procedures ?? {})) {
        const newPath = `${path}${key}`;

        if (isRouter(procedureOrRouter)) {
          recursiveGetPaths(procedureOrRouter._def.procedures, `${newPath}.`);
          continue;
        }

        if (routerProcedures[newPath]) {
          throw new Error(`Duplicate key: ${newPath}`);
        }

        routerProcedures[newPath] = procedureOrRouter;
      }
    }
    recursiveGetPaths(procedures);

    const _def: AnyRouterDef<TConfig> = {
      _config: config,
      router: true,
      procedures: routerProcedures,
      ...emptyRouter,
      record: procedures,
    };

    const router: AnyRouter = {
      ...procedures,
      _def,
      createCaller(ctx) {
        const proxy = createRecursiveProxy(({ path, args }) => {
          const fullPath = path.join('.');
          const procedure = _def.procedures[fullPath] as AnyProcedure;

          let type: ProcedureType = 'query';
          if (procedure._def.mutation) {
            type = 'mutation';
          } else if (procedure._def.subscription) {
            type = 'subscription';
          }

          return procedure({
            path: fullPath,
            rawInput: args[0],
            ctx,
            type,
          });
        });

        return proxy as ReturnType<RouterCaller<any>>;
      },
      getErrorShape(opts) {
        const { path, error } = opts;
        const { code } = opts.error;
        const shape: DefaultErrorShape = {
          message: error.message,
          code: TRPC_ERROR_CODES_BY_KEY[code],
          data: {
            code,
            httpStatus: getHTTPStatusCodeFromError(error),
          },
        };
        if (config.isDev && typeof opts.error.stack === 'string') {
          shape.data.stack = opts.error.stack;
        }
        if (typeof path === 'string') {
          shape.data.path = path;
        }
        return this._def._config.errorFormatter({ ...opts, shape });
      },
    };
    return router as any;
  };
}

/**
 * @internal
 */
export function callProcedure(
  opts: ProcedureCallOptions & { procedures: ProcedureRouterRecord },
) {
  const { type, path } = opts;

  if (!(path in opts.procedures) || !opts.procedures[path]?._def[type]) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: `No "${type}"-procedure on path "${path}"`,
    });
  }

  const procedure = opts.procedures[path] as AnyProcedure;

  return procedure(opts);
}
