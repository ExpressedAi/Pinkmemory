// Model definitions
export const AGENT_A_MODEL = "gpt-4.1-2025-04-14";
export const AGENT_B_EMBED_MODEL = "text-embedding-3-small";
export const AGENT_B_META_MODEL = "gpt-4.1-2025-04-14";
export const AGENT_C_EMBED_MODEL = "text-embedding-3-large";
export const AGENT_C_META_MODEL = "gpt-4.1-2025-04-14";

// Helper function to sanitize API key
function sanitizeApiKey(apiKey: string): string {
  // First decode in case it's already encoded to avoid double encoding
  const decodedKey = decodeURIComponent(apiKey);
  // Then encode to ensure proper format
  return encodeURIComponent(decodedKey);
}

// Helper functions for vector operations
export function normalize(val: number, min: number, max: number): number {
  if (max === min) return 0;
  return Math.max(0, Math.min(1, (val - min) / (max - min)));
}

export function cosine(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; ++i) { 
    dot += (a[i] || 0) * (b[i] || 0); 
    normA += (a[i] || 0) * (a[i] || 0); 
    normB += (b[i] || 0) * (b[i] || 0); 
  }
  if (normA === 0 || normB === 0) return 0;
  const similarity = dot / (Math.sqrt(normA) * Math.sqrt(normB));
  return Math.max(-1, Math.min(1, similarity));
}

export function buildMetaVectorFromAI(meta: any): number[] {
  const bd = meta.brainDominance || { leftBrain: 0, rightBrain: 0 };
  const ps = meta.processingStyle || { reflexive: 0, reasoning: 0 };
  const ea = meta.emotionalAnalysis || { joy: 0, intensity: 0, engagement: 0, complexity: 0, sentiment: 0 };
  const cm = meta.conversationMetrics || { depth: 0, coherence: 0, engagement: 0, topicStability: 0 };
  const cs = meta.cognitiveStyle || { strength: 0 };
  
  return [ 
    bd.leftBrain, 
    bd.rightBrain, 
    ps.reflexive, 
    ps.reasoning, 
    ea.joy, 
    ea.intensity, 
    ea.engagement, 
    ea.complexity, 
    normalize(ea.sentiment, -1, 1), 
    normalize(cm.depth, 0, 100), 
    normalize(cm.coherence, 0, 100), 
    normalize(cm.engagement, 0, 100), 
    normalize(cm.topicStability, 0, 100), 
    normalize(cs.strength, 0, 100) 
  ];
}

// Fetch embedding vector from OpenAI
export async function fetchEmbedding(apiKey: string, text: string, model = AGENT_B_EMBED_MODEL): Promise<number[]> {
  if (!apiKey) throw new Error(`API Key is missing for embedding with model ${model}.`);
  if (!text || text.trim().length === 0) throw new Error("Cannot fetch embedding for empty text.");
  
  console.log(`Fetching embedding with model: ${model}`);
  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json", 
      "Authorization": `Bearer ${sanitizeApiKey(apiKey)}`
    },
    body: JSON.stringify({ input: text, model: model })
  });
  
  if (!resp.ok) {
    const errorText = await resp.text();
    console.error("Embedding API Error:", errorText);
    throw new Error(`Embedding failed (${model}): ${resp.status} ${errorText}`);
  }
  
  const data = await resp.json();
  if (!data.data || data.data.length === 0 || !data.data[0].embedding) {
    console.error("Invalid embedding response structure:", data);
    throw new Error(`Invalid embedding response structure received from API (${model}).`);
  }
  
  return data.data[0].embedding;
}

// Fetch meta scoring from OpenAI
export async function fetchMeta(apiKey: string, text: string, model = AGENT_B_META_MODEL): Promise<any> {
  if (!apiKey) throw new Error(`API Key is missing for meta-scoring with model ${model}.`);
  if (!text || text.trim().length === 0) throw new Error("Cannot fetch meta-score for empty text.");
  
  console.log(`Fetching meta-score with model: ${model}`);
  const prompt = `
You are a cognitive state analyzer. Given a user message, return a JSON object with the following fields, each scored as described:
\t• brainDominance: { leftBrain: 0.0–1.0, rightBrain: 0.0–1.0 }
\t• processingStyle: { reflexive: 0.0–1.0, reasoning: 0.0–1.0 }
\t• emotionalAnalysis: { joy: 0.0–1.0, intensity: 0.0–1.0, engagement: 0.0–1.0, complexity: 0.0–1.0, sentiment: -1.0–1.0 }
\t• conversationMetrics: { depth: 0–100, coherence: 0–100, engagement: 0–100, topicStability: 0–100 }
\t• cognitiveStyle: { strength: 0–100 }
Message:
"""${text}"""
Return JSON only, without any markdown formatting or explanations.`.trim();

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 
      "Content-Type": "application/json", 
      "Authorization": `Bearer ${sanitizeApiKey(apiKey)}`
    },
    body: JSON.stringify({
      model: model,
      messages: [ { role: "user", content: prompt } ],
      temperature: 0.1,
      response_format: { type: "json_object" }
    })
  });

  if (!resp.ok) {
    const errorText = await resp.text();
    console.error("Meta Scoring API Error:", errorText);
    throw new Error(`Meta-scoring failed (${model}): ${resp.status} ${errorText}`);
  }
  
  const data = await resp.json();
  let content = data.choices[0].message.content;
  
  try {
    // Attempt to parse directly
    return JSON.parse(content);
  } catch (e) {
    console.warn("Direct JSON parse failed for meta-score, attempting cleanup:", content);
    content = content.replace(/^\s*```json\s*|```\s*$/g, "").trim();
    try {
      return JSON.parse(content);
    } catch (e2) {
      console.error("Failed to parse LLM meta-score output:", content);
      throw new Error("Failed to parse LLM meta-score output after cleanup.");
    }
  }
}

// Stream response from OpenAI
export async function streamResponse(
  apiKey: string, 
  messages: { role: string, content: string }[], 
  model = AGENT_A_MODEL,
  onStart: () => void,
  onChunk: (chunk: string) => void,
  onComplete: () => void,
  onError: (error: Error) => void,
  abortSignal?: AbortSignal
): Promise<void> {
  try {
    onStart();
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${sanitizeApiKey(apiKey)}`
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.7,
        stream: true
      }),
      signal: abortSignal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Streaming failed: ${response.status} ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("Response body is not readable");
    
    const decoder = new TextDecoder("utf-8");
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      // Process this chunk of data
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim() !== '');
      
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        
        const data = line.slice(5).trim();
        if (data === '[DONE]') break;
        
        try {
          const json = JSON.parse(data);
          const content = json.choices[0]?.delta?.content || '';
          
          if (content) {
            onChunk(content);
          }
        } catch (e) {
          console.warn('Could not parse stream chunk', e);
        }
      }
    }
    
    onComplete();
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log("Stream was aborted");
    } else {
      onError(error);
    }
  }
}