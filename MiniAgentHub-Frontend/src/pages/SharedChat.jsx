import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, AlertCircle, Check, Copy, Mic, Paperclip, ArrowUp, ChevronDown, Sun, Moon, Plus, Send, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import axiosClient from '../services/axiosClient';
import useThemeStore from '../store/themeStore';
import useAuthStore from '../store/authStore';

import Sidebar from '../components/layout/Sidebar';

const PreBlock = ({ children, ...props }) => {
  const [copied, setCopied] = useState(false);

  let textContent = '';
  let language = '';

  if (React.isValidElement(children)) {
    if (children.props.children) {
      const childData = children.props.children;
      textContent = Array.isArray(childData) ? childData.join('') : String(childData);
      textContent = textContent.replace(/\n$/, '');
    }

    if (children.props.className) {
      const match = /language-(\w+)/.exec(children.props.className || '');
      if (match) language = match[1];
    }
  }

  const handleCopy = () => {
    if (!textContent) return;
    navigator.clipboard.writeText(textContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-4 rounded-xl overflow-hidden shadow-sm bg-[#1e1e1e] border border-gray-200 dark:border-[#333]">
      <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] border-b border-[#444] select-none">
        <span className="text-xs font-mono text-gray-400 font-semibold uppercase tracking-wider">{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-gray-400 hover:text-gray-100 transition-colors"
          title="Copy code"
        >
          {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
          <span className="text-xs">{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-[13px] font-mono text-gray-300 m-0" {...props}>
        {children}
      </pre>
    </div>
  );
};

const SharedChat = () => {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fullScreenImage, setFullScreenImage] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    useThemeStore.getState().setTheme(theme);
  }, [theme]);

  useEffect(() => {
    const fetchSharedChat = async () => {
      try {
        setLoading(true);
        const res = await axiosClient.get(`/public/chat-sessions/${id}`);
        setSession(res.data || res);
        setError('');
      } catch (err) {
        console.error("Error fetching public chat session:", err);
        setError(err.response?.data?.message || 'Phiên trò chuyện không tồn tại hoặc chưa được chia sẻ công khai.');
      } finally {
        setLoading(false);
      }
    };
    if (id) {
      fetchSharedChat();
    }
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages]);

  const handleAction = () => {
    if (isAuthenticated) navigate('/');
    else navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-[#131417] text-gray-900 dark:text-white font-sans overflow-hidden transition-colors relative">

      <Sidebar />

      <main className="flex-1 flex flex-col relative min-w-0">

        <header className="hidden md:flex items-center justify-between px-4 py-2 shrink-0 z-10">
          <div className="flex items-center gap-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-[#2f2f2f] px-3 py-1.5 rounded-xl transition-colors" onClick={handleAction}>
            <span className="font-semibold text-[17px] text-gray-700 dark:text-gray-200">Agent Hub</span>
            <ChevronDown size={16} className="text-gray-500" />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2f2f2f] rounded-full transition-colors"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 pb-32 flex flex-col space-y-6 pt-14 md:pt-6">
          <div className="w-full max-w-3xl mx-auto flex flex-col space-y-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <Loader2 className="animate-spin mb-3 text-blue-500" size={32} />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-20 text-red-500 text-center">
                <AlertCircle className="mb-4" size={48} />
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">{error}</p>
              </div>
            ) : (
              <>
                <h1 className="text-2xl md:text-3xl font-bold mb-10 mt-4 text-center text-gray-900 dark:text-gray-100">
                  {session?.title || 'Shared Conversation'}
                </h1>

                {session.messages && session.messages.length > 0 ? (
                  session.messages.map((msg, index) => {
                    const isUser = msg.role === 'user';
                    return (
                      <div key={index} className={`flex flex-col w-full group ${isUser ? 'items-end' : 'items-start'}`}>
                        {isUser ? (
                          (() => {
                            const content = msg.content || '';
                            const fileRegex = /\[📎 File đính kèm: (.*?)\]/g;
                            const fileMatches = [...content.matchAll(fileRegex)];

                            const imgRegex = /!\[(.*?)\]\(([^)]+)\)/g;
                            const imgMatches = [...content.matchAll(imgRegex)];

                            const contentText = content.replace(fileRegex, '').replace(imgRegex, '').trim();

                            return (
                              <div className="flex flex-col items-end w-full">
                                <div className="flex flex-col items-end gap-2 max-w-[85%] md:max-w-[75%]">
                                  {imgMatches.map((match, i) => {
                                    const imgSrc = match[2].startsWith('/api/uploads') ? `${import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '') : ''}${match[2]}` : match[2];
                                    return (
                                      <div key={`img-${i}`} className="relative group inline-block">
                                        <img 
                                          src={imgSrc} 
                                          alt={match[1]} 
                                          className="max-h-64 w-auto rounded-2xl object-contain shadow-sm cursor-zoom-in" 
                                          onClick={() => setFullScreenImage(imgSrc)}
                                        />
                                      </div>
                                    );
                                  })}
                                  {(contentText || fileMatches.length > 0) && (
                                    <div className="rounded-2xl px-5 py-3.5 text-[15px] leading-relaxed bg-blue-600 text-white rounded-br-sm shadow-sm">
                                      {fileMatches.map((match, i) => (
                                        <div key={i} className="bg-white/20 dark:bg-black/20 text-white rounded-xl p-2 flex items-center gap-3 w-fit shadow-sm border border-white/10 mb-2.5">
                                          <div className="p-1.5 bg-white/20 rounded-lg">
                                            <Paperclip size={16} />
                                          </div>
                                          <span className="text-sm font-medium truncate max-w-[200px]">{match[1]}</span>
                                        </div>
                                      ))}
                                      {contentText && <span className="whitespace-pre-wrap">{contentText}</span>}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })()
                        ) : (
                          <div className="flex flex-col items-start w-full">
                            <div className="max-w-[85%] md:max-w-[75%] rounded-2xl px-5 py-3.5 text-[15px] leading-relaxed bg-white dark:bg-[#1e1f24] text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-[#2a2b30] rounded-bl-sm shadow-sm">
                              <ReactMarkdown
                                rehypePlugins={[rehypeRaw]}
                                components={{
                                  p: ({ node, ...props }) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
                                  ul: ({ node, ...props }) => <ul className="list-disc ml-5 mb-2 space-y-1" {...props} />,
                                  ol: ({ node, ...props }) => <ol className="list-decimal ml-5 mb-2 space-y-1" {...props} />,
                                  li: ({ node, ...props }) => <li {...props} />,
                                  strong: ({ node, ...props }) => <strong className="font-semibold text-gray-900 dark:text-white" {...props} />,
                                  pre: PreBlock,
                                  code: ({node, inline, ...props}) => inline ? <code className="bg-gray-100 dark:bg-[#2b2d31] text-red-600 dark:text-red-400 rounded px-1.5 py-0.5 text-[13px] font-mono border border-gray-200 dark:border-[#383a40]" {...props} /> : <code {...props} />,
                                  a: ({node, ...props}) => <a className="text-[#0068ff] dark:text-[#4799ff] hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
                                  img: ({node, src, alt, ...props}) => {
                                    const backendUrl = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '') : '';
                                    const finalSrc = src?.startsWith('/api/uploads') ? `${backendUrl}${src}` : src;
                                    return <img src={finalSrc} alt={alt} className="max-w-full max-h-96 object-contain rounded-lg border border-gray-200 dark:border-[#333] shadow-sm my-2 cursor-zoom-in" onClick={() => window.open(finalSrc, '_blank')} {...props} />;
                                  },
                                  table: ({node, ...props}) => <div className="overflow-x-auto my-4 rounded-lg border border-gray-200 dark:border-[#2b2d31]"><table className="min-w-full divide-y divide-gray-200 dark:divide-[#2b2d31] text-sm" {...props} /></div>,
                                  thead: ({ node, ...props }) => <thead className="bg-gray-100 dark:bg-gray-800/80" {...props} />,
                                  th: ({ node, ...props }) => <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider" {...props} />,
                                  td: ({ node, ...props }) => <td className="px-4 py-3 border-t border-gray-200 dark:border-gray-700" {...props} />
                                }}
                              >
                                {msg.content}
                              </ReactMarkdown>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-12 text-gray-400 text-sm">
                    This conversation has no messages.
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>
        </div>

        {!loading && !error && (
          <div className="absolute bottom-0 w-full p-4 md:p-6 flex flex-col items-center bg-gradient-to-t from-gray-50 via-gray-50 dark:from-[#131417] dark:via-[#131417] to-transparent">
            <div
              onClick={handleAction}
              className="w-full max-w-3xl relative flex items-center bg-white dark:bg-[#212227] shadow-lg dark:shadow-none rounded-3xl p-2 border border-gray-300 dark:border-[#333] cursor-pointer hover:border-gray-400 dark:hover:border-[#444] transition-colors"
            >
              <div className="p-3 text-gray-400 shrink-0">
                <Plus size={22} />
              </div>

              <div className="flex-1 text-gray-400 dark:text-gray-500 px-2 py-3 text-base select-none">
                {t('dashboard.promptPlaceholder')}
              </div>

              <div className="flex items-center gap-2 pr-1 shrink-0 pb-0.5">
                <div className="p-3 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors">
                  <Paperclip size={20} />
                </div>
                <div className="bg-[#3b82f6] text-white p-3 rounded-full flex items-center justify-center">
                  <Send size={20} className="ml-1" />
                </div>
              </div>
            </div>
            <p className="mt-4 text-[11px] text-gray-600 font-mono tracking-wide">
              {t('dashboard.footerNote')}
            </p>
          </div>
        )}

      </main>
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
    </div>
  );
};

export default SharedChat;