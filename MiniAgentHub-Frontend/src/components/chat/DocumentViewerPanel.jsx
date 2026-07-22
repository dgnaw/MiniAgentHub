import React, { useState, useEffect } from 'react';
import { X, FileText, Download, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const DocumentViewerPanel = ({ fileInfo, onClose }) => {
  const { t } = useTranslation();
  const [content, setContent] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isExtractedPreview, setIsExtractedPreview] = useState(false);

  const { name, url } = fileInfo;
  
  const getExtension = (filename) => {
    return filename.split('.').pop().toLowerCase();
  };

  const ext = getExtension(name);

  const textExtensions = [
    'txt', 'md', 'csv', 'json', 'xml', 'html', 'css', 'scss', 
    'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cpp', 'cs', 'h', 'hpp', 
    'sql', 'sh', 'bat', 'yaml', 'yml', 'env', 'ini', 'conf', 'toml', 'log', 
    'php', 'rb', 'go', 'rs', 'kt', 'swift', 'vue', 'svelte'
  ];
  
  const isPdf = ext === 'pdf';
  const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext);
  const isText = textExtensions.includes(ext);
  
  const isComplex = !isPdf && !isImage && !isText;

  useEffect(() => {
    let isMounted = true;
    
    const fetchTextContent = async (fetchUrl, isFallback = false) => {
      setIsLoading(true);
      setError(null);
      try {
        const fullUrl = `${import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '') : ''}${fetchUrl}`;
        const res = await fetch(fullUrl, { credentials: 'include' });
        if (!res.ok) throw new Error(t('documentViewer.loadError'));
        const text = await res.text();
        if (isMounted) {
          setContent(text);
          setIsExtractedPreview(isFallback);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    if (isText) {
      fetchTextContent(url);
    } else if (isComplex) {
      fetchTextContent(`${url}.extracted.txt`, true);
    }

    return () => {
      isMounted = false;
    };
  }, [url, isText, isComplex, t]);

  const fullUrl = `${import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '') : ''}${url}`;

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-[#1e1f24] border-l border-gray-200 dark:border-[#2a2b30] shadow-xl animate-in slide-in-from-right-8 duration-300 z-20 relative">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-[#2a2b30] bg-gray-50 dark:bg-[#131417]">
        <div className="flex items-center gap-2 overflow-hidden">
          <FileText size={18} className="text-blue-500 shrink-0" />
          <h3 className="font-semibold text-gray-800 dark:text-gray-200 truncate text-sm" title={name}>
            {name}
          </h3>
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          <a
            href={fullUrl}
            download={name}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 text-gray-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"
            title={t('documentViewer.downloadOrOpen')}
          >
            <Download size={16} />
          </a>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden relative bg-gray-50/50 dark:bg-[#131417]/50">
        {isPdf && (
          <iframe
            src={`${fullUrl}#toolbar=0`}
            className="w-full h-full border-none"
            title={name}
          />
        )}

        {isImage && (
          <div className="w-full h-full flex items-center justify-center p-4">
            <img src={fullUrl} alt={name} className="max-w-full max-h-full object-contain rounded-lg shadow-sm" />
          </div>
        )}

        {(isText || isComplex) && (
          <div className="w-full h-full flex flex-col relative">
             {isExtractedPreview && (
                <div className="bg-yellow-50 dark:bg-yellow-500/10 text-yellow-800 dark:text-yellow-200 text-xs px-4 py-2 border-b border-yellow-200 dark:border-yellow-500/20 flex items-center gap-2 shrink-0">
                  <span className="font-medium">{t('documentViewer.previewModeTitle')}</span>
                  {t('documentViewer.previewModeDesc')}
                </div>
             )}
             
             {isLoading ? (
               <div className="flex-1 flex items-center justify-center">
                 <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
               </div>
             ) : error ? (
               <div className="flex-1 flex items-center justify-center flex-col text-red-500 gap-2">
                 <p className="text-sm font-medium">{error}</p>
                 <a href={fullUrl} target="_blank" className="text-xs text-blue-500 hover:underline">{t('documentViewer.downloadOriginal')}</a>
               </div>
             ) : (
               <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                 <pre className="text-[13px] font-mono text-gray-800 dark:text-gray-300 whitespace-pre-wrap break-words">
                   {content}
                 </pre>
               </div>
             )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentViewerPanel;
