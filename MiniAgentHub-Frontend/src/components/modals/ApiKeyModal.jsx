import React, { useState, useEffect } from 'react';
import { X, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import axiosClient from '../../services/axiosClient';

const ApiKeyModal = ({ isOpen, type, user, onClose, onSuccess }) => {
  const { t } = useTranslation();
  
  const [tempApiKey, setTempApiKey] = useState('');
  const [tempApiUrl, setTempApiUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && user?.id) {
      axiosClient.get(`/users/${user.id}`)
        .then((res) => {
          const userData = res.user || res.data?.user || {};
          if (type === 'groq') {
            const key = userData.groq_api_key;
            setTempApiKey(key ? `••••••••••••••••••••••••••••` : '');
          } else {
            const url = userData.flowise_api_url;
            setTempApiUrl(url ? `••••••••••••••••••••••••••••` : '');
          }
        })
        .catch(err => {
          console.error('Error loading user info:', err);
        });
    }
  }, [isOpen, type, user]);

  if (!isOpen) return null;

  const saveApiKeyConfig = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const payload = {};
      if (type === 'groq') {
        const val = tempApiKey.trim();
        if (val !== '••••••••••••••••••••••••••••') {
          payload.groq_api_key = val || null;
        }
      } else {
        const val = tempApiUrl.trim();
        if (val !== '••••••••••••••••••••••••••••') {
          payload.flowise_api_url = val || null;
        }
      }

      if (Object.keys(payload).length === 0) {
        onSuccess();
        onClose();
        return;
      }

      await axiosClient.put(`/users/${user.id}`, payload);
      toast.success(type === 'groq' ? t('dashboard.saveGroqKeySuccess') : t('dashboard.saveFlowiseUrlSuccess'));
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(error.message || 'Lỗi khi lưu cấu hình.');
    } finally {
      setIsLoading(false);
    }
  };



  return (
    <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1e1f23] border border-gray-200 dark:border-[#333] w-full max-w-md rounded-2xl shadow-2xl p-6 relative animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-4 right-4 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 rounded-full p-2 transition-colors disabled:opacity-50"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className={`p-3 rounded-xl ${type === 'groq' ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>
            <Settings size={20} />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {type === 'groq' ? t('dashboard.configApiKeyGroq') : t('dashboard.configApiUrlFlowise')}
          </h3>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-5 leading-relaxed">
          {type === 'groq'
            ? t('dashboard.configApiKeyGroqDesc')
            : t('dashboard.configApiUrlFlowiseDesc')}
        </p>

        <div className="space-y-4 mb-6">
          {type === 'groq' ? (
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{t('dashboard.groqApiKeyLabel')} <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={tempApiKey}
                onChange={(e) => setTempApiKey(e.target.value)}
                onFocus={(e) => { if (tempApiKey === '••••••••••••••••••••••••••••') setTempApiKey(''); }}
                placeholder="gsk_..."
                disabled={isLoading}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-[#131417] border border-gray-200 dark:border-[#333] rounded-xl text-sm outline-none focus:border-blue-500 dark:focus:border-blue-500 transition-colors text-gray-900 dark:text-white placeholder-gray-400"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{t('dashboard.flowiseApiUrlLabel')} <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={tempApiUrl}
                onChange={(e) => setTempApiUrl(e.target.value)}
                onFocus={(e) => { if (tempApiUrl === '••••••••••••••••••••••••••••') setTempApiUrl(''); }}
                placeholder="http://localhost:3000/api/v1/prediction/..."
                disabled={isLoading}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-[#131417] border border-gray-200 dark:border-[#333] rounded-xl text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-500 transition-colors text-gray-900 dark:text-white placeholder-gray-400"
              />
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end items-center">

          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#26272b] rounded-xl transition-colors disabled:opacity-50"
            >
              {t('dashboard.cancel')}
            </button>
            <button
              onClick={saveApiKeyConfig}
              disabled={isLoading || (type === 'groq' ? !tempApiKey.trim() || tempApiKey === '••••••••••••••••••••••••••••' : !tempApiUrl.trim() || tempApiUrl === '••••••••••••••••••••••••••••')}
              className={`px-5 py-2.5 text-sm font-medium text-white rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50 ${type === 'groq' ? 'bg-[#3b82f6] hover:bg-[#2563eb]' : 'bg-[#10b981] hover:bg-[#059669]'}`}
            >
              {t('dashboard.saveConfig')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;
