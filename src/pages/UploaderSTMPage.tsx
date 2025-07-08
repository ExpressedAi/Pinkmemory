import React, { useState, useRef } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { useMemory } from '@/contexts/MemoryContext';
import { Upload, FileType, AlertCircle } from 'lucide-react';
import { chunkText, stm_addChunk } from '@/services/memory';
import { fetchEmbedding, fetchMeta, buildMetaVectorFromAI } from '@/services/api';

interface ProcessedChunk {
  text: string;
  source: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  error?: string;
}

const UploaderSTMPage: React.FC = () => {
  const { settings } = useSettings();
  const { clearAllMemories, refreshMemoryCounts, stmCount } = useMemory();
  const [pasteInput, setPasteInput] = useState('');
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);
  const [processedChunks, setProcessedChunks] = useState<ProcessedChunk[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  const handleFiles = async (files: FileList) => {
    if (!files || files.length === 0) return;
    
    setProcessedChunks([]);
    setUploadStatus(`Reading ${files.length} file(s)...`);
    
    let allChunks: ProcessedChunk[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const text = await file.text();
        const base = file.name || "unknown_file";
        let chunksFromFile: string[] = [];
        
        if (base.endsWith(".json")) {
          try {
            let json = JSON.parse(text);
            let rawChunks: string[] = [];
            
            if (Array.isArray(json)) {
              rawChunks = json.map(e => typeof e === "string" ? e : JSON.stringify(e));
            } else if (typeof json === 'object' && json !== null) {
              if (Array.isArray(json.entries)) {
                rawChunks = json.entries.map(e => typeof e === "string" ? e : JSON.stringify(e));
              } else if (Array.isArray(json.data)) {
                rawChunks = json.data.map(e => typeof e === "string" ? e : JSON.stringify(e));
              } else {
                rawChunks = Object.values(json).map(e => typeof e === "string" ? e : JSON.stringify(e));
              }
            } else {
              rawChunks = [text];
            }
            
            chunksFromFile = rawChunks.flatMap(raw => chunkText(raw));
          } catch (jsonError) {
            console.warn(`File ${base} JSON parse failed, treating as text.`, jsonError);
            chunksFromFile = chunkText(text);
          }
        } else {
          chunksFromFile = chunkText(text);
        }
        
        allChunks.push(...chunksFromFile.map(c => ({ 
          text: c, 
          source: base,
          status: 'pending'
        })));
        
        setUploadStatus(`Read ${file.name}, gathered ${allChunks.length} potential chunks...`);
      } catch (readError: any) {
        console.error(`Error reading file ${file.name}:`, readError);
        setUploadStatus(`Error reading ${file.name}: ${readError.message}`);
      }
    }
    
    setProcessedChunks(allChunks);
    await processChunks(allChunks);
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };
  
  const handlePasteUpload = async () => {
    if (!pasteInput.trim()) {
      setUploadStatus("Please enter text to upload.");
      return;
    }
    
    const chunks = chunkText(pasteInput.trim());
    if (chunks.length) {
      const formattedChunks = chunks.map(c => ({
        text: c,
        source: "Pasted Text",
        status: 'pending' as const
      }));
      setProcessedChunks(formattedChunks);
      await processChunks(formattedChunks);
      setPasteInput("");
    } else {
      setUploadStatus("Text too short to process.");
    }
  };
  
  const processChunks = async (chunksToProcess: ProcessedChunk[]) => {
    if (!chunksToProcess.length) {
      setProcessingStatus("No processable chunks found.");
      return;
    }
    
    if (!settings.apiKeyB) {
      setProcessingStatus("Error: Agent B API Key is not configured in Settings. Cannot process upload.");
      return;
    }
    
    setProcessingStatus(`Processing ${chunksToProcess.length} chunks for STM...`);
    
    let ok = 0, fail = 0;
    // Make a new copy of chunks for updating
    const updatingChunks = [...chunksToProcess];
    
    // Process sequentially to avoid overwhelming API / IndexedDB
    for (let j = 0; j < chunksToProcess.length; ++j) {
      setProcessingStatus(`Processing STM chunk: ${j+1}/${chunksToProcess.length} | ✓ ${ok} | ✗ ${fail}`);
      
      // Update status to processing
      updatingChunks[j] = { ...updatingChunks[j], status: 'processing' };
      setProcessedChunks([...updatingChunks]);
      
      try {
        // Use Agent B's key and embedding model
        const embedding = await fetchEmbedding(settings.apiKeyB, chunksToProcess[j].text, settings.modelBEmbed);
        
        // Use Agent B's key and meta model
        const meta = await fetchMeta(settings.apiKeyB, chunksToProcess[j].text, settings.modelBMeta);
        const metaVector = buildMetaVectorFromAI(meta);
        
        // Save to IndexedDB (STM)
        await stm_addChunk({
          text: chunksToProcess[j].text,
          embedding,
          metaVector,
          timestamp: Date.now(),
          agentId: "agent-b-uploader",
          meta,
          source: chunksToProcess[j].source,
        });
        
        // Update status to success
        updatingChunks[j] = { ...updatingChunks[j], status: 'success' };
        setProcessedChunks([...updatingChunks]);
        ok++;
      } catch (error: any) {
        console.error(`Error processing STM chunk ${j+1} from ${chunksToProcess[j].source}:`, error);
        
        // Update status to error
        updatingChunks[j] = { 
          ...updatingChunks[j], 
          status: 'error',
          error: error.message 
        };
        setProcessedChunks([...updatingChunks]);
        fail++;
      }
    }
    
    setProcessingStatus(`Processing Complete. Success: ${ok} | Failed: ${fail}`);
    refreshMemoryCounts();
  };
  
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-2 text-gray-800">📝 MetaVector Memory Uploader (to STM)</h1>
      <p className="text-gray-500 mb-4">
        Upload text or files here. They will be chunked, embedded, meta-scored using Agent B's settings, 
        and saved to the Short-Term Memory store (IndexedDB).
      </p>
      
      <button 
        onClick={clearAllMemories}
        className="mb-6 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 font-semibold rounded-lg px-4 py-2 flex items-center gap-2"
      >
        <AlertCircle size={18} />
        Clear All Memories (STM & LTM)
      </button>
      
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 mb-6">
        <div className="mb-1">
          <span className="text-blue-600 font-medium">Agent B (STM Uploader):</span> 
          <span className="text-sm text-gray-500 ml-1">{settings.modelBEmbed} / {settings.modelBMeta}</span>
        </div>
        <div className="text-sm text-gray-500">
          API Key Used: {settings.apiKeyB ? settings.apiKeyB.slice(0, 6) + "..." + settings.apiKeyB.slice(-4) : "Not Set"} | 
          Store: IndexedDB (STM) | Chunks: {stmCount}
        </div>
      </div>
      
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 mb-6">
        <div 
          className={`border-2 ${isDragging ? 'border-blue-400 bg-blue-50' : 'border-dashed border-blue-300'} rounded-lg p-8 text-center mb-4 cursor-pointer transition-colors`}
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={handleFileSelect}
        >
          <div className="flex flex-col items-center justify-center">
            <Upload size={36} className="text-blue-500 mb-2" />
            <p className="text-lg font-semibold text-gray-800 mb-2">Drop .txt/.md/.json files here</p>
            <p className="text-gray-500 mb-3">or</p>
            <button
              type="button"
              className="bg-blue-100 text-blue-700 hover:bg-blue-200 font-medium rounded-lg px-4 py-2 transition"
            >
              Choose File(s)
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".txt,.md,.json"
              className="hidden"
              onChange={e => e.target.files && handleFiles(e.target.files)}
            />
            <p className="text-gray-500 mt-4 mb-2">OR paste raw text below:</p>
          </div>
        </div>
        
        <textarea
          value={pasteInput}
          onChange={e => setPasteInput(e.target.value)}
          placeholder="Paste or type text here..."
          className="w-full p-3 border border-gray-300 rounded-lg min-h-[120px] focus:ring-2 focus:ring-blue-500"
        />
        
        <button
          onClick={handlePasteUpload}
          disabled={!pasteInput.trim()}
          className="mt-3 bg-blue-600 text-white font-semibold rounded-lg px-4 py-2 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
        >
          Upload Pasted Text to STM
        </button>
      </div>
      
      {uploadStatus && (
        <div className="text-blue-800 mb-4">
          {uploadStatus}
        </div>
      )}
      
      {processingStatus && (
        <div className="text-blue-800 font-medium mb-4">
          {processingStatus}
        </div>
      )}
      
      {processedChunks.length > 0 && (
        <div className="mb-8 overflow-auto max-h-[400px] bg-white rounded-lg border border-gray-200 shadow-sm">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">#</th>
                <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Source</th>
                <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Preview</th>
                <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {processedChunks.map((chunk, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="py-2 px-4 text-sm text-gray-700">{index + 1}</td>
                  <td className="py-2 px-4 text-sm text-gray-700">{chunk.source}</td>
                  <td className="py-2 px-4 text-sm text-gray-700">
                    {chunk.text.length > 80 ? chunk.text.substring(0, 80) + "..." : chunk.text}
                  </td>
                  <td className="py-2 px-4 text-sm">
                    {chunk.status === 'pending' && <span className="text-gray-500">Pending...</span>}
                    {chunk.status === 'processing' && <span className="text-blue-600">Processing...</span>}
                    {chunk.status === 'success' && <span className="text-green-600">✓ Saved to STM</span>}
                    {chunk.status === 'error' && (
                      <span className="text-red-600 flex items-center gap-1" title={chunk.error}>
                        <AlertCircle size={14} /> Error
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default UploaderSTMPage;