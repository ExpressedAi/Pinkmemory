import React, { useState, useEffect } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { useChatHistory } from '@/contexts/ChatHistoryContext';
import { Save, Trash2 } from 'lucide-react';

const SettingsPage: React.FC = () => {
  const { settings, updateSettings, saveSettings } = useSettings();
  const { clearChatHistory, chatHistorySize } = useChatHistory();
  
  const [apiKeyA, setApiKeyA] = useState('');
  const [apiKeyB, setApiKeyB] = useState('');
  const [apiKeyC, setApiKeyC] = useState('');
  const [globalPrompt, setGlobalPrompt] = useState(settings.globalPrompt);
  const [autonomyEnabled, setAutonomyEnabled] = useState(settings.autonomyEnabled);
  const [autonomyInterval, setAutonomyInterval] = useState(settings.autonomyInterval);
  const [saveMessage, setSaveMessage] = useState<{text: string, type: 'success' | 'error'} | null>(null);
  
  // Load settings on mount
  useEffect(() => {
    setGlobalPrompt(settings.globalPrompt);
    // Don't set api keys for security reasons
    setAutonomyEnabled(settings.autonomyEnabled);
    setAutonomyInterval(settings.autonomyInterval);
  }, [settings]);
  
  const handleSaveSettings = () => {
    const newSettings: Partial<typeof settings> = {
      globalPrompt,
      autonomyEnabled,
      autonomyInterval
    };
    
    if (apiKeyA) newSettings.apiKeyA = apiKeyA;
    if (apiKeyB) newSettings.apiKeyB = apiKeyB;
    if (apiKeyC) newSettings.apiKeyC = apiKeyC;
    
    updateSettings(newSettings);
    saveSettings();
    
    // Clear input fields for security
    setApiKeyA('');
    setApiKeyB('');
    setApiKeyC('');
    
    // Show success message
    setSaveMessage({ text: 'Settings saved successfully!', type: 'success' });
    
    // Clear message after 3 seconds
    setTimeout(() => {
      setSaveMessage(null);
    }, 3000);
  };
  
  const handleClearHistory = () => {
    if (window.confirm('Are you sure you want to clear the chat history?')) {
      clearChatHistory();
    }
  };
  
  // Helper function to mask API keys
  const maskApiKey = (key: string) => {
    if (!key) return 'Not Set';
    return key.slice(0, 6) + '...' + key.slice(-4);
  };
  
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">⚙️ Settings</h1>
      <p className="text-gray-500 mb-8">
        Configure global prompt and API keys. Settings are saved locally in your browser.
      </p>

      <div className="space-y-6">
        <div>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
              <label className="block text-blue-700 font-medium mb-2" htmlFor="globalPrompt">
                Global System Prompt (Prepended to Agent A's Instructions)
              </label>
              <textarea
                id="globalPrompt"
                value={globalPrompt}
                onChange={(e) => setGlobalPrompt(e.target.value)}
                placeholder="Optional: Define core instructions or personality for Agent A..."
                className="w-full p-3 border border-gray-300 rounded-lg min-h-[150px] focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
              <label className="block text-blue-700 font-medium mb-2" htmlFor="apiKeyA">
                Agent A API Key (Responder)
              </label>
              <input
                type="password"
                id="apiKeyA"
                value={apiKeyA}
                onChange={(e) => setApiKeyA(e.target.value)}
                placeholder="sk-..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 mb-2"
              />
              <div className="text-gray-500 text-sm">
                Current: <span className={settings.apiKeyA ? 'text-blue-600 font-mono' : 'text-red-500'}>
                  {maskApiKey(settings.apiKeyA)}
                </span>
              </div>
              <div className="text-gray-500 text-sm mt-2">
                Model: <code className="bg-gray-100 px-2 py-1 rounded">{settings.modelA}</code> (fixed)
              </div>
            </div>
            
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
              <label className="block text-blue-700 font-medium mb-2" htmlFor="apiKeyB">
                Agent B API Key (STM / Embedder)
              </label>
              <input
                type="password"
                id="apiKeyB"
                value={apiKeyB}
                onChange={(e) => setApiKeyB(e.target.value)}
                placeholder="sk-..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 mb-2"
              />
              <div className="text-gray-500 text-sm">
                Current: <span className={settings.apiKeyB ? 'text-blue-600 font-mono' : 'text-red-500'}>
                  {maskApiKey(settings.apiKeyB)}
                </span>
              </div>
              <div className="text-gray-500 text-sm mt-2">
                Model: <code className="bg-gray-100 px-2 py-1 rounded">{settings.modelBEmbed}</code> / 
                <code className="bg-gray-100 px-2 py-1 rounded ml-1">{settings.modelBMeta}</code> (fixed)
              </div>
            </div>
            
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
              <label className="block text-blue-700 font-medium mb-2" htmlFor="apiKeyC">
                Agent C API Key (LTM / Embedder)
              </label>
              <input
                type="password"
                id="apiKeyC"
                value={apiKeyC}
                onChange={(e) => setApiKeyC(e.target.value)}
                placeholder="sk-..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 mb-2"
              />
              <div className="text-gray-500 text-sm">
                Current: <span className={settings.apiKeyC ? 'text-blue-600 font-mono' : 'text-red-500'}>
                  {maskApiKey(settings.apiKeyC)}
                </span>
              </div>
              <div className="text-gray-500 text-sm mt-2">
                Model: <code className="bg-gray-100 px-2 py-1 rounded">{settings.modelCEmbed}</code> / 
                <code className="bg-gray-100 px-2 py-1 rounded ml-1">{settings.modelCMeta}</code> (fixed)
              </div>
              <div className="text-gray-500 text-sm mt-2">
                Note: Ensure this key has access to the specified embedding model.
              </div>
            </div>
            
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
              <label className="block text-blue-700 font-medium mb-4">
                Autonomy Settings
              </label>
              
              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  id="autonomyEnabled"
                  checked={autonomyEnabled}
                  onChange={(e) => setAutonomyEnabled(e.target.checked)}
                  className="h-4 w-4 text-blue-600 rounded border-gray-300"
                />
                <label htmlFor="autonomyEnabled" className="ml-2 text-gray-700">
                  Enable Autonomous Mode
                </label>
              </div>
              
              <div className="mb-2">
                <label htmlFor="autonomyInterval" className="block text-sm text-gray-600 mb-2">
                  Reflection Interval (seconds)
                </label>
                <input
                  type="number"
                  id="autonomyInterval"
                  value={autonomyInterval}
                  onChange={(e) => setAutonomyInterval(Math.max(30, parseInt(e.target.value) || 30))}
                  min="30"
                  className="w-24 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  disabled={!autonomyEnabled}
                />
              </div>
              
              <p className="text-sm text-gray-500 mt-2">
                When enabled, the agent will periodically reflect on memories and generate new insights. Minimum interval is 30 seconds.
              </p>
            </div>
            
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
              <label className="block text-blue-700 font-medium mb-2">
                Chat History
              </label>
              <button
                onClick={handleClearHistory}
                className="bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 font-medium rounded-lg px-4 py-2 flex items-center gap-2"
              >
                <Trash2 size={18} />
                Clear Chat History
              </button>
              <div className="text-gray-500 text-sm mt-4">
                Current history uses approximately <span className="font-semibold">{chatHistorySize.toLocaleString()}</span> tokens.
              </div>
            </div>
            
            <button
              onClick={handleSaveSettings}
              className="bg-blue-600 text-white font-semibold rounded-lg px-6 py-3 hover:bg-blue-700 transition flex items-center gap-2"
            >
              <Save size={18} />
              Save All Settings
            </button>
            
            {saveMessage && (
              <div className={`mt-4 p-3 rounded-lg ${saveMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {saveMessage.text}
              </div>
            )}
          </div>
      </div>
    </div>
  );
};

export default SettingsPage;