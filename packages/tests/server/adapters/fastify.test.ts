import { EventEmitter } from 'events';
import ws from '@fastify/websocket';
import { waitFor } from '@testing-library/react';
import {
  createTRPCProxyClient,
  createWSClient,
  HTTPHeaders,
  splitLink,
  TRPCLink,
  unstable_httpBatchStreamLink,
  wsLink,
} from '@trpc/client/src';
import { inferAsyncReturnType, initTRPC } from '@trpc/server';
import {
  CreateFastifyContextOptions,
  fastifyTRPCPlugin,
} from '@trpc/server/src/adapters/fastify';
import { observable } from '@trpc/server/src/observable';
import fastify from 'fastify';
import fp from 'fastify-plugin';
import fetch from 'node-fetch';
import { z } from 'zod';

const config = {
  port: 2023,
  logger: false,
  prefix: '/trpc',
};

function createContext({ req, res }: CreateFastifyContextOptions) {
  const user = { name: req.headers.username ?? 'anonymous' };
  return { req, res, user };
}

type Context = inferAsyncReturnType<typeof createContext>;

interface Message {
  id: string;
}

function createAppRouter() {
  const ee = new EventEmitter();
  const onNewMessageSubscription = vi.fn();
  const onSubscriptionEnded = vi.fn();

  const t = initTRPC.context<Context>().create();
  const router = t.router;
  const publicProcedure = t.procedure;

  const appRouter = router({
    ping: publicProcedure.query(() => {
      return 'pong';
    }),
    hello: publicProcedure
      .input(
        z
          .object({
            username: z.string().nullish(),
          })
          .nullish(),
      )
      .query(({ input, ctx }) => ({
        text: `hello ${input?.username ?? ctx.user?.name ?? 'world'}`,
      })),
    ['post.edit']: publicProcedure
      .input(
        z.object({
          id: z.string(),
          data: z.object({
            title: z.string(),
            text: z.string(),
          }),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.name === 'anonymous') {
          return { error: 'Unauthorized user' };
        }
        const { id, data } = input;
        return { id, ...data };
      }),
    onMessage: publicProcedure.input(z.string()).subscription(() => {
      const sub = observable<Message>((emit) => {
        const onMessage = (data: Message) => {
          emit.next(data);
        };
        ee.on('server:msg', onMessage);
        return () => {
          onSubscriptionEnded();
          ee.off('server:msg', onMessage);
        };
      });
      ee.emit('subscription:created');
      onNewMessageSubscription();
      return sub;
    }),
    deferred: publicProcedure
      .input(
        z.object({
          wait: z.number(),
        }),
      )
      .query(async (opts) => {
        await new Promise<void>((resolve) =>
          setTimeout(resolve, opts.input.wait * 10),
        );
        return opts.input.wait;
      }),
  });

  return { appRouter, ee, onNewMessageSubscription, onSubscriptionEnded };
}

type CreateAppRouter = inferAsyncReturnType<typeof createAppRouter>;
type AppRouter = CreateAppRouter['appRouter'];

interface ServerOptions {
  appRouter: AppRouter;
  fastifyPluginWrapper?: boolean;
}

type PostPayload = { Body: { text: string; life: number } };

function createServer(opts: ServerOptions) {
  const instance = fastify({ logger: config.logger });

  const plugin = !!opts.fastifyPluginWrapper
    ? fp(fastifyTRPCPlugin)
    : fastifyTRPCPlugin;

  const router = opts.appRouter;

  instance.register(ws);
  instance.register(plugin, {
    useWSS: true,
    prefix: config.prefix,
    trpcOptions: { router, createContext },
  });

  instance.get('/hello', async () => {
    return { hello: 'GET' };
  });

  instance.post<PostPayload>('/hello', async ({ body }) => {
    return { hello: 'POST', body };
  });

  const stop = async () => {
    await instance.close();
  };
  const start = async () => {
    try {
      await instance.listen({ port: config.port });
    } catch (err) {
      instance.log.error(err);
    }
  };

  return { instance, start, stop };
}

const orderedResults: number[] = [];
const linkSpy: TRPCLink<AppRouter> = () => {
  // here we just got initialized in the app - this happens once per app
  // useful for storing cache for instance
  return ({ next, op }) => {
    // this is when passing the result to the next link
    // each link needs to return an observable which propagates results
    return observable((observer) => {
      const unsubscribe = next(op).subscribe({
        next(value) {
          orderedResults.push((value.result as any).data);
          observer.next(value);
        },
        error: observer.error,
      });
      return unsubscribe;
    });
  };
};

interface ClientOptions {
  headers?: HTTPHeaders;
}

function createClient(opts: ClientOptions = {}) {
  const host = `localhost:${config.port}${config.prefix}`;
  const wsClient = createWSClient({ url: `ws://${host}` });
  const client = createTRPCProxyClient<AppRouter>({
    links: [
      linkSpy,
      splitLink({
        condition(op) {
          return op.type === 'subscription';
        },
        true: wsLink({ client: wsClient }),
        false: unstable_httpBatchStreamLink({
          url: `http://${host}`,
          headers: opts.headers,
          AbortController,
          fetch: fetch as any,
        }),
      }),
    ],
  });

  return { client, wsClient };
}

interface AppOptions {
  clientOptions?: ClientOptions;
  serverOptions?: Partial<ServerOptions>;
}

function createApp(opts: AppOptions = {}) {
  const { appRouter, ee } = createAppRouter();
  const { instance, start, stop } = createServer({
    ...(opts.serverOptions ?? {}),
    appRouter,
  });
  const { client } = createClient(opts.clientOptions);

  return { server: instance, start, stop, client, ee };
}

let app: inferAsyncReturnType<typeof createApp>;

describe('anonymous user', () => {
  beforeEach(async () => {
    orderedResults.length = 0;
    app = createApp();
    await app.start();
  });

  afterEach(async () => {
    await app.stop();
  });

  test('fetch POST', async () => {
    const data = { text: 'life', life: 42 };
    const req = await fetch(`http://localhost:${config.port}/hello`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    // body should be object
    expect(await req.json()).toMatchInlineSnapshot(`
      Object {
        "body": Object {
          "life": 42,
          "text": "life",
        },
        "hello": "POST",
      }
    `);
  });

  test('query', async () => {
    expect(await app.client.ping.query()).toMatchInlineSnapshot(`"pong"`);
    expect(await app.client.hello.query()).toMatchInlineSnapshot(`
          Object {
            "text": "hello anonymous",
          }
      `);
    expect(
      await app.client.hello.query({
        username: 'test',
      }),
    ).toMatchInlineSnapshot(`
          Object {
            "text": "hello test",
          }
      `);
  });

  test('mutation', async () => {
    expect(
      await app.client['post.edit'].mutate({
        id: '42',
        data: { title: 'new_title', text: 'new_text' },
      }),
    ).toMatchInlineSnapshot(`
      Object {
        "error": "Unauthorized user",
      }
    `);
  });

  test('subscription', async () => {
    app.ee.once('subscription:created', () => {
      setTimeout(() => {
        app.ee.emit('server:msg', {
          id: '1',
        });
        app.ee.emit('server:msg', {
          id: '2',
        });
      });
    });

    const onStartedMock = vi.fn();
    const onDataMock = vi.fn();
    const sub = app.client.onMessage.subscribe('onMessage', {
      onStarted: onStartedMock,
      onData(data) {
        expectTypeOf(data).not.toBeAny();
        expectTypeOf(data).toMatchTypeOf<Message>();
        onDataMock(data);
      },
    });

    await waitFor(() => {
      expect(onStartedMock).toHaveBeenCalledTimes(1);
      expect(onDataMock).toHaveBeenCalledTimes(2);
    });

    app.ee.emit('server:msg', {
      id: '3',
    });

    await waitFor(() => {
      expect(onDataMock).toHaveBeenCalledTimes(3);
    });

    expect(onDataMock.mock.calls).toMatchInlineSnapshot(`
      Array [
        Array [
          Object {
            "id": "1",
          },
        ],
        Array [
          Object {
            "id": "2",
          },
        ],
        Array [
          Object {
            "id": "3",
          },
        ],
      ]
    `);

    sub.unsubscribe();

    await waitFor(() => {
      expect(app.ee.listenerCount('server:msg')).toBe(0);
      expect(app.ee.listenerCount('server:error')).toBe(0);
    });
  });

  test('streaming', async () => {
    const results = await Promise.all([
      app.client.deferred.query({ wait: 3 }),
      app.client.deferred.query({ wait: 1 }),
      app.client.deferred.query({ wait: 2 }),
    ]);
    expect(results).toEqual([3, 1, 2]);
    expect(orderedResults).toEqual([1, 2, 3]);
  });
});

describe('authorized user', () => {
  beforeEach(async () => {
    app = createApp({ clientOptions: { headers: { username: 'nyan' } } });
    await app.start();
  });

  afterEach(async () => {
    await app.stop();
  });

  test('query', async () => {
    expect(await app.client.hello.query()).toMatchInlineSnapshot(`
      Object {
        "text": "hello nyan",
      }
    `);
  });

  test('mutation', async () => {
    expect(
      await app.client['post.edit'].mutate({
        id: '42',
        data: { title: 'new_title', text: 'new_text' },
      }),
    ).toMatchInlineSnapshot(`
      Object {
        "id": "42",
        "text": "new_text",
        "title": "new_title",
      }
    `);
  });
});

describe('anonymous user with fastify-plugin', () => {
  beforeEach(async () => {
    app = createApp({ serverOptions: { fastifyPluginWrapper: true } });
    await app.start();
  });

  afterEach(async () => {
    await app.stop();
  });

  test('fetch GET', async () => {
    const req = await fetch(`http://localhost:${config.port}/hello`);
    expect(await req.json()).toEqual({ hello: 'GET' });
  });

  test('fetch POST', async () => {
    const data = { text: 'life', life: 42 };
    const req = await fetch(`http://localhost:${config.port}/hello`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    // body should be string
    expect(await req.json()).toMatchInlineSnapshot(`
      Object {
        "body": "{\\"text\\":\\"life\\",\\"life\\":42}",
        "hello": "POST",
      }
    `);
  });

  test('query', async () => {
    expect(await app.client.ping.query()).toMatchInlineSnapshot(`"pong"`);
    expect(await app.client.hello.query()).toMatchInlineSnapshot(`
          Object {
            "text": "hello anonymous",
          }
      `);
    expect(
      await app.client.hello.query({
        username: 'test',
      }),
    ).toMatchInlineSnapshot(`
          Object {
            "text": "hello test",
          }
      `);
  });
});
