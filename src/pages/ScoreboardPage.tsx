import React, { useState, useEffect } from 'react';
import { useMemory } from '@/contexts/MemoryContext';
import { AlertCircle, BarChart2, Database, HardDrive } from 'lucide-react';
import { stm_getMemoryStore, ltm_getMemoryStore, stm_decayMemoryStore, ltm_decayMemoryStore } from '@/services/memory';

interface MemoryChunk {
  id?: number;
  text: string;
  score?: number;
  lastAccessed?: number;
  timestamp: number;
  source: string;
}

interface StorageStats {
  stm: {
    size: number;
    chunks: number;
  };
  ltm: {
    size: number;
    chunks: number;
  };
}

const ScoreboardPage: React.FC = () => {
  const { clearAllMemories, refreshMemoryCounts, stmCount, ltmCount } = useMemory();
  const [stmChunks, setStmChunks] = useState<MemoryChunk[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastDecayed, setLastDecayed] = useState<{stm?: Date, ltm?: Date}>({});
  const [storageStats, setStorageStats] = useState<StorageStats>({ 
    stm: { size: 0, chunks: 0 }, 
    ltm: { size: 0, chunks: 0 } 
  });
  const [browserInfo, setBrowserInfo] = useState<string>('');
  
  // Load STM chunks on mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // Detect browser
        const ua = navigator.userAgent;
        if (ua.includes('Chrome')) {
          setBrowserInfo('Chrome (~2GB or 80% of available disk)');
        } else if (ua.includes('Firefox')) {
          setBrowserInfo('Firefox (50MB+ requires permission)');
        } else if (ua.includes('Safari')) {
          setBrowserInfo('Safari (~1GB total)');
        } else {
          setBrowserInfo('Other browser (limits may vary)');
        }

        // Load chunks and calculate sizes
        const stmData = await stm_getMemoryStore();
        const ltmData = await ltm_getMemoryStore();
        
        // Calculate approximate sizes (JSON stringification)
        const stmSize = new Blob([JSON.stringify(stmData)]).size;
        const ltmSize = new Blob([JSON.stringify(ltmData)]).size;
        
        setStorageStats({
          stm: { size: stmSize, chunks: stmData.length },
          ltm: { size: ltmSize, chunks: ltmData.length }
        });

        // Sort by score (descending)
        stmData.sort((a, b) => (b.score || 1) - (a.score || 1));
        setStmChunks(stmData);
      } catch (error) {
        console.error("Error loading STM data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, []);
  
  const handleDecaySTM = async () => {
    try {
      const result = await stm_decayMemoryStore();
      setLastDecayed({...lastDecayed, stm: new Date()});
      
      // Reload data after decay
      const stmData = await stm_getMemoryStore();
      stmData.sort((a, b) => (b.score || 1) - (a.score || 1));
      setStmChunks(stmData);
      
      // Refresh counts in context
      refreshMemoryCounts();
      
      alert(`STM memories decayed. Updated ${result.updated} chunks, deleted ${result.deleted} chunks.`);
    } catch (error) {
      console.error("Error decaying STM memories:", error);
      alert("Error decaying STM memories. Check console.");
    }
  };
  
  const handleDecayLTM = async () => {
    try {
      const result = await ltm_decayMemoryStore();
      setLastDecayed({...lastDecayed, ltm: new Date()});
      
      // Refresh counts in context
      refreshMemoryCounts();
      
      alert(`LTM memories decayed. Updated ${result.updated} chunks, deleted ${result.deleted} chunks.`);
    } catch (error) {
      console.error("Error decaying LTM memories:", error);
      alert("Error decaying LTM memories. Check console.");
    }
  };
  
  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-2 text-gray-800">📊 Context & Scoreboard</h1>
      <p className="text-gray-500 mb-6">
        View the current state of the system's memory and context relevance metrics.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg border border-blue-200 shadow-sm p-5 flex items-center">
          <BarChart2 size={36} className="text-blue-500 mr-4" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-blue-800">STM Chunks</h3>
            <p className="text-3xl font-bold text-blue-600">{stmCount}</p>
            <p className="text-sm text-blue-600">
              {lastDecayed.stm 
                ? `Last decayed: ${lastDecayed.stm.toLocaleTimeString()}`
                : "Not decayed in this session"}
            </p>
            <p className="text-sm text-blue-600 mt-1">
              Size: {(storageStats.stm.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        </div>
        
        <div className="bg-indigo-50 rounded-lg border border-indigo-200 shadow-sm p-5 flex items-center">
          <BarChart2 size={36} className="text-indigo-500 mr-4" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-indigo-800">LTM Chunks</h3>
            <p className="text-3xl font-bold text-indigo-600">{ltmCount}</p>
            <p className="text-sm text-indigo-600">
              {lastDecayed.ltm 
                ? `Last decayed: ${lastDecayed.ltm.toLocaleTimeString()}`
                : "Not decayed in this session"}
            </p>
            <p className="text-sm text-indigo-600 mt-1">
              Size: {(storageStats.ltm.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        </div>
        
        <div className="bg-purple-50 rounded-lg border border-purple-200 shadow-sm p-5">
          <div className="flex items-center mb-3">
            <HardDrive size={24} className="text-purple-500 mr-2" />
            <h3 className="text-lg font-semibold text-purple-800">Storage Info</h3>
          </div>
          <div className="space-y-2 text-sm">
            <p className="text-purple-900">
              Total Size: {((storageStats.stm.size + storageStats.ltm.size) / 1024 / 1024).toFixed(2)} MB
            </p>
            <p className="text-purple-700">{browserInfo}</p>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-purple-500 rounded-full transition-all duration-500"
                style={{ 
                  width: `${Math.min(100, ((storageStats.stm.size + storageStats.ltm.size) / (50 * 1024 * 1024)) * 100)}%` 
                }}
              />
            </div>
            <p className="text-xs text-purple-600">Progress bar shows usage relative to 50MB threshold</p>
          </div>
        </div>
        
        <div className="bg-red-50 rounded-lg border border-red-200 shadow-sm p-5 flex items-center">
          <AlertCircle size={36} className="text-red-500 mr-4" />
          <div>
            <h3 className="text-lg font-semibold text-red-800">Memory Management</h3>
            <button 
              onClick={clearAllMemories}
              className="mt-2 bg-red-100 text-red-700 hover:bg-red-200 font-medium rounded-lg px-3 py-1 text-sm"
            >
              Clear All Memories
            </button>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 mb-6">
        <h2 className="text-xl font-bold mb-4 text-blue-700 flex items-center gap-2">
          <span>🔥 STM Scoreboard</span>
          <span className="text-sm font-normal text-gray-500">(IndexedDB STM)</span>
        </h2>
        
        {isLoading ? (
          <div className="text-gray-500">Loading STM data...</div>
        ) : stmChunks.length === 0 ? (
          <div className="text-gray-500">STM store is empty.</div>
        ) : (
          <div className="overflow-auto max-h-[400px]">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">#</th>
                  <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Preview</th>
                  <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Score</th>
                  <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Source</th>
                  <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Last Access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stmChunks.slice(0, 20).map((chunk, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="py-2 px-4 text-sm text-gray-700">{index + 1}</td>
                    <td className="py-2 px-4 text-sm text-gray-700">
                      {chunk.text.length > 80 ? chunk.text.substring(0, 80) + "..." : chunk.text}
                    </td>
                    <td className={`py-2 px-4 text-sm ${(chunk.score || 1) > 2 ? "font-semibold text-green-600" : "text-gray-500"}`}>
                      {(chunk.score || 1).toFixed(2)}
                    </td>
                    <td className="py-2 px-4 text-sm text-gray-700">{chunk.source}</td>
                    <td className="py-2 px-4 text-sm text-gray-700">
                      {new Date(chunk.lastAccessed || chunk.timestamp).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {stmChunks.length > 20 && (
              <div className="text-center py-2 text-sm text-gray-500">
                Showing top 20 of {stmChunks.length} STM chunks
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 mb-6">
        <h2 className="text-xl font-bold mb-4 text-indigo-700 flex items-center gap-2">
          <span>📚 LTM Status</span>
          <span className="text-sm font-normal text-gray-500">(IndexedDB LTM)</span>
        </h2>
        
        <p className="text-gray-700 mb-2">
          Total LTM Chunks: <span className="font-semibold">{ltmCount}</span>
        </p>
        
        <p className="text-gray-500 text-sm">
          The LTM store contains long-term, stable memories that decay at a slower rate than STM.
          These memories are generally accessed when there are no relevant recent memories in STM.
        </p>
      </div>
      
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
        <h2 className="text-xl font-bold mb-4 text-gray-800">🔄 Memory Management</h2>
        
        <div className="flex gap-4 mb-6">
          <button
            onClick={handleDecaySTM}
            className="bg-blue-100 text-blue-700 hover:bg-blue-200 font-medium rounded-lg px-4 py-2 transition flex items-center gap-2"
          >
            Decay STM Memories
          </button>
          
          <button
            onClick={handleDecayLTM}
            className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 font-medium rounded-lg px-4 py-2 transition flex items-center gap-2"
          >
            Decay LTM Memories
          </button>
        </div>
        
        <button 
          onClick={clearAllMemories}
          className="bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 font-semibold rounded-lg px-4 py-2 flex items-center gap-2"
        >
          <AlertCircle size={18} />
          Clear All Memories (STM & LTM)
        </button>
      </div>
    </div>
  );
};

export default ScoreboardPage;