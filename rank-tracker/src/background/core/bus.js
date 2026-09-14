/**
 * bus.js — ناقل أحداث داخلي للـ Service Worker (Pub/Sub بسيط وآمن)
 */
export class Bus {
  constructor() {
    this.handlers = new Map();
  }

  on(type, handler) {
    if (!this.handlers.has(type)) { this.handlers.set(type, new Set()); }
    this.handlers.get(type).add(handler);
    return () => this.off(type, handler);
  }

  off(type, handler) {
    const set = this.handlers.get(type);
    if (set) { set.delete(handler); }
  }

  emit(type, payload) {
    const set = this.handlers.get(type);
    if (!set || !set.size) { return; }
    for (const handler of Array.from(set)) {
      try { handler(payload); } catch (err) {
        console.warn('[SRT][bus] handler error for', type, err);
      }
    }
  }

  /** انتظار حدث واحد فقط مع مهلة */
  once(type, timeoutMs, filter) {
    return new Promise((resolve) => {
      let timer = null;
      const off = this.on(type, (payload) => {
        if (filter && !filter(payload)) { return; }
        if (timer) { clearTimeout(timer); }
        off();
        resolve(payload);
      });
      if (timeoutMs) {
        timer = setTimeout(() => { off(); resolve(null); }, timeoutMs);
      }
    });
  }

  clear() {
    this.handlers.clear();
  }
}

export const bus = new Bus();
