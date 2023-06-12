import { getUntypedClient, TRPCUntypedClient } from '@trpc/client';
import { AnyRouter, initTRPC } from '@trpc/server';
import { konn } from 'konn';
import './___packages';
import { routerToServerAndClientNew } from './___testHelpers';

const ctx = konn()
  .beforeEach(() => {
    const t = initTRPC.create();

    const appRouter = t.router({
      foo: t.procedure.query(() => 'bar'),
    });

    return routerToServerAndClientNew(appRouter);
  })
  .afterEach(async (ctx) => {
    await ctx?.close?.();
  })
  .done();

test('getUntypedClient()', async () => {
  const proxy = ctx.proxy;
  expect(await proxy.foo.query()).toBe('bar');
  const untyped = getUntypedClient(proxy);

  type TRouter = typeof untyped extends TRPCUntypedClient<infer T> ? T : never;

  expectTypeOf<TRouter>().toEqualTypeOf<typeof ctx.router>();
  expectTypeOf<TRouter>().not.toEqualTypeOf<AnyRouter>();

  expect(await untyped.query('foo')).toBe('bar');
});
