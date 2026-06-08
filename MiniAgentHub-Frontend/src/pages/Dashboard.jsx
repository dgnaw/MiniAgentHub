import React, { useState, useRef, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { ChevronDown, Sparkles, Code, Plus, Paperclip, Send, AlertCircle } from 'lucide-react';
import useThemeStore from '../store/themeStore';
import useAuthStore from '../store/authStore';
import { useTranslation } from 'react-i18next';
import axiosClient from '../services/axiosClient';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';

const Dashboard = () => {
  useThemeStore();
  const user = useAuthStore((state) => state.user);
  const { t } = useTranslation();
  const { id: sessionId } = useParams(); 
  const navigate = useNavigate();

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('Llama 3'); 
  const [showModelDropdown, setShowModelDropdown] = useState(false); 
  const [isFlowiseAvailable, setIsFlowiseAvailable] = useState(true);
  const [isApiKeyMissing, setIsApiKeyMissing] = useState(() => {
    return localStorage.getItem('agentHub_apiKeyMissing') === 'true';
  });
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (sessionId) {
      const fetchMessages = async () => {
        try {
          const res = await axiosClient.get(`/chat-sessions/${sessionId}/messages`);
          const msgList = Array.isArray(res) ? res : (res.data || []);
          setMessages(msgList.map(m => ({ role: m.role, content: m.content })));
        } catch (error) {
          console.error("Lỗi tải lịch sử tin nhắn:", error);
        }
      };
      fetchMessages();
    } else {
      setMessages([]);
    }
  }, [sessionId]);

  const handleSend = async (customMessage) => {
    const textToSend = typeof customMessage === 'string' ? customMessage : input;
    if (!textToSend.trim() || isLoading) return;

    const userMessage = { role: 'user', content: textToSend.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'; // Reset chiều cao khung chat sau khi gửi
    }
    setIsLoading(true);

    try {
      const token = localStorage.getItem('agentHub_token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: userMessage.content,
          sessionId: sessionId,
          model: selectedModel
        })
      });
      
      if (!response.ok) {
        throw new Error('Server connection error');
      }

      const reader = response.body.getReader(); // đọc dữ liệu -> trả về -> chunks
      const decoder = new TextDecoder('utf-8'); // dữ liệu -> dạng nhị phân
      let aiResponseText = '';
      let buffer = '';
      let newSessionId = null;
      let isAiMessageAdded = false; 

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        // Xử lý nối dữ liệu nếu bị cắt trong quá trình stream
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '').trim();
            if (dataStr === '[DONE]') {
              if (!isAiMessageAdded) setIsLoading(false);
              break;
            }
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.sessionId) {
                newSessionId = parsed.sessionId;
              }
            if (parsed.flowiseUnavailable) {
              setIsFlowiseAvailable(false);
              setSelectedModel('Llama 3');
            }
              if (parsed.chunk) {
                if (parsed.chunk.includes('API Key của hệ thống AI (Groq) không hợp lệ')) {
                  setIsApiKeyMissing(true);
                  localStorage.setItem('agentHub_apiKeyMissing', 'true');
                } else if (!parsed.chunk.includes('Lỗi hệ thống')) {
                  setIsApiKeyMissing(false);
                  localStorage.removeItem('agentHub_apiKeyMissing');
                }

                if (!isAiMessageAdded) {
                  setIsLoading(false);
                  setMessages((prev) => [...prev, { role: 'ai', content: '' }]);
                  isAiMessageAdded = true;
                }

                aiResponseText += parsed.chunk;
                setMessages((prev) => {
                  const newMsgs = [...prev];
                  if (newMsgs.length > 0 && newMsgs[newMsgs.length - 1].role === 'ai') {
                    newMsgs[newMsgs.length - 1].content = aiResponseText;
                  }
                  return newMsgs;
                });
              }
            } catch (e) {
            }
          }
        }
      }

      if (newSessionId && !sessionId) {
        navigate(`/chat/${newSessionId}`);
      }
    } catch (error) {
      console.error("Lỗi khi chat:", error);
      const errorMessage = { role: 'ai', content: t('dashboard.errorConnect', 'Sorry, an error occurred while connecting to the AI server.') };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-[#131417] text-gray-900 dark:text-white font-sans overflow-hidden transition-colors">
      
      <Sidebar />

      <main className="flex-1 flex flex-col relative">
        
        <header className="flex justify-between items-center p-6">
          {isApiKeyMissing ? (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 dark:bg-red-500/10 px-4 py-2 rounded-lg border border-red-200 dark:border-red-500/20">
              <AlertCircle size={18} />
              <span className="text-sm font-medium">Hệ thống chưa được cấu hình API Key. Vui lòng liên hệ Admin.</span>
            </div>
          ) : (
            <div />
          )}

          {!isApiKeyMissing && (
            <div className="relative">
            <button 
              onClick={() => setShowModelDropdown(!showModelDropdown)}
              className="flex items-center gap-2 bg-white dark:bg-[#1e1f23] border border-gray-200 dark:border-[#333] hover:bg-gray-100 dark:hover:bg-[#2a2b30] text-gray-700 dark:text-gray-300 shadow-sm dark:shadow-none px-4 py-2 rounded-full text-sm font-medium transition-colors"
            >
              {selectedModel === 'Llama 3' ? 'Llama 3 (Groq)' : 'Data Analyst (Flowise)'}
              <ChevronDown size={16} className="text-gray-400" />
            </button>

            {showModelDropdown && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#1e1f23] border border-gray-200 dark:border-[#333] rounded-xl shadow-lg overflow-hidden z-10">
                <div className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#2a2b30] cursor-pointer text-sm text-gray-700 dark:text-gray-300 transition-colors" onClick={() => { setSelectedModel('Llama 3'); setShowModelDropdown(false); }}>
                  <div className="font-medium text-blue-600 dark:text-blue-400 mb-0.5">Llama 3</div>
                  <div className="text-xs text-gray-500">{t('dashboard.modelLlamaDesc', 'General chat (via Groq)')}</div>
                </div>
                <div className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#2a2b30] cursor-pointer text-sm text-gray-700 dark:text-gray-300 transition-colors border-t border-gray-100 dark:border-[#333]" onClick={() => { 
                  if (!isFlowiseAvailable) {
                    alert(t('dashboard.flowiseUnavailable', 'Data analysis system is busy or out of requests. Please try again later!'));
                    setShowModelDropdown(false);
                    return;
                  }
                  setSelectedModel('Data Analyst'); 
                  setShowModelDropdown(false); 
                }}>
                  <div className="font-medium text-emerald-600 dark:text-emerald-400 mb-0.5">Data Analyst</div>
                  <div className="text-xs text-gray-500">{t('dashboard.modelDataDesc', 'Data analysis (via Flowise)')}</div>
                </div>
              </div>
            )}
            </div>
          )}
        </header>

        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-8 pb-32">
            <div className="text-center mb-12">
              <h2 className="text-5xl font-bold mb-4 text-blue-600 dark:text-[#d1e5fb]">
                {t('dashboard.greeting', { name: user?.full_name || 'User' })}
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-lg">{t('dashboard.subtitle')}</p>
            </div>

            {!isApiKeyMissing && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-3xl">
                <div 
                  onClick={() => handleSend(`${t('dashboard.card1Title')}: ${t('dashboard.card1Desc')}`)}
                  className="bg-white dark:bg-[#1e1f24] hover:bg-blue-50/50 dark:hover:bg-[#25272d] border border-gray-200 dark:border-[#2a2b30] shadow-sm dark:shadow-none p-6 rounded-2xl cursor-pointer transition-colors group"
                >
                <Sparkles className="text-blue-500 dark:text-blue-400 mb-4" size={24} />
                <h3 className="text-gray-800 dark:text-gray-200 font-semibold text-lg mb-2 group-hover:text-blue-600 dark:group-hover:text-white transition-colors">
                  {t('dashboard.card1Title')}
                </h3>
                <p className="text-gray-500 text-sm">{t('dashboard.card1Desc')}</p>
              </div>

              <div 
                onClick={() => handleSend(`${t('dashboard.card2Title')}: ${t('dashboard.card2Desc')}`)}
                className="bg-white dark:bg-[#1e1f24] hover:bg-blue-50/50 dark:hover:bg-[#25272d] border border-gray-200 dark:border-[#2a2b30] shadow-sm dark:shadow-none p-6 rounded-2xl cursor-pointer transition-colors group"
              >
                <Code className="text-blue-500 dark:text-blue-400 mb-4" size={24} />
                <h3 className="text-gray-800 dark:text-gray-200 font-semibold text-lg mb-2 group-hover:text-blue-600 dark:group-hover:text-white transition-colors">
                  {t('dashboard.card2Title')}
                </h3>
                <p className="text-gray-500 text-sm">{t('dashboard.card2Desc')}</p>
              </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 pb-32 flex flex-col space-y-6">
            <div className="max-w-3xl w-full mx-auto flex flex-col space-y-6">
              {messages.map((msg, index) => (
                <div key={index} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-5 py-3.5 text-[15px] leading-relaxed ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-br-sm' 
                      : 'bg-white dark:bg-[#1e1f24] text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-[#2a2b30] rounded-bl-sm'
                  }`}>
                    {msg.role === 'user' ? (
                      <span className="whitespace-pre-wrap">{msg.content}</span>
                    ) : (
                      <ReactMarkdown
                        rehypePlugins={[rehypeRaw]}
                        components={{
                          p: ({node, ...props}) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
                          ul: ({node, ...props}) => <ul className="list-disc ml-5 mb-2 space-y-1" {...props} />,
                          ol: ({node, ...props}) => <ol className="list-decimal ml-5 mb-2 space-y-1" {...props} />,
                          li: ({node, ...props}) => <li {...props} />,
                          strong: ({node, ...props}) => <strong className="font-semibold" {...props} />,
                          pre: ({node, ...props}) => <pre className="bg-[#1e1e1e] text-gray-300 rounded-lg p-4 overflow-x-auto my-3 text-[13px] font-mono border border-gray-700 shadow-sm" {...props} />,
                          code: ({node, inline, ...props}) => 
                            inline 
                              ? <code className="bg-black/10 dark:bg-white/10 text-red-600 dark:text-red-400 rounded px-1.5 py-0.5 text-sm font-mono" {...props} /> 
                              : <code {...props} />,
                          a: ({node, ...props}) => <a className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
                          table: ({node, ...props}) => <div className="overflow-x-auto my-4 rounded-lg border border-gray-200 dark:border-gray-700"><table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm" {...props} /></div>,
                          thead: ({node, ...props}) => <thead className="bg-gray-100 dark:bg-gray-800/80" {...props} />,
                          th: ({node, ...props}) => <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider" {...props} />,
                          td: ({node, ...props}) => <td className="px-4 py-3 border-t border-gray-200 dark:border-gray-700" {...props} />
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex flex-col items-start">
                  <div className="max-w-[85%] md:max-w-[75%] rounded-2xl px-5 py-3.5 text-[15px] bg-white dark:bg-[#1e1f24] text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-[#2a2b30] rounded-bl-sm flex items-center gap-3">
                    <Sparkles size={16} className="text-blue-500 animate-pulse" />
                    <span className="text-sm font-medium text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-500 animate-pulse">
                      {selectedModel === 'Data Analyst' ? t('dashboard.analyzing', 'Analyzing data deeply') : t('dashboard.thinking', 'Generating response')}
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

        <div className="absolute bottom-0 w-full p-6 flex flex-col items-center bg-gradient-to-t from-gray-50 via-gray-50 dark:from-[#131417] dark:via-[#131417] to-transparent">
          <div className="w-full max-w-3xl relative flex items-end bg-white dark:bg-[#212227] shadow-lg dark:shadow-none rounded-3xl p-2 border border-gray-300 dark:border-[#333] focus-within:border-blue-500 dark:focus-within:border-[#555] transition-colors">
            
            <button className="p-3 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors shrink-0">
              <Plus size={22} />
            </button>

            <textarea 
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder={t('dashboard.promptPlaceholder')} 
              className="flex-1 bg-transparent border-none outline-none text-gray-900 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 px-2 py-3 text-base resize-none overflow-y-auto max-h-[200px] custom-scrollbar"
            />

            <div className="flex items-center gap-2 pr-1 shrink-0 pb-0.5">
              <button className="p-3 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors">
                <Paperclip size={20} />
              </button>
              
              <button 
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                className={`bg-[#3b82f6] hover:bg-[#2563eb] text-white p-3 rounded-full transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <Send size={20} className="ml-1" /> {/* Thêm ml-1 để icon send căn giữa đẹp hơn */}
              </button>
            </div>
          </div>

          <p className="mt-4 text-[11px] text-gray-600 font-mono tracking-wide">
            {t('dashboard.footerNote')}
          </p>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;