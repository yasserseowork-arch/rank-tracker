/**
 * chrome-mock.mjs — بيئة chrome كاملة داخل Node لاختبارات الوحدات
 * تغطي: storage.local/session, runtime, tabs, alarms, notifications,
 * windows, sidePanel, i18n — بما يكفي لتشغيل state/queue/scheduler خارج المتصفح.
 */

class EventEmitter {
  constructor() { this.listeners = new Set(); }
  addListener(fn) { this.listeners.add(fn); }
  removeListener(fn) { this.listeners.delete(fn); }
  async fire(...args) {
    for (const fn of Array.from(this.listeners)) { await fn(...args); }
  }
}

function makeStorageArea() {
  const data = new Map();
  return {
    async get(keys) {
      if (keys === null || keys === undefined) { return Object.fromEntries(data); }
      const list = Array.isArray(keys) ? keys : [keys];
      const out = {};
      for (const k of list) { if (data.has(k)) { out[k] = data.get(k); } }
      return out;
    },
    async set(obj) {
      for (const [k, v] of Object.entries(obj || {})) { data.set(k, JSON.parse(JSON.stringify(v))); }
    },
    async remove(keys) {
      const list = Array.isArray(keys) ? keys : [keys];
      for (const k of list) { data.delete(k); }
    },
    async clear() { data.clear(); }
  };
}

export function installChromeMock() {
  const tabs = new Map();
  let nextTabId = 100;

  const chrome = {
    storage: {
      local: makeStorageArea(),
      session: makeStorageArea()
    },
    runtime: {
      lastError: undefined,
      onMessage: new EventEmitter(),
      onConnect: new EventEmitter(),
      onInstalled: new EventEmitter(),
      onStartup: new EventEmitter(),
      sendMessage(message, cb) {
        if (typeof cb === 'function') { cb({ ok: true }); }
      },
      connect() {
        return {
          name: 'mock',
          onDisconnect: new EventEmitter(),
          onMessage: new EventEmitter(),
          postMessage() {},
          disconnect() {}
        };
      },
      getURL(p) { return 'chrome-extension://mock/' + p; }
    },
    tabs: {
      onUpdated: new EventEmitter(),
      onRemoved: new EventEmitter(),
      async create(props) {
        const tab = { id: nextTabId++, url: props.url, status: 'loading', windowId: 1 };
        tabs.set(tab.id, tab);
        return tab;
      },
      async get(id) { return tabs.get(id) || null; },
      async update(id, props) {
        const tab = tabs.get(id);
        if (tab) { Object.assign(tab, props); }
        return tab;
      },
      async remove(id) {
        tabs.delete(id);
        await chrome.tabs.onRemoved.fire(id);
      }
    },
    alarms: {
      store: new Map(),
      onAlarm: new EventEmitter(),
      async create(name, opts) { chrome.alarms.store.set(name, opts); },
      async clear(name) { return chrome.alarms.store.delete(name); },
      async getAll() { return Array.from(chrome.alarms.store.entries()).map(([name, v]) => Object.assign({ name }, v)); }
    },
    notifications: {
      onClicked: new EventEmitter(),
      async create() { return 'mock-notification'; },
      async clear() { return true; }
    },
    windows: {
      async getLastFocused() { return { id: 1 }; },
      async update() { return {}; }
    },
    sidePanel: {
      async setPanelBehavior() {},
      async open() {}
    },
    i18n: {
      getMessage(key) { return key; }
    }
  };

  globalThis.chrome = chrome;
  return chrome;
}
