import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCustomKey } from '../components/ApiKeyModal';
import axiosClient from '../services/axiosClient';

const getBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result);
  reader.onerror = error => reject(error);
});

export const useChatStream = (sessionId, selectedModel, setSelectedModel, apiKeyChanged, setGroqModels) => {
  const navigate = useNavigate();

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editInput, setEditInput] = useState('');
  const [isFlowiseAvailable, setIsFlowiseAvailable] = useState(true);
  const [isFlowiseConfigured, setIsFlowiseConfigured] = useState(true);
  const [isApiKeyMissing, setIsApiKeyMissing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const abortControllerRef = useRef(null);
  const readerRef = useRef(null);
  const textareaRef = useRef(null);
  const isStoppedRef = useRef(false);

  const handleStop = () => {
    if (readerRef.current) {
      readerRef.current.cancel();
      readerRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    isStoppedRef.current = true;
    setIsLoading(false);
  };

  const handleSend = async (customMessage, isEdit = false, editIdx = null) => {
    const textToSend = typeof customMessage === 'string' ? customMessage : input;
    if ((!textToSend.trim() && selectedFiles.length === 0) || isLoading) return;

    isStoppedRef.current = false;
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

    if (isApiKeyMissing) {
      const userMsg = { role: 'user', content: typeof customMessage === 'string' ? customMessage : input };
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
        textareaRef.current.style.height = 'auto';
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
        selectedFiles.forEach(f => formData.append('files', f));
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
        } catch (_) { }
        throw new Error(errMsg);
      }

      const reader = response.body.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder('utf-8');
      let aiResponseText = '';
      let buffer = '';
      let newSessionId = null;
      let isAiMessageAdded = false;
      let isDone = false;

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

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
                  if (!isAiMessageAdded) {
                    setMessages((prev) => [...prev, { role: 'ai', content: '' }]);
                    isAiMessageAdded = true;
                  }
                  aiResponseText += "*(Hệ thống phân tích dữ liệu đang bận hoặc lỗi, tự động chuyển sang AI thường)*\n\n";
                }
                if (parsed.chunk) {
                  if (parsed.chunk.includes('No key found') || parsed.chunk.includes('API Key')) {
                    setIsApiKeyMissing(true);
                  } else if (!parsed.chunk.includes('Lỗi hệ thống')) {
                    setIsApiKeyMissing(false);
                  }

                  if (!isAiMessageAdded) {
                    setMessages((prev) => [...prev, { role: 'ai', content: '' }]);
                    isAiMessageAdded = true;
                  }

                  if (isAiMessageAdded) {
                    const words = parsed.chunk.match(/\S+|\s+/g) || [];
                    for (const word of words) {
                      if (isStoppedRef.current || isDone) break;

                      aiResponseText += word;
                      setMessages((prev) => {
                        const newMsgs = [...prev];
                        if (newMsgs.length > 0 && newMsgs[newMsgs.length - 1].role === 'ai') {
                          newMsgs[newMsgs.length - 1].content = aiResponseText;
                        }
                        return newMsgs;
                      });

                      const delayTime = selectedModel === 'Data Analyst' ? 10 : 10;
                      await new Promise(resolve => setTimeout(resolve, delayTime));
                    }
                  }
                }
              } catch (e) { }
            }
          }
          if (isStoppedRef.current || isDone) break;
        }
      } catch (readErr) {
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

  // Drag and Drop
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
      setSelectedFiles(prev => [...prev, ...newFiles].slice(0, 10));
    }
  };
  const removeFile = (indexToRemove) => {
    setSelectedFiles(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

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
              setSelectedModel((prev) => {
                if (prev === 'Data Analyst') return prev;
                const exists = modelsList.some(m => m.id === prev);
                return exists ? prev : modelsList[0].id;
              });
            }
          }
        } catch (modelsErr) {
          console.error("Lỗi khi tải danh sách models:", modelsErr);
        }
      } catch (error) {
      }
    };
    checkApiKeyStatus();
  }, [apiKeyChanged, setGroqModels, setSelectedModel]);

  useEffect(() => {
    const handleRegenerateEvent = (e) => {
      const aiIndex = e.detail.index;
      const userIndex = aiIndex - 1;
      if (userIndex >= 0 && messages[userIndex] && messages[userIndex].role === 'user') {
        handleSend(messages[userIndex].content, true, userIndex);
      }
    };
    window.addEventListener('regenerate-message', handleRegenerateEvent);
    return () => window.removeEventListener('regenerate-message', handleRegenerateEvent);
  }, [messages, handleSend]);

  return {
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
    handleSend, handleStop, handleKeyDown,
    handleDragOver, handleDragLeave, handleDrop, removeFile
  };
};
