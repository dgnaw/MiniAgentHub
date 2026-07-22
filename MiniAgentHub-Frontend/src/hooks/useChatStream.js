import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../services/axiosClient';
import useGenerationStore from '../store/useGenerationStore';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { backgroundStreams, messageCache } from '../utils/chatCaches';
import { useChatFiles, getBase64 } from './useChatFiles';
import { useChatValidation } from './useChatValidation';
import { useChatHistory } from './useChatHistory';
import { createSSEHandlers, dispatchSSEEvent } from '../utils/sseHandlers';

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
        let updatedMsgs = [...currentMsgs];
        if (currentMsgs[currentMsgs.length - 1].role === 'ai') {
          const stopLabel = `\n\n${t('chat.generationStoppedByUser')}`;
          const truncatedContent = currentMsgs[currentMsgs.length - 1].content + stopLabel;
          
          updatedMsgs[updatedMsgs.length - 1] = {
            ...updatedMsgs[updatedMsgs.length - 1],
            content: truncatedContent
          };

          setMessages(updatedMsgs);

          setTimeout(async () => {
            try {
              await axiosClient.put(`/chat-sessions/${targetSessionId}/truncate-last-message`, {
                content: truncatedContent
              });
            } catch (error) {
              console.error('Error truncating AI message:', error);
            }
          }, 300);
        } else {
          const stopLabel = `*${t('chat.generationStoppedByUser')}*`;
          const newAiMessage = { role: 'ai', content: stopLabel };
          updatedMsgs = [...currentMsgs, newAiMessage];
          
          setMessages(updatedMsgs);

          (async () => {
            try {
              await axiosClient.put(`/chat-sessions/${targetSessionId}/truncate-last-message`, {
                content: stopLabel
              });
            } catch (error) {
              console.error('Error saving AI stop message:', error);
              toast.error('Lỗi đồng bộ dữ liệu: ' + error.message);
            }
          })();
        }

        messageCache.set(targetSessionId, updatedMsgs);
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
    let backendContent = textToSend.trim();

    if (selectedFiles.length > 0 && !isEdit) {
      let filesMarkdown = '';
      let backendMarkdown = '';
      for (const file of selectedFiles) {
        const safeName = file.name.replace(/[\\]/g, '_');
        if (file.type.startsWith('image/')) {
          const base64 = await getBase64(file);
          filesMarkdown += `![${safeName}](${base64})\n\n`;
          backendMarkdown += `[🖼️ Hình ảnh đính kèm: ${safeName}]\n\n`;
        } else {
          filesMarkdown += `[📎 File đính kèm: ${safeName}]\n\n`;
          backendMarkdown += `[📎 File đính kèm: ${safeName}]\n\n`;
        }
      }
      finalContent = finalContent ? `${filesMarkdown}${finalContent}` : filesMarkdown.trim();
      backendContent = backendContent ? `${backendMarkdown}${backendContent}` : backendMarkdown.trim();
    }

    const userMessage = { role: 'user', content: finalContent };
    
    let currentMessages = isEdit ? [...messages.slice(0, editIdx)] : [...messages];
    currentMessages.push(userMessage);
    setMessages([...currentMessages]);
    if (isEdit) {
      setEditingIndex(null);
    }

    setInput('');
    setSelectedFiles([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setLocalError('');

    let streamTimeout;
    let isTimeout = false;

    try {
      const resetTimeout = () => {
        if (streamTimeout) clearTimeout(streamTimeout);
        streamTimeout = setTimeout(() => {
          isTimeout = true;
          controller.abort();
        }, 60000); 
      };

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

      resetTimeout(); // Bắt đầu tính giờ chờ phản hồi đầu tiên
      const response = await fetch(`${import.meta.env.VITE_API_URL}/chat`, fetchOptions);

      if (!response.ok) {
        let errMsg = 'Server connection error';
        try {
          const errJson = await response.json();
          if (errJson && errJson.message) {
            errMsg = errJson.message;
          }
        } catch (_) {
          console.warn("Cannot parse JSON error response from server.");
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

      const sseHandlers = createSSEHandlers({
        originalSessionId,
        newSessionIdRef: {
          get current() { return newSessionId; },
          set current(val) { newSessionId = val; }
        },
        currentMessages,
        aiTextRef: {
          get current() { return aiResponseText; },
          set current(val) { aiResponseText = val; }
        },
        isAiMessageAddedRef: {
          get current() { return isAiMessageAdded; },
          set current(val) { isAiMessageAdded = val; }
        },
        isStoppedRef,
        isDoneRef: {
          get current() { return isDone; },
          set current(val) { isDone = val; }
        },
        isUnmountedRef,
        currentSessionIdRef,
        setMessages,
        setActiveSessionId,
        setIsFlowiseAvailable,
        backgroundStreams,
        onNewSession: (id) => {
          activeSessionIdRef.current = id;
          if (!sessionId) {
            useGenerationStore.getState().removeGeneration('new');
            useGenerationStore.getState().addGeneration(id, controller);
          }
          window.dispatchEvent(new CustomEvent('sessions-updated'));
        }
      });

      try {
        while (true) {
          const { done, value } = await reader.read();
          resetTimeout(); 

          if (done) {
            isDone = true;
            break;
          } 
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.replace('data: ', '').trim();
              if (dataStr === '[DONE]') { isDone = true; break; }
              let parsed;
              try {
                parsed = JSON.parse(dataStr);
              } catch (e) {
                console.debug("Stream JSON parse error (Skipping):", e.message);
                continue;
              }
                
              if (parsed.type && parsed.data) {
                await dispatchSSEEvent(parsed.type, parsed.data, sseHandlers);
              } else {
                if (parsed.sessionId) {
                  await dispatchSSEEvent('session', { sessionId: parsed.sessionId }, sseHandlers);
                }
                if (parsed.chunk) {
                  await dispatchSSEEvent('chunk', { content: parsed.chunk }, sseHandlers);
                }
                if (parsed.error) {
                  await dispatchSSEEvent('error', { message: parsed.error }, sseHandlers);
                }
              }
            }
          }
          if (isStoppedRef.current || isDone) break;
        }
      } catch (readErr) {
        if (readErr.name !== 'AbortError' && readErr.message !== 'BodyStreamBuffer was aborted') {
          console.warn('Stream reader interrupted:', readErr.message);
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
      if (isTimeout) {
        error = new Error('Yêu cầu mất quá nhiều thời gian để phản hồi (Timeout). Vui lòng thử lại.');
      } else if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        return;
      }
      console.error("Error chatting:", error);
      
      const errorMsg = error.message || 'Đã xảy ra lỗi khi kết nối server.';
      
      currentMessages.push({ role: 'ai', content: `*(Lỗi: ${errorMsg})*` });
      const targetSessionId = newSessionId || originalSessionId || 'new';
      backgroundStreams.set(targetSessionId, currentMessages);
      
      const isActive = !isUnmountedRef.current && (currentSessionIdRef.current === originalSessionId || currentSessionIdRef.current === newSessionId);
      if (isActive) {
        setMessages([...currentMessages]);
      }
    } finally {
      if (streamTimeout) clearTimeout(streamTimeout);
      const finalTargetId = newSessionId || originalSessionId || 'new';
      
      if (finalTargetId) {
        if (!isStoppedRef.current && currentMessages && currentMessages.length > 0) {
          messageCache.set(finalTargetId, currentMessages);
        }

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
