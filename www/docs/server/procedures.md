---
id: procedures
title: Define Procedures
sidebar_label: Define Procedures
slug: /server/procedures
---

A procedure is a function which is exposed to the client, it can be one of:

- a `Query` - used to fetch data, generally does not change any data
- a `Mutation` - used to send data, often for create/update/delete purposes
- a `Subscription` - you might not need this, and we have [dedicated documentation](/docs/subscriptions)

Procedures in tRPC are very flexible primitives to create backend functions. They use an immutable builder pattern, which means you can [create reusable base procedures](#reusable-base-procedures) that share functionality among multiple procedures.

## Writing procedures

The `t` object you create during tRPC setup returns an initial `t.procedure` which all other procedures are built on:

```ts twoslash
import { initTRPC } from '@trpc/server';
import { z } from 'zod';

const t = initTRPC.context<{ signGuestBook: () => Promise<void> }>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

const appRouter = router({
  // Queries are the best place to fetch data
  hello: publicProcedure.query(() => {
    return {
      message: 'hello world',
    };
  }),

  // Mutations are the best place to do things like updating a database
  goodbye: publicProcedure.mutation(async (opts) => {
    await opts.ctx.signGuestBook();

    return {
      message: 'goodbye!',
    };
  }),
});
```

## Reusable "Base Procedures" {#reusable-base-procedures}

As a general pattern we recommend you rename and export `t.procedure` as `publicProcedure`, which then makes room for you to create other named procedures for specific use cases and export those too. This pattern is called "base procedures" and is a key pattern for code and behaviour re-use in tRPC; every application is likely to need it.

The below example takes a user input and [authorizes](https://en.wikipedia.org/wiki/Authorization) them like protective towns-people. This is obviously a contrived example for simplicity, and not an appropriate way to securely authorize an application user, so in practice you may want to use some combination of [Headers](/docs/client/headers), [Context](context), [Middleware](middlewares), and [Metadata](metadata), to [authenticate](https://en.wikipedia.org/wiki/Authentication) and authorize your users.

```ts twoslash
// @target: esnext
import { initTRPC, TRPCError } from '@trpc/server';
import { z } from 'zod';

const t = initTRPC.context<{ signGuestBook: () => Promise<void> }>().create();

export const publicProcedure = t.procedure;

// ---cut---

export const authorizedProcedure = publicProcedure
  .input(z.object({ townName: z.string() }))
  .use((opts) => {
    if (opts.input.townName !== 'Pucklechurch') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: "We don't take kindly to out-of-town folk",
      });
    }

    return opts.next();
  });

export const appRouter = t.router({
  hello: authorizedProcedure.query(() => {
    return {
      message: 'hello world',
    };
  }),
  goodbye: authorizedProcedure.mutation(async (opts) => {
    await opts.ctx.signGuestBook();

    return {
      message: 'goodbye!',
    };
  }),
});
```

## Infering the options type of a "Base Procedure"

In addition to being able to [infer the input and output types](/docs/client/vanilla/infer-types#inferring-input--output-types) of a procedure, you can also infer the options type of a specific procedure builder (or base procedure) using `inferProcedureBuilderResolverOptions`.

This type helper is useful for declaring a type to a function's parameters. Like for example, separating the procedure's handler (main execution code) from its definition at the router, or for creating a helper function that works with multiple procedures.

<!-- prettier-ignore-start -->
```ts twoslash
// @target: esnext
import { initTRPC, TRPCError } from '@trpc/server';
import type { inferProcedureBuilderResolverOptions } from '@trpc/server';
import { z } from 'zod';

const t = initTRPC.create();

export const publicProcedure = t.procedure;

export const authorizedProcedure = publicProcedure
  .input(z.object({ townName: z.string() }))
  .use(async (opts) => opts.next());

// ---cut---

const GiveFiftsToTownfolkInput = z.object({
  gift: z.string().default('🎁'),
});

export const appRouter = t.router({
  getTownInformation: authorizedProcedure.query(
    async (opts) => await getTownInformationHandler(opts)
  ),
  giveGiftsToTownfolk: authorizedProcedure.input(GiveFiftsToTownfolkInput).mutation(
    async (opts) => await giveGiftsToTownfolkHandler(opts)
  )
});

type AuthorizedProcedureOptions = inferProcedureBuilderResolverOptions<typeof authorizedProcedure>;
//   ^?

const getTownInformationHandler = async (opts: AuthorizedProcedureOptions) => {
  const { input, ctx } = opts; //input and ctx are now correctly typed! 
  //       ^?

  const townInfo = await getTownInfoHelper(opts);
  return townInfo;
};

const giveGiftsToTownfolkHandler = async (opts: AuthorizedProcedureOptions & {
  input: z.infer<typeof GiveFiftsToTownfolkInput>;
}) => {
  const { townsFavoriteGift } = await getTownInfoHelper(opts);
  if (opts.input.gift !== townsFavoriteGift) {
    return "We'll accept it...";
  }

  return "We thank you for your generosity";
};

function getTownInfoHelper({ input }: AuthorizedProcedureOptions) {
  // ...get town info from api/database using input.townName
  return { townsFavoriteGift: '🍓' };
}
```
<!-- prettier-ignore-end -->
