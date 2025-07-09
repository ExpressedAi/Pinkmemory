import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useToast } from '@/hooks/useToast';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatHistoryContextType {
  chatHistory: ChatMessage[];
  addChatMessage: (message: ChatMessage) => void;
  clearChatHistory: () => void;
  chatHistorySize: number;
}

interface ChatHistoryProviderProps {
  children: ReactNode;
}

const CHAT_HISTORY_KEY = "chatHistory";

export const ChatHistoryContext = createContext<ChatHistoryContextType>({
  chatHistory: [],
  addChatMessage: () => {},
  clearChatHistory: () => {},
  chatHistorySize: 0
});

export const useChatHistory = () => useContext(ChatHistoryContext);

export const ChatHistoryProvider: React.FC<ChatHistoryProviderProps> = ({ children }) => {
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatHistorySize, setChatHistorySize] = useState(0);
  const { toast } = useToast();

  // Load chat history on mount
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem(CHAT_HISTORY_KEY);
      if (savedHistory) {
        const parsedHistory = JSON.parse(savedHistory);
        setChatHistory(parsedHistory);
      }
    } catch (error) {
      console.error("Failed to load chat history:", error);
      toast({
        title: "Error loading chat history",
        description: "Previous conversations could not be restored",
        variant: "error"
      });
    }
  }, []);

  // Save chat history and update size whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(chatHistory));
      updateChatHistorySize();
    } catch (error) {
      console.error("Failed to save chat history:", error);
      toast({
        title: "Error saving chat history",
        description: "Your conversation may not be preserved",
        variant: "error"
      });
    }
  }, [chatHistory]);

  const updateChatHistorySize = () => {
    try {
      if (chatHistory.length > 0) {
        // Very rough token estimation (3.5 tokens per word)
        const totalText = chatHistory.reduce((acc, msg) => acc + msg.content, "");
        const wordCount = totalText.split(/\s+/).length;
        const tokenEstimate = Math.ceil(wordCount * 3.5);
        setChatHistorySize(tokenEstimate);
      } else {
        setChatHistorySize(0);
      }
    } catch (e) {
      console.error("Error estimating chat history size", e);
      setChatHistorySize(0);
    }
  };

  const addChatMessage = (message: ChatMessage) => {
    setChatHistory(prev => [...prev, message]);
  };

  const clearChatHistory = () => {
    setChatHistory([]);
    localStorage.removeItem(CHAT_HISTORY_KEY);
    toast({
      title: "Chat history cleared",
      variant: "success"
    });
  };

  return (
    <ChatHistoryContext.Provider 
      value={{ 
        chatHistory, 
        addChatMessage, 
        clearChatHistory,
        chatHistorySize
      }}
    >
      {children}
    </ChatHistoryContext.Provider>
  );
};