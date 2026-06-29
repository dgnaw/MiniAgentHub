import React, { useState, useEffect } from 'react';
import { X, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

export const getCustomKey = (type) => {
  const storageKey = type === 'groq' ? 'agentHub_custom_groq_api_key' : 'agentHub_custom_flowise_api_url';
  const key = localStorage.getItem(storageKey) || '';
  const expire = localStorage.getItem(`agentHub_custom_${type}_expire`);
  if (expire && expire !== 'never') {
    const expireTime = parseInt(expire, 10);
    if (Date.now() > expireTime) {
      localStorage.removeItem(storageKey);
      localStorage.removeItem(`agentHub_custom_${type}_expire`);
      localStorage.removeItem(`agentHub_custom_${type}_expire_option`);
      return '';
    }
  }
  return key;
};

const ApiKeyModal = ({ isOpen, type, onClose, onSuccess }) => {
  const { t } = useTranslation();
  
  const [tempApiKey, setTempApiKey] = useState('');
  const [tempApiUrl, setTempApiUrl] = useState('');
  const [tempExpire, setTempExpire] = useState('never');

  useEffect(() => {
    if (isOpen) {
      if (type === 'groq') {
        setTempApiKey(getCustomKey('groq'));
        setTempExpire(localStorage.getItem('agentHub_custom_groq_expire_option') || 'never');
      } else {
        setTempApiUrl(getCustomKey('flowise'));
        setTempExpire(localStorage.getItem('agentHub_custom_flowise_expire_option') || 'never');
      }
    }
  }, [isOpen, type]);

  if (!isOpen) return null;

  const saveApiKeyConfig = () => {
    const storageKey = type === 'groq' ? 'agentHub_custom_groq_api_key' : 'agentHub_custom_flowise_api_url';
    const val = type === 'groq' ? tempApiKey : tempApiUrl;

    localStorage.setItem(storageKey, val.trim());
    localStorage.setItem(`agentHub_custom_${type}_expire_option`, tempExpire);

    if (tempExpire === 'never') {
      localStorage.removeItem(`agentHub_custom_${type}_expire`);
    } else {
      let durationMs = 0;
      if (tempExpire === '1h') durationMs = 60 * 60 * 1000;
      else if (tempExpire === '1d') durationMs = 24 * 60 * 60 * 1000;
      else if (tempExpire === '7d') durationMs = 7 * 24 * 60 * 60 * 1000;
      else if (tempExpire === '30d') durationMs = 30 * 24 * 60 * 60 * 1000;

      localStorage.setItem(`agentHub_custom_${type}_expire`, (Date.now() + durationMs).toString());
    }

    toast.success(type === 'groq' ? 'Đã lưu cấu hình API Key Groq cá nhân!' : 'Đã lưu cấu hình API URL Flowise cá nhân!');
    onSuccess();
    onClose();
  };

  const clearApiKeyConfig = () => {
    const storageKey = type === 'groq' ? 'agentHub_custom_groq_api_key' : 'agentHub_custom_flowise_api_url';
    localStorage.removeItem(storageKey);
    localStorage.removeItem(`agentHub_custom_${type}_expire`);
    localStorage.removeItem(`agentHub_custom_${type}_expire_option`);

    if (type === 'groq') {
      setTempApiKey('');
    } else {
      setTempApiUrl('');
    }
    toast.success(type === 'groq' ? 'Đã xóa API Key Groq cá nhân.' : 'Đã xóa API URL Flowise cá nhân.');
    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1e1f23] border border-gray-200 dark:border-[#333] w-full max-w-md rounded-2xl shadow-2xl p-6 relative animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 rounded-full p-2 transition-colors"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className={`p-3 rounded-xl ${type === 'groq' ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>
            <Settings size={20} />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {type === 'groq' ? t('dashboard.configApiKeyGroq', 'Cấu hình API Key (Groq)') : t('dashboard.configApiUrlFlowise', 'Cấu hình API URL (Flowise)')}
          </h3>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-5 leading-relaxed">
          {type === 'groq'
            ? t('dashboard.configApiKeyGroqDesc', 'Nhập API Key Groq cá nhân của bạn để sử dụng các model Llama, Mixtral... Key được lưu trực tiếp trên trình duyệt (localStorage) của bạn và không lưu trên cơ sở dữ liệu server.')
            : t('dashboard.configApiUrlFlowiseDesc', 'Nhập địa chỉ URL Prediction API của Flowise để thực hiện phân tích dữ liệu chuyên sâu. URL được lưu trực tiếp trên trình duyệt của bạn.')}
        </p>

        <div className="space-y-4 mb-6">
          {type === 'groq' ? (
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{t('dashboard.groqApiKeyLabel', 'Groq API Key')}</label>
              <input
                type="password"
                value={tempApiKey}
                onChange={(e) => setTempApiKey(e.target.value)}
                placeholder="gsk_..."
                className="w-full px-4 py-3 bg-gray-50 dark:bg-[#131417] border border-gray-200 dark:border-[#333] rounded-xl text-sm outline-none focus:border-blue-500 dark:focus:border-blue-500 transition-colors text-gray-900 dark:text-white placeholder-gray-400"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{t('dashboard.flowiseApiUrlLabel', 'Flowise API Endpoint URL')}</label>
              <input
                type="text"
                value={tempApiUrl}
                onChange={(e) => setTempApiUrl(e.target.value)}
                placeholder="http://localhost:3000/api/v1/prediction/..."
                className="w-full px-4 py-3 bg-gray-50 dark:bg-[#131417] border border-gray-200 dark:border-[#333] rounded-xl text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-500 transition-colors text-gray-900 dark:text-white placeholder-gray-400"
              />
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end items-center">
          <button
            onClick={clearApiKeyConfig}
            className="px-4 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors"
          >
            {t('dashboard.clearConfig', 'Xóa cấu hình')}
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#26272b] rounded-xl transition-colors"
            >
              {t('dashboard.cancel', 'Hủy')}
            </button>
            <button
              onClick={saveApiKeyConfig}
              className={`px-5 py-2.5 text-sm font-medium text-white rounded-xl shadow-md transition-all active:scale-95 ${type === 'groq' ? 'bg-[#3b82f6] hover:bg-[#2563eb]' : 'bg-[#10b981] hover:bg-[#059669]'}`}
            >
              {t('dashboard.saveConfig', 'Lưu cấu hình')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;
