import { useState, useEffect } from 'react';
import axiosClient from '../services/axiosClient';
import { backgroundStreams, messageCache, pageCache } from '../utils/chatCaches';

export const useChatHistory = (sessionId, messages, setMessages, isReloadingRef, currentSessionIdRef) => {
  const [chatPage, setChatPage] = useState(1);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [triggerReload, setTriggerReload] = useState(0);

  useEffect(() => {
    if (sessionId && messages.length > 0 && sessionId === currentSessionIdRef.current) {
      messageCache.set(sessionId, messages);
      pageCache.set(sessionId, { hasMoreMessages, chatPage });
    }
  }, [messages, sessionId, hasMoreMessages, chatPage, currentSessionIdRef]);

  useEffect(() => {
    const handleReload = (e) => {
      if (e.detail === sessionId) {
        if (isReloadingRef) {
          isReloadingRef.current = true;
        }
        setTriggerReload(prev => prev + 1);
      }
    };
    window.addEventListener('reload-messages', handleReload);
    return () => window.removeEventListener('reload-messages', handleReload);
  }, [sessionId, isReloadingRef]);

  useEffect(() => {
    if (sessionId) {
      if (backgroundStreams.has(sessionId)) {
        setMessages(backgroundStreams.get(sessionId));
      } else if (messageCache.has(sessionId) && (!isReloadingRef || !isReloadingRef.current)) {
        setMessages(messageCache.get(sessionId));
        
        const cachedPage = pageCache.get(sessionId);
        if (cachedPage) {
          setHasMoreMessages(cachedPage.hasMoreMessages);
          setChatPage(cachedPage.chatPage);
        }
      } else {
        if (isReloadingRef) {
          isReloadingRef.current = false;
        }
        const fetchMessages = async () => {
          setMessages([]);
          try {
            const res = await axiosClient.get(`/chat-sessions/${sessionId}/messages?page=1&limit=50`);
            
            if (currentSessionIdRef.current !== sessionId) return;

            const msgList = Array.isArray(res) ? res : (res.data || []);
            setMessages(msgList.map(m => ({ id: m.id, role: m.role, content: m.content })));
            
            if (res && res.totalPages !== undefined) {
               setHasMoreMessages(1 < res.totalPages);
            } else {
               setHasMoreMessages(false);
            }
            setChatPage(1);
          } catch (error) {
            console.error("Error loading message history:", error);
          }
        };
        fetchMessages();
      }
    } else {
      setMessages([]);
      setHasMoreMessages(false);
      setChatPage(1);
    }
  }, [sessionId, triggerReload, setMessages, isReloadingRef, currentSessionIdRef]);

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
      console.error("Error loading more messages:", error);
    } finally {
      setIsFetchingMore(false);
    }
  };

  return {
    chatPage, setChatPage,
    hasMoreMessages, setHasMoreMessages,
    isFetchingMore, setIsFetchingMore,
    loadMoreMessages
  };
};
