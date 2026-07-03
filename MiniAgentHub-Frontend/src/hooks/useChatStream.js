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
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editInput, setEditInput] = useState('');
  const [isFlowiseAvailable, setIsFlowiseAvailable] = useState(true);
  const [isFlowiseConfigured, setIsFlowiseConfigured] = useState(true);
  const [isApiKeyMissing, setIsApiKeyMissing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [triggerReload, setTriggerReload] = useState(0);
  
  const currentSessionIdRef = useRef(sessionId);
  useEffect(() => { currentSessionIdRef.current = sessionId; }, [sessionId]);
  
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
    setIsLoading(false);
    
    if (sessionId) {
      useGenerationStore.getState().stopGeneration(sessionId);
    }
    toast.success(t('chat.generationStopped', 'Đã dừng tạo câu trả lời.'));
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
    
    // Kiểm tra xem tin nhắn được edit có phải là tin nhắn cuối cùng (hoặc áp chót nếu đã có AI trả lời) không
    const isLastMessage = isEdit && (editIdx >= messages.length - 2);

    if (isLastMessage) {
      // Nếu là tin nhắn cuối: cập nhật tại chỗ (xóa tin nhắn cũ và câu trả lời AI cũ tương ứng)
      setMessages((prev) => [...prev.slice(0, editIdx), userMessage]);
      setEditingIndex(null);
    } else if (isEdit) {
      // Nếu là tin nhắn ở giữa lịch sử: copy xuống dưới cùng thành một cuộc hội thoại mới
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
    setIsLoading(true);
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
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.sessionId) {
                  newSessionId = parsed.sessionId;
                  if (!sessionId) {
                    useGenerationStore.getState().removeGeneration(undefined);
                    useGenerationStore.getState().addGeneration(newSessionId, controller);
                    window.dispatchEvent(new CustomEvent('sessions-updated'));
                  }
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
                        const delayTime = selectedModel === 'Data Analyst' ? 10 : 10;
                        await new Promise(resolve => setTimeout(resolve, delayTime));
                      }
                    }
                  }
                }
              } catch (e) {
                console.debug("Bỏ qua dòng dữ liệu stream lỗi parse JSON:", e.message);
              }
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
      useGenerationStore.getState().removeGeneration(originalSessionId);
      if (newSessionId) useGenerationStore.getState().removeGeneration(newSessionId);

      const finalPath = window.location.pathname;
      const targetSessionId = newSessionId || originalSessionId;
      const isPathDetached = !didAutoNavigate && targetSessionId && finalPath !== `/chat/${targetSessionId}`;
      const shouldShowToast = isDetached || isUnmountedRef.current || isPathDetached;

      // Chỉ hiện thông báo nếu hoàn thành thành công và đang ở trang khác
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
        setIsLoading(false);
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
    const handleReload = (e) => {
      if (e.detail === sessionId) {
        setTriggerReload(prev => prev + 1);
      }
    };
    window.addEventListener('reload-messages', handleReload);
    return () => window.removeEventListener('reload-messages', handleReload);
  }, [sessionId]);

  useEffect(() => {
    if (useGenerationStore.getState().generatingSessions.has(sessionId)) {
      setIsLoading(true);
    } else {
      setIsLoading(false);
    }

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
    // Không dùng handleStop ở đây nữa để giữ kết nối ngầm khi chuyển trang
  }, [sessionId, triggerReload]);

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
    handleSend, handleStop, handleKeyDown,
    handleDragOver, handleDragLeave, handleDrop, removeFile
  };
};
