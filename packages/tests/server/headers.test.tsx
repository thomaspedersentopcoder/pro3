import { routerToServerAndClientNew } from './___testHelpers';
import {
  createTRPCProxyClient,
  httpBatchLink,
  httpLink,
} from '@trpc/client/src';
import { Dict, initTRPC } from '@trpc/server/src';

describe('pass headers', () => {
  type Context = {
    headers: Dict<string[] | string>;
  };

  const t = initTRPC.context<Context>().create();

  const appRouter = t.router({
    hello: t.procedure.query(({ ctx }) => {
      return {
        'x-special': ctx.headers['x-special'],
      };
    }),
  });

  type AppRouter = typeof appRouter;

  const { close, httpUrl } = routerToServerAndClientNew(appRouter, {
    server: {
      createContext(opts) {
        return {
          headers: opts.req.headers,
        };
      },
      // createContext({ req }) {
      //   return { headers: req.headers };
      // },
    },
  });

  afterAll(async () => {
    await close();
  });

  test('no headers', async () => {
    const client = createTRPCProxyClient<AppRouter>({
      links: [httpBatchLink({ url: httpUrl })],
    });
    expect(await client.hello.query()).toMatchInlineSnapshot(`Object {}`);
  });

  test('custom headers', async () => {
    const client = createTRPCProxyClient<AppRouter>({
      links: [
        httpBatchLink({
          url: httpUrl,
          headers() {
            return {
              'x-special': 'special header',
            };
          },
        }),
      ],
    });
    expect(await client.hello.query()).toMatchInlineSnapshot(`
Object {
  "x-special": "special header",
}
`);
  });

  test('async headers', async () => {
    const client = createTRPCProxyClient<AppRouter>({
      links: [
        httpBatchLink({
          url: httpUrl,
          async headers() {
            return {
              'x-special': 'async special header',
            };
          },
        }),
      ],
    });
    expect(await client.hello.query()).toMatchInlineSnapshot(`
Object {
  "x-special": "async special header",
}
`);
  });

  test('custom headers with context using httpBatchLink', async () => {
    type LinkContext = {
      headers: Dict<string[] | string>;
    };
    const client = createTRPCProxyClient<AppRouter>({
      links: [
        httpBatchLink({
          url: httpUrl,
          headers(opts) {
            return new Promise((resolve) => {
              resolve({
                'x-special': (opts.opList[0].context as LinkContext).headers[
                  'x-special'
                ],
              });
            });
          },
        }),
      ],
    });

    expect(
      await client.hello.query(undefined, {
        context: {
          headers: {
            'x-special': 'special header',
          },
        },
      }),
    ).toMatchInlineSnapshot(`
      Object {
        "x-special": "special header",
      }
    `);
  });

  test('custom headers with context using httpLink', async () => {
    type LinkContext = {
      headers: Dict<string[] | string>;
    };
    const client = createTRPCProxyClient<AppRouter>({
      links: [
        httpLink({
          url: httpUrl,
          headers(opts) {
            return {
              'x-special': (opts.op.context as LinkContext).headers[
                'x-special'
              ],
            };
          },
        }),
      ],
    });

    expect(
      await client.hello.query(undefined, {
        context: {
          headers: {
            'x-special': 'special header',
          },
        },
      }),
    ).toMatchInlineSnapshot(`
      Object {
        "x-special": "special header",
      }
    `);
  });
});
