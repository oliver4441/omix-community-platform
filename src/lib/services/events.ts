/**
 * Typed pub/sub emitter — the message bus between domain services and UI.
 *
 * Every subscribe call returns an unsubscribe function; emitters never hold
 * references after unsubscribe, so components can't leak listeners.
 */

type Handler<T = unknown> = (payload: T) => void;

const channels = new Map<string, Set<Handler<never>>>();

export function publish<T>(topic: string, payload: T): void {
  const handlers = channels.get(topic);
  if (!handlers) return;
  for (const handler of [...handlers]) {
    try {
      (handler as Handler<T>)(payload);
    } catch (err) {
      console.error(`[events] handler error on "${topic}":`, err);
    }
  }
}

export function subscribe<T>(topic: string, handler: Handler<T>): () => void {
  let handlers = channels.get(topic);
  if (!handlers) {
    handlers = new Set();
    channels.set(topic, handlers as Set<Handler<never>>);
  }
  (handlers as Set<Handler<T>>).add(handler);
  return () => {
    (handlers as Set<Handler<T>>).delete(handler);
  };
}

export function clearTopic(topic: string): void {
  channels.delete(topic);
}
