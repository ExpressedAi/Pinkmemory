import { openLTMDB, openSTMDB, LTM_STORE_NAME, STM_STORE_NAME } from './db';

// Memory chunk interface
export interface MemoryChunk {
  id?: number;
  text: string;
  embedding: number[];
  metaVector: number[];
  timestamp: number;
  lastAccessed?: number;
  score?: number;
  agentId: string;
  meta: any;
  source: string;
  semanticSim?: number;
  metaSim?: number;
  simScore?: number;
  finalScore?: number;
}

// STM Database Functions
export const stm_addChunk = async (chunk: Omit<MemoryChunk, 'id'>): Promise<number> => {
  if (!chunk.text || !chunk.embedding || !chunk.metaVector) {
    throw new Error("Invalid chunk data provided");
  }
  
  // Ensure required fields
  const enrichedChunk = {
    ...chunk,
    score: chunk.score ?? 1.0,
    timestamp: chunk.timestamp ?? Date.now(),
    lastAccessed: chunk.lastAccessed ?? chunk.timestamp ?? Date.now()
  };

  const db = await openSTMDB();
  const tx = db.transaction(STM_STORE_NAME, 'readwrite');
  const store = tx.objectStore(STM_STORE_NAME);
  const id = await store.add(enrichedChunk);
  await tx.done;
  
  console.log("Chunk added to STM (IDB)", id);
  return id as number;
};

export const stm_getMemoryStore = async (): Promise<MemoryChunk[]> => {
  const db = await openSTMDB();
  return db.getAll(STM_STORE_NAME);
};

export const stm_boostMemoryChunk = async (id: number, boost = 1): Promise<void> => {
  if (typeof id !== 'number' || id <= 0) {
    throw new Error("Invalid ID for STM boost");
  }
  
  const db = await openSTMDB();
  const tx = db.transaction(STM_STORE_NAME, 'readwrite');
  const store = tx.objectStore(STM_STORE_NAME);
  
  const chunk = await store.get(id);
  if (!chunk) {
    throw new Error("Chunk not found");
  }
  
  chunk.score = (chunk.score || 1) + boost;
  chunk.lastAccessed = Date.now();
  await store.put(chunk);
  await tx.done;
  
  console.log("Boosted STM chunk:", id);
};

export const stm_decayMemoryStore = async (rate = 0.995, minScore = 0.05): Promise<{updated: number, deleted: number}> => {
  const db = await openSTMDB();
  const tx = db.transaction(STM_STORE_NAME, 'readwrite');
  const store = tx.objectStore(STM_STORE_NAME);
  
  let decayedCount = 0;
  let deletedCount = 0;
  const now = Date.now();
  
  let cursor = await store.openCursor();
  while (cursor) {
    const chunk = cursor.value;
    const lastAccess = chunk.lastAccessed || chunk.timestamp || now;
    const hours = (now - lastAccess) / 3600000;
    chunk.score = (chunk.score || 1) * Math.pow(rate, hours);
    
    if (chunk.score < minScore) {
      await cursor.delete();
      deletedCount++;
    } else {
      await cursor.update(chunk);
      decayedCount++;
    }
    cursor = await cursor.continue();
  }
  
  await tx.done;
  console.log(`STM Decay: Updated ${decayedCount} chunks, Deleted ${deletedCount} chunks.`);
  return { updated: decayedCount, deleted: deletedCount };
};

export const stm_countChunks = async (): Promise<number> => {
  const db = await openSTMDB();
  return db.count(STM_STORE_NAME);
};

// LTM Database Functions
export const ltm_addChunk = async (chunk: Omit<MemoryChunk, 'id'>): Promise<number> => {
  if (!chunk.text || !chunk.embedding || !chunk.metaVector) {
    throw new Error("Invalid chunk data provided");
  }
  
  // Ensure required fields
  const enrichedChunk = {
    ...chunk,
    score: chunk.score ?? 1.0,
    timestamp: chunk.timestamp ?? Date.now(),
    lastAccessed: chunk.lastAccessed ?? chunk.timestamp ?? Date.now()
  };

  const db = await openLTMDB();
  const tx = db.transaction(LTM_STORE_NAME, 'readwrite');
  const store = tx.objectStore(LTM_STORE_NAME);
  const id = await store.add(enrichedChunk);
  await tx.done;
  
  console.log("Chunk added to LTM (IDB)", id);
  return id as number;
};

export const ltm_getMemoryStore = async (): Promise<MemoryChunk[]> => {
  const db = await openLTMDB();
  return db.getAll(LTM_STORE_NAME);
};

export const ltm_boostMemoryChunk = async (id: number, boost = 1): Promise<void> => {
  if (typeof id !== 'number' || id <= 0) {
    throw new Error("Invalid ID for LTM boost");
  }
  
  const db = await openLTMDB();
  const tx = db.transaction(LTM_STORE_NAME, 'readwrite');
  const store = tx.objectStore(LTM_STORE_NAME);
  
  const chunk = await store.get(id);
  if (!chunk) {
    throw new Error("Chunk not found");
  }
  
  chunk.score = (chunk.score || 1) + boost;
  chunk.lastAccessed = Date.now();
  await store.put(chunk);
  await tx.done;
  
  console.log("Boosted LTM chunk:", id);
};

export const ltm_decayMemoryStore = async (rate = 0.995, minScore = 0.05): Promise<{updated: number, deleted: number}> => {
  const db = await openLTMDB();
  const tx = db.transaction(LTM_STORE_NAME, 'readwrite');
  const store = tx.objectStore(LTM_STORE_NAME);
  
  let decayedCount = 0;
  let deletedCount = 0;
  const now = Date.now();
  
  let cursor = await store.openCursor();
  while (cursor) {
    const chunk = cursor.value;
    const lastAccess = chunk.lastAccessed || chunk.timestamp || now;
    const hours = (now - lastAccess) / 3600000;
    chunk.score = (chunk.score || 1) * Math.pow(rate, hours);
    
    if (chunk.score < minScore) {
      await cursor.delete();
      deletedCount++;
    } else {
      await cursor.update(chunk);
      decayedCount++;
    }
    cursor = await cursor.continue();
  }
  
  await tx.done;
  console.log(`LTM Decay: Updated ${decayedCount} chunks, Deleted ${deletedCount} chunks.`);
  return { updated: decayedCount, deleted: deletedCount };
};

export const ltm_countChunks = async (): Promise<number> => {
  const db = await openLTMDB();
  return db.count(LTM_STORE_NAME);
};

// Chunking Logic for Text Processing
export const chunkText = (text: string): string[] => {
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  const MAX_CHUNK_LEN = 1000;
  const MIN_CHUNK_LEN = 50;
  
  for (let p of paragraphs) {
    if (p.length <= MAX_CHUNK_LEN * 1.2) {
      if (p.length >= MIN_CHUNK_LEN) chunks.push(p);
    } else {
      const sentences = p.match(/[^.!?]+(?:[.!?]|$)\s*/g) || [p];
      let currentChunk = "";
      
      for (let s of sentences) {
        s = s.trim();
        if (!s) continue;
        
        if (currentChunk.length + s.length <= MAX_CHUNK_LEN) {
          currentChunk += (currentChunk ? " " : "") + s;
        } else {
          if (currentChunk.length >= MIN_CHUNK_LEN) {
            chunks.push(currentChunk);
          }
          
          if (s.length <= MAX_CHUNK_LEN) {
            currentChunk = s;
          } else {
            for (let i = 0; i < s.length; i += MAX_CHUNK_LEN) {
              const subChunk = s.substring(i, i + MAX_CHUNK_LEN).trim();
              if (subChunk.length >= MIN_CHUNK_LEN) {
                chunks.push(subChunk);
              }
            }
            currentChunk = "";
          }
        }
      }
      
      if (currentChunk.length >= MIN_CHUNK_LEN) {
        chunks.push(currentChunk);
      }
    }
  }
  
  return chunks.filter(c => c.length >= MIN_CHUNK_LEN);
};