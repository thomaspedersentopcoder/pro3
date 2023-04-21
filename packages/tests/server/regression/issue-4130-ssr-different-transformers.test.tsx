/* eslint-disable @typescript-eslint/ban-ts-comment */

import { routerToServerAndClientNew } from '../___testHelpers';
import { DehydratedState } from '@tanstack/react-query';
import { createTRPCNext } from '@trpc/next';
import type { CombinedDataTransformer } from '@trpc/server';
import { initTRPC } from '@trpc/server';
import { uneval } from 'devalue';
import { konn } from 'konn';
import { AppType } from 'next/dist/shared/lib/utils';
import React from 'react';
import superjson from 'superjson';

// [...]

export const transformer: CombinedDataTransformer = {
  input: superjson,
  output: {
    serialize: (object) => {
      return uneval(object);
    },
    // This `eval` only ever happens on the **client**
    deserialize: (object) => eval(`(${object})`),
  },
};

const ctx = konn()
  .beforeEach(() => {
    const t = initTRPC.create({
      transformer,
    });
    const appRouter = t.router({
      foo: t.procedure.query(() => 'bar' as const),
    });
    const opts = routerToServerAndClientNew(appRouter, {
      client(opts) {
        return {
          ...opts,
          transformer,
        };
      },
    });

    return opts;
  })
  .afterEach(async (ctx) => {
    await ctx?.close?.();
  })
  .done();

test('withTRPC - SSR', async () => {
  // @ts-ignore
  const { window } = global;

  // @ts-ignore
  delete global.window;

  const trpc = createTRPCNext({
    config() {
      return ctx.trpcClientOptions;
    },
    ssr: true,
  });

  const App: AppType = () => {
    const query = trpc.foo.useQuery();
    return <>{JSON.stringify(query.data ?? null)}</>;
  };

  const Wrapped = trpc.withTRPC(App);

  const props = (await Wrapped.getInitialProps!({
    AppTree: Wrapped,
    Component: <div />,
  } as any)) as any;

  const trpcState: DehydratedState = transformer.output.deserialize(
    props.pageProps.trpcState,
  );

  const relevantData = trpcState.queries.map((it) => ({
    data: it.state.data,
    queryKey: it.queryKey,
  }));

  expect(relevantData).toMatchInlineSnapshot(`
    Array [
      Object {
        "data": "bar",
        "queryKey": Array [
          Array [
            "foo",
          ],
          Object {
            "type": "query",
          },
        ],
      },
    ]
  `);

  // @ts-ignore
  global.window = window;
});
