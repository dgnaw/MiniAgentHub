import React, { useState, useRef, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { ChevronDown, ChevronLeft, Sparkles, Code, Plus, Paperclip, Send, AlertCircle, X, Copy, Check, Eye, Pencil, Square, Key, Settings } from 'lucide-react';
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

  if (React.isValidElement(children)) {
    if (children.props.children) {
      const childData = children.props.children;
      if (Array.isArray(childData)) {
        textContent = childData.join('');
      } else {
        textContent = String(childData);
      }
      textContent = textContent.replace(/\n$/, ''); 
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

const getBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result);
  reader.onerror = error => reject(error);
});

const DEFAULT_GROQ_MODELS = [
  { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', desc: 'Nhanh, nhẹ, xử lý cơ bản' },
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', desc: 'Thông minh, suy luận sâu' },
  { id: 'llama3-70b-8192', name: 'Llama 3 70B', desc: 'Mô hình lớn, độ chính xác cao' },
  { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1', desc: 'Mô hình lập luận logic mạnh mẽ' },
  { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', desc: 'Tốt cho lập trình & đa ngôn ngữ' },
  { id: 'gemma2-9b-it', name: 'Gemma 2 9B', desc: 'Mã nguồn mở từ Google' }
];

const Dashboard = () => {
  useThemeStore();
  const user = useAuthStore((state) => state.user);
  const { t } = useTranslation();
  const { id: sessionId } = useParams(); 
  const navigate = useNavigate();

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('llama-3.1-8b-instant');
  const [groqModels, setGroqModels] = useState(DEFAULT_GROQ_MODELS);
  const [apiKeyChanged, setApiKeyChanged] = useState(0);
  const [apiKeyModalConfig, setApiKeyModalConfig] = useState({ isOpen: false, type: 'groq' });
  const [tempApiKey, setTempApiKey] = useState('');
  const [tempApiUrl, setTempApiUrl] = useState('');
  const [tempExpire, setTempExpire] = useState('never');
  const [showModelDropdown, setShowModelDropdown] = useState(false); 
  const [isFlowiseAvailable, setIsFlowiseAvailable] = useState(true);
  const [isApiKeyMissing, setIsApiKeyMissing] = useState(false);
  const [isFlowiseConfigured, setIsFlowiseConfigured] = useState(true);
  const [localError, setLocalError] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [fullScreenImage, setFullScreenImage] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editInput, setEditInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const abortControllerRef = useRef(null);
  const readerRef = useRef(null); // Giữ tham chiếu reader để có thể cancel ngay lập tức

  const getCustomKey = (type) => {
    const storageKey = type === 'groq' ? 'agentHub_custom_groq_api_key' : 'agentHub_custom_flowise_api_url';
    const key = localStorage.getItem(storageKey) || '';
    const expire = localStorage.getItem(`agentHub_custom_${type}_expire`);
    if (expire && expire !== 'never') {
      const expireTime = parseInt(expire, 10);
      if (Date.now() > expireTime) {
        localStorage.removeItem(storageKey);
        localStorage.removeItem(`agentHub_custom_${type}_expire`);
        localStorage.removeItem(`agentHub_custom_${type}_expire_option`);
        return '';
      }
    }
    return key;
  };

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
        const customGroqKey = getCustomKey('groq');
        const customFlowiseUrl = getCustomKey('flowise');

        const response = await fetch(`${import.meta.env.VITE_API_URL}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-Groq-Api-Key': customGroqKey,
            'X-Flowise-Api-Url': customFlowiseUrl
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
          setSelectedModel((prev) => prev === 'Data Analyst' ? 'llama-3.1-8b-instant' : prev);
        } else {
          setIsFlowiseConfigured(true);
        }

        // Tải danh sách model từ backend
        try {
          const modelsRes = await fetch(`${import.meta.env.VITE_API_URL}/models`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'X-Groq-Api-Key': customGroqKey,
              'X-Flowise-Api-Url': customFlowiseUrl
            }
          });
          if (modelsRes.ok) {
            const modelsList = await modelsRes.json();
            if (Array.isArray(modelsList) && modelsList.length > 0) {
              setGroqModels(modelsList);
              // Kiểm tra xem model đã chọn có nằm trong danh sách tải về không
              setSelectedModel((prev) => {
                if (prev === 'Data Analyst') return prev;
                const exists = modelsList.some(m => m.id === prev);
                return exists ? prev : modelsList[0].id;
              });
            }
          }
        } catch (modelsErr) {
          console.error("Lỗi khi tải danh sách models từ backend:", modelsErr);
        }
      } catch (error) {
      }
    };
    checkApiKeyStatus();
  }, [apiKeyChanged]);

  const openApiKeyModal = (type) => {
    setApiKeyModalConfig({ isOpen: true, type });
    if (type === 'groq') {
      setTempApiKey(getCustomKey('groq'));
      setTempExpire(localStorage.getItem('agentHub_custom_groq_expire_option') || 'never');
    } else {
      setTempApiUrl(getCustomKey('flowise'));
      setTempExpire(localStorage.getItem('agentHub_custom_flowise_expire_option') || 'never');
    }
  };

  const saveApiKeyConfig = () => {
    const type = apiKeyModalConfig.type;
    const storageKey = type === 'groq' ? 'agentHub_custom_groq_api_key' : 'agentHub_custom_flowise_api_url';
    const val = type === 'groq' ? tempApiKey : tempApiUrl;
    
    localStorage.setItem(storageKey, val.trim());
    localStorage.setItem(`agentHub_custom_${type}_expire_option`, tempExpire);

    if (tempExpire === 'never') {
      localStorage.removeItem(`agentHub_custom_${type}_expire`);
    } else {
      let durationMs = 0;
      if (tempExpire === '1h') durationMs = 60 * 60 * 1000;
      else if (tempExpire === '1d') durationMs = 24 * 60 * 60 * 1000;
      else if (tempExpire === '7d') durationMs = 7 * 24 * 60 * 60 * 1000;
      else if (tempExpire === '30d') durationMs = 30 * 24 * 60 * 60 * 1000;
      
      localStorage.setItem(`agentHub_custom_${type}_expire`, (Date.now() + durationMs).toString());
    }

    toast.success(type === 'groq' ? 'Đã lưu cấu hình API Key Groq cá nhân!' : 'Đã lưu cấu hình API URL Flowise cá nhân!');
    setApiKeyModalConfig({ isOpen: false, type: 'groq' });
    setApiKeyChanged(prev => prev + 1);
  };

  const clearApiKeyConfig = () => {
    const type = apiKeyModalConfig.type;
    const storageKey = type === 'groq' ? 'agentHub_custom_groq_api_key' : 'agentHub_custom_flowise_api_url';
    localStorage.removeItem(storageKey);
    localStorage.removeItem(`agentHub_custom_${type}_expire`);
    localStorage.removeItem(`agentHub_custom_${type}_expire_option`);
    
    if (type === 'groq') {
      setTempApiKey('');
    } else {
      setTempApiUrl('');
    }
    toast.success(type === 'groq' ? 'Đã xóa API Key Groq cá nhân.' : 'Đã xóa API URL Flowise cá nhân.');
    setApiKeyModalConfig({ isOpen: false, type: 'groq' });
    setApiKeyChanged(prev => prev + 1);
  };

  const handleStop = () => {
    // Hủy reader trực tiếp để thoát khỏi vòng lặp reader.read() ngay lập tức
    if (readerRef.current) {
      readerRef.current.cancel();
      readerRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  };

  const handleSend = async (customMessage, isEdit = false, editIdx = null) => {
    const textToSend = typeof customMessage === 'string' ? customMessage : input;
    if ((!textToSend.trim() && selectedFiles.length === 0) || isLoading) return;

    // Khởi tạo AbortController cho request này để có thể dừng
    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (selectedModel === 'Data Analyst' && !isFlowiseConfigured) {
      const userMsg = { role: 'user', content: typeof customMessage === 'string' ? customMessage : input };
      const isEnglish = /^[\x00-\x7F\s\p{P}]*$/u.test(userMsg.content.trim());
      const replyText = isEnglish
        ? 'Flowise API URL is not configured. Please provide the URL and try again.'
        : 'Chưa cấu hình URL cho Flowise. Vui lòng cấu hình để sử dụng mô hình này.';
      setMessages((prev) => [...prev, userMsg, { role: 'ai', content: replyText }]);
      setInput('');
      setSelectedFiles([]);
      return;
    }

    // Nếu API Key chưa được cấu hình, hiển thị thông báo ngắn trong khung chat
    if (isApiKeyMissing) {
      const userMsg = { role: 'user', content: typeof customMessage === 'string' ? customMessage : input };
      // Detect ngôn ngữ: nếu phần lớn ký tự là ASCII (tiếng Anh) thì dùng EN, ngược lại VI
      const isEnglish = /^[\x00-\x7F\s\p{P}]*$/u.test(userMsg.content.trim());
      const replyText = isEnglish
        ? 'No key found. Please provide a key and try again.'
        : 'Chưa tìm thấy key. Vui lòng cung cấp key và thử lại.';
      setMessages((prev) => [...prev, userMsg, { role: 'ai', content: replyText }]);
      setInput('');
      setSelectedFiles([]);
      return;
    }

    let finalContent = textToSend.trim();
    if (selectedFiles.length > 0 && !isEdit) {
      let filesMarkdown = '';
      for (const file of selectedFiles) {
        const safeName = file.name.replace(/[\\]/g, '_');
        if (file.type.startsWith('image/')) {
          const base64 = await getBase64(file);
          filesMarkdown += `![${safeName}](${base64})\n\n`;
        } else {
          filesMarkdown += `[📎 File đính kèm: ${safeName}]\n\n`;
        }
      }
      finalContent = finalContent ? `${filesMarkdown}${finalContent}` : filesMarkdown.trim();
    }

    const userMessage = { role: 'user', content: finalContent };
    if (isEdit) {
      setMessages((prev) => [...prev.slice(0, editIdx), userMessage]);
      setEditingIndex(null);
    } else {
      setMessages((prev) => [...prev, userMessage]);
      setInput('');
      setSelectedFiles([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'; // Reset chiều cao khung chat sau khi gửi
      }
    }
    setIsLoading(true);
    setLocalError('');

    try {
      const token = localStorage.getItem('agentHub_token');
      
      const customGroqKey = getCustomKey('groq');
      const customFlowiseUrl = getCustomKey('flowise');

      let fetchOptions = {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'X-Groq-Api-Key': customGroqKey,
          'X-Flowise-Api-Url': customFlowiseUrl
        },
        signal: controller.signal
      };

      if (selectedFiles.length > 0 && !isEdit) {
        const formData = new FormData();
        const messageToSend = userMessage.content.replace(/!\[(.*?)\]\(data:image\/[^;]+;base64,[^\)]+\)/g, '[🖼️ Hình ảnh đính kèm: $1]');
        formData.append('message', messageToSend);
        formData.append('sessionId', sessionId || '');
        formData.append('model', selectedModel);
        selectedFiles.forEach(f => formData.append('files', f)); // Nạp toàn bộ file vào formData
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
        let errMsg = 'Server connection error';
        try {
          const errJson = await response.json();
          if (errJson && errJson.message) {
            errMsg = errJson.message;
          }
        } catch (_) {}
        throw new Error(errMsg);
      }

      const reader = response.body.getReader(); // đọc dữ liệu -> trả về -> chunks
      readerRef.current = reader;
      const decoder = new TextDecoder('utf-8');
      let aiResponseText = '';
      let buffer = '';
      let newSessionId = null;
      let isAiMessageAdded = false;
      let stopped = false;
      let isDone = false;

      try {
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
              if (dataStr === '[DONE]') { isDone = true; break; }
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.sessionId) {
                  newSessionId = parsed.sessionId;
                }
                if (parsed.flowiseUnavailable) {
                  setIsFlowiseAvailable(false);
                  setSelectedModel('llama-3.1-8b-instant');
                  // Thêm cảnh báo vào ngay đầu tin nhắn AI
                  if (!isAiMessageAdded) {
                    setMessages((prev) => [...prev, { role: 'ai', content: '' }]);
                    isAiMessageAdded = true;
                  }
                  aiResponseText += "*(Hệ thống phân tích dữ liệu đang bận hoặc lỗi, tự động chuyển sang AI thường)*\n\n";
                }
                if (parsed.chunk) {
                  // Kiểm tra chunk có phải lỗi API Key không để cập nhật trạng thái UI
                  if (parsed.chunk.includes('No key found') || parsed.chunk.includes('API Key')) {
                    setIsApiKeyMissing(true);
                  } else if (!parsed.chunk.includes('Lỗi hệ thống')) {
                    setIsApiKeyMissing(false);
                  }

                  // Thêm tin nhắn AI trống vào danh sách khi nhận token đầu tiên
                  if (!isAiMessageAdded) {
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
              } catch (e) {}
            }
          }
          if (stopped || isDone) break;
        }
      } catch (readErr) {
        // reader.cancel() được gọi từ handleStop -> ném lỗi ở đây, bỏ qua
        if (readErr.name !== 'AbortError' && readErr.message !== 'BodyStreamBuffer was aborted') {
          console.warn('Stream reader bị ngắt:', readErr.message);
        }
      } finally {
        readerRef.current = null;
      }

      if (newSessionId && !sessionId) {
        navigate(`/chat/${newSessionId}`);
      }
    } catch (error) {
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        // Người dùng bấm nút Dừng - không làm gì thêm, UI đã được cập nhật bởi handleStop
        return;
      }

      console.error("Lỗi khi chat:", error);
      
      setMessages((prev) => [
        ...prev,
        { role: 'ai', content: `**Lỗi hệ thống:** ${error.message || 'Đã xảy ra lỗi khi kết nối server.'}` }
      ]);

      if (isEdit) {
        setEditInput(textToSend.trim());
        setEditingIndex(editIdx);
      } else {
        setInput(textToSend.trim());
      }
      
      setLocalError(error.message || 'Đã xảy ra lỗi khi kết nối server.');
      setTimeout(() => setLocalError(''), 7000);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Drag and Drop Handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files);
      setSelectedFiles(prev => [...prev, ...newFiles].slice(0, 10)); // Giới hạn lấy 10 file
    }
  };

  const removeFile = (indexToRemove) => {
    setSelectedFiles(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  return (
    <div 
      className="flex h-screen bg-gray-50 dark:bg-[#131417] text-gray-900 dark:text-white font-sans overflow-hidden transition-colors relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      
      <Sidebar />

      {/* Overlay Dropzone Visual */}
      {isDragging && (
        <div className="absolute inset-0 z-[60] bg-blue-500/10 backdrop-blur-sm border-4 border-blue-500 border-dashed m-4 rounded-3xl flex items-center justify-center pointer-events-none transition-all duration-200">
            <div className="bg-white dark:bg-[#1e1f24] p-8 rounded-2xl shadow-2xl flex flex-col items-center">
                <Paperclip size={48} className="text-blue-500 mb-4 animate-bounce" />
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Thả file vào đây</h3>
                <p className="text-gray-500 mt-2">Hỗ trợ đính kèm tối đa 10 files cùng lúc</p>
            </div>
        </div>
      )}

      <main className="flex-1 flex flex-col relative">
        
        <header className="flex justify-end p-4 pt-16 md:p-6 md:pt-6">

          <div className="relative">
            <button 
              onClick={() => setShowModelDropdown(!showModelDropdown)}
              className="flex items-center gap-2 bg-white dark:bg-[#1e1f23] border border-gray-200 dark:border-[#333] hover:bg-gray-100 dark:hover:bg-[#2a2b30] text-gray-700 dark:text-gray-300 shadow-sm dark:shadow-none px-4 py-2 rounded-full text-sm font-medium transition-colors"
            >
              {selectedModel === 'Data Analyst' 
                ? 'Data Analyst (Flowise)' 
                : `${groqModels.find(m => m.id === selectedModel)?.name || 'Llama 3.1 8B'} (Groq)`}
              <ChevronDown size={16} className="text-gray-400" />
            </button>

            {showModelDropdown && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#1e1f23] border border-gray-200 dark:border-[#333] rounded-xl shadow-lg z-[80]">
                {/* Groq Model group with hover state */}
                <div className="group relative">
                  <div className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#2a2b30] cursor-pointer text-sm text-gray-700 dark:text-gray-300 transition-colors flex items-center justify-between rounded-t-xl">
                    <div className="flex-1">
                      <div className="font-medium text-blue-600 dark:text-blue-400 mb-0.5">Groq Models</div>
                      <div className="text-xs text-gray-500">General chat models</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 pl-2">
                      <div className="relative group/tooltip flex items-center justify-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openApiKeyModal('groq');
                          }}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-white/10 rounded transition-colors text-gray-400 hover:text-blue-500"
                        >
                          <Settings size={14} />
                        </button>
                        {/* Tooltip */}
                        <div className="absolute bottom-full mb-1.5 left-1/2 transform -translate-x-1/2 hidden group-hover/tooltip:block bg-gray-950 dark:bg-gray-800 text-white text-[10px] py-1 px-2 rounded-lg shadow-xl whitespace-nowrap z-[100] border border-gray-200 dark:border-gray-700/50">
                          Set API Key
                        </div>
                      </div>
                      <ChevronLeft size={16} className="text-gray-400" />
                    </div>
                  </div>
                  
                  {/* Submenu for Groq versions to the left */}
                  <div className="absolute top-0 right-[calc(100%+8px)] hidden group-hover:block w-64 bg-white dark:bg-[#1e1f23] border border-gray-200 dark:border-[#333] rounded-xl shadow-lg py-1 z-[90]">
                    {groqModels.map((model) => (
                      <div 
                        key={model.id}
                        onClick={() => { 
                          setSelectedModel(model.id); 
                          setShowModelDropdown(false); 
                        }}
                        className={`px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-[#2a2b30] cursor-pointer text-sm transition-colors ${selectedModel === model.id ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                      >
                        <div className={`font-medium ${selectedModel === model.id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                          {model.name}
                        </div>
                        <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 leading-snug">
                          {model.desc}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Data Analyst (Flowise) */}
                <div 
                  className={`px-4 py-3 text-sm text-gray-700 dark:text-gray-300 transition-colors border-t border-gray-100 dark:border-[#333] rounded-b-xl flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[#2a2b30] cursor-pointer`}
                  onClick={() => { 
                    if (!isFlowiseAvailable) {
                      toast.error(t('dashboard.flowiseUnavailable', 'Data analysis system is busy or out of requests. Please try again later!'));
                      setShowModelDropdown(false);
                      return;
                    }
                    setSelectedModel('Data Analyst'); 
                    setShowModelDropdown(false); 
                  }}
                >
                  <div className="flex-1">
                    <div className={`font-medium text-emerald-600 dark:text-emerald-400 mb-0.5 flex items-center gap-2 ${!isFlowiseAvailable ? 'line-through' : ''}`}>
                      Data Analyst
                    </div>
                    <div className="text-xs text-gray-500">{t('dashboard.modelDataDesc', 'Data analysis (via Flowise)')}</div>
                    {!isFlowiseAvailable && (
                      <div className="text-xs text-red-500 mt-1">{t('dashboard.flowiseBusy', 'Đã hết lượt hoặc đang bận.')}</div>
                    )}
                  </div>
                  <div className="relative group/tooltip flex items-center justify-center shrink-0 ml-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openApiKeyModal('flowise');
                      }}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-white/10 rounded transition-colors text-gray-400 hover:text-emerald-500"
                    >
                      <Settings size={14} />
                    </button>
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-1.5 left-1/2 transform -translate-x-1/2 hidden group-hover/tooltip:block bg-gray-950 dark:bg-gray-800 text-white text-[10px] py-1 px-2 rounded-lg shadow-xl whitespace-nowrap z-[100] border border-gray-200 dark:border-gray-700/50">
                      Set API Key
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </header>

        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-8 pb-32">
            <div className="text-center mb-8 md:mb-12 px-4 md:px-0">
              <h2 className="text-3xl md:text-5xl font-bold mb-3 md:mb-4 text-blue-600 dark:text-[#d1e5fb]">
                {t('dashboard.greeting', { name: user?.full_name || 'User' })}
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-lg">{t('dashboard.subtitle')}</p>
            </div>

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
                              maxLength={5000}
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
                              <button onClick={() => {
                                const originalContent = messages[index].content || '';
                                const fileRegex = /\[📎 File đính kèm: (.*?)\]/g;
                                const imgRegex = /!\[(.*?)\]\(([^)]+)\)/g;
                                
                                const files = [...originalContent.matchAll(fileRegex)].map(m => m[0]);
                                const imgs = [...originalContent.matchAll(imgRegex)].map(m => m[0]);
                                
                                let finalEdit = editInput.trim();
                                if (files.length > 0) finalEdit = `${files.join('\n')}\n\n${finalEdit}`;
                                if (imgs.length > 0) finalEdit = `${imgs.join('\n')}\n\n${finalEdit}`;
                                
                                handleSend(finalEdit.trim(), true, index);
                              }} className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">Gửi lại</button>
                            </div>
                          </div>
                        </div>
                      ) : (
                      (() => {
                        // Tìm và bóc tách đoạn text đính kèm file ra khỏi nội dung
                        const content = msg.content || '';
                        const fileRegex = /\[📎 File đính kèm: (.*?)\]/g;
                        const fileMatches = [...content.matchAll(fileRegex)];
                        
                        // Tìm và bóc tách hình ảnh
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
                              <button onClick={() => { if (!contentText) return; navigator.clipboard.writeText(contentText); toast.success('Đã copy tin nhắn!'); }} className="flex items-center gap-1 text-[12px] font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"><Copy size={13} /> Copy</button>
                              <button onClick={() => { setEditInput(contentText); setEditingIndex(index); }} className="flex items-center gap-1 text-[12px] font-medium text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"><Pencil size={13} /> Edit</button>
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
                            code: ({node, inline, ...props}) => inline ? <code className="bg-black/10 dark:bg-white/10 text-red-600 dark:text-red-400 rounded px-1.5 py-0.5 text-sm font-mono" {...props} /> : <code {...props} />,
                            a: ({node, ...props}) => <a className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
                            img: ({node, src, alt, ...props}) => {
                              const backendUrl = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '') : '';
                              const finalSrc = src?.startsWith('/api/uploads') ? `${backendUrl}${src}` : src;
                              return <img src={finalSrc} alt={alt} className="max-w-full max-h-96 object-contain rounded-lg border border-gray-200 dark:border-[#333] shadow-sm my-2 cursor-zoom-in" onClick={() => window.open(finalSrc, '_blank')} {...props} />;
                            },
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
            
            {selectedFiles.length > 0 && (
              <div className="px-3 pt-3 pb-1 flex items-center gap-3 flex-wrap max-h-32 overflow-y-auto custom-scrollbar">
                {selectedFiles.map((file, idx) => (
                  file.type.startsWith('image/') ? (
                    <div key={idx} className="relative group shrink-0">
                      <img 
                        src={URL.createObjectURL(file)} 
                        alt="preview" 
                        className="h-16 w-16 object-cover rounded-lg border border-gray-200 dark:border-[#333] shadow-sm cursor-zoom-in"
                        onClick={() => setFullScreenImage(URL.createObjectURL(file))}
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center cursor-zoom-in pointer-events-none">
                        <Eye className="text-white drop-shadow-md" size={16} />
                      </div>
                      <button onClick={() => removeFile(idx)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow-md transition-colors z-10">
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <div key={idx} className="bg-gray-100 dark:bg-[#2a2b30] border border-gray-200 dark:border-[#333] text-gray-700 dark:text-gray-300 px-3 py-2 rounded-xl text-sm flex items-center gap-2 shadow-sm shrink-0 max-w-[200px]">
                      <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                        <Paperclip size={14} />
                      </div>
                      <span className="truncate font-medium">{file.name}</span>
                      <button onClick={() => removeFile(idx)} className="ml-1 p-1 hover:bg-gray-200 dark:hover:bg-[#3a3b40] rounded-full transition-colors text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                        <X size={14} />
                      </button>
                    </div>
                  )
                ))}
              </div>
            )}

            <div className="flex items-end w-full">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="p-3 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors shrink-0"
            >
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
              maxLength={5000}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder={t('dashboard.promptPlaceholder')} 
              className="flex-1 bg-transparent border-none outline-none text-gray-900 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 px-2 py-3 text-base resize-none overflow-y-auto max-h-[200px] custom-scrollbar"
            />

            <div className="flex items-center gap-2 pr-1 shrink-0 pb-0.5">
              <input 
                type="file" 
                multiple
                ref={fileInputRef} 
                onChange={(e) => { 
                  if (e.target.files && e.target.files.length > 0) { 
                    const newFiles = Array.from(e.target.files);
                    setSelectedFiles(prev => [...prev, ...newFiles].slice(0, 10));
                  } 
                  e.target.value = null; // Reset input để có thể chọn lại file vừa chọn
                }} 
                className="hidden" 
              />
              
              {isLoading ? (
                <button 
                  onClick={handleStop}
                  className="bg-red-500 hover:bg-red-600 text-white p-3 rounded-full transition-colors flex items-center justify-center shadow-md animate-pulse shrink-0"
                >
                  <Square size={20} fill="currentColor" className="text-white" />
                </button>
              ) : (
                <button 
                  onClick={() => handleSend()}
                  disabled={!input.trim() && selectedFiles.length === 0}
                  className="bg-[#3b82f6] hover:bg-[#2563eb] text-white p-3 rounded-full transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                  <Send size={20} className="ml-1 text-white" />
                </button>
              )}
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

      {/* ApiKeyModal - LibreChat Style */}
      {apiKeyModalConfig.isOpen && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1e1f23] border border-gray-200 dark:border-[#333] w-full max-w-md rounded-2xl shadow-2xl p-6 relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setApiKeyModalConfig({ isOpen: false, type: 'groq' })}
              className="absolute top-4 right-4 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 rounded-full p-2 transition-colors"
            >
              <X size={16} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className={`p-3 rounded-xl ${apiKeyModalConfig.type === 'groq' ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>
                <Settings size={20} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {apiKeyModalConfig.type === 'groq' ? t('dashboard.configApiKeyGroq', 'Cấu hình API Key (Groq)') : t('dashboard.configApiUrlFlowise', 'Cấu hình API URL (Flowise)')}
              </h3>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-5 leading-relaxed">
              {apiKeyModalConfig.type === 'groq' 
                ? t('dashboard.configApiKeyGroqDesc', 'Nhập API Key Groq cá nhân của bạn để sử dụng các model Llama, Mixtral... Key được lưu trực tiếp trên trình duyệt (localStorage) của bạn và không lưu trên cơ sở dữ liệu server.')
                : t('dashboard.configApiUrlFlowiseDesc', 'Nhập địa chỉ URL Prediction API của Flowise để thực hiện phân tích dữ liệu chuyên sâu. URL được lưu trực tiếp trên trình duyệt của bạn.')}
            </p>

            <div className="space-y-4 mb-6">
              {apiKeyModalConfig.type === 'groq' ? (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{t('dashboard.groqApiKeyLabel', 'Groq API Key')}</label>
                  <input 
                    type="password"
                    value={tempApiKey}
                    onChange={(e) => setTempApiKey(e.target.value)}
                    placeholder="gsk_..."
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-[#131417] border border-gray-200 dark:border-[#333] rounded-xl text-sm outline-none focus:border-blue-500 dark:focus:border-blue-500 transition-colors text-gray-900 dark:text-white placeholder-gray-400"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{t('dashboard.flowiseApiUrlLabel', 'Flowise API Endpoint URL')}</label>
                  <input 
                    type="text"
                    value={tempApiUrl}
                    onChange={(e) => setTempApiUrl(e.target.value)}
                    placeholder="http://localhost:3000/api/v1/prediction/..."
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-[#131417] border border-gray-200 dark:border-[#333] rounded-xl text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-500 transition-colors text-gray-900 dark:text-white placeholder-gray-400"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{t('dashboard.expireLabel', 'Thời gian hết hạn (Expire)')}</label>
                <select
                  value={tempExpire}
                  onChange={(e) => setTempExpire(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-[#131417] border border-gray-200 dark:border-[#333] rounded-xl text-sm outline-none focus:border-blue-500 dark:focus:border-blue-500 transition-colors text-gray-900 dark:text-white"
                >
                  <option value="never">{t('dashboard.expireNever', 'Không bao giờ hết hạn')}</option>
                  <option value="1h">{t('dashboard.expire1h', 'Sau 1 giờ')}</option>
                  <option value="1d">{t('dashboard.expire1d', 'Sau 1 ngày')}</option>
                  <option value="7d">{t('dashboard.expire7d', 'Sau 7 ngày')}</option>
                  <option value="30d">{t('dashboard.expire30d', 'Sau 30 ngày')}</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 justify-end items-center">
              <button 
                onClick={clearApiKeyConfig}
                className="px-4 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors"
              >
                {t('dashboard.clearConfig', 'Xóa cấu hình')}
              </button>
              <div className="flex gap-2">
                <button 
                  onClick={() => setApiKeyModalConfig({ isOpen: false, type: 'groq' })}
                  className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#26272b] rounded-xl transition-colors"
                >
                  {t('dashboard.cancel', 'Hủy')}
                </button>
                <button 
                  onClick={saveApiKeyConfig}
                  className={`px-5 py-2.5 text-sm font-medium text-white rounded-xl shadow-md transition-all active:scale-95 ${apiKeyModalConfig.type === 'groq' ? 'bg-[#3b82f6] hover:bg-[#2563eb]' : 'bg-[#10b981] hover:bg-[#059669]'}`}
                >
                  {t('dashboard.saveConfig', 'Lưu cấu hình')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;