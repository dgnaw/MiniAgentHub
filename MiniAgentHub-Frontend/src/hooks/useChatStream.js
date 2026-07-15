import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../services/axiosClient';
import useGenerationStore from '../store/useGenerationStore';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

const getBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result);
  reader.onerror = error => reject(error);
});

export const useChatStream = (sessionId, selectedModel, setSelectedModel, apiKeyChanged, setGroqModels) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  // isLoading được derive trực tiếp từ Zustand — không dùng local state để tránh race condition
  const isLoading = useGenerationStore(state => state.generatingSessions.has(sessionId));
  const [localError, setLocalError] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editInput, setEditInput] = useState('');
  const [isFlowiseAvailable, setIsFlowiseAvailable] = useState(true);
  const [isFlowiseConfigured, setIsFlowiseConfigured] = useState(true);
  const [isApiKeyMissing, setIsApiKeyMissing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [triggerReload, setTriggerReload] = useState(0);
  
  const [chatPage, setChatPage] = useState(1);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  
  const currentSessionIdRef = useRef(sessionId);
  const activeSessionIdRef = useRef(sessionId);
  useEffect(() => { 
    currentSessionIdRef.current = sessionId; 
    activeSessionIdRef.current = sessionId;
    
    // Abort bất kỳ reconnect stream nào đang chạy khi chuyển conversation
    // Điều này giải phóng HTTP connection slot, tránh trường hợp bấm nhiều lần mới chuyển được
    if (readerRef.current) {
      readerRef.current.cancel().catch(() => {});
      readerRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    setInput('');
    setSelectedFiles([]);
  }, [sessionId]);
  
  const isUnmountedRef = useRef(false);
  useEffect(() => {
    isUnmountedRef.current = false;
    return () => { isUnmountedRef.current = true; };
  }, []);
  
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
    
    const targetSessionId = activeSessionIdRef.current;
    if (targetSessionId) {
      useGenerationStore.getState().stopGeneration(targetSessionId);
      
      const currentMsgs = latestMessages.current;
      if (currentMsgs && currentMsgs.length > 0 && currentMsgs[currentMsgs.length - 1].role === 'ai') {
        const stopLabel = `\n\n${t('chat.generationStoppedByUser')}`;
        const truncatedContent = currentMsgs[currentMsgs.length - 1].content + stopLabel;
        
        setMessages(prev => {
          const newMsgs = [...prev];
          if (newMsgs.length > 0 && newMsgs[newMsgs.length - 1].role === 'ai') {
            newMsgs[newMsgs.length - 1].content = truncatedContent;
          }
          return newMsgs;
        });

        setTimeout(async () => {
          try {
            await axiosClient.put(`/chat-sessions/${targetSessionId}/truncate-last-message`, {
              content: truncatedContent
            });
          } catch (error) {
            console.error('Lỗi khi truncate tin nhắn AI:', error);
          }
        }, 1000);
      }
    }
  };

  const handleSend = async (customMessage, isEdit = false, editIdx = null) => {
    const textToSend = typeof customMessage === 'string' ? customMessage : input;
    if ((!textToSend.trim() && selectedFiles.length === 0) || isLoading) return;

    isStoppedRef.current = false;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const originalSessionId = sessionId;
    useGenerationStore.getState().addGeneration(originalSessionId, controller);

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
    
    const isLastMessage = isEdit && (editIdx >= messages.length - 2);

    if (isLastMessage) {
      setMessages((prev) => [...prev.slice(0, editIdx), userMessage]);
      setEditingIndex(null);
    } else if (isEdit) {
      setMessages((prev) => [...prev, userMessage]);
      setEditingIndex(null);
    } else {
      setMessages((prev) => [...prev, userMessage]);
      setInput('');
      setSelectedFiles([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
    setLocalError('');

    let newSessionId = null;
    let isDetached = false;
    let isDone = false;
    let didAutoNavigate = false;

    try {
      let fetchOptions = {
        method: 'POST',
        credentials: 'include',
        headers: {},
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
          ...(isLastMessage && { editIndex: editIdx })
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
        } catch (_) {
          console.warn("Không thể parse JSON phản hồi lỗi từ server.");
        }
        throw new Error(errMsg);
      }

      const reader = response.body.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder('utf-8');
      let aiResponseText = '';
      let buffer = '';
      let isAiMessageAdded = false;
      isDone = false;

      try {
        while (true) {
          if (
            (currentSessionIdRef.current !== originalSessionId && currentSessionIdRef.current !== newSessionId) ||
            isUnmountedRef.current
          ) {
             isDetached = true;
             if (abortControllerRef.current) {
                 abortControllerRef.current.abort();
             }
             break;
          }

          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.replace('data: ', '').trim();
              if (dataStr === '[DONE]') { isDone = true; break; }
              let streamError = null;
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.sessionId) {
                  newSessionId = parsed.sessionId;
                  activeSessionIdRef.current = parsed.sessionId;
                  if (!sessionId) {
                    useGenerationStore.getState().removeGeneration(undefined);
                    useGenerationStore.getState().addGeneration(newSessionId, controller);
                    window.dispatchEvent(new CustomEvent('sessions-updated'));
                  }
                }
                if (parsed.error) {
                  streamError = parsed.error;
                }
                if (parsed.flowiseUnavailable) {
                  if (currentSessionIdRef.current === originalSessionId && !isDetached) {
                    setIsFlowiseAvailable(false);
                    setSelectedModel('llama-3.1-8b-instant');
                    if (!isAiMessageAdded) {
                      setMessages((prev) => [...prev, { role: 'ai', content: '' }]);
                      isAiMessageAdded = true;
                    }
                  } else {
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
                    if ((currentSessionIdRef.current === originalSessionId || currentSessionIdRef.current === newSessionId) && !isDetached) {
                        setMessages((prev) => [...prev, { role: 'ai', content: '' }]);
                    }
                    isAiMessageAdded = true;
                  }

                  if (isAiMessageAdded) {
                    const words = parsed.chunk.match(/\S+|\s+/g) || [];
                    for (const word of words) {
                      if (isStoppedRef.current || isDone) break;

                      aiResponseText += word;
                      if ((currentSessionIdRef.current === originalSessionId || currentSessionIdRef.current === newSessionId) && !isDetached) {
                          setMessages((prev) => {
                            const newMsgs = [...prev];
                            if (newMsgs.length > 0 && newMsgs[newMsgs.length - 1].role === 'ai') {
                              newMsgs[newMsgs.length - 1].content = aiResponseText;
                            }
                            return newMsgs;
                          });
                      }

                      if (!isDetached) {
                        const delayTime = selectedModel === 'Data Analyst' ? 5 : 5;
                        await new Promise(resolve => setTimeout(resolve, delayTime));
                      }
                    }
                  }
                }
              } catch (e) {
                console.debug("Bỏ qua dòng dữ liệu stream lỗi parse JSON:", e.message);
              }
              if (streamError) {
                  throw new Error(streamError);
              }
            }
          }
          if (isStoppedRef.current || isDone) break;
        }
      } catch (readErr) {
        if (readErr.name !== 'AbortError' && readErr.message !== 'BodyStreamBuffer was aborted') {
          console.warn('Stream reader bị ngắt:', readErr.message);
          throw readErr;
        }
      } finally {
        readerRef.current = null;
      }

      didAutoNavigate = false;
      if (!isDetached && newSessionId && !sessionId) {
        navigate(`/chat/${newSessionId}`);
        didAutoNavigate = true;
      }
    } catch (error) {
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        return;
      }
      console.error("Lỗi khi chat:", error);
      
      const errorMsg = error.message || 'Đã xảy ra lỗi khi kết nối server.';
      
      // Hiển thị lỗi thẳng vào khung chat AI thay vì toast
      setMessages((prev) => {
        const newMsgs = [...prev];
        if (newMsgs.length > 0 && newMsgs[newMsgs.length - 1].role === 'ai') {
          newMsgs[newMsgs.length - 1].content = newMsgs[newMsgs.length - 1].content + `\n\n*(Lỗi: ${errorMsg})*`;
        } else {
          newMsgs.push({ role: 'ai', content: `*(Lỗi: ${errorMsg})*` });
        }
        return newMsgs;
      });

      if (isEdit) {
        setEditInput(textToSend.trim());
        setEditingIndex(editIdx);
      } else {
        setInput(textToSend.trim());
      }
    } finally {
      const targetSessionId = newSessionId || originalSessionId;
      const isActuallyDetached = isDetached || isUnmountedRef.current || currentSessionIdRef.current !== targetSessionId;

      if (!isActuallyDetached) {
        useGenerationStore.getState().removeGeneration(originalSessionId);
        if (newSessionId) useGenerationStore.getState().removeGeneration(newSessionId);
      }

      const finalPath = window.location.pathname;
      const isPathDetached = !didAutoNavigate && targetSessionId && finalPath !== `/chat/${targetSessionId}`;
      const shouldShowToast = isActuallyDetached || isPathDetached;

      if (shouldShowToast && isDone) {
        toast.success(
          t('chat.generationComplete'),
          { duration: 7000, position: 'top-right', id: `gen-complete-${targetSessionId}` }
        );
        
        if (currentSessionIdRef.current === targetSessionId) {
          window.dispatchEvent(new CustomEvent('reload-messages', { detail: targetSessionId }));
        }
      }

      // Cập nhật lại danh sách conversation trong sidebar sau mỗi lần chat xong
      if (isDone) {
        window.dispatchEvent(new CustomEvent('sessions-updated'));
      }
      
      if (!shouldShowToast) {
        abortControllerRef.current = null;
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

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
    const handleReload = (e) => {
      if (e.detail === sessionId) {
        setTriggerReload(prev => prev + 1);
      }
    };
    window.addEventListener('reload-messages', handleReload);
    return () => window.removeEventListener('reload-messages', handleReload);
  }, [sessionId]);

  const reconnectToStream = async (targetSessionId) => {
    isStoppedRef.current = false;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    useGenerationStore.getState().addGeneration(targetSessionId, controller);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/chat/stream/${targetSessionId}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        },
        signal: controller.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[reconnect] Backend trả về lỗi:', response.status, errorText);
        if (response.status === 404) {
          console.log('[reconnect] Stream đã hoàn tất, reload messages...');
          useGenerationStore.getState().removeGeneration(targetSessionId);
          setTriggerReload(prev => prev + 1);
          return;
        }
        throw new Error(`Không thể kết nối lại: ${response.status}`);
      }

      const reader = response.body.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder('utf-8');
      let aiResponseText = '';
      let buffer = '';
      let isAiMessageAdded = false;
      let isDone = false;

      while (true) {
        if (currentSessionIdRef.current !== targetSessionId || isUnmountedRef.current) {
           if (abortControllerRef.current) {
               abortControllerRef.current.abort();
           }
           break;
        }

        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '').trim();
            if (dataStr === '[DONE]') { isDone = true; break; }
            let streamError = null;
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.error) streamError = parsed.error;
              if (parsed.chunk) {
                if (!isAiMessageAdded) {
                  setMessages((prev) => {
                    const newMsgs = [...prev];
                    if (newMsgs.length === 0 || newMsgs[newMsgs.length - 1].role !== 'ai') {
                      newMsgs.push({ role: 'ai', content: '' });
                    }
                    return newMsgs;
                  });
                  isAiMessageAdded = true;
                }

                aiResponseText += parsed.chunk;
                if (currentSessionIdRef.current === targetSessionId) {
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
            if (streamError) throw new Error(streamError);
          }
        }
        if (isStoppedRef.current || isDone) break;
      }
      
      if (isDone) {
        useGenerationStore.getState().removeGeneration(targetSessionId);
        window.dispatchEvent(new CustomEvent('sessions-updated'));
      }
    } catch (error) {
      if (error.name !== 'AbortError' && !error.message?.includes('aborted')) {
        console.error("Lỗi khi reconnect chat:", error);
        useGenerationStore.getState().removeGeneration(targetSessionId);
      }
    } finally {
      readerRef.current = null;
    }
  };

  useEffect(() => {
    if (sessionId) {
      const fetchMessages = async () => {
        try {
          const res = await axiosClient.get(`/chat-sessions/${sessionId}/messages?page=1&limit=50`);
          const msgList = Array.isArray(res) ? res : (res.data || []);
          setMessages(msgList.map(m => ({ id: m.id, role: m.role, content: m.content })));
          
          if (res && res.totalPages !== undefined) {
             setHasMoreMessages(1 < res.totalPages);
          } else {
             setHasMoreMessages(false);
          }
          setChatPage(1);

          if (useGenerationStore.getState().generatingSessions.has(sessionId)) {
            reconnectToStream(sessionId);
          }
        } catch (error) {
          console.error("Lỗi tải lịch sử tin nhắn:", error);
        }
      };
      fetchMessages();
    } else {
      setMessages([]);
      setHasMoreMessages(false);
      setChatPage(1);
    }
  }, [sessionId, triggerReload]);

  const loadMoreMessages = async () => {
    if (isFetchingMore || !hasMoreMessages || !sessionId) return;
    setIsFetchingMore(true);
    try {
      const nextPage = chatPage + 1;
      const res = await axiosClient.get(`/chat-sessions/${sessionId}/messages?page=${nextPage}&limit=50`);
      const msgList = Array.isArray(res) ? res : (res.data || []);
      
      const newMessages = msgList.map(m => ({ id: m.id, role: m.role, content: m.content }));
      
      setMessages(prev => [...newMessages, ...prev]);
      setChatPage(nextPage);
      
      if (res && res.totalPages !== undefined) {
         setHasMoreMessages(nextPage < res.totalPages);
      }
    } catch (error) {
      console.error("Lỗi tải thêm tin nhắn:", error);
    } finally {
      setIsFetchingMore(false);
    }
  };

  useEffect(() => {
    const checkApiKeyStatus = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/chat`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
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
            credentials: 'include'
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

  // Dùng useRef để giữ giá trị mới nhất của messages và handleSend
  // Giúp event listener luôn lấy được data mới nhất mà không bị gỡ ra/cài lại liên tục
  const latestMessages = useRef(messages);
  const latestHandleSend = useRef(handleSend);

  useEffect(() => {
    latestMessages.current = messages;
    latestHandleSend.current = handleSend;
  }, [messages, handleSend]);

  useEffect(() => {
    const handleRegenerateEvent = (e) => {
      const aiIndex = e.detail.index;
      const userIndex = aiIndex - 1;
      const currentMsgs = latestMessages.current;
      
      if (userIndex >= 0 && currentMsgs[userIndex] && currentMsgs[userIndex].role === 'user') {
        latestHandleSend.current(currentMsgs[userIndex].content, true, userIndex);
      }
    };
    
    window.addEventListener('regenerate-message', handleRegenerateEvent);
    return () => window.removeEventListener('regenerate-message', handleRegenerateEvent);
  }, []); // Dependency array rỗng: Chỉ cài đặt 1 lần duy nhất lúc load trang!

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
    hasMoreMessages,
    isFetchingMore,
    loadMoreMessages,
    handleSend, handleStop, handleKeyDown,
    handleDragOver, handleDragLeave, handleDrop, removeFile
  };
};
