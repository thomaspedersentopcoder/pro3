import { waitFor } from '@testing-library/dom';
import { AnyRouter } from '@trpc/server/src';
import { observable } from '@trpc/server/src/observable';
import { OperationLink } from '../..';
import { createChain } from './createChain';
import { dedupeLink } from './dedupeLink';

test('dedupeLink', async () => {
  const endingLinkTriggered = vi.fn();
  const timerTriggered = vi.fn();
  const links: OperationLink<AnyRouter, any, any>[] = [
    // "dedupe link"
    dedupeLink()(null as any),
    ({ op }) => {
      return observable((subscribe) => {
        endingLinkTriggered();
        const timer = setTimeout(() => {
          timerTriggered();
          subscribe.next({
            result: {
              type: 'data',
              data: {
                input: op.input,
              },
            },
          });
          subscribe.complete();
        }, 1);
        return () => {
          clearTimeout(timer);
        };
      });
    },
  ];
  {
    const call1 = createChain<AnyRouter, unknown, unknown>({
      links,
      op: {
        type: 'query',
        id: 1,
        input: 'world',
        path: 'hello',
        context: {},
      },
    });

    const call2 = createChain<AnyRouter, unknown, unknown>({
      links,
      op: {
        type: 'query',
        id: 1,
        input: 'world',
        path: 'hello',
        context: {},
      },
    });
    const next = vi.fn();
    call1.subscribe({ next });
    call2.subscribe({ next });

    expect(endingLinkTriggered).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(timerTriggered).toHaveBeenCalledTimes(1);
    });

    expect(next).toHaveBeenCalledTimes(2);
  }
});

test('dedupe - cancel one does not cancel the other', async () => {
  const endingLinkTriggered = vi.fn();
  const timerTriggered = vi.fn();
  const links: OperationLink<AnyRouter, any, any>[] = [
    // "dedupe link"
    dedupeLink()(null as any),
    ({ op }) => {
      return observable((subscribe) => {
        endingLinkTriggered();
        const timer = setTimeout(() => {
          timerTriggered();
          subscribe.next({
            result: {
              type: 'data',
              data: {
                input: op.input,
              },
            },
          });
          subscribe.complete();
        }, 1);
        return () => {
          clearTimeout(timer);
        };
      });
    },
  ];

  {
    const call1 = createChain<AnyRouter, unknown, unknown>({
      links,
      op: {
        type: 'query',
        id: 1,
        input: 'world',
        path: 'hello',
        context: {},
      },
    });

    const call2 = createChain<AnyRouter, unknown, unknown>({
      links,
      op: {
        type: 'query',
        id: 1,
        input: 'world',
        path: 'hello',
        context: {},
      },
    });
    const next = vi.fn();
    const call1$ = call1.subscribe({ next });
    call2.subscribe({ next });
    call1$.unsubscribe();

    expect(endingLinkTriggered).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(timerTriggered).toHaveBeenCalledTimes(1);

      expect(next).toHaveBeenCalledTimes(1);
    });
  }
});
