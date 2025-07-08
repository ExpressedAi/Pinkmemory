import { openDB, DBSchema, IDBPDatabase } from 'idb';

// Database Constants
export const LTM_DB_NAME = "MetaVectorLTM";
export const STM_DB_NAME = "MetaVectorSTM";
export const DB_VERSION = 1;
export const LTM_STORE_NAME = "memoryChunksLTM";
export const STM_STORE_NAME = "memoryChunksSTM";

// Database schemas
interface LTMDBSchema extends DBSchema {
  [LTM_STORE_NAME]: {
    key: number;
    value: any;
    indexes: {
      'timestamp': number;
      'score': number;
      'lastAccessed': number;
    };
  };
}

interface STMDBSchema extends DBSchema {
  [STM_STORE_NAME]: {
    key: number;
    value: any;
    indexes: {
      'timestamp': number;
      'score': number;
      'lastAccessed': number;
    };
  };
}

// Database instances
let ltmDb: IDBPDatabase<LTMDBSchema> | null = null;
let stmDb: IDBPDatabase<STMDBSchema> | null = null;

// Open LTM Database
export const openLTMDB = async (): Promise<IDBPDatabase<LTMDBSchema>> => {
  if (ltmDb) return ltmDb;
  
  ltmDb = await openDB<LTMDBSchema>(LTM_DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(LTM_STORE_NAME)) {
        const store = db.createObjectStore(LTM_STORE_NAME, { 
          keyPath: 'id',
          autoIncrement: true 
        });
        store.createIndex("timestamp", "timestamp", { unique: false });
        store.createIndex("score", "score", { unique: false });
        store.createIndex("lastAccessed", "lastAccessed", { unique: false });
        console.log("LTM store and indexes created.");
      }
    },
  });
  
  console.log("LTM IndexedDB opened successfully");
  return ltmDb;
};

// Open STM Database
export const openSTMDB = async (): Promise<IDBPDatabase<STMDBSchema>> => {
  if (stmDb) return stmDb;
  
  stmDb = await openDB<STMDBSchema>(STM_DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STM_STORE_NAME)) {
        const store = db.createObjectStore(STM_STORE_NAME, { 
          keyPath: 'id',
          autoIncrement: true 
        });
        store.createIndex("timestamp", "timestamp", { unique: false });
        store.createIndex("score", "score", { unique: false });
        store.createIndex("lastAccessed", "lastAccessed", { unique: false });
        console.log("STM store and indexes created.");
      }
    },
  });
  
  console.log("STM IndexedDB opened successfully");
  return stmDb;
};