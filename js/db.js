// BrewPOS Database — IndexedDB wrapper
// All data persists on the device even offline

const DB_NAME = 'BrewPOS';
const DB_VERSION = 1;

let _db = null;

const DB = {
  open() {
    return new Promise((resolve, reject) => {
      if (_db) return resolve(_db);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        // Orders store
        if (!db.objectStoreNames.contains('orders')) {
          const os = db.createObjectStore('orders', { keyPath: 'id', autoIncrement: true });
          os.createIndex('date', 'date');
          os.createIndex('status', 'status');
        }
        // Customers store
        if (!db.objectStoreNames.contains('customers')) {
          const cs = db.createObjectStore('customers', { keyPath: 'id', autoIncrement: true });
          cs.createIndex('phone', 'phone', { unique: true });
          cs.createIndex('name', 'name');
        }
        // Ingredients / inventory
        if (!db.objectStoreNames.contains('ingredients')) {
          db.createObjectStore('ingredients', { keyPath: 'id', autoIncrement: true });
        }
        // Products
        if (!db.objectStoreNames.contains('products')) {
          db.createObjectStore('products', { keyPath: 'id', autoIncrement: true });
        }
        // Settings
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
        // Kitchen queue
        if (!db.objectStoreNames.contains('kitchen')) {
          db.createObjectStore('kitchen', { keyPath: 'orderId' });
        }
      };
      req.onsuccess = e => { _db = e.target.result; resolve(_db); };
      req.onerror = e => reject(e.target.error);
    });
  },

  async tx(store, mode, fn) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const os = tx.objectStore(store);
      const req = fn(os);
      if (req && req.onsuccess !== undefined) {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      } else {
        tx.oncomplete = () => resolve(req ? req.result : undefined);
        tx.onerror = () => reject(tx.error);
      }
    });
  },

  async getAll(store) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async get(store, key) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async put(store, data) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).put(data);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async add(store, data) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).add(data);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async delete(store, key) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async getSetting(key, defaultVal = null) {
    const row = await this.get('settings', key);
    return row ? row.value : defaultVal;
  },

  async setSetting(key, value) {
    return this.put('settings', { key, value });
  },

  async getOrdersByDate(dateStr) {
    const all = await this.getAll('orders');
    return all.filter(o => o.date === dateStr);
  },

  async getCustomerByPhone(phone) {
    const all = await this.getAll('customers');
    return all.find(c => c.phone === phone) || null;
  },
};

window.DB = DB;
