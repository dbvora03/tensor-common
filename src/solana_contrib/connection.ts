import { Connection } from '@solana/web3.js';
import { rejectAfterDelay, TimeoutError } from '../utils';

/// This will failover from connection 0..N-1 if an ECONNREFUSED/503/timeout error is encountered.
export const makeFailoverConnection = (
  conns: Connection[],
  options?: { timeoutMS?: number },
): Connection => {
  const timeoutMS = options?.timeoutMS;

  const handler: ProxyHandler<Connection> = {
    get: (_target, prop, _receiver) => {
      // NB: can't be arrow function.
      return async function () {
        for (const [idx, conn] of conns.entries()) {
          try {
            //@ts-ignore
            const promise = conn[prop].apply(conn, arguments);
            const res = await (timeoutMS
              ? // Promise with timeout rejection.
                Promise.race([promise, rejectAfterDelay(timeoutMS)])
              : promise);
            return res;
          } catch (err: any) {
            console.warn(`conn ${idx} error:`, err);
            if (
              err instanceof TimeoutError ||
              err.message?.includes('503 Service Unavailable') ||
              err.message?.includes('ECONNREFUSED')
            ) {
              continue;
            }
            throw err;
          }
        }
        throw new Error(
          `503 Service Unavailable/ECONNREFUSED/timeout across ${conns.length} provider(s)`,
        );
      };
    },
  };

  return new Proxy(conns[0], handler);
};