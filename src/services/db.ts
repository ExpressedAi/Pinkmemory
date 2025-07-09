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

// Storage quota and usage tracking
export const getStorageInfo = async () => {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    return {
      quota: estimate.quota || 0,
      usage: estimate.usage || 0,
      available: (estimate.quota || 0) - (estimate.usage || 0),
      percentage: estimate.quota ? ((estimate.usage || 0) / estimate.quota) * 100 : 0
    };
  }
  return null;
};

// Request persistent storage
export const requestPersistentStorage = async (): Promise<boolean> => {
  if ('storage' in navigator && 'persist' in navigator.storage) {
    return await navigator.storage.persist();
  }
  return false;
};

// Check if storage is persistent
export const isStoragePersistent = async (): Promise<boolean> => {
  if ('storage' in navigator && 'persisted' in navigator.storage) {
    return await navigator.storage.persisted();
  }
  return false;
};

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

// Database health check
export const checkDatabaseHealth = async () => {
  try {
    const [ltmDb, stmDb] = await Promise.all([openLTMDB(), openSTMDB()]);
    
    // Test basic operations
    const ltmCount = await ltmDb.count(LTM_STORE_NAME);
    const stmCount = await stmDb.count(STM_STORE_NAME);
    
    const storageInfo = await getStorageInfo();
    const isPersistent = await isStoragePersistent();
    
    return {
      ltmCount,
      stmCount,
      storageInfo,
      isPersistent,
      healthy: true
    };
  } catch (error) {
    console.error("Database health check failed:", error);
    return {
      ltmCount: 0,
      stmCount: 0,
      storageInfo: null,
      isPersistent: false,
      healthy: false,
      error: error.message
    };
  }
};

// Export all data for backup
export const exportAllData = async () => {
  try {
    const [ltmDb, stmDb] = await Promise.all([openLTMDB(), openSTMDB()]);
    
    const [ltmData, stmData] = await Promise.all([
      ltmDb.getAll(LTM_STORE_NAME),
      stmDb.getAll(STM_STORE_NAME)
    ]);
    
    return {
      exportDate: new Date().toISOString(),
      version: "1.0",
      ltmData,
      stmData
    };
  } catch (error) {
    console.error("Export failed:", error);
    throw error;
  }
};

// Import data from backup
export const importAllData = async (backupData: any) => {
  try {
    const [ltmDb, stmDb] = await Promise.all([openLTMDB(), openSTMDB()]);
    
    // Clear existing data
    const ltmTx = ltmDb.transaction(LTM_STORE_NAME, 'readwrite');
    const stmTx = stmDb.transaction(STM_STORE_NAME, 'readwrite');
    
    await Promise.all([
      ltmTx.objectStore(LTM_STORE_NAME).clear(),
      stmTx.objectStore(STM_STORE_NAME).clear()
    ]);
    
    await Promise.all([ltmTx.done, stmTx.done]);
    
    // Import new data
    if (backupData.ltmData && Array.isArray(backupData.ltmData)) {
      const ltmImportTx = ltmDb.transaction(LTM_STORE_NAME, 'readwrite');
      const ltmStore = ltmImportTx.objectStore(LTM_STORE_NAME);
      
      for (const item of backupData.ltmData) {
        await ltmStore.add(item);
      }
      await ltmImportTx.done;
    }
    
    if (backupData.stmData && Array.isArray(backupData.stmData)) {
      const stmImportTx = stmDb.transaction(STM_STORE_NAME, 'readwrite');
      const stmStore = stmImportTx.objectStore(STM_STORE_NAME);
      
      for (const item of backupData.stmData) {
        await stmStore.add(item);
      }
      await stmImportTx.done;
    }
    
    return {
      ltmImported: backupData.ltmData?.length || 0,
      stmImported: backupData.stmData?.length || 0
    };
  } catch (error) {
    console.error("Import failed:", error);
    throw error;
  }
};