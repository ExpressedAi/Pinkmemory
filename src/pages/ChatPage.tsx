import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Brain } from 'lucide-react';
import { useSettings } from '@/contexts/SettingsContext';
import { useMemory } from '@/contexts/MemoryContext';
import { useChatHistory } from '@/contexts/ChatHistoryContext';
import { fetchEmbedding, fetchMeta, buildMetaVectorFromAI, cosine, normalize, streamResponse } from '@/services/api';
import { stm_getMemoryStore, ltm_getMemoryStore, stm_boostMemoryChunk, ltm_boostMemoryChunk, stm_decayMemoryStore, ltm_decayMemoryStore, stm_addChunk, ltm_addChunk } from '@/services/memory';

interface ContextChunk {
  id?: number;
  text: string;
  semanticSim?: number;
  metaSim?: number;
  finalScore?: number;
  score?: number;
}

export default function ChatPage() {
  const { settings, updateSettings, saveSettings } = useSettings();
  const { isInitialized } = useMemory();
  const { chatHistory, addChatMessage } = useChatHistory();
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [queryInfo, setQueryInfo] = useState<string | null>(null);
  const [stmContext, setStmContext] = useState<{chunks: ContextChunk[], meta: any} | null>(null);
  const [ltmContext, setLtmContext] = useState<{chunks: ContextChunk[], meta: any} | null>(null);
  const [agentAStatus, setAgentAStatus] = useState<string | null>(null);
  const [agentBStatus, setAgentBStatus] = useState<string | null>(null);
  const [agentCStatus, setAgentCStatus] = useState<string | null>(null);
  
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

      let reflection = '';
      await streamResponse(
        settings.apiKeyA,
        [{ role: "user", content: reflectionPrompt }],
        settings.modelA,
        () => {
          // onStart - not needed for autonomous reflection
        },
        (chunk) => {
          reflection += chunk;
        },
        async () => {
          // onComplete - save reflection to STM
          if (reflection && settings.apiKeyB) {
            const embedding = await fetchEmbedding(settings.apiKeyB, reflection, settings.modelBEmbed);
            const meta = await fetchMeta(settings.apiKeyB, reflection, settings.modelBMeta);
            const metaVector = buildMetaVectorFromAI(meta);
            
            // Save to STM
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
            
            // Also save to LTM for long-term preservation
            if (settings.apiKeyC) {
              try {
                // Use Agent C's models for LTM storage
                const ltmEmbedding = await fetchEmbedding(settings.apiKeyC, reflection, settings.modelCEmbed);
                const ltmMeta = await fetchMeta(settings.apiKeyC, reflection, settings.modelCMeta);
                const ltmMetaVector = buildMetaVectorFromAI(ltmMeta);
                
                await ltm_addChunk({
                  text: reflection,
                  embedding: ltmEmbedding,
                  metaVector: ltmMetaVector,
                  timestamp: Date.now(),
                  score: 2.5, // Give LTM reflections an even higher score for persistence
                  agentId: "agent-autonomous-reflection-ltm",
                  meta: ltmMeta,
                  source: "Autonomous Reflection (LTM)"
                });
                
                console.log("Saved autonomous reflection to both STM and LTM");
              } catch (ltmError) {
                console.warn("Failed to save reflection to LTM, but STM save succeeded:", ltmError);
              }
            }
            
            // Add reflection to chat history
            addChatMessage({
              role: 'reflection',
              content: reflection,
              timestamp: Date.now()
            });
          }
        },
        (error) => {
          console.error("Error during autonomous reflection:", error);
        }
      );
      
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
    if (chatLogRef.current) {
      chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
    }
  }, [chatHistory, streamingContent]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isLoading || !isInitialized) return;
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const userMessage = message.trim();
    setMessage('');
    
    addChatMessage({ role: 'user', content: userMessage });
    
    setIsLoading(true);
    setStreamingContent('');
    setQueryInfo(`Processing query: "${userMessage}"`);
    setStmContext(null);
    setLtmContext(null);
    setAgentAStatus('Waiting for context retrieval...');
    setAgentBStatus(null);
    setAgentCStatus(null);
    
    try {
      await stm_decayMemoryStore();
      await ltm_decayMemoryStore();
      
      let stmContextData: {chunks: ContextChunk[], meta: any} | null = null;
      let ltmContextData: {chunks: ContextChunk[], meta: any} | null = null;
      
      // Agent B: Retrieve STM context first
      if (settings.apiKeyB) {
        try {
          setAgentBStatus('🧠 Agent B: Analyzing query semantics...');
          setQueryInfo('Agent B processing query for STM retrieval...');
          
          const embedding = await fetchEmbedding(settings.apiKeyB, userMessage, settings.modelBEmbed);
          setAgentBStatus('🧠 Agent B: Generating meta-cognitive profile...');
          
          const meta = await fetchMeta(settings.apiKeyB, userMessage, settings.modelBMeta);
          const metaVector = buildMetaVectorFromAI(meta);
          
          setAgentBStatus('🧠 Agent B: Searching STM for relevant memories...');
          const store = await stm_getMemoryStore();
          
          if (store.length > 0) {
            const semanticWeight = 0.6;
            const metaWeight = 0.4;
            
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
            
            stmContextData = { chunks: results, meta };
            setAgentBStatus(`✅ Agent B: Found ${results.length} relevant STM memories`);
          } else {
            stmContextData = { chunks: [], meta };
            setAgentBStatus('⚠️ Agent B: No STM memories found');
          }
        } catch (error) {
          console.error("Failed to retrieve STM context:", error);
          stmContextData = { chunks: [], meta: null };
          setAgentBStatus('❌ Agent B: STM retrieval failed');
        }
      }
      
      // Agent C: Retrieve LTM context second
      if (settings.apiKeyC) {
        try {
          setAgentCStatus('🧠 Agent C: Analyzing query semantics...');
          setQueryInfo('Agent C processing query for LTM retrieval...');
          
          const embedding = await fetchEmbedding(settings.apiKeyC, userMessage, settings.modelCEmbed);
          setAgentCStatus('🧠 Agent C: Generating meta-cognitive profile...');
          
          const meta = await fetchMeta(settings.apiKeyC, userMessage, settings.modelCMeta);
          const metaVector = buildMetaVectorFromAI(meta);
          
          setAgentCStatus('🧠 Agent C: Searching LTM for relevant memories...');
          const store = await ltm_getMemoryStore();
          
          if (store.length > 0) {
            const semanticWeight = 0.6;
            const metaWeight = 0.4;
            
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
            
            ltmContextData = { chunks: results, meta };
            setAgentCStatus(`✅ Agent C: Found ${results.length} relevant LTM memories`);
          } else {
            ltmContextData = { chunks: [], meta };
            setAgentCStatus('⚠️ Agent C: No LTM memories found');
          }
        } catch (error) {
          console.error("Failed to retrieve LTM context:", error);
          ltmContextData = { chunks: [], meta: null };
          setAgentCStatus('❌ Agent C: LTM retrieval failed');
        }
      }
      
      // Update UI state with retrieved context
      setStmContext(stmContextData);
      setLtmContext(ltmContextData);
      
      // Agent A: Generate response using context from B and C
      if (settings.apiKeyA) {
        setQueryInfo('Agent A synthesizing response from all contexts...');
        setAgentAStatus('🤔 Agent A: Synthesizing STM and LTM context...');
        
        const stmContextChunks = stmContextData?.chunks || [];
        const ltmContextChunks = ltmContextData?.chunks || [];
        
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
        
        console.log("Agent A Context Summary:", {
          stmChunks: stmContextChunks.length,
          ltmChunks: ltmContextChunks.length,
          hasConversationHistory: chatHistory.length > 0
        });
        
        let accumulatedContent = '';
        
        const agentPrompt = `${systemPrefix}You are Agent A (Sylvia), a highly context-aware AI responder. Your personality is thoughtful and insightful.
User query: "${userMessage}"
${conversationContext ? conversationContext + "\n" : ""}Relevant context retrieved by other agents:
${stmContextBlock}
${ltmContextBlock}
Based only on the provided memories (STM & LTM), conversation history, and the user query, write a thoughtful, contextually intelligent response.
\t•\tPrioritize and synthesize information from both memory types if relevant.\t•\tIf STM and LTM provide similar info, acknowledge the consistency. If they conflict, note the discrepancy or prioritize based on perceived reliability or recency (STM score reflects recency/usage).\t•\tWeave in memories naturally as if they inform your perspective or recall related experiences.\t•\tAvoid mentioning "Agent B", "Agent C", "STM", "LTM", or the retrieval process unless specifically asked about your memory.\t•\tBe concise but insightful. If no memories are relevant, simply answer the query directly.`.trim();
        
        abortControllerRef.current = new AbortController();
        
        await streamResponse(
          settings.apiKeyA,
          [{ role: "user", content: agentPrompt }],
          settings.modelA,
          () => {
            // onStart
            setIsStreaming(true);
            setStreamingContent('');
            accumulatedContent = '';
            setAgentAStatus('💭 Agent A: Generating response...');
          },
          (chunk) => {
            // onChunk
            accumulatedContent += chunk;
            setStreamingContent(prev => prev + chunk);
          },
          () => {
            // onComplete
            setAgentAStatus('✅ Agent A: Response completed');
            
            // Add accumulated content to chat history
            addChatMessage({ 
              role: 'assistant', 
              content: accumulatedContent 
            });
            
            // Clear streaming state after a brief delay to ensure smooth transition
            setTimeout(() => {
              setIsStreaming(false);
              setStreamingContent('');
            }, 50);
            
            setQueryInfo(null);
          },
          (error) => {
            // onError
            console.error("Error generating response:", error);
            setAgentAStatus(`❌ Agent A: Error - ${error.message}`);
            setIsStreaming(false);
            setStreamingContent('');
          },
          abortControllerRef.current.signal
        );
      }
    } catch (error: any) {
      console.error("Error in chat process:", error);
      setAgentAStatus(`❌ Error: ${error.message}`);
      setQueryInfo(`Error: ${error.message}`);
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
              <div className={`font-semibold ${
                message.role === 'user' 
                  ? 'text-pink-600' 
                  : message.role === 'reflection'
                  ? 'text-purple-600'
                  : 'text-blue-600'
              }`}>
                {message.role === 'user' 
                  ? 'You:' 
                  : message.role === 'reflection'
                  ? '🧠 Autonomous Reflection:'
                  : 'Agent A:'}
              </div>
              <div className={`prose-sm max-w-none mt-2 ${
                message.role === 'user'
                  ? 'bg-pastel-pink/30 border-l-4 border-pastel-pink pl-4 py-2 rounded-r-lg'
                  : message.role === 'assistant'
                  ? 'bg-pastel-blue/30 border-l-4 border-pastel-blue pl-4 py-2 rounded-r-lg'
                  : message.role === 'reflection' 
                  ? 'bg-pastel-purple/30 border-l-4 border-pastel-purple pl-4 py-2 rounded-r-lg' 
                  : ''
              }`}>
                <ReactMarkdown>{message.content}</ReactMarkdown>
                {message.role === 'reflection' && message.timestamp && (
                  <div className="text-xs text-purple-500 mt-2 italic">
                    Generated at {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {isStreaming && streamingContent && (
            <div className="mb-4">
              <div className="font-semibold text-blue-600">Agent A:</div>
              <div className="prose-sm max-w-none mt-2 bg-pastel-blue/30 border-l-4 border-pastel-blue pl-4 py-2 rounded-r-lg">
                <ReactMarkdown>{streamingContent}</ReactMarkdown>
                <span className="inline-block w-2 h-5 border-r-2 border-blue-600 animate-pulse ml-1"></span>
              </div>
            </div>
          )}
        </div>
        
        {/* Status indicators */}
        {(queryInfo || agentBStatus || agentCStatus || agentAStatus) && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            {queryInfo && (
              <div className="text-sm text-blue-800 font-medium mb-1">{queryInfo}</div>
            )}
            {agentBStatus && (
              <div className="text-sm text-blue-700 mb-1">{agentBStatus}</div>
            )}
            {agentCStatus && (
              <div className="text-sm text-indigo-700 mb-1">{agentCStatus}</div>
            )}
            {agentAStatus && (
              <div className="text-sm text-purple-700">{agentAStatus}</div>
            )}
          </div>
        )}
        
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