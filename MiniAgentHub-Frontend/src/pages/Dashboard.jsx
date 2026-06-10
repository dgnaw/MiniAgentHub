import React, { useState, useRef, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { ChevronDown, Sparkles, Code, Plus, Paperclip, Send, AlertCircle, X, Copy, Check, Eye, Pencil } from 'lucide-react';
import useThemeStore from '../store/themeStore';
import useAuthStore from '../store/authStore';
import { useTranslation } from 'react-i18next';
import axiosClient from '../services/axiosClient';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import toast from 'react-hot-toast';

const PreBlock = ({ children, ...props }) => {
  const [copied, setCopied] = useState(false);
  
  let textContent = '';
  let language = '';

  // Bóc tách text và tên ngôn ngữ từ props của thẻ <code> bên trong
  if (React.isValidElement(children)) {
    if (children.props.children) {
      const childData = children.props.children;
      if (Array.isArray(childData)) {
        textContent = childData.join('');
      } else {
        textContent = String(childData);
      }
      textContent = textContent.replace(/\n$/, ''); // Bỏ dấu xuống dòng thừa ở cuối
    }
    
    if (children.props.className) {
      const match = /language-(\w+)/.exec(children.props.className || '');
      if (match) {
        language = match[1];
      }
    }
  }

  const handleCopy = () => {
    if (!textContent) return;
    navigator.clipboard.writeText(textContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000); // Tắt hiệu ứng Copied sau 2 giây
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

const getBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result);
  reader.onerror = error => reject(error);
});

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
  const [isApiKeyMissing, setIsApiKeyMissing] = useState(false);
  const [isFlowiseConfigured, setIsFlowiseConfigured] = useState(true);
  const [localError, setLocalError] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [fullScreenImage, setFullScreenImage] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editInput, setEditInput] = useState('');
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

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

  // Ping kiểm tra trạng thái API Key khi vừa vào trang
  useEffect(() => {
    const checkApiKeyStatus = async () => {
      try {
        const token = localStorage.getItem('agentHub_token');
        const response = await fetch(`${import.meta.env.VITE_API_URL}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ message: "ping", isPing: true })
        });
        const data = await response.json();
        if (data.ready === false) {
          setIsApiKeyMissing(true);
        } else {
          setIsApiKeyMissing(false);
        }
        if (data.flowiseReady === false) {
          setIsFlowiseConfigured(false);
          setSelectedModel((prev) => prev === 'Data Analyst' ? 'Llama 3' : prev);
        } else {
          setIsFlowiseConfigured(true);
        }
      } catch (error) {
      }
    };
    checkApiKeyStatus();
  }, []);

  const handleSend = async (customMessage, isEdit = false, editIdx = null) => {
    const textToSend = typeof customMessage === 'string' ? customMessage : input;
    if ((!textToSend.trim() && !selectedFile) || isLoading) return;

    let finalContent = textToSend.trim();
    if (selectedFile && !isEdit) {
      const safeName = selectedFile.name.replace(/[\\]/g, '_'); // Lọc ký tự đặc biệt để không vỡ cấu trúc regex
      if (selectedFile.type.startsWith('image/')) {
        const base64 = await getBase64(selectedFile);
        finalContent = finalContent 
          ? `![${safeName}](${base64})\n\n${finalContent}` 
          : `![${safeName}](${base64})`;
      } else {
        finalContent = finalContent 
          ? `[📎 File đính kèm: ${safeName}]\n\n${finalContent}` 
          : `[📎 File đính kèm: ${safeName}]`;
      }
    }

    const userMessage = { role: 'user', content: finalContent };
    if (isEdit) {
      setMessages((prev) => [...prev.slice(0, editIdx), userMessage]);
      setEditingIndex(null);
    } else {
      setMessages((prev) => [...prev, userMessage]);
      setInput('');
      setSelectedFile(null);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'; // Reset chiều cao khung chat sau khi gửi
      }
    }
    setIsLoading(true);
    setLocalError('');

    try {
      const token = localStorage.getItem('agentHub_token');
      
      let fetchOptions = {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      };

      if (selectedFile && !isEdit) {
        const formData = new FormData();
        const messageToSend = userMessage.content.replace(/!\[(.*?)\]\(data:image\/[^;]+;base64,[^\)]+\)/g, '[🖼️ Hình ảnh đính kèm: $1]');
        formData.append('message', messageToSend);
        formData.append('sessionId', sessionId || '');
        formData.append('model', selectedModel);
        formData.append('file', selectedFile);
        fetchOptions.body = formData;
      } else {
        fetchOptions.headers['Content-Type'] = 'application/json';
        fetchOptions.body = JSON.stringify({
          message: userMessage.content,
          sessionId: sessionId,
          model: selectedModel,
          ...(isEdit && { editIndex: editIdx })
        });
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL}/chat`, fetchOptions);
      
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
                if (parsed.chunk.includes('API Key của hệ thống AI (Groq) không hợp lệ') || parsed.chunk.includes('Lỗi hệ thống: API Key')) {
                  setIsApiKeyMissing(true);
                  setLocalError('Vui lòng cung cấp đầy đủ API Key để sử dụng chat');
                  setTimeout(() => setLocalError(''), 5000); // Ẩn lỗi sau 5s
                  
                  setMessages((prev) => {
                    const newMsgs = [...prev];
                    if (isAiMessageAdded) newMsgs.pop(); // Xóa tin nhắn AI bị lỗi
                    if (newMsgs.length > 0 && newMsgs[newMsgs.length - 1].role === 'user') {
                      newMsgs.pop(); // Xóa luôn tin nhắn câu hỏi của User khỏi màn hình
                    }
                    return newMsgs;
                  });
                  setInput(textToSend.trim()); // Trả lại text vào ô input để người dùng không mất công gõ lại
                  
                  setIsLoading(false);
                  newSessionId = null; // Chặn việc tự động chuyển trang sang URL session lỗi
                  break; // Dừng xử lý luồng stream ngay lập tức
                } else if (!parsed.chunk.includes('Lỗi hệ thống')) {
                  setIsApiKeyMissing(false);
                }

                if (!isAiMessageAdded && !parsed.chunk.includes('API Key của hệ thống AI')) {
                  setIsLoading(false);
                  setMessages((prev) => [...prev, { role: 'ai', content: '' }]);
                  isAiMessageAdded = true;
                }

                if (isAiMessageAdded) {
                  aiResponseText += parsed.chunk;
                  setMessages((prev) => {
                    const newMsgs = [...prev];
                    if (newMsgs.length > 0 && newMsgs[newMsgs.length - 1].role === 'ai') {
                      newMsgs[newMsgs.length - 1].content = aiResponseText;
                    }
                    return newMsgs;
                  });
                }
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
        
        <header className="flex justify-end p-4 pt-16 md:p-6 md:pt-6">

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
              <div className={`px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#2a2b30] cursor-pointer text-sm text-gray-700 dark:text-gray-300 transition-colors border-t border-gray-100 dark:border-[#333] ${!isFlowiseConfigured ? 'opacity-60' : ''}`} onClick={() => { 
                if (!isFlowiseConfigured) {
                  setLocalError('Hệ thống chưa được cấu hình URL cho Flowise. Vui lòng cấu hình để sử dụng tính năng này.');
                  setTimeout(() => setLocalError(''), 5000);
                  setShowModelDropdown(false);
                  return;
                }
                  if (!isFlowiseAvailable) {
                    toast.error(t('dashboard.flowiseUnavailable', 'Data analysis system is busy or out of requests. Please try again later!'));
                    setShowModelDropdown(false);
                    return;
                  }
                  setSelectedModel('Data Analyst'); 
                  setShowModelDropdown(false); 
                }}>
                <div className="font-medium text-emerald-600 dark:text-emerald-400 mb-0.5 flex items-center gap-2">
                  Data Analyst
                  {!isFlowiseConfigured && <span className="text-red-500 text-[10px] px-1.5 py-0.5 bg-red-50 dark:bg-red-500/10 rounded-full border border-red-100 dark:border-red-500/20 leading-none">Chưa cấu hình</span>}
                </div>
                  <div className="text-xs text-gray-500">{t('dashboard.modelDataDesc', 'Data analysis (via Flowise)')}</div>
                </div>
              </div>
            )}
            </div>
          )}
        </header>

        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-8 pb-32">
            <div className="text-center mb-8 md:mb-12 px-4 md:px-0">
              <h2 className="text-3xl md:text-5xl font-bold mb-3 md:mb-4 text-blue-600 dark:text-[#d1e5fb]">
                {t('dashboard.greeting', { name: user?.full_name || 'User' })}
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-lg">{t('dashboard.subtitle')}</p>
            </div>

            {isApiKeyMissing ? (
              <div className="w-full max-w-3xl text-center p-6 bg-red-50 dark:bg-red-500/10 rounded-2xl border border-red-200 dark:border-red-500/20">
                <AlertCircle className="mx-auto text-red-500 mb-3" size={32} />
                <h3 className="text-red-700 dark:text-red-400 font-medium text-lg mb-2">Hệ thống chưa sẵn sàng</h3>
                <p className="text-red-600 dark:text-red-300">Vui lòng cung cấp đầy đủ API Key để sử dụng chat</p>
              </div>
            ) : (
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
                <div key={index} className={`flex flex-col w-full group ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {msg.role === 'user' ? (
                      editingIndex === index ? (
                        <div className="flex flex-col items-end w-full gap-2 my-2">
                          <div className="w-full max-w-[85%] md:max-w-[75%] bg-white dark:bg-[#1e1f24] border border-blue-500 rounded-2xl p-3 shadow-sm">
                            <textarea 
                              value={editInput}
                              onChange={(e) => {
                                setEditInput(e.target.value);
                                e.target.style.height = 'auto';
                                e.target.style.height = `${e.target.scrollHeight}px`;
                              }}
                              className="w-full bg-transparent border-none outline-none text-gray-900 dark:text-gray-200 text-[15px] resize-none overflow-y-auto max-h-[200px] custom-scrollbar"
                              rows={1}
                              autoFocus
                              onFocus={(e) => {
                                e.target.style.height = 'auto';
                                e.target.style.height = `${e.target.scrollHeight}px`;
                              }}
                            />
                            <div className="flex justify-end gap-2 mt-3">
                              <button onClick={() => setEditingIndex(null)} className="px-4 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2a2b30] rounded-lg transition-colors">Hủy</button>
                              <button onClick={() => handleSend(editInput, true, index)} className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">Gửi lại</button>
                            </div>
                          </div>
                        </div>
                      ) : (
                      (() => {
                        // Tìm và bóc tách đoạn text đính kèm file ra khỏi nội dung
                        const content = msg.content || '';
                        const fileRegex = /\[📎 File đính kèm: (.*?)\]/g;
                        const fileMatches = [...content.matchAll(fileRegex)];
                        
                        // Tìm và bóc tách hình ảnh base64
                        const imgRegex = /!\[(.*?)\]\((data:image\/[^;]+;base64,[^\)]+)\)/g;
                        const imgMatches = [...content.matchAll(imgRegex)];
                        
                        const contentText = content.replace(fileRegex, '').replace(imgRegex, '').trim();
                        
                        return (
                          <div className="flex flex-col items-end w-full">
                            <div className="flex flex-col items-end gap-2 max-w-[85%] md:max-w-[75%]">
                            {imgMatches.map((match, i) => (
                              <div key={`img-${i}`} className="relative group inline-block">
                                <img 
                                  src={match[2]} 
                                  alt={match[1]} 
                                  className="max-h-64 w-auto rounded-2xl object-contain shadow-sm cursor-zoom-in" 
                                  onClick={() => setFullScreenImage(match[2])}
                                />
                              </div>
                            ))}
                            {(contentText || fileMatches.length > 0) && (
                              <div className="rounded-2xl px-5 py-3.5 text-[15px] leading-relaxed bg-blue-600 text-white rounded-br-sm">
                                {fileMatches.map((match, i) => (
                                  <div key={i} className={`bg-white/20 dark:bg-black/20 text-white rounded-xl p-2 flex items-center gap-3 w-fit shadow-sm border border-white/10 ${contentText ? 'mb-2.5' : ''}`}>
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
                            <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity mt-1.5 mr-2">
                              <button 
                                onClick={() => {
                                  if (!contentText) return;
                                  navigator.clipboard.writeText(contentText);
                                  toast.success('Đã copy tin nhắn!');
                                }} 
                                className="flex items-center gap-1 text-[12px] font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                              >
                                <Copy size={13} /> Copy
                              </button>
                              <button 
                                onClick={() => {
                                  if (!contentText) return;
                                  setEditInput(contentText);
                                  setEditingIndex(index);
                                }} 
                                className="flex items-center gap-1 text-[12px] font-medium text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                              >
                                <Pencil size={13} /> Edit
                              </button>
                            </div>
                          </div>
                        );
                      })()
                      )
                    ) : (
                      <div className="flex flex-col items-start w-full">
                        <div className="max-w-[85%] md:max-w-[75%] rounded-2xl px-5 py-3.5 text-[15px] leading-relaxed bg-white dark:bg-[#1e1f24] text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-[#2a2b30] rounded-bl-sm">
                        <ReactMarkdown
                          rehypePlugins={[rehypeRaw]}
                          components={{
                            p: ({node, ...props}) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
                            ul: ({node, ...props}) => <ul className="list-disc ml-5 mb-2 space-y-1" {...props} />,
                            ol: ({node, ...props}) => <ol className="list-decimal ml-5 mb-2 space-y-1" {...props} />,
                            li: ({node, ...props}) => <li {...props} />,
                            strong: ({node, ...props}) => <strong className="font-semibold" {...props} />,
                            pre: PreBlock,
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
                        </div>
                        <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity mt-1.5 ml-2">
                          <button 
                            onClick={() => {
                              if (!msg.content) return;
                              navigator.clipboard.writeText(msg.content);
                              toast.success('Đã copy phản hồi!');
                            }} 
                            className="flex items-center gap-1 text-[12px] font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                          >
                            <Copy size={13} /> Copy
                          </button>
                        </div>
                      </div>
                    )}
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

        <div className="absolute bottom-0 w-full p-4 md:p-6 flex flex-col items-center bg-gradient-to-t from-gray-50 via-gray-50 dark:from-[#131417] dark:via-[#131417] to-transparent">
          {localError && (
            <div className="mb-4 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 px-4 py-2 rounded-lg border border-red-200 dark:border-red-500/20 text-sm flex items-center gap-2 shadow-sm animate-pulse">
              <AlertCircle size={16} />
              {localError}
            </div>
          )}
          
          <div className="w-full max-w-3xl relative flex flex-col bg-white dark:bg-[#212227] shadow-lg dark:shadow-none rounded-3xl p-2 border border-gray-300 dark:border-[#333] focus-within:border-blue-500 dark:focus-within:border-[#555] transition-colors">
            
            {selectedFile && (
              <div className="px-2 pt-2 pb-1 flex items-center">
                {selectedFile.type.startsWith('image/') ? (
                  <div className="relative group">
                    <img 
                      src={URL.createObjectURL(selectedFile)} 
                      alt="preview" 
                      className="h-16 w-auto max-w-[200px] object-cover rounded-lg border border-gray-200 dark:border-[#333] shadow-sm cursor-zoom-in"
                      onClick={() => setFullScreenImage(URL.createObjectURL(selectedFile))}
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center cursor-zoom-in pointer-events-none">
                      <Eye className="text-white drop-shadow-md" size={20} />
                    </div>
                    <button onClick={() => setSelectedFile(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow-md transition-colors z-10">
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <div className="bg-gray-100 dark:bg-[#2a2b30] border border-gray-200 dark:border-[#333] text-gray-700 dark:text-gray-300 px-3 py-2 rounded-xl text-sm flex items-center gap-2 shadow-sm">
                    <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                      <Paperclip size={14} />
                    </div>
                    <span className="truncate max-w-[150px] md:max-w-[250px] font-medium">{selectedFile.name}</span>
                    <button onClick={() => setSelectedFile(null)} className="ml-1 p-1 hover:bg-gray-200 dark:hover:bg-[#3a3b40] rounded-full transition-colors text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-end w-full">
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
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={(e) => { if (e.target.files[0]) setSelectedFile(e.target.files[0]); }} 
                className="hidden" 
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-3 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
              >
                <Paperclip size={20} />
              </button>
              
              <button 
                onClick={() => handleSend()}
                disabled={(!input.trim() && !selectedFile) || isLoading}
                className={`bg-[#3b82f6] hover:bg-[#2563eb] text-white p-3 rounded-full transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <Send size={20} className="ml-1" /> {/* Thêm ml-1 để icon send căn giữa đẹp hơn */}
              </button>
            </div>
            </div>
          </div>

          <p className="mt-4 text-[11px] text-gray-600 font-mono tracking-wide">
            {t('dashboard.footerNote')}
          </p>
        </div>
      </main>

      {/* Ảnh toàn màn hình */}
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

export default Dashboard;