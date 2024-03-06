import type { IncomingMessage } from 'http';
import type { AddressInfo } from 'net';
import type { TRPCWebSocketClient, WebSocketClientOptions } from '@trpc/client';
import { createTRPCClient, createWSClient, httpBatchLink } from '@trpc/client';
import type { WithTRPCConfig } from '@trpc/next';
import type { AnyRouter } from '@trpc/server';
import type { CreateHTTPHandlerOptions } from '@trpc/server/adapters/standalone';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import type { WSSHandlerOptions } from '@trpc/server/adapters/ws';
import { applyWSSHandler } from '@trpc/server/adapters/ws';
import type {
  DataTransformerOptions,
  OnErrorFunction,
} from '@trpc/server/unstable-core-do-not-import';
import fetch from 'node-fetch';
import { WebSocket, WebSocketServer } from 'ws';

// This is a hack because the `server.close()` times out otherwise ¯\_(ツ)_/¯
globalThis.fetch = fetch as any;
globalThis.WebSocket = WebSocket as any;

export type CreateClientCallback<TRouter extends AnyRouter> = (opts: {
  httpUrl: string;
  wssUrl: string;
  wsClient: TRPCWebSocketClient;
  transformer?: DataTransformerOptions;
}) => Partial<WithTRPCConfig<TRouter>>;

export function routerToServerAndClientNew<TRouter extends AnyRouter>(
  router: TRouter,
  opts?: {
    server?: Partial<CreateHTTPHandlerOptions<TRouter>>;
    wssServer?: Partial<WSSHandlerOptions<TRouter>>;
    wsClient?: Partial<WebSocketClientOptions>;
    client?: Partial<WithTRPCConfig<TRouter>> | CreateClientCallback<TRouter>;
    transformer?: DataTransformerOptions;
  },
) {
  // http
  type OnError = OnErrorFunction<TRouter, IncomingMessage>;

  const onError = vitest.fn<Parameters<OnError>, void>();
  const httpServer = createHTTPServer({
    router: router,
    createContext: ({ req, res }) => ({ req, res }),
    onError: onError as OnError,
    ...(opts?.server ?? {
      batching: {
        enabled: true,
      },
    }),
  });
  const server = httpServer.listen(0);
  const httpPort = (server.address() as AddressInfo).port;
  const httpUrl = `http://localhost:${httpPort}`;

  // wss
  const wss = new WebSocketServer({ port: 0 });
  const wssPort = (wss.address() as any).port as number;
  const applyWSSHandlerOpts: WSSHandlerOptions<TRouter> = {
    wss,
    router,
    createContext: ({ req, res }) => ({ req, res }),
    ...((opts?.wssServer as any) ?? {}),
  };
  const wssHandler = applyWSSHandler(applyWSSHandlerOpts);
  const wssUrl = `ws://localhost:${wssPort}`;

  // client
  const wsClient = createWSClient({
    url: wssUrl,
    ...opts?.wsClient,
  });
  const trpcClientOptions = {
    links: [
      httpBatchLink({
        url: httpUrl,
        transformer: opts?.transformer as any,
      }),
    ],
    ...(opts?.client
      ? typeof opts.client === 'function'
        ? opts.client({ httpUrl, wssUrl, wsClient })
        : opts.client
      : {}),
  } as WithTRPCConfig<typeof router>;

  const client = createTRPCClient<typeof router>(trpcClientOptions);

  return {
    wsClient,
    client,
    close: async () => {
      await Promise.all([
        new Promise((resolve) => server.close(resolve)),
        new Promise((resolve) => {
          wss.clients.forEach((ws) => {
            ws.close();
          });
          wss.close(resolve);
        }),
      ]);
    },
    router,
    trpcClientOptions,
    httpPort,
    wssPort,
    httpUrl,
    wssUrl,
    applyWSSHandlerOpts,
    wssHandler,
    wss,
    onError,
  };
}

export async function waitMs(ms: number) {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

type Constructor<T extends object = object> = new (...args: any[]) => T;

export async function waitError<TError extends Error = Error>(
  /**
   * Function callback or promise that you expect will throw
   */
  fnOrPromise: Promise<unknown> | (() => unknown),
  /**
   * Force error constructor to be of specific type
   * @default Error
   **/
  errorConstructor?: Constructor<TError>,
): Promise<TError> {
  let res;
  try {
    if (typeof fnOrPromise === 'function') {
      res = await fnOrPromise();
    } else {
      res = await fnOrPromise;
    }
  } catch (cause) {
    expect(cause).toBeInstanceOf(Error);
    if (errorConstructor) {
      expect((cause as Error).name).toBe(errorConstructor.name);
    }
    return cause as TError;
  }

  // eslint-disable-next-line no-console
  console.warn('Expected function to throw, but it did not. Result:', res);
  throw new Error('Function did not throw');
}

export const ignoreErrors = async (fn: () => unknown) => {
  /* eslint-disable no-console */
  const suppressLogs = () => {
    const log = console.log;
    const error = console.error;
    const noop = () => {
      // ignore
    };
    console.log = noop;
    console.error = noop;
    return () => {
      console.log = log;
      console.error = error;
    };
  };
  /* eslint-enable no-console */
  const release = suppressLogs();
  try {
    await fn();
  } catch {
    // ignore
  } finally {
    release();
  }
};

export const doNotExecute = (_func: () => void) => true;
