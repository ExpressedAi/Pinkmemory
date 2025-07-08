import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Settings, MessageSquare, FileText, BarChart3, Database, Brain } from 'lucide-react';
import { useMemory } from '@/contexts/MemoryContext';
import { useSettings } from '@/contexts/SettingsContext'; 

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { ltmCount, stmCount } = useMemory();
  const { settings, updateSettings, saveSettings } = useSettings();
  const [isReflecting, setIsReflecting] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [lastReflectionTime, setLastReflectionTime] = useState<number | null>(null);

  // Load initial reflection time
  useEffect(() => {
    const storedTime = localStorage.getItem('lastReflectionTime');
    if (storedTime) {
      setLastReflectionTime(parseInt(storedTime));
    }
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (settings.autonomyEnabled) {
      const updateCountdown = () => {
        const now = Date.now();
        const storedTime = localStorage.getItem('lastReflectionTime');
        const lastTime = storedTime ? parseInt(storedTime) : null;
        
        if (!lastTime) {
          setCountdown(settings.autonomyInterval);
        } else {
          const elapsed = Math.floor((now - lastTime) / 1000);
          const remaining = settings.autonomyInterval - elapsed;
        
          if (remaining <= 0) {
            setCountdown(settings.autonomyInterval);
          } else {
            setCountdown(remaining);
          }
        }
      };
      
      updateCountdown();
      timer = setInterval(() => {
        updateCountdown();
      }, 1000);
    }
    
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [settings.autonomyEnabled, settings.autonomyInterval, lastReflectionTime]);
  
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'lastReflectionTime') {
        const newTime = e.newValue ? parseInt(e.newValue) : null;
        setLastReflectionTime(newTime);
        if (newTime) {
          const now = Date.now();
          const elapsed = Math.floor((now - newTime) / 1000);
          const remaining = settings.autonomyInterval - elapsed;
          setCountdown(Math.max(0, remaining));
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [settings.autonomyInterval]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-pastel-purple/30 via-pastel-pink/20 to-pastel-purple/10">
      <header className="bg-gradient-to-r from-pastel-purple to-pastel-pink backdrop-blur-md border-b border-gray-200/75 h-16 z-10 sticky top-0">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center gap-4">
          <button
            onClick={() => {
              const newState = !settings.autonomyEnabled;
              updateSettings({ autonomyEnabled: newState });
              saveSettings();
            }}
            className={`
              flex items-center gap-2 px-3 py-1.5 rounded-full font-medium transition-all text-sm
              ${settings.autonomyEnabled 
                ? 'bg-pastel-purple text-purple-700 hover:bg-purple-100' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}
            `}
          >
            <Brain size={16} className={settings.autonomyEnabled ? 'text-purple-600' : 'text-gray-600'} />
            <span>Openera AI Reflection</span>
            {isReflecting && (
              <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse ml-1" title="Currently reflecting"></div>
            )}
            {settings.autonomyEnabled && (
              <span className="ml-2 text-xs font-mono bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                {Math.max(0, countdown)}s
              </span>
            )}
          </button>
          
          <NavLink 
            to="/chat" 
            className={({ isActive }) => 
              `relative text-gray-800 hover:text-purple-600 font-medium py-2 transition-colors ${isActive ? 'text-purple-600' : ''}`
            }
          >
            <div className="flex items-center gap-1.5">
              <MessageSquare size={18} />
              <span>Chat</span>
            </div>
            <ActiveIndicator active={location.pathname === '/chat'} />
          </NavLink>

          <NavLink 
            to="/uploader-ltm" 
            className={({ isActive }) => 
              `relative text-gray-800 hover:text-purple-600 font-medium py-2 transition-colors ${isActive ? 'text-purple-600' : ''}`
            }
          >
            <div className="flex items-center gap-1.5">
              <Database size={18} />
              <span>LTM</span>
              {ltmCount > 0 && <span className="ml-1 bg-purple-100 text-purple-800 text-xs font-medium rounded-full px-2">{ltmCount}</span>}
            </div>
            <ActiveIndicator active={location.pathname === '/uploader-ltm'} />
          </NavLink>

          <NavLink 
            to="/uploader-stm" 
            className={({ isActive }) => 
              `relative text-gray-800 hover:text-purple-600 font-medium py-2 transition-colors ${isActive ? 'text-purple-600' : ''}`
            }
          >
            <div className="flex items-center gap-1.5">
              <FileText size={18} />
              <span>STM</span>
              {stmCount > 0 && <span className="ml-1 bg-purple-100 text-purple-800 text-xs font-medium rounded-full px-2">{stmCount}</span>}
            </div>
            <ActiveIndicator active={location.pathname === '/uploader-stm'} />
          </NavLink>

          <NavLink 
            to="/scoreboard" 
            className={({ isActive }) => 
              `relative text-gray-800 hover:text-purple-600 font-medium py-2 transition-colors ${isActive ? 'text-purple-600' : ''}`
            }
          >
            <div className="flex items-center gap-1.5">
              <BarChart3 size={18} />
              <span>Scoreboard</span>
            </div>
            <ActiveIndicator active={location.pathname === '/scoreboard'} />
          </NavLink>

          <NavLink 
            to="/settings" 
            className={({ isActive }) => 
              `relative text-gray-800 hover:text-purple-600 font-medium py-2 transition-colors ${isActive ? 'text-purple-600' : ''}`
            }
          >
            <div className="flex items-center gap-1.5">
              <Settings size={18} />
              <span>Settings</span>
            </div>
            <ActiveIndicator active={location.pathname === '/settings'} />
          </NavLink>
        </nav>
      </header>
      
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}

const ActiveIndicator: React.FC<{ active: boolean }> = ({ active }) => {
  return active ? (
    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1/2 h-0.5 bg-purple-600 rounded-t transition-all"></div>
  ) : null;
};