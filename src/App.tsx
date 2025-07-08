import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/Toaster';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { MemoryProvider } from '@/contexts/MemoryContext';
import Layout from '@/components/Layout';
import ChatPage from '@/pages/ChatPage';
import UploaderLTMPage from '@/pages/UploaderLTMPage';
import UploaderSTMPage from '@/pages/UploaderSTMPage';
import ScoreboardPage from '@/pages/ScoreboardPage';
import TestPage from '@/pages/TestPage';
import SettingsPage from '@/pages/SettingsPage';

function App() {
  return (
    <Router>
      <SettingsProvider>
        <MemoryProvider>
          <Layout>
            <Routes>
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/uploader-ltm" element={<UploaderLTMPage />} />
              <Route path="/uploader-stm" element={<UploaderSTMPage />} />
              <Route path="/scoreboard" element={<ScoreboardPage />} />
              <Route path="/test" element={<TestPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/chat" replace />} />
            </Routes>
          </Layout>
          <Toaster />
        </MemoryProvider>
      </SettingsProvider>
    </Router>
  );
}

export default App;