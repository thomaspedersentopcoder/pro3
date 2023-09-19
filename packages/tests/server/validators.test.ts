import { routerToServerAndClientNew } from './___testHelpers';
import { wrap } from '@decs/typeschema';
import * as S from '@effect/schema/Schema';
import { initTRPC } from '@trpc/server/src';
import * as arktype from 'arktype';
import myzod from 'myzod';
import * as T from 'runtypes';
import * as $ from 'scale-codec';
import * as st from 'superstruct';
import * as v from 'valibot';
import * as yup from 'yup';
import { z } from 'zod';

test('no validator', async () => {
  const t = initTRPC.create();

  const router = t.router({
    hello: t.procedure.query(({ input }) => {
      expectTypeOf(input).toBeUndefined();
      return 'test';
    }),
  });

  const { close, proxy } = routerToServerAndClientNew(router);
  const res = await proxy.hello.query();
  expect(res).toBe('test');
  await close();
});

test('zod', async () => {
  const t = initTRPC.create();

  const router = t.router({
    num: t.procedure.input(z.number()).query(({ input }) => {
      expectTypeOf(input).toBeNumber();
      return {
        input,
      };
    }),
  });

  const { close, proxy } = routerToServerAndClientNew(router);
  const res = await proxy.num.query(123);

  await expect(proxy.num.query('123' as any)).rejects.toMatchInlineSnapshot(`
            [TRPCClientError: [
              {
                "code": "invalid_type",
                "expected": "number",
                "received": "string",
                "path": [],
                "message": "Expected number, received string"
              }
            ]]
          `);
  expect(res.input).toBe(123);
  await close();
});

test('zod async', async () => {
  const t = initTRPC.create();
  const input = z.string().refine(async (value) => value === 'foo');

  const router = t.router({
    q: t.procedure.input(input).query(({ input }) => {
      expectTypeOf(input).toBeString();
      return {
        input,
      };
    }),
  });

  const { close, proxy } = routerToServerAndClientNew(router);

  await expect(proxy.q.query('bar')).rejects.toMatchInlineSnapshot(`
            [TRPCClientError: [
              {
                "code": "custom",
                "message": "Invalid input",
                "path": []
              }
            ]]
          `);
  const res = await proxy.q.query('foo');
  expect(res).toMatchInlineSnapshot(`
      Object {
        "input": "foo",
      }
    `);
  await close();
});

test('zod transform mixed input/output', async () => {
  const t = initTRPC.create();
  const input = z.object({
    length: z.string().transform((s) => s.length),
  });

  const router = t.router({
    num: t.procedure.input(input).query(({ input }) => {
      expectTypeOf(input.length).toBeNumber();
      return {
        input,
      };
    }),
  });

  const { close, proxy } = routerToServerAndClientNew(router);

  await expect(proxy.num.query({ length: '123' })).resolves
    .toMatchInlineSnapshot(`
            Object {
              "input": Object {
                "length": 3,
              },
            }
          `);

  await expect(
    // @ts-expect-error this should only accept a string
    proxy.num.query({ length: 123 }),
  ).rejects.toMatchInlineSnapshot(`
            [TRPCClientError: [
              {
                "code": "invalid_type",
                "expected": "string",
                "received": "number",
                "path": [
                  "length"
                ],
                "message": "Expected string, received number"
              }
            ]]
          `);

  await close();
});

test('valibot', async () => {
  const t = initTRPC.create();

  const router = t.router({
    num: t.procedure.input(wrap(v.number())).query(({ input }) => {
      expectTypeOf(input).toBeNumber();
      return {
        input,
      };
    }),
  });

  const { close, proxy } = routerToServerAndClientNew(router);
  const res = await proxy.num.query(123);

  await expect(proxy.num.query('123' as any)).rejects.toMatchInlineSnapshot(
    '[TRPCClientError: Assertion failed]',
  );
  expect(res.input).toBe(123);
  await close();
});

test('valibot async', async () => {
  const t = initTRPC.create();
  const input = wrap(
    v.stringAsync([v.customAsync(async (value) => value === 'foo')]),
  );

  const router = t.router({
    q: t.procedure.input(input).query(({ input }) => {
      expectTypeOf(input).toBeString();
      return {
        input,
      };
    }),
  });

  const { close, proxy } = routerToServerAndClientNew(router);

  await expect(proxy.q.query('bar')).rejects.toMatchInlineSnapshot(
    '[TRPCClientError: Assertion failed]',
  );
  const res = await proxy.q.query('foo');
  expect(res).toMatchInlineSnapshot(`
      Object {
        "input": "foo",
      }
    `);
  await close();
});

test('valibot transform mixed input/output', async () => {
  const t = initTRPC.create();
  const input = wrap(
    v.object({
      length: v.transform(v.string(), (s) => s.length),
    }),
  );

  const router = t.router({
    num: t.procedure.input(input).query(({ input }) => {
      expectTypeOf(input.length).toBeNumber();
      return {
        input,
      };
    }),
  });

  const { close, proxy } = routerToServerAndClientNew(router);

  await expect(proxy.num.query({ length: '123' })).resolves
    .toMatchInlineSnapshot(`
            Object {
              "input": Object {
                "length": 3,
              },
            }
          `);

  await expect(
    // @ts-expect-error this should only accept a string
    proxy.num.query({ length: 123 }),
  ).rejects.toMatchInlineSnapshot('[TRPCClientError: Assertion failed]');

  await close();
});

test('superstruct', async () => {
  const t = initTRPC.create();

  const router = t.router({
    num: t.procedure.input(st.number()).query(({ input }) => {
      expectTypeOf(input).toBeNumber();
      return {
        input,
      };
    }),
  });

  const { close, proxy } = routerToServerAndClientNew(router);
  const res = await proxy.num.query(123);

  // @ts-expect-error this only accepts a `number`
  await expect(proxy.num.query('123')).rejects.toMatchInlineSnapshot(
    `[TRPCClientError: Expected a number, but received: "123"]`,
  );
  expect(res.input).toBe(123);
  await close();
});

test('yup', async () => {
  const t = initTRPC.create();

  const router = t.router({
    num: t.procedure.input(yup.number().required()).query(({ input }) => {
      expectTypeOf(input).toMatchTypeOf<number>();
      return {
        input,
      };
    }),
  });

  const { close, proxy } = routerToServerAndClientNew(router);
  const res = await proxy.num.query(123);

  // @ts-expect-error this only accepts a `number`
  await expect(proxy.num.query('asd')).rejects.toMatchInlineSnapshot(
    `[TRPCClientError: this must be a \`number\` type, but the final value was: \`NaN\` (cast from the value \`"asd"\`).]`,
  );
  expect(res.input).toBe(123);
  await close();
});

test('scale', async () => {
  const t = initTRPC.create();

  const router = t.router({
    num: t.procedure.input($.i8).query(({ input }) => {
      expectTypeOf(input).toMatchTypeOf<number>();
      return {
        input,
      };
    }),
  });

  const { close, proxy } = routerToServerAndClientNew(router);
  const res = await proxy.num.query(16);

  // @ts-expect-error this only accepts a `number`
  await expect(proxy.num.query('asd')).rejects.toMatchInlineSnapshot(
    `[TRPCClientError: typeof value !== "number"]`,
  );
  expect(res.input).toBe(16);
  await close();
});

test('myzod', async () => {
  const t = initTRPC.create();

  const router = t.router({
    num: t.procedure.input(myzod.number()).query(({ input }) => {
      expectTypeOf(input).toMatchTypeOf<number>();
      return {
        input,
      };
    }),
  });

  const { close, proxy } = routerToServerAndClientNew(router);
  const res = await proxy.num.query(123);
  await expect(proxy.num.query('123' as any)).rejects.toMatchInlineSnapshot(
    `[TRPCClientError: expected type to be number but got string]`,
  );
  expect(res.input).toBe(123);
  await close();
});

test('arktype schema - [not officially supported]', async () => {
  const t = initTRPC.create();

  const router = t.router({
    num: t.procedure
      .input(arktype.type({ text: 'string' }).assert)
      .query(({ input }) => {
        expectTypeOf(input).toMatchTypeOf<{ text: string }>();
        return {
          input,
        };
      }),
  });

  const { close, proxy } = routerToServerAndClientNew(router);
  const res = await proxy.num.query({ text: '123' });
  expect(res.input).toMatchObject({ text: '123' });

  // @ts-expect-error this only accepts a `number`
  await expect(proxy.num.query('13')).rejects.toMatchInlineSnapshot(`
	[TRPCClientError: Must be an object (was string)]
`);
  await close();
});

test('effect schema - [not officially supported]', async () => {
  const t = initTRPC.create();

  const router = t.router({
    num: t.procedure
      .input(S.parseSync(S.struct({ text: S.string })))
      .query(({ input }) => {
        expectTypeOf(input).toMatchTypeOf<{ text: string }>();
        return {
          input,
        };
      }),
  });

  const { close, proxy } = routerToServerAndClientNew(router);
  const res = await proxy.num.query({ text: '123' });
  expect(res.input).toMatchObject({ text: '123' });

  // @ts-expect-error this only accepts a `number`
  await expect(proxy.num.query('13')).rejects.toMatchInlineSnapshot(`
	[TRPCClientError: error(s) found
	└─ Expected a generic object, actual "13"]
`);
  await close();
});

test('runtypes', async () => {
  const t = initTRPC.create();

  const router = t.router({
    num: t.procedure.input(T.Record({ text: T.String })).query(({ input }) => {
      expectTypeOf(input).toMatchTypeOf<{ text: string }>();
      return {
        input,
      };
    }),
  });

  const { close, proxy } = routerToServerAndClientNew(router);
  const res = await proxy.num.query({ text: '123' });
  expect(res.input).toMatchObject({ text: '123' });

  // @ts-expect-error this only accepts a `number`
  await expect(proxy.num.query('13')).rejects.toMatchInlineSnapshot(`
  [TRPCClientError: Expected { text: string; }, but was string]
`);
  await close();
});

test('validator fn', async () => {
  const t = initTRPC.create();

  const numParser = (input: unknown) => {
    if (typeof input !== 'number') {
      throw new Error('Not a number');
    }
    return input;
  };

  const router = t.router({
    num: t.procedure.input(numParser).query(({ input }) => {
      expectTypeOf(input).toBeNumber();
      return {
        input,
      };
    }),
  });

  const { close, proxy } = routerToServerAndClientNew(router);
  const res = await proxy.num.query(123);
  await expect(proxy.num.query('123' as any)).rejects.toMatchInlineSnapshot(
    `[TRPCClientError: Not a number]`,
  );
  expect(res.input).toBe(123);
  await close();
});

test('async validator fn', async () => {
  const t = initTRPC.create();
  async function numParser(input: unknown) {
    if (typeof input !== 'number') {
      throw new Error('Not a number');
    }
    return input;
  }

  const router = t.router({
    num: t.procedure.input(numParser).query(({ input }) => {
      expectTypeOf(input).toBeNumber();
      return {
        input,
      };
    }),
  });

  const { close, proxy } = routerToServerAndClientNew(router);
  const res = await proxy.num.query(123);
  await expect(proxy.num.query('123' as any)).rejects.toMatchInlineSnapshot(
    `[TRPCClientError: Not a number]`,
  );
  expect(res.input).toBe(123);
  await close();
});
