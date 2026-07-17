import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../services/axiosClient';
import useGenerationStore from '../store/useGenerationStore';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { backgroundStreams } from '../utils/chatCaches';
import { useChatFiles, getBase64 } from './useChatFiles';
import { useChatValidation } from './useChatValidation';
import { useChatHistory } from './useChatHistory';

export const useChatStream = (sessionId, selectedModel, setSelectedModel, apiKeyChanged, setGroqModels) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [localError, setLocalError] = useState('');
  const [editingIndex, setEditingIndex] = useState(null);
  const [editInput, setEditInput] = useState('');
  
  const currentSessionIdRef = useRef(sessionId);
  const [activeSessionId, setActiveSessionId] = useState(sessionId);
  const activeSessionIdRef = useRef(sessionId);
  const isReloadingRef = useRef(false);

  const {
    selectedFiles, setSelectedFiles, isDragging, handleDragOver, handleDragLeave, handleDrop, removeFile
  } = useChatFiles();

  const {
    isFlowiseAvailable, setIsFlowiseAvailable, isFlowiseConfigured, setIsFlowiseConfigured, isApiKeyMissing, setIsApiKeyMissing
  } = useChatValidation(apiKeyChanged, setGroqModels, setSelectedModel);

  const {
    chatPage, hasMoreMessages, isFetchingMore, loadMoreMessages
  } = useChatHistory(sessionId, messages, setMessages, isReloadingRef, currentSessionIdRef);

  const generatingSessions = useGenerationStore(state => state.generatingSessions);
  const isLoading = generatingSessions.has(activeSessionId) || generatingSessions.has(sessionId);

  useEffect(() => { 
    currentSessionIdRef.current = sessionId; 
    activeSessionIdRef.current = sessionId;
    setActiveSessionId(sessionId);
    
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
    isStoppedRef.current = true;
    
    const currentController = useGenerationStore.getState().generatingSessions.get(activeSessionIdRef.current);
    if (currentController) {
      currentController.abort();
    } else if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    if (readerRef.current) {
      readerRef.current.cancel().catch(() => {});
      readerRef.current = null;
    }
    
    const targetSessionId = activeSessionIdRef.current;
    if (targetSessionId) {
      useGenerationStore.getState().stopGeneration(targetSessionId);
      
      const currentMsgs = latestMessages.current;
      if (currentMsgs && currentMsgs.length > 0) {
        if (currentMsgs[currentMsgs.length - 1].role === 'ai') {
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
          }, 300);
        } else {
          const stopLabel = `*${t('chat.generationStoppedByUser')}*`;
          const newAiMessage = { role: 'ai', content: stopLabel };
          
          setMessages(prev => [...prev, newAiMessage]);

          (async () => {
            try {
              await axiosClient.put(`/chat-sessions/${targetSessionId}/truncate-last-message`, {
                content: stopLabel
              });
            } catch (error) {
              console.error('Lỗi khi lưu tin nhắn dừng AI:', error);
              toast.error('Lỗi đồng bộ dữ liệu: ' + error.message);
            }
          })();
        }
      }
    }
  };

  const handleSend = async (customMessage, isEdit = false, editIdx = null) => {
    const textToSend = typeof customMessage === 'string' ? customMessage : input;
    if ((!textToSend.trim() && selectedFiles.length === 0) || isLoading) return;

    let newSessionId = null;
    let isDetached = false;
    let isDone = false;
    let didAutoNavigate = false;

    isStoppedRef.current = false;
    const controller = new AbortController();
    
    controller.signal.addEventListener('abort', () => {
      if (!isStoppedRef.current) {
        isDetached = true;
      }
    });

    abortControllerRef.current = controller;
    const originalSessionId = sessionId;
    useGenerationStore.getState().addGeneration(originalSessionId || 'new', controller);

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
    
    let currentMessages = isEdit ? [...messages.slice(0, editIdx)] : [...messages];
    currentMessages.push(userMessage);
    setMessages([...currentMessages]);

    setInput('');
    setSelectedFiles([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setLocalError('');

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
                  activeSessionIdRef.current = newSessionId;
                  setActiveSessionId(newSessionId);
                  
                  if (!sessionId) {
                    useGenerationStore.getState().removeGeneration('new');
                    useGenerationStore.getState().addGeneration(newSessionId, controller);
                    window.dispatchEvent(new CustomEvent('sessions-updated'));
                  }
                }
                if (parsed.error) {
                  streamError = parsed.error;
                }
                if (parsed.chunk) {
                  if (!isAiMessageAdded) {
                    currentMessages.push({ role: 'ai', content: '' });
                    isAiMessageAdded = true;
                  }

                  const words = parsed.chunk.match(/\S+|\s+/g) || [];
                  for (const word of words) {
                    if (isStoppedRef.current || isDone) break;

                    aiResponseText += word;
                    currentMessages[currentMessages.length - 1] = {
                      ...currentMessages[currentMessages.length - 1],
                      content: aiResponseText
                    };
                    
                    const isActive = currentSessionIdRef.current === originalSessionId || currentSessionIdRef.current === newSessionId;
                    
                    const targetSessionId = newSessionId || originalSessionId;
                    if (targetSessionId) {
                      backgroundStreams.set(targetSessionId, currentMessages);
                    }

                    if (isActive) {
                      setMessages([...currentMessages]);
                    }

                    const delayTime = 5;
                    await new Promise(resolve => setTimeout(resolve, delayTime));
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
      
      currentMessages.push({ role: 'ai', content: `*(Lỗi: ${errorMsg})*` });
      const targetSessionId = newSessionId || originalSessionId || 'new';
      backgroundStreams.set(targetSessionId, currentMessages);
      
      const isActive = currentSessionIdRef.current === originalSessionId || currentSessionIdRef.current === newSessionId;
      if (isActive) {
        setMessages([...currentMessages]);
      }
    } finally {
      const finalTargetId = newSessionId || originalSessionId || 'new';
      
      if (finalTargetId) {
        backgroundStreams.delete(finalTargetId);
        useGenerationStore.getState().removeGeneration(finalTargetId);
      }

      const finalPath = window.location.pathname;
      const targetSessionId = newSessionId || originalSessionId;
      const isPathDetached = !didAutoNavigate && targetSessionId && finalPath !== `/chat/${targetSessionId}`;
      const shouldShowToast = isPathDetached;

      if (shouldShowToast && isDone) {
        toast.success(
          t('chat.generationComplete'),
          { duration: 7000, position: 'top-right', id: `gen-complete-${targetSessionId}` }
        );
        
        if (currentSessionIdRef.current === targetSessionId) {
          window.dispatchEvent(new CustomEvent('reload-messages', { detail: targetSessionId }));
        }
      }

      if (isDone) {
        window.dispatchEvent(new CustomEvent('sessions-updated'));
      }
      
      abortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

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
