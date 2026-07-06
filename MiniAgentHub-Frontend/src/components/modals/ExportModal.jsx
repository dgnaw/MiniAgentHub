import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import axiosClient from '../../services/axiosClient';
import html2canvas from 'html2canvas';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import useThemeStore from '../../store/themeStore';

const ExportModal = ({ isOpen, session, onClose }) => {
  const { t } = useTranslation();
  const theme = useThemeStore((state) => state.theme);
  
  const [format, setFormat] = useState('md');
  const [fileName, setFileName] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (isOpen && session) {
      setFormat('md');
      setFileName((session.title || 'chat').replace(/[^a-z0-9\u00C0-\u024F\u4e00-\u9fa5]/gi, '_').substring(0, 50));
      setIsExporting(false);
    }
  }, [isOpen, session]);

  if (!isOpen || !session) return null;

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const processExport = async () => {
    if (!session) return;
    setIsExporting(true);

    try {
      const res = await axiosClient.get(`/chat-sessions/${session.id}/messages`);
      const messages = Array.isArray(res) ? res : (res.data || []);
      const finalFileName = fileName.trim() || 'export';

      if (format === 'json') {
        const jsonStr = JSON.stringify(messages, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
        downloadBlob(blob, `${finalFileName}.json`);
      } 
      else if (format === 'csv') {
        let csvContent = "Role,Content,Time\n";
        messages.forEach(msg => {
          const role = msg.role === 'ai' ? 'AI' : 'User';
          const content = (msg.content || '').replace(/"/g, '""');
          const time = msg.createdAt ? new Date(msg.createdAt).toLocaleString() : new Date().toLocaleString();
          csvContent += `"${role}","${content}","${time}"\n`;
        });
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8' });
        downloadBlob(blob, `${finalFileName}.csv`);
      }
      else if (format === 'txt') {
        const lines = [`Chat Session: ${session.title || 'Untitled'}`, `Exported: ${new Date().toLocaleString()}`, ''];
        messages.forEach(msg => {
          lines.push(`${msg.role === 'ai' ? 'AI' : 'User'}:`);
          lines.push(msg.content || '');
          lines.push('----------------------------------------');
        });
        const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
        downloadBlob(blob, `${finalFileName}.txt`);
      }
      else if (format === 'md') {
        const lines = [`# ${session.title || 'Chat Session'}`, `> Exported from Agent Hub — ${new Date().toLocaleString()}`, ''];
        messages.forEach(msg => {
          lines.push(`### ${msg.role === 'ai' ? '🤖 AI' : '👤 User'}`);
          lines.push(msg.content || '');
          lines.push('');
        });
        const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
        downloadBlob(blob, `${finalFileName}.md`);
      }
      else if (format === 'png') {
        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.left = '-9999px';
        container.style.top = '0';
        container.style.width = '800px';
        container.style.backgroundColor = theme === 'dark' ? '#131417' : '#f9fafb';
        container.style.color = theme === 'dark' ? '#ffffff' : '#111827';
        container.style.padding = '40px';
        container.style.fontFamily = 'sans-serif';
        
        const title = document.createElement('h2');
        title.innerText = session.title || 'Chat Session';
        title.style.textAlign = 'center';
        title.style.marginBottom = '30px';
        title.style.color = theme === 'dark' ? '#ffffff' : '#111827';
        container.appendChild(title);

        messages.forEach(msg => {
          const msgDiv = document.createElement('div');
          msgDiv.style.marginBottom = '20px';
          msgDiv.style.display = 'flex';
          msgDiv.style.flexDirection = 'column';
          msgDiv.style.alignItems = msg.role === 'user' ? 'flex-end' : 'flex-start';

          const bubble = document.createElement('div');
          bubble.style.maxWidth = '80%';
          bubble.style.padding = '15px 20px';
          bubble.style.borderRadius = '16px';
          bubble.style.lineHeight = '1.5';
          bubble.innerText = msg.content || ''; 
          
          if (msg.role === 'user') {
            bubble.style.backgroundColor = '#2563eb';
            bubble.style.color = '#ffffff';
            bubble.style.borderBottomRightRadius = '4px';
          } else {
            bubble.style.backgroundColor = theme === 'dark' ? '#1e1f24' : '#ffffff';
            bubble.style.border = theme === 'dark' ? '1px solid #2a2b30' : '1px solid #e5e7eb';
            bubble.style.color = theme === 'dark' ? '#e5e7eb' : '#374151';
            bubble.style.borderBottomLeftRadius = '4px';
          }

          msgDiv.appendChild(bubble);
          container.appendChild(msgDiv);
        });

        document.body.appendChild(container);
        
        const canvas = await html2canvas(container, {
          backgroundColor: theme === 'dark' ? '#131417' : '#f9fafb',
          scale: 2,
          logging: false
        });
        
        document.body.removeChild(container);

        const imgUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = imgUrl;
        a.download = `${finalFileName}.png`;
        a.click();
      }

      toast.success(t('sidebar.exportSuccess'));
      onClose();
    } catch (err) {
      console.error('Export error:', err);
      toast.error(t('sidebar.exportError'));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-white dark:bg-[#1e1e1e] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-[#333]">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {t('sidebar.exportTitle')}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 rounded-md hover:bg-gray-100 dark:hover:bg-[#333]"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('sidebar.exportFileName')}
            </label>
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#2d2d2d] border border-gray-300 dark:border-[#444] rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-shadow"
              placeholder="my_chat_export"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('sidebar.exportFormat')}
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {['md', 'txt', 'csv', 'json', 'png'].map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setFormat(fmt)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors flex items-center justify-center uppercase ${
                    format === fmt
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
                      : 'border-gray-200 dark:border-[#444] text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#333]'
                  }`}
                >
                  .{fmt}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="px-6 py-4 bg-gray-50 dark:bg-[#252525] border-t border-gray-100 dark:border-[#333] flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#333] rounded-lg transition-colors"
            disabled={isExporting}
          >
            {t('sidebar.exportCancel')}
          </button>
          <button
            onClick={processExport}
            disabled={isExporting || !fileName.trim()}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-sm transition-all flex items-center justify-center min-w-[100px]"
          >
            {isExporting ? t('sidebar.exporting') : t('sidebar.exportConfirm')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;
