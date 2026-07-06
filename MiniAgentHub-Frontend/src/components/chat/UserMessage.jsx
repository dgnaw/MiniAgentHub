import React from 'react';
import { Paperclip, Copy, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

const UserMessage = ({
  msg, index,
  editingIndex, setEditingIndex,
  editInput, setEditInput,
  handleSend,
  setFullScreenImage
}) => {
  const { t } = useTranslation();

  if (editingIndex === index) {
    return (
      <div className="flex flex-col items-end w-full gap-2 my-2">
        <div className="w-full max-w-[85%] md:max-w-[75%] bg-white dark:bg-[#1e1f24] border border-blue-500 rounded-2xl p-3 shadow-sm">
          <textarea
            value={editInput}
            onChange={(e) => {
              setEditInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            maxLength={5000}
            className="w-full bg-transparent border-none outline-none text-gray-900 dark:text-gray-200 text-[15px] resize-none overflow-y-auto max-h-[200px] custom-scrollbar"
            rows={1}
            autoFocus
            onFocus={(e) => {
              e.target.style.height = 'auto';
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
          />
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => setEditingIndex(null)} className="px-4 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2a2b30] rounded-lg transition-colors">{t('chat.cancelEdit')}</button>
            <button onClick={() => {
              const originalContent = msg.content || '';
              const fileRegex = /\[📎 File đính kèm: (.*?)\]/g;
              const imgRegex = /!\[(.*?)\]\(([^)]+)\)/g;

              const files = [...originalContent.matchAll(fileRegex)].map(m => m[0]);
              const imgs = [...originalContent.matchAll(imgRegex)].map(m => m[0]);

              let finalEdit = editInput.trim();
              if (files.length > 0) finalEdit = `${files.join('\n')}\n\n${finalEdit}`;
              if (imgs.length > 0) finalEdit = `${imgs.join('\n')}\n\n${finalEdit}`;

              handleSend(finalEdit.trim(), true, index);
            }} className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">{t('chat.resendEdit')}</button>
          </div>
        </div>
      </div>
    );
  }

  // Tìm và bóc tách đoạn text đính kèm file ra khỏi nội dung
  const content = msg.content || '';
  const fileRegex = /\[📎 File đính kèm: (.*?)\]/g;
  const fileMatches = [...content.matchAll(fileRegex)];

  // Tìm và bóc tách hình ảnh
  const imgRegex = /!\[(.*?)\]\(([^)]+)\)/g;
  const imgMatches = [...content.matchAll(imgRegex)];

  const contentText = content.replace(fileRegex, '').replace(imgRegex, '').trim();

  return (
    <div className="flex flex-col items-end w-full">
      <div className="flex flex-col items-end gap-2 max-w-[85%] md:max-w-[75%]">
        {imgMatches.map((match, i) => {
          const imgSrc = match[2].startsWith('/api/uploads') ? `${import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '') : ''}${match[2]}` : match[2];
          return (
            <div key={`img-${i}`} className="relative group inline-block">
              <img
                src={imgSrc}
                alt={match[1]}
                className="max-h-64 w-auto rounded-2xl object-contain shadow-sm cursor-zoom-in"
                onClick={() => setFullScreenImage(imgSrc)}
              />
            </div>
          );
        })}
        {(contentText || fileMatches.length > 0) && (
          <div className="rounded-2xl px-5 py-3.5 text-[15px] leading-relaxed bg-blue-600 text-white rounded-br-sm break-words">
            {fileMatches.map((match, i) => (
              <div key={i} className={`bg-white/20 dark:bg-black/20 text-white rounded-xl p-2 flex items-center gap-3 w-fit shadow-sm border border-white/10 ${contentText ? 'mb-2.5' : ''}`}>
                <div className="p-1.5 bg-white/20 rounded-lg">
                  <Paperclip size={16} />
                </div>
                <span className="text-sm font-medium truncate max-w-[200px]">{match[1]}</span>
              </div>
            ))}
            {contentText && <span className="whitespace-pre-wrap">{contentText}</span>}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity mt-1.5 mr-2">
        <button onClick={() => { if (!contentText) return; navigator.clipboard.writeText(contentText); toast.success(t('chat.copiedMessage')); }} className="flex items-center gap-1 text-[12px] font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"><Copy size={13} /> {t('chat.copy')}</button>
        <button onClick={() => { setEditInput(contentText); setEditingIndex(index); }} className="flex items-center gap-1 text-[12px] font-medium text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"><Pencil size={13} /> {t('chat.edit')}</button>
      </div>
    </div>
  );
};

export default UserMessage;
