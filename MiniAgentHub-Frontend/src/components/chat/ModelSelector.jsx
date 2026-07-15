import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronLeft, Settings } from 'lucide-react';
import groqLogo from '../../assets/groq.webp';
import flowiseLogo from '../../assets/flowise.svg';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

const ModelSelector = ({
  selectedModel, setSelectedModel,
  groqModels,
  showModelDropdown, setShowModelDropdown,
  isFlowiseAvailable,
  openApiKeyModal
}) => {
  const { t } = useTranslation();
  const [isGroqOpen, setIsGroqOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowModelDropdown(false);
        setIsGroqOpen(false);
      }
    };
    if (showModelDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showModelDropdown, setShowModelDropdown]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowModelDropdown(!showModelDropdown)}
        className="flex items-center gap-2 bg-white dark:bg-[#1e1f23] border border-gray-200 dark:border-[#333] hover:bg-gray-100 dark:hover:bg-[#2a2b30] text-gray-700 dark:text-gray-300 shadow-sm dark:shadow-none px-4 py-2 rounded-full text-sm font-medium transition-colors"
      >
        {selectedModel === 'Data Analyst' ? (
          <>
            <img src={flowiseLogo} alt="Flowise" className="h-4 w-auto object-contain shrink-0" />
            <span className="truncate max-w-[120px] sm:max-w-none">Flowise</span>
          </>
        ) : (
          <>
            <img src={groqLogo} alt="Groq" className="h-4 w-4 object-contain shrink-0" />
            <span className="truncate max-w-[120px] sm:max-w-none">{groqModels.find(m => m.id === selectedModel)?.name || 'Llama 3.1 8B'}</span>
          </>
        )}
        <ChevronDown size={16} className="text-gray-400" />
      </button>

      {showModelDropdown && (
        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#1e1f23] border border-gray-200 dark:border-[#333] rounded-xl shadow-lg z-[80]">
          <div className="group relative">
            <div 
              className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#2a2b30] cursor-pointer text-sm text-gray-700 dark:text-gray-300 transition-colors flex items-center justify-between rounded-t-xl"
              onClick={() => setIsGroqOpen(!isGroqOpen)}
            >
              <div className="flex-1">
                <div className="font-medium text-blue-600 dark:text-blue-400 mb-0.5 flex items-center gap-1.5">
                  <img src={groqLogo} alt="Groq" className="h-3.5 w-3.5 object-contain" />
                  Groq
                </div>
                <div className="text-xs text-gray-500">{t('dashboard.generalChatModels')}</div>
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
                  <div className="absolute bottom-full mb-1.5 left-1/2 transform -translate-x-1/2 hidden group-hover/tooltip:block bg-gray-950 dark:bg-gray-800 text-white text-[10px] py-1 px-2 rounded-lg shadow-xl whitespace-nowrap z-[100] border border-gray-200 dark:border-gray-700/50">
                    {t('dashboard.setApiKey')}
                  </div>
                </div>
                <ChevronLeft size={16} className="text-gray-400" />
              </div>
            </div>

            <div className={`absolute ${isGroqOpen ? 'block' : 'hidden md:group-hover:block'} right-0 top-full mt-2 md:mt-0 md:top-0 md:right-[calc(100%+8px)] w-64 bg-white dark:bg-[#1e1f23] border border-gray-200 dark:border-[#333] rounded-xl shadow-lg py-1 z-[90]`}>
              {groqModels.map((model) => (
                <div
                  key={model.id}
                  onClick={() => {
                    setSelectedModel(model.id);
                    setShowModelDropdown(false);
                    setIsGroqOpen(false);
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
                toast.error(t('dashboard.flowiseUnavailable'));
                setShowModelDropdown(false);
                return;
              }
              setSelectedModel('Data Analyst');
              setShowModelDropdown(false);
            }}
          >
            <div className="flex-1">
              <div className={`font-medium text-emerald-600 dark:text-emerald-400 mb-0.5 flex items-center gap-1.5 ${!isFlowiseAvailable ? 'line-through' : ''}`}>
                <img src={flowiseLogo} alt="Flowise" className="h-3.5 w-auto object-contain" />
                Flowise
              </div>
              <div className="text-xs text-gray-500">{t('dashboard.modelDataDesc')}</div>
              {!isFlowiseAvailable && (
                <div className="text-xs text-red-500 mt-1">{t('dashboard.flowiseBusy')}</div>
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
                {t('dashboard.setApiKey')}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelSelector;
