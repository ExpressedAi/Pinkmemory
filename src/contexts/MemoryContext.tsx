import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { openSTMDB, openLTMDB } from '@/services/db';
import { stm_countChunks, ltm_countChunks } from '@/services/memory';
import { useToast } from '@/hooks/useToast';

interface MemoryContextType {
  stmCount: number;
  ltmCount: number;
  isInitialized: boolean;
  clearAllMemories: () => Promise<void>;
  refreshMemoryCounts: () => Promise<void>;
}

interface MemoryProviderProps {
  children: ReactNode;
}

export const MemoryContext = createContext<MemoryContextType>({
  stmCount: 0,
  ltmCount: 0,
  isInitialized: false,
  clearAllMemories: async () => {},
  refreshMemoryCounts: async () => {}
});

export const useMemory = () => useContext(MemoryContext);

export const MemoryProvider: React.FC<MemoryProviderProps> = ({ children }) => {
  const [stmCount, setStmCount] = useState(0);
  const [ltmCount, setLtmCount] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const { toast } = useToast();

  // Initialize database connections on mount
  useEffect(() => {
    const initDBs = async () => {
      try {
        await Promise.all([openSTMDB(), openLTMDB()]);
        setIsInitialized(true);
        await refreshMemoryCounts();
      } catch (error) {
        console.error("Failed to initialize database connections:", error);
        toast({
          title: "Database initialization failed",
          description: "Some features may not work properly",
          variant: "error"
        });
      }
    };

    initDBs();
  }, []);

  const refreshMemoryCounts = async () => {
    try {
      const [stmCountValue, ltmCountValue] = await Promise.all([
        stm_countChunks(),
        ltm_countChunks()
      ]);
      setStmCount(stmCountValue);
      setLtmCount(ltmCountValue);
    } catch (error) {
      console.error("Failed to refresh memory counts:", error);
    }
  };

  const clearAllMemories = async () => {
    // This is a simplified version. The actual implementation would clear both STM and LTM databases.
    if (window.confirm("Are you sure you want to clear ALL memories? This cannot be undone.")) {
      try {
        // Clear STM and LTM stores
        const stmDB = await openSTMDB();
        const stmTransaction = stmDB.transaction("memoryChunksSTM", "readwrite");
        const stmStore = stmTransaction.objectStore("memoryChunksSTM");
        await stmStore.clear();
        
        const ltmDB = await openLTMDB();
        const ltmTransaction = ltmDB.transaction("memoryChunksLTM", "readwrite");
        const ltmStore = ltmTransaction.objectStore("memoryChunksLTM");
        await ltmStore.clear();
        
        await refreshMemoryCounts();
        
        toast({
          title: "All memories cleared",
          variant: "success"
        });
      } catch (error) {
        console.error("Failed to clear memories:", error);
        toast({
          title: "Failed to clear memories",
          description: "An error occurred while clearing memories",
          variant: "error"
        });
      }
    }
  };

  return (
    <MemoryContext.Provider
      value={{
        stmCount,
        ltmCount,
        isInitialized,
        clearAllMemories,
        refreshMemoryCounts
      }}
    >
      {children}
    </MemoryContext.Provider>
  );
};