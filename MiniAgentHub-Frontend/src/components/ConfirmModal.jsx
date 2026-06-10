import React from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText, cancelText, isDanger = true }) => {
  const { t } = useTranslation();
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity p-4">
      <div className="bg-white dark:bg-[#1a1b20] border border-gray-200 dark:border-[#26272b] rounded-2xl w-full max-w-sm p-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <div className="flex flex-col items-center text-center mt-2">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${isDanger ? 'bg-red-100 dark:bg-red-500/20 text-red-500 dark:text-red-400' : 'bg-blue-100 dark:bg-blue-500/20 text-blue-500 dark:text-blue-400'}`}>
            <AlertTriangle size={24} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{title || t('confirmModal.title', 'Xác nhận')}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{message}</p>

          <div className="flex w-full gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-100 dark:bg-[#26272b] hover:bg-gray-200 dark:hover:bg-[#33353b] text-gray-700 dark:text-gray-300 font-semibold py-2.5 rounded-xl transition-colors"
            >
              {cancelText || t('confirmModal.cancel', 'Hủy')}
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`flex-1 font-semibold py-2.5 rounded-xl transition-colors text-white ${isDanger ? 'bg-red-500 hover:bg-red-600' : 'bg-[#3b82f6] hover:bg-[#2563eb]'}`}
            >
              {confirmText || t('confirmModal.confirm', 'Xác nhận')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;