import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Brain } from 'lucide-react';
import { useSettings } from '@/contexts/SettingsContext';
import { useMemory } from '@/contexts/MemoryContext';
import { fetchEmbedding, fetchMeta, buildMetaVectorFromAI, cosine, normalize, fetchChatCompletion } from '@/services/api';
import { stm_getMemoryStore, ltm_getMemoryStore, stm_boostMemoryChunk, ltm_boostMemoryChunk, stm_decayMemoryStore, ltm_decayMemoryStore, stm_addChunk } from '@/services/memory';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ContextChunk {
  id?: number;
  text: string;
  semanticSim?: number;
  metaSim?: number;
  finalScore?: number;
  score?: number;
}

const CHAT_HISTORY_KEY = "chatHistory";

export default function ChatPage() {
  const { settings, updateSettings, saveSettings } = useSettings();
  const { isInitialized } = useMemory();
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [queryInfo, setQueryInfo] = useState<string | null>(null);
  const [stmContext, setStmContext] = useState<{chunks: ContextChunk[], meta: any} | null>(null);
  const [ltmContext, setLtmContext] = useState<{chunks: ContextChunk[], meta: any} | null>(null);
  const [agentAStatus, setAgentAStatus] = useState<string | null>(null);
  
  const chatLogRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const reflectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle autonomy mode
  useEffect(() => {
    const scheduleNextReflection = () => {
      if (reflectionTimeoutRef.current) {
        clearTimeout(reflectionTimeoutRef.current);
      }

      if (settings.autonomyEnabled && settings.apiKeyA && settings.apiKeyB && !isLoading) {
        reflectionTimeoutRef.current = setTimeout(async () => {
          await performAutonomousReflection();
          scheduleNextReflection(); // Schedule next reflection after completion
        }, settings.autonomyInterval * 1000);
      }
    };

    scheduleNextReflection();

    return () => {
      if (reflectionTimeoutRef.current) {
        clearTimeout(reflectionTimeoutRef.current);
      }
    }
  }, [settings.autonomyEnabled, settings.autonomyInterval, settings.apiKeyA, settings.apiKeyB, isLoading]);

  const performAutonomousReflection = async () => {
    if (!settings.apiKeyA || !settings.apiKeyB) return;
    
    // Update UI to show reflection status
    setAgentAStatus('Performing autonomous reflection...');
    
    try {
      // Get random memories to reflect on
      const store = await stm_getMemoryStore();
      if (store.length === 0) {
        console.log("No memories to reflect on");
        return;
      }
      
      // Randomly select up to 3 memories
      const selectedMemories = store
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);
      
      const memoriesBlock = selectedMemories
        .map((mem, i) => `Memory ${i+1}: ${mem.text}`)
        .join('\n\n');
      
      const reflectionPrompt = `You are an introspective AI agent. Review these memories and generate a thoughtful reflection or insight that synthesizes them in a new way. Focus on finding patterns, drawing conclusions, or generating novel perspectives.

Memories to reflect on:
${memoriesBlock}

Generate a reflection that:
1. Synthesizes these memories in an interesting way
2. Draws novel connections or insights
3. Is written in a clear, natural style
4. Could be valuable for future context

Write your reflection:`;

      const reflection = await fetchChatCompletion(
        settings.apiKeyA,
        [{ role: "user", content: reflectionPrompt }],
        settings.modelA
      );
      
      // Save reflection to STM
      if (reflection && settings.apiKeyB) {
        const embedding = await fetchEmbedding(settings.apiKeyB, reflection, settings.modelBEmbed);
        const meta = await fetchMeta(settings.apiKeyB, reflection, settings.modelBMeta);
        const metaVector = buildMetaVectorFromAI(meta);
        
        await stm_addChunk({
          text: reflection,
          embedding,
          metaVector,
          timestamp: Date.now(),
          score: 2.0, // Give reflections a higher initial score
          agentId: "agent-autonomous-reflection",
          meta,
          source: "Autonomous Reflection"
        });
        
        console.log("Saved autonomous reflection to STM");
      }
      
      // Update UI after reflection
      setAgentAStatus('Reflection completed');
    } catch (error) {
      console.error("Failed to perform autonomous reflection:", error);
      setAgentAStatus('Reflection failed');
    } finally {
      setAgentAStatus(null);
    }
  };
  
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem(CHAT_HISTORY_KEY);
      if (savedHistory) {
        setChatHistory(JSON.parse(savedHistory));
      }
    } catch (error) {
      console.error("Failed to load chat history:", error);
    }
  }, []);
  
  useEffect(() => {
    try {
      localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(chatHistory));
    } catch (error) {
      console.error("Failed to save chat history:", error);
    }
  }, [chatHistory]);
  
  useEffect(() => {
    if (chatLogRef.current) {
      chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
    }
  }, [chatHistory]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isLoading || !isInitialized) return;
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const userMessage = message.trim();
    setMessage('');
    
    setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);
    
    setIsLoading(true);
    setQueryInfo(`Processing query: "${userMessage}"`);
    setStmContext(null);
    setLtmContext(null);
    setAgentAStatus('Waiting for context retrieval...');
    
    try {
      await stm_decayMemoryStore();
      await ltm_decayMemoryStore();
      
      if (settings.apiKeyB) {
        try {
          const embedding = await fetchEmbedding(settings.apiKeyB, userMessage, settings.modelBEmbed);
          const meta = await fetchMeta(settings.apiKeyB, userMessage, settings.modelBMeta);
          const metaVector = buildMetaVectorFromAI(meta);
          
          const store = await stm_getMemoryStore();
          const semanticWeight = 0.6;
          const metaWeight = 0.4;
          
          if (store.length > 0) {
            const results = store.map(mem => {
              const semanticSim = cosine(embedding, mem.embedding);
              const metaSim = cosine(metaVector, mem.metaVector);
              const simScore = semanticSim * semanticWeight + metaSim * metaWeight;
              const memScoreNormalized = normalize(mem.score || 1, 0, 5);
              const finalScore = simScore * 0.85 + memScoreNormalized * 0.15;
              return { ...mem, semanticSim, metaSim, simScore, finalScore };
            })
            .sort((a, b) => b.finalScore - a.finalScore)
            .slice(0, 3);
            
            results.forEach(chunk => {
              if (chunk.id) {
                stm_boostMemoryChunk(chunk.id, 1).catch(e => console.warn("Failed to boost STM chunk:", e));
              }
            });
            
            setStmContext({ chunks: results, meta });
          } else {
            setStmContext({ chunks: [], meta });
          }
        } catch (error) {
          console.error("Failed to retrieve STM context:", error);
          setStmContext({ chunks: [], meta: null });
        }
      }
      
      if (settings.apiKeyC) {
        try {
          const embedding = await fetchEmbedding(settings.apiKeyC, userMessage, settings.modelCEmbed);
          const meta = await fetchMeta(settings.apiKeyC, userMessage, settings.modelCMeta);
          const metaVector = buildMetaVectorFromAI(meta);
          
          const store = await ltm_getMemoryStore();
          const semanticWeight = 0.6;
          const metaWeight = 0.4;
          
          if (store.length > 0) {
            const results = store.map(mem => {
              const semanticSim = cosine(embedding, mem.embedding);
              const metaSim = cosine(metaVector, mem.metaVector);
              const simScore = semanticSim * semanticWeight + metaSim * metaWeight;
              const memScoreNormalized = normalize(mem.score || 1, 0, 5);
              const finalScore = simScore * 0.85 + memScoreNormalized * 0.15;
              return { ...mem, semanticSim, metaSim, simScore, finalScore };
            })
            .sort((a, b) => b.finalScore - a.finalScore)
            .slice(0, 3);
            
            results.forEach(chunk => {
              if (chunk.id) {
                ltm_boostMemoryChunk(chunk.id, 1).catch(e => console.warn("Failed to boost LTM chunk:", e));
              }
            });
            
            setLtmContext({ chunks: results, meta });
          } else {
            setLtmContext({ chunks: [], meta });
          }
        } catch (error) {
          console.error("Failed to retrieve LTM context:", error);
          setLtmContext({ chunks: [], meta: null });
        }
      }
      
      if (settings.apiKeyA) {
        setAgentAStatus('Generating response...');
        
        const stmContextChunks = stmContext?.chunks || [];
        const ltmContextChunks = ltmContext?.chunks || [];
        
        const stmContextBlock = stmContextChunks.length
          ? "--- Short-Term Memory (STM - Recent/Decaying) ---\n" + stmContextChunks.map((mem, i) => 
              `${i+1}. [Score: ${mem.finalScore?.toFixed(3)}] ${mem.text}`).join('\n')
          : "--- Short-Term Memory (STM - Recent/Decaying) ---\nNone found.";

        const ltmContextBlock = ltmContextChunks.length
          ? "--- Long-Term Memory (LTM - Stable/Uploaded) ---\n" + ltmContextChunks.map((mem, i) => 
              `${i+1}. [Score: ${mem.finalScore?.toFixed(3)}] ${mem.text}`).join('\n')
          : "--- Long-Term Memory (LTM - Stable/Uploaded) ---\nNone found.";
        
        let conversationContext = "";
        if (chatHistory.length > 0) {
          conversationContext = "--- Recent Conversation History ---\n";
          const recentMessages = chatHistory.slice(-20);
          for (const msg of recentMessages) {
            const role = msg.role === "user" ? "User" : "You (Agent A)";
            conversationContext += `${role}: ${msg.content}\n\n`;
          }
        }
        
        const systemPrefix = settings.globalPrompt ? settings.globalPrompt + "\n\n---\n\n" : "";
        
        const agentPrompt = `${systemPrefix}You are Agent A (Sylvia), a highly context-aware AI responder. Your personality is thoughtful and insightful.
User query: "${userMessage}"
${conversationContext ? conversationContext + "\n" : ""}Relevant context retrieved by other agents:
${stmContextBlock}
${ltmContextBlock}
Based only on the provided memories (STM & LTM), conversation history, and the user query, write a thoughtful, contextually intelligent response.
\t•\tPrioritize and synthesize information from both memory types if relevant.\t•\tIf STM and LTM provide similar info, acknowledge the consistency. If they conflict, note the discrepancy or prioritize based on perceived reliability or recency (STM score reflects recency/usage).\t•\tWeave in memories naturally as if they inform your perspective or recall related experiences.\t•\tAvoid mentioning "Agent B", "Agent C", "STM", "LTM", or the retrieval process unless specifically asked about your memory.\t•\tBe concise but insightful. If no memories are relevant, simply answer the query directly.`.trim();
        
        abortControllerRef.current = new AbortController();
        
        const response = await fetchChatCompletion(
          settings.apiKeyA,
          [{ role: "user", content: agentPrompt }],
          settings.modelA,
          abortControllerRef.current.signal
        );
        
        setAgentAStatus('Response completed');
        setChatHistory(prev => [...prev, { 
          role: 'assistant', 
          content: response 
        }]);
      }
    } catch (error: any) {
      console.error("Error in chat process:", error);
      setAgentAStatus(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="h-[calc(100vh-12rem)] flex">
      {/* Main chat area */}
      <div className="flex-grow flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200/75 p-6 mr-0">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Memory Chat</h2>
        </div>
        
        <div 
          ref={chatLogRef}
          className="flex-grow overflow-y-auto mb-4 pr-2 space-y-4 scroll-smooth bg-pastel-yellow/30 rounded-lg p-4"
        >
          {chatHistory.map((message, index) => (
            <div key={index} className="mb-4">
              <div className={`font-semibold ${message.role === 'user' ? 'text-purple-600' : 'text-gray-800'}`}>
                {message.role === 'user' ? 'You:' : 'Agent A:'}
              </div>
              <div className="prose-sm max-w-none mt-2">
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>
            </div>
          ))}
          
        </div>
        
        <form onSubmit={handleSubmit} className="mt-auto">
          <div className="flex gap-3">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message..."
              disabled={isLoading || !isInitialized}
              className="flex-grow min-h-[80px] p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100 resize-none transition-colors"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            <button
              type="submit"
              disabled={isLoading || !message.trim() || !isInitialized}
              className="h-fit self-end py-3 px-6 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
            >
              Send
            </button>
          </div>
        </form>
      </div>
      
    </div>
  );
}