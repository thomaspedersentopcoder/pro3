/* eslint-disable @typescript-eslint/no-empty-function */
import { AnyRouter } from '../../../server/src';
import { createChain } from '../links/internals/createChain';
import { splitLink } from '../links/splitLink';
import { OperationLink, TRPCLink } from '../links/types';
import { observable } from '../rx';

test('splitLink', () => {
  const wsLinkSpy = jest.fn();
  const wsLink: TRPCLink<any> = () => () =>
    observable(() => {
      wsLinkSpy();
    });
  const httpLinkSpy = jest.fn();
  const httpLink: TRPCLink<any> = () => () =>
    observable(() => {
      httpLinkSpy();
    });
  const links: OperationLink<AnyRouter, any, any>[] = [
    // "dedupe link"
    splitLink({
      condition(op) {
        return op.type === 'subscription';
      },
      true: wsLink,
      false: [httpLink],
    })(null as any),
  ];

  createChain({
    links,
    op: {
      type: 'query',
      input: null,
      path: '.',
      id: 0,
      context: {},
    },
  }).subscribe({});
  expect(httpLinkSpy).toHaveBeenCalledTimes(1);
  expect(wsLinkSpy).toHaveBeenCalledTimes(0);
  jest.resetAllMocks();

  createChain({
    links,
    op: {
      type: 'subscription',
      input: null,
      path: '.',
      id: 0,
      context: {},
    },
  }).subscribe({});
  expect(httpLinkSpy).toHaveBeenCalledTimes(0);
  expect(wsLinkSpy).toHaveBeenCalledTimes(1);
});
