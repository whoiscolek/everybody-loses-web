function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

class FakeDocumentSnapshot {
  constructor(ref, value) {
    this.ref = ref;
    this.id = ref.id;
    this.exists = value !== undefined;
    this._value = value;
  }

  data() {
    return clone(this._value);
  }
}

export class FakeFirestore {
  constructor(seed = {}) {
    this.data = new Map();
    this.commits = 0;
    this.autoId = 0;
    for (const [collection, docs] of Object.entries(seed)) {
      for (const [id, value] of Object.entries(docs)) {
        this.data.set(`${collection}/${id}`, clone(value));
      }
    }
  }

  collection(name) {
    const db = this;
    return {
      id: name,
      doc(id = `auto-${++db.autoId}`) {
        return db.doc(name, id);
      },
      where(field, operator, expected) {
        if (operator !== "==") throw new Error(`FakeFirestore only supports == queries, received ${operator}`);
        return db.query(name, [{ field, expected }]);
      },
      async get() {
        return db.querySnapshot(name, []);
      }
    };
  }

  query(collection, filters, limitCount = null) {
    const db = this;
    return {
      where(field, operator, expected) {
        if (operator !== "==") throw new Error(`FakeFirestore only supports == queries, received ${operator}`);
        return db.query(collection, [...filters, { field, expected }], limitCount);
      },
      limit(count) {
        return db.query(collection, filters, Number(count));
      },
      async get() {
        return db.querySnapshot(collection, filters, limitCount);
      }
    };
  }

  querySnapshot(collection, filters, limitCount = null) {
    let docs = [...this.data.entries()]
      .filter(([key]) => key.startsWith(`${collection}/`))
      .map(([key, value]) => {
        const id = key.slice(collection.length + 1);
        return new FakeDocumentSnapshot(this.doc(collection, id), value);
      })
      .filter(snapshot => filters.every(({ field, expected }) => snapshot.data()?.[field] === expected));
    if (Number.isFinite(limitCount)) docs = docs.slice(0, limitCount);
    return { docs, empty: docs.length === 0, size: docs.length };
  }

  doc(collection, id) {
    const key = `${collection}/${id}`;
    const db = this;
    return {
      id: String(id),
      path: key,
      _key: key,
      async get() {
        return new FakeDocumentSnapshot(this, db.data.get(key));
      },
      async set(value, options = {}) {
        const existing = db.data.get(key) || {};
        db.data.set(key, options.merge ? { ...existing, ...clone(value) } : clone(value));
      },
      async update(value) {
        const existing = db.data.get(key);
        if (existing === undefined) throw new Error(`Missing document ${key}`);
        db.data.set(key, { ...existing, ...clone(value) });
      },
      async delete() {
        db.data.delete(key);
      }
    };
  }

  batch() {
    const operations = [];
    return {
      set: (ref, value, options = {}) => operations.push({ type: "set", ref, value: clone(value), options }),
      update: (ref, value) => operations.push({ type: "update", ref, value: clone(value), options: { merge: true } }),
      delete: ref => operations.push({ type: "delete", ref }),
      commit: async () => {
        for (const operation of operations) {
          const key = operation.ref._key || operation.ref.path;
          if (operation.type === "delete") {
            this.data.delete(key);
            continue;
          }
          const existing = this.data.get(key);
          if (operation.type === "update" && existing === undefined) throw new Error(`Missing document ${key}`);
          this.data.set(key, operation.options?.merge ? { ...(existing || {}), ...operation.value } : operation.value);
        }
        this.commits += 1;
      }
    };
  }

  get(collection, id) {
    return this.data.get(`${collection}/${id}`);
  }

  entries(collection) {
    return [...this.data.entries()]
      .filter(([key]) => key.startsWith(`${collection}/`))
      .map(([key, value]) => ({ id: key.slice(collection.length + 1), ...value }));
  }
}

export const FakeFieldValue = {
  serverTimestamp() {
    return "__SERVER_TIMESTAMP__";
  }
};
