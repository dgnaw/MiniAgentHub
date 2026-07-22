import React, { useState, useRef, useEffect, useMemo } from 'react';
import Sidebar from '../components/layout/Sidebar';
import { Sparkles, Code, AlertCircle, X, Paperclip } from 'lucide-react';
import useThemeStore from '../store/themeStore';
import useAuthStore from '../store/authStore';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import AiMessage from '../components/chat/AiMessage';
import ApiKeyModal from '../components/modals/ApiKeyModal';
import ModelSelector from '../components/chat/ModelSelector';
import ChatInput from '../components/chat/ChatInput';
import UserMessage from '../components/chat/UserMessage';
import { useChatStream } from '../hooks/useChatStream';
import useGenerationStore from '../store/useGenerationStore';
import DocumentViewerPanel from '../components/chat/DocumentViewerPanel';

const Dashboard = () => {
  useThemeStore();
  const user = useAuthStore((state) => state.user);
  const { t } = useTranslation();
  const { id: sessionId } = useParams();

  const defaultGroqModels = useMemo(() => [
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', desc: t('dashboard.modelLlama318b') },
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', desc: t('dashboard.modelLlama3370b') },
    { id: 'llama3-70b-8192', name: 'Llama 3 70B', desc: t('dashboard.modelLlama370b') },
    { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1', desc: t('dashboard.modelDeepseek') },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', desc: t('dashboard.modelMixtral') },
    { id: 'gemma2-9b-it', name: 'Gemma 2 9B', desc: t('dashboard.modelGemma') }
  ], [t]);

  const [selectedModel, setSelectedModel] = useState('llama-3.1-8b-instant');
  const [groqModels, setGroqModels] = useState(defaultGroqModels);

  const displayGroqModels = useMemo(() => {
    return groqModels.map(m => {
      const def = defaultGroqModels.find(d => d.id === m.id);
      if (def) {
        return { ...m, desc: def.desc };
      }
      
      if (m.desc && m.desc.includes('Cung cấp bởi')) {
         const provider = m.desc.replace('Cung cấp bởi ', '');
         return { ...m, desc: t('dashboard.providedBy', { provider }) };
      }
      return m;
    });
  }, [groqModels, defaultGroqModels, t]);
  const [apiKeyChanged, setApiKeyChanged] = useState(0);
  const [apiKeyModalConfig, setApiKeyModalConfig] = useState({ isOpen: false, type: 'groq' });
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState(null);
  const [viewedFile, setViewedFile] = useState(null);

  const generatingSessions = useGenerationStore((state) => state.generatingSessions);
  const isGeneratingBackground = sessionId && generatingSessions.has(sessionId);

  const messagesEndRef = useRef(null);

  const {
    input, setInput,
    messages, setMessages,
    isLoading,
    localError,
    selectedFiles, setSelectedFiles,
    editingIndex, setEditingIndex,
    editInput, setEditInput,
    isFlowiseAvailable, setIsFlowiseAvailable,
    isApiKeyMissing, setIsApiKeyMissing,
    isDragging,
    textareaRef,
    hasMoreMessages,
    isFetchingMore,
    loadMoreMessages,
    handleSend, handleStop, handleKeyDown,
    handleDragOver, handleDragLeave, handleDrop, removeFile
  } = useChatStream(sessionId, selectedModel, setSelectedModel, apiKeyChanged, setGroqModels);

  const openApiKeyModal = (type) => {
    setApiKeyModalConfig({ isOpen: true, type });
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div
      className="flex h-screen bg-gray-50 dark:bg-[#131417] text-gray-900 dark:text-white font-sans overflow-hidden transition-colors relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <Sidebar />

      {isDragging && (
        <div className="absolute inset-0 z-[60] bg-blue-500/10 backdrop-blur-sm border-4 border-blue-500 border-dashed m-4 rounded-3xl flex items-center justify-center pointer-events-none transition-all duration-200">
          <div className="bg-white dark:bg-[#1e1f24] p-8 rounded-2xl shadow-2xl flex flex-col items-center">
            <Paperclip size={48} className="text-blue-500 mb-4 animate-bounce" />
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{t('dashboard.dropFileTitle')}</h3>
            <p className="text-gray-500 mt-2">{t('dashboard.dropFileDesc')}</p>
          </div>
        </div>
      )}

      <main className="flex-1 flex flex-col relative overflow-hidden">
        <header className="flex justify-end p-4 pt-16 lg:p-6 lg:pt-6 shrink-0 z-10">
          <ModelSelector
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            groqModels={displayGroqModels}
            showModelDropdown={showModelDropdown}
            setShowModelDropdown={setShowModelDropdown}
            isFlowiseAvailable={isFlowiseAvailable}
            openApiKeyModal={openApiKeyModal}
          />
        </header>

        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-start md:justify-center pt-10 md:pt-0 px-6 md:px-8 pb-48 md:pb-32 overflow-y-auto">
            <div className="text-center mb-8 md:mb-12 px-4 md:px-0">
              <h2 className="text-3xl md:text-5xl font-bold mb-3 md:mb-4 text-blue-600 dark:text-[#d1e5fb]">
                {t('dashboard.greeting', { name: user?.full_name || 'User' })}
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-lg">{t('dashboard.subtitle')}</p>
            </div>
            <div className="hidden md:grid md:grid-cols-2 gap-4 w-full max-w-3xl">
              <div
                onClick={() => handleSend(`${t('dashboard.card1Title')}: ${t('dashboard.card1Desc')}`)}
                className="bg-white dark:bg-[#1e1f24] hover:bg-blue-50/50 dark:hover:bg-[#25272d] border border-gray-200 dark:border-[#2a2b30] shadow-sm dark:shadow-none p-6 rounded-2xl cursor-pointer transition-colors group"
              >
                <Sparkles className="text-blue-500 dark:text-blue-400 mb-4" size={24} />
                <h3 className="text-gray-800 dark:text-gray-200 font-semibold text-lg mb-2 group-hover:text-blue-600 dark:group-hover:text-white transition-colors">{t('dashboard.card1Title')}</h3>
                <p className="text-gray-500 text-sm">{t('dashboard.card1Desc')}</p>
              </div>
              <div
                onClick={() => handleSend(`${t('dashboard.card2Title')}: ${t('dashboard.card2Desc')}`)}
                className="bg-white dark:bg-[#1e1f24] hover:bg-blue-50/50 dark:hover:bg-[#25272d] border border-gray-200 dark:border-[#2a2b30] shadow-sm dark:shadow-none p-6 rounded-2xl cursor-pointer transition-colors group"
              >
                <Code className="text-blue-500 dark:text-blue-400 mb-4" size={24} />
                <h3 className="text-gray-800 dark:text-gray-200 font-semibold text-lg mb-2 group-hover:text-blue-600 dark:group-hover:text-white transition-colors">{t('dashboard.card2Title')}</h3>
                <p className="text-gray-500 text-sm">{t('dashboard.card2Desc')}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 pb-32 flex flex-col space-y-6 min-h-0">
            <div className="max-w-3xl w-full mx-auto flex flex-col space-y-6">
              {hasMoreMessages && (
                <div className="flex justify-center mt-2 mb-2">
                  <button
                    onClick={loadMoreMessages}
                    disabled={isFetchingMore}
                    className="text-xs font-medium bg-white hover:bg-gray-100 dark:bg-[#1e1f24] dark:hover:bg-[#25272d] border border-gray-200 dark:border-[#2a2b30] text-gray-600 dark:text-gray-400 px-4 py-1.5 rounded-full shadow-sm transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {isFetchingMore ? (
                      <>
                        <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                        Đang tải...
                      </>
                    ) : (
                      'Tải thêm tin nhắn cũ'
                    )}
                  </button>
                </div>
              )}
              {messages.map((msg, index) => (
                <div key={index} className={`flex flex-col w-full group ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {msg.role === 'user' ? (
                    <UserMessage
                      msg={msg}
                      index={index}
                      editingIndex={editingIndex}
                      setEditingIndex={setEditingIndex}
                      editInput={editInput}
                      setEditInput={setEditInput}
                      handleSend={handleSend}
                      setFullScreenImage={setFullScreenImage}
                      setViewedFile={setViewedFile}
                    />
                  ) : (
                    <AiMessage content={msg.content} index={index} setViewedFile={setViewedFile} />
                  )}
                </div>
              ))}
              {(isLoading || isGeneratingBackground) && (!messages.length || messages[messages.length - 1].role !== 'ai') && (
                <div className="flex flex-col items-start">
                  <div className="max-w-[85%] md:max-w-[75%] rounded-2xl px-5 py-3.5 text-[15px] bg-white dark:bg-[#1e1f24] text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-[#2a2b30] rounded-bl-sm flex items-center gap-3">
                    <Sparkles size={16} className="text-blue-500 animate-pulse" />
                    <span className="text-sm font-medium text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-500 animate-pulse">
                      {selectedModel === 'Data Analyst' ? t('dashboard.analyzing') : t('dashboard.thinking')}
                    </span>
                    <div className="flex items-center gap-1 ml-1 mt-1">
                      <span className="w-1.5 h-1.5 bg-blue-500/80 rounded-full animate-bounce"></span>
                      <span className="w-1.5 h-1.5 bg-blue-500/80 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                      <span className="w-1.5 h-1.5 bg-blue-500/80 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        )}

        <div className="absolute bottom-0 w-full p-4 md:p-6 flex flex-col items-center bg-gradient-to-t from-gray-50 via-gray-50 dark:from-[#131417] dark:via-[#131417] to-transparent">
          {localError && (
            <div className="mb-4 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 px-4 py-2 rounded-lg border border-red-200 dark:border-red-500/20 text-sm flex items-center gap-2 shadow-sm animate-pulse">
              <AlertCircle size={16} />
              {localError}
            </div>
          )}

          <ChatInput
            input={input}
            setInput={setInput}
            handleSend={handleSend}
            handleStop={handleStop}
            handleKeyDown={handleKeyDown}
            isLoading={isLoading}
            selectedFiles={selectedFiles}
            removeFile={removeFile}
            setSelectedFiles={setSelectedFiles}
            textareaRef={textareaRef}
            setFullScreenImage={setFullScreenImage}
          />

          <p className="mt-4 text-[11px] text-gray-600 font-mono tracking-wide">
            {t('dashboard.footerNote')}
          </p>
        </div>
      </main>

      {viewedFile && (
        <aside className="w-[35vw] min-w-[300px] max-w-[600px] h-full flex-shrink-0 z-[40]">
           <DocumentViewerPanel fileInfo={viewedFile} onClose={() => setViewedFile(null)} />
        </aside>
      )}

      {fullScreenImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out animate-in fade-in duration-200"
          onClick={() => setFullScreenImage(null)}
        >
          <button
            className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white rounded-full p-2 transition-colors"
            onClick={(e) => { e.stopPropagation(); setFullScreenImage(null); }}
          >
            <X size={24} />
          </button>
          <img
            src={fullScreenImage}
            alt="Full screen"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl cursor-default animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <ApiKeyModal
        isOpen={apiKeyModalConfig.isOpen}
        type={apiKeyModalConfig.type}
        user={user}
        onClose={() => setApiKeyModalConfig({ isOpen: false, type: 'groq' })}
        onSuccess={() => setApiKeyChanged(prev => prev + 1)}
      />
    </div>
  );
};

export default Dashboard;