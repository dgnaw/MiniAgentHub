import React, { useEffect, useState, useRef } from 'react';
import { Plus, Paperclip, Send, X, Eye, Square } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const ImagePreview = ({ file, idx, removeFile, setFullScreenImage }) => {
  const [objectUrl, setObjectUrl] = useState('');

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="relative group shrink-0">
      <img
        src={objectUrl}
        alt="preview"
        className="h-16 w-16 object-cover rounded-lg border border-gray-200 dark:border-[#333] shadow-sm cursor-zoom-in"
        onClick={() => setFullScreenImage(objectUrl)}
      />
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center cursor-zoom-in pointer-events-none">
        <Eye className="text-white drop-shadow-md" size={16} />
      </div>
      <button onClick={() => removeFile(idx)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow-md transition-colors z-10">
        <X size={12} />
      </button>
    </div>
  );
};

const ChatInput = ({
  input, setInput,
  handleSend, handleStop, handleKeyDown,
  isLoading,
  selectedFiles, removeFile, setSelectedFiles,
  textareaRef,
  setFullScreenImage
}) => {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);

  return (
    <div className="w-full max-w-3xl relative flex flex-col bg-white dark:bg-[#212227] shadow-lg dark:shadow-none rounded-3xl p-2 border border-gray-300 dark:border-[#333] focus-within:border-blue-500 dark:focus-within:border-[#555] transition-colors">
      {selectedFiles.length > 0 && (
        <div className="px-3 pt-3 pb-1 flex items-center gap-3 flex-wrap max-h-32 overflow-y-auto custom-scrollbar">
          {selectedFiles.map((file, idx) => (
            file.type.startsWith('image/') ? (
              <ImagePreview 
                key={idx} 
                file={file} 
                idx={idx} 
                removeFile={removeFile} 
                setFullScreenImage={setFullScreenImage} 
              />
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
              e.target.value = null; 
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
  );
};

export default ChatInput;
