import React, { useState } from 'react';
import { 
  User, 
  Phone, 
  MapPin, 
  Palette, 
  Globe, 
  Shield, 
  Key, 
  Trash2, 
  LogOut
} from 'lucide-react';
import useAuthStore from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import axiosClient from '../services/axiosClient';
import ThemeToggle from '../components/ThemeToggle';
import { useTranslation } from 'react-i18next';
import LanguageToggle from '../components/LanguageToggle';
import ChangePasswordModal from '../components/ChangePasswordModal';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';

const Settings = () => {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout); 
  const updateUser = useAuthStore((state) => state.updateUser); 
  const navigate = useNavigate();
  const [confirmDeleteHistory, setConfirmDeleteHistory] = useState(false);

  const handleSignOut = () => {
    if (logout) logout(); 
    localStorage.removeItem('agentHub_token'); 
    navigate('/login');
  };

  const handleClearHistory = async () => {
    setConfirmDeleteHistory(true);
  };

  const executeClearHistory = async () => {
    try {
      await axiosClient.delete('/chat-sessions');
      window.dispatchEvent(new Event('sessions-cleared'));
      toast.success(t('settings.clearSuccess', 'Chat history cleared successfully!'));
    } catch (error) {
      console.error('Lỗi khi xóa lịch sử:', error);
      toast.error(t('settings.clearError', 'Error clearing chat history.'));
    }
  };

  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState(user?.phone || '');
  const [phoneError, setPhoneError] = useState('');
  const [isSavingPhone, setIsSavingPhone] = useState(false);

  const validatePhone = (val) => {
    const trimmedPhone = val.trim();
    if (trimmedPhone !== '' && !/^[0-9]{10}$/.test(trimmedPhone)) {
      return t('settings.invalidPhone', 'Invalid phone number (exactly 10 digits).');
    }
    return '';
  };

  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [addressInput, setAddressInput] = useState(user?.address || '');
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  const handleUpdatePhone = async () => {
    if (!user?.id) return;

    const trimmedPhone = phoneInput.trim();
    const err = validatePhone(trimmedPhone);
    if (err) {
      setPhoneError(err);
      return;
    }

    setIsSavingPhone(true);
    try {
      await axiosClient.put(`/users/${user.id}`, { phone: trimmedPhone });
      updateUser({ phone: trimmedPhone }); 
      setIsEditingPhone(false);
      toast.success(t('settings.save', 'Lưu thành công'));
    } catch (error) {
      console.error(error);
      toast.error(t('settings.updatePhoneError', 'Error updating phone number.'));
    } finally {
      setIsSavingPhone(false);
    }
  };

  const handleUpdateAddress = async () => {
    if (!user?.id) return;
    setIsSavingAddress(true);
    try {
      await axiosClient.put(`/users/${user.id}`, { address: addressInput });
      updateUser({ address: addressInput });
      setIsEditingAddress(false);
      toast.success(t('settings.save', 'Lưu thành công'));
    } catch (error) {
      console.error(error);
      toast.error(t('settings.updateAddressError', 'Error updating address.'));
    } finally {
      setIsSavingAddress(false);
    }
  };

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  return (
    <div className="flex h-[100dvh] bg-gray-50 dark:bg-[#131417] text-gray-900 dark:text-white font-sans overflow-hidden">
      <Sidebar />
      <div className="flex-1 p-4 pt-20 md:p-8 overflow-y-auto min-w-0">
        <div className="max-w-4xl mx-auto space-y-10">
        
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-gray-800 dark:text-gray-200 font-semibold text-lg pb-2">
            <User size={20} className="text-gray-500 dark:text-gray-400" />
            <h2>{t('settings.personalInformation')}</h2>
          </div>

          <div className="space-y-3">
            <div className={`bg-white dark:bg-[#1a1b20] border ${isEditingPhone ? 'border-blue-500/50' : 'border-gray-200 dark:border-[#26272b]'} rounded-xl p-4 shadow-sm dark:shadow-none transition-colors`}>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 w-full sm:flex-1">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-[#222328] flex items-center justify-center text-blue-500 dark:text-blue-400 shrink-0">
                    <Phone size={18} />
                  </div>
                  <div className="flex-1 mr-4">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-200">{t('settings.phoneNumber')}</h4>
                    {!isEditingPhone && (
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">{user?.phone || t('settings.notUpdated', 'Not updated')}</p>
                    )}
                  </div>
                </div>
                {!isEditingPhone && (
                  <div className="flex gap-2 shrink-0 justify-end">
                    <button onClick={() => setIsEditingPhone(true)} className="bg-[#006ecf] hover:bg-[#005bb1] text-white px-5 py-1.5 rounded-lg text-xs font-semibold transition-colors">
                      {t('settings.update')}
                    </button>
                  </div>
                )}
              </div>
              
              {isEditingPhone && (
                <div className="mt-4 pl-0 sm:pl-14 flex flex-col sm:flex-row gap-3 items-start sm:items-start">
                  <div className="flex-1 w-full">
                    <input 
                      type="text" 
                      value={phoneInput} 
                      onChange={(e) => {
                        setPhoneInput(e.target.value);
                        setPhoneError(validatePhone(e.target.value));
                      }}
                      onBlur={(e) => setPhoneError(validatePhone(e.target.value))}
                      className={`w-full bg-gray-50 dark:bg-[#131417] border ${phoneError ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 dark:border-[#333] focus:border-blue-500'} rounded-md px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none transition-colors`}
                      placeholder={t('settings.phonePlaceholder', 'Enter phone number...')}
                      autoFocus
                    />
                    {phoneError && <p className="text-red-500 dark:text-red-400 text-xs mt-1.5">{phoneError}</p>}
                  </div>
                  <div className="flex gap-2 shrink-0 w-full sm:w-auto mt-1 sm:mt-0">
                    <button onClick={handleUpdatePhone} disabled={isSavingPhone} className="flex-1 sm:flex-none bg-[#006ecf] hover:bg-[#005bb1] text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
                      {isSavingPhone ? t('settings.saving', 'Saving...') : t('settings.save')}
                    </button>
                    <button onClick={() => { setIsEditingPhone(false); setPhoneInput(user?.phone || ''); setPhoneError(''); }} className="flex-1 sm:flex-none bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 px-5 py-2 rounded-lg text-sm font-semibold transition-colors">
                      {t('settings.cancel')}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className={`bg-white dark:bg-[#1a1b20] border ${isEditingAddress ? 'border-blue-500/50' : 'border-gray-200 dark:border-[#26272b]'} rounded-xl p-4 shadow-sm dark:shadow-none transition-colors`}>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 w-full sm:flex-1">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-[#222328] flex items-center justify-center text-blue-500 dark:text-blue-400 shrink-0">
                    <MapPin size={18} />
                  </div>
                  <div className="flex-1 mr-4">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-200">{t('settings.address')}</h4>
                    {!isEditingAddress && (
                      <p className="text-xs text-gray-500 mt-0.5">{user?.address || t('settings.notUpdated', 'Not updated')}</p>
                    )}
                  </div>
                </div>
                {!isEditingAddress && (
                  <div className="flex gap-2 shrink-0 justify-end">
                    <button onClick={() => setIsEditingAddress(true)} className="bg-[#006ecf] hover:bg-[#005bb1] text-white px-5 py-1.5 rounded-lg text-xs font-semibold transition-colors">
                      {t('settings.update')}
                    </button>
                  </div>
                )}
              </div>

              {isEditingAddress && (
                <div className="mt-4 pl-0 sm:pl-14 flex flex-col sm:flex-row gap-3 items-start sm:items-start">
                  <div className="flex-1 w-full">
                    <input 
                      type="text" 
                      value={addressInput} 
                      onChange={(e) => setAddressInput(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-[#131417] border border-gray-300 dark:border-[#333] rounded-md px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
                      placeholder={t('settings.addressPlaceholder', 'Enter address...')}
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-2 shrink-0 w-full sm:w-auto mt-1 sm:mt-0">
                    <button onClick={handleUpdateAddress} disabled={isSavingAddress} className="flex-1 sm:flex-none bg-[#006ecf] hover:bg-[#005bb1] text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
                      {isSavingAddress ? t('settings.saving', 'Saving...') : t('settings.save')}
                    </button>
                    <button onClick={() => { setIsEditingAddress(false); setAddressInput(user?.address || ''); }} className="flex-1 sm:flex-none bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 px-5 py-2 rounded-lg text-sm font-semibold transition-colors">
                      {t('settings.cancel')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2 text-gray-800 dark:text-gray-200 font-semibold text-lg pb-2">
            <Palette size={20} className="text-gray-500 dark:text-gray-400" />
            <h2>{t('settings.personalization')}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 bg-white dark:bg-[#1a1b20] border border-gray-200 dark:border-[#26272b] rounded-xl p-5 flex flex-col justify-between gap-6 shadow-sm dark:shadow-none">
              <div>
                <span className="text-[10px] font-bold text-gray-500 tracking-widest uppercase">{t('settings.visualStyle')}</span>
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-200 mt-1">{t('settings.interfaceTheme')}</h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  {t('settings.themeDescription')}
                </p>
              </div>
              
              <ThemeToggle />
            </div>

            <div className="bg-white dark:bg-[#1a1b20] border border-gray-200 dark:border-[#26272b] rounded-xl p-5 flex flex-col justify-between gap-6 shadow-sm dark:shadow-none">
              <div>
                <span className="text-[10px] font-bold text-gray-500 tracking-widest uppercase">{t('settings.global')}</span>
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-200 mt-1">{t('settings.language')}</h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  {t('settings.languageDescription')}
                </p>
              </div>

              <LanguageToggle />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2 text-gray-800 dark:text-gray-200 font-semibold text-lg pb-2">
            <Shield size={20} className="text-gray-500 dark:text-gray-400" />
            <h2>{t('settings.accountSecurity')}</h2>
          </div>

          <div className="space-y-3">
            {/* Password & Security Row */}
            <div className="bg-white dark:bg-[#1a1b20] border border-gray-200 dark:border-[#26272b] rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm dark:shadow-none">
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-[#222328] flex items-center justify-center text-blue-500 dark:text-blue-400">
                  <Key size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-200">{t('settings.passwordSecurity')}</h4>
                  <p className="text-xs text-gray-500 mt-0.5">{t('settings.passwordDescription')}</p>
                </div>
              </div>
              <button onClick={() => setIsPasswordModalOpen(true)} className="w-full sm:w-auto bg-[#006ecf] hover:bg-[#005bb1] text-white px-5 py-2 sm:py-1.5 rounded-lg text-xs font-semibold transition-colors mt-2 sm:mt-0">
                {t('settings.update')}
              </button>
            </div>

            {/* Clear Chat History Row */}
            <div className="bg-white dark:bg-[#1a1b20] border border-gray-200 dark:border-[#26272b] rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm dark:shadow-none">
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <div className="w-10 h-10 rounded-lg bg-red-50 dark:bg-[#281a1a] flex items-center justify-center text-red-500 dark:text-red-400">
                  <Trash2 size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-200">{t('settings.clearChatHistory')}</h4>
                  <p className="text-xs text-gray-500 mt-0.5">{t('settings.clearChatDescription')}</p>
                </div>
              </div>
              <button 
                onClick={handleClearHistory}
                className="w-full sm:w-auto bg-transparent hover:bg-red-50 dark:hover:bg-red-950 text-red-500 dark:text-red-400 border border-red-200 dark:border-red-900/60 hover:border-red-500 px-6 py-2 sm:py-1.5 rounded-lg text-xs font-semibold transition-all mt-2 sm:mt-0"
              >
                {t('settings.clear')}
              </button>
            </div>

            {/* Sign Out Row */}
            <div className="bg-white dark:bg-[#1a1b20] border border-gray-200 dark:border-[#26272b] rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm dark:shadow-none">
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-[#222328] flex items-center justify-center text-gray-600 dark:text-gray-400">
                  <LogOut size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-200">{t('settings.signOut')}</h4>
                  <p className="text-xs text-gray-500 mt-0.5">{t('settings.signOutDescription')}</p>
                </div>
              </div>
              <button 
                onClick={handleSignOut}
                className="w-full sm:w-auto bg-gray-100 dark:bg-[#26272b] hover:bg-gray-200 dark:hover:bg-[#33353b] text-gray-700 dark:text-gray-300 px-4 py-2 sm:py-1.5 rounded-lg text-xs font-semibold border border-gray-200 dark:border-[#3a3b40] transition-colors mt-2 sm:mt-0"
              >
                {t('settings.signOut')}
              </button>
            </div>
          </div>
        </section>

      </div>
    </div>

      <ChangePasswordModal 
        isOpen={isPasswordModalOpen} 
        onClose={() => setIsPasswordModalOpen(false)} 
      />
      
      <ConfirmModal 
        isOpen={confirmDeleteHistory}
        onClose={() => setConfirmDeleteHistory(false)}
        onConfirm={executeClearHistory}
        title={t('settings.clearChatHistory', 'Clear chat history')}
        message={t('settings.clearChatHistoryConfirm', 'Are you sure you want to delete this chat history?')}
        confirmText={t('settings.clear', 'Clear')}
      />
    </div>
  );
};

export default Settings;