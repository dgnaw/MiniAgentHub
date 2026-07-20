import { useState, useEffect } from 'react';

export const useChatValidation = (apiKeyChanged, setGroqModels, setSelectedModel) => {
  const [isFlowiseAvailable, setIsFlowiseAvailable] = useState(true);
  const [isFlowiseConfigured, setIsFlowiseConfigured] = useState(true);
  const [isApiKeyMissing, setIsApiKeyMissing] = useState(false);

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
          console.error("Error loading models list:", modelsErr);
        }
      } catch (error) {
        console.error("Error checking API status:", error);
      }
    };
    checkApiKeyStatus();
  }, [apiKeyChanged, setGroqModels, setSelectedModel]);

  return {
    isFlowiseAvailable,
    setIsFlowiseAvailable,
    isFlowiseConfigured,
    setIsFlowiseConfigured,
    isApiKeyMissing,
    setIsApiKeyMissing
  };
};
