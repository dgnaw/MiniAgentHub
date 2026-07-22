import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import toast from 'react-hot-toast';
import { Check, Copy, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const PreBlock = ({ children, ...props }) => {
  const [copied, setCopied] = useState(false);
  const { t } = useTranslation();

  let textContent = '';
  let language = '';

  if (React.isValidElement(children)) {
    if (children.props.children) {
      const childData = children.props.children;
      if (Array.isArray(childData)) {
        textContent = childData.join('');
      } else {
        textContent = String(childData);
      }
      textContent = textContent.replace(/\n$/, '');
    }

    if (children.props.className) {
      const match = /language-(\w+)/.exec(children.props.className || '');
      if (match) {
        language = match[1];
      }
    }
  }

  const handleCopy = () => {
    if (!textContent) return;
    navigator.clipboard.writeText(textContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-4 rounded-xl overflow-hidden shadow-sm bg-[#1e1e1e] border border-gray-200 dark:border-[#333]">
      <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] border-b border-[#444] select-none">
        <span className="text-xs font-mono text-gray-400 font-semibold uppercase tracking-wider">{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-gray-400 hover:text-gray-100 transition-colors"
          title="Copy code"
        >
          {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
          <span className="text-xs">{copied ? t('chat.copied') : t('chat.copy')}</span>
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-[13px] font-mono text-gray-300 m-0" {...props}>
        {children}
      </pre>
    </div>
  );
};

const AiMessage = React.memo(({ content, index, setViewedFile }) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-start w-full">
      <div className="max-w-[85%] md:max-w-[75%] rounded-2xl px-5 py-3.5 text-[15px] leading-relaxed bg-white dark:bg-[#1e1f24] text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-[#2a2b30] rounded-bl-sm break-words overflow-x-auto">
        <ReactMarkdown
          rehypePlugins={[rehypeRaw, rehypeSanitize]}
          components={{
            p: ({ node, ...props }) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
            ul: ({ node, ...props }) => <ul className="list-disc ml-5 mb-2 space-y-1" {...props} />,
            ol: ({ node, ...props }) => <ol className="list-decimal ml-5 mb-2 space-y-1" {...props} />,
            li: ({ node, ...props }) => <li {...props} />,
            strong: ({ node, ...props }) => <strong className="font-semibold" {...props} />,
            pre: PreBlock,
            code: ({ node, inline, ...props }) => inline ? <code className="bg-black/10 dark:bg-white/10 text-red-600 dark:text-red-400 rounded px-1.5 py-0.5 text-sm font-mono" {...props} /> : <code {...props} />,
            a: ({ node, href, children, ...props }) => {
              if (href?.startsWith('/api/uploads/')) {
                return (
                  <span
                    onClick={(e) => {
                      e.preventDefault();
                      if (setViewedFile) {
                        const fileName = Array.isArray(children) ? children.join('') : (children || 'Tài liệu');
                        setViewedFile({ name: fileName, url: href });
                      }
                    }}
                    className="text-blue-500 hover:underline cursor-pointer inline-flex items-center gap-1"
                    title="Nhấn để xem tài liệu"
                  >
                    {children}
                  </span>
                );
              }
              return <a className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer" href={href} {...props}>{children}</a>;
            },
            img: ({ node, src, alt, ...props }) => {
              const backendUrl = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '') : '';
              const finalSrc = src?.startsWith('/api/uploads') ? `${backendUrl}${src}` : src;
              return <img src={finalSrc} alt={alt} className="max-w-full max-h-96 object-contain rounded-lg border border-gray-200 dark:border-[#333] shadow-sm my-2 cursor-zoom-in" onClick={() => window.open(finalSrc, '_blank')} {...props} />;
            },
            table: ({ node, ...props }) => <div className="overflow-x-auto my-4 rounded-lg border border-gray-200 dark:border-gray-700"><table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm" {...props} /></div>,
            thead: ({ node, ...props }) => <thead className="bg-gray-100 dark:bg-gray-800/80" {...props} />,
            th: ({ node, ...props }) => <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider" {...props} />,
            td: ({ node, ...props }) => <td className="px-4 py-3 border-t border-gray-200 dark:border-gray-700" {...props} />
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
      <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity mt-1.5 ml-2">
        <button
          onClick={() => {
            if (!content) return;
            navigator.clipboard.writeText(content);
            toast.success(t('chat.copiedResponse'));
          }}
          className="flex items-center gap-1 text-[12px] font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <Copy size={13} /> {t('chat.copy')}
        </button>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('regenerate-message', { detail: { index } }))}
          className="flex items-center gap-1 text-[12px] font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <RefreshCw size={13} /> {t('chat.regenerate')}
        </button>
      </div>
    </div>
  );
}, (prevProps, nextProps) => prevProps.content === nextProps.content);

export default AiMessage;
