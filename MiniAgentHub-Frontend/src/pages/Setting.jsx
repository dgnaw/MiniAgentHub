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

const Settings = () => {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout); 
  const updateUser = useAuthStore((state) => state.updateUser); 
  const navigate = useNavigate();

  const handleSignOut = () => {
    if (logout) logout(); 
    localStorage.removeItem('agentHub_token'); 
    navigate('/login');
  };

  const handleClearHistory = async () => {
    if (window.confirm(t('settings.clearChatHistoryConfirm'))) {
      try {
        await axiosClient.delete('/chat-sessions');
        alert('Đã xóa lịch sử trò chuyện thành công!');
        window.location.reload(); 
      } catch (error) {
        console.error('Lỗi khi xóa lịch sử:', error);
        alert('Có lỗi xảy ra khi xóa lịch sử chat.');
      }
    }
  };

  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState(user?.phone || '');
  const [isSavingPhone, setIsSavingPhone] = useState(false);

  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [addressInput, setAddressInput] = useState(user?.address || '');
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  const handleUpdatePhone = async () => {
    if (!user?.id) return;
    setIsSavingPhone(true);
    try {
      await axiosClient.put(`/users/${user.id}`, { phone: phoneInput });
      updateUser({ phone: phoneInput }); 
      setIsEditingPhone(false);
    } catch (error) {
      console.error(error);
      alert('Lỗi khi cập nhật số điện thoại.');
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
    } catch (error) {
      console.error(error);
      alert('Lỗi khi cập nhật địa chỉ.');
    } finally {
      setIsSavingAddress(false);
    }
  };

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-[#131417] text-gray-900 dark:text-white font-sans overflow-hidden">
      <Sidebar />
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-10">
        
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-gray-800 dark:text-gray-200 font-semibold text-lg pb-2">
            <User size={20} className="text-gray-500 dark:text-gray-400" />
            <h2>{t('settings.personalInformation')}</h2>
          </div>

          <div className="space-y-3">
            <div className="bg-white dark:bg-[#1a1b20] border border-gray-200 dark:border-[#26272b] rounded-xl p-4 flex items-center justify-between shadow-sm dark:shadow-none">
              <div className="flex items-center gap-4 w-full">
                <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-[#222328] flex items-center justify-center text-blue-500 dark:text-blue-400 shrink-0">
                  <Phone size={18} />
                </div>
                <div className="flex-1 mr-4">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-200">{t('settings.phoneNumber')}</h4>
                  {isEditingPhone ? (
                    <input 
                      type="text" 
                      value={phoneInput} 
                      onChange={(e) => setPhoneInput(e.target.value)}
                      className="mt-1.5 w-full bg-gray-50 dark:bg-[#131417] border border-gray-300 dark:border-[#333] rounded-md px-3 py-1.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
                      placeholder="Nhập số điện thoại..."
                    />
                  ) : (
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">{user?.phone || t('settings.notUpdated')}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                {isEditingPhone ? (
                  <>
                    <button onClick={handleUpdatePhone} disabled={isSavingPhone} className="bg-[#006ecf] hover:bg-[#005bb1] text-white px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50">
                      {isSavingPhone ? 'Saving...' : t('settings.save')}
                    </button>
                    <button onClick={() => { setIsEditingPhone(false); setPhoneInput(user?.phone || ''); }} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors">
                      {t('settings.cancel')}
                    </button>
                  </>
                ) : (
                  <button onClick={() => setIsEditingPhone(true)} className="bg-[#006ecf] hover:bg-[#005bb1] text-white px-5 py-1.5 rounded-lg text-xs font-semibold transition-colors">
                    {t('settings.update')}
                  </button>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-[#1a1b20] border border-gray-200 dark:border-[#26272b] rounded-xl p-4 flex items-center justify-between shadow-sm dark:shadow-none">
              <div className="flex items-center gap-4 w-full">
                <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-[#222328] flex items-center justify-center text-blue-500 dark:text-blue-400 shrink-0">
                  <MapPin size={18} />
                </div>
                <div className="flex-1 mr-4">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-200">{t('settings.address')}</h4>
                  {isEditingAddress ? (
                    <input 
                      type="text" 
                      value={addressInput} 
                      onChange={(e) => setAddressInput(e.target.value)}
                      className="mt-1.5 w-full bg-gray-50 dark:bg-[#131417] border border-gray-300 dark:border-[#333] rounded-md px-3 py-1.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
                      placeholder="Nhập địa chỉ..."
                    />
                  ) : (
                    <p className="text-xs text-gray-500 mt-0.5">{user?.address || 'Chưa cập nhật'}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                {isEditingAddress ? (
                  <>
                    <button onClick={handleUpdateAddress} disabled={isSavingAddress} className="bg-[#006ecf] hover:bg-[#005bb1] text-white px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50">
                      {isSavingAddress ? 'Saving...' : t('settings.save')}
                    </button>
                    <button onClick={() => { setIsEditingAddress(false); setAddressInput(user?.address || ''); }} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors">
                      {t('settings.cancel')}
                    </button>
                  </>
                ) : (
                  <button onClick={() => setIsEditingAddress(true)} className="bg-[#006ecf] hover:bg-[#005bb1] text-white px-5 py-1.5 rounded-lg text-xs font-semibold transition-colors">
                    {t('settings.update')}
                  </button>
                )}
              </div>
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
            <div className="bg-white dark:bg-[#1a1b20] border border-gray-200 dark:border-[#26272b] rounded-xl p-4 flex items-center justify-between shadow-sm dark:shadow-none">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-[#222328] flex items-center justify-center text-blue-500 dark:text-blue-400">
                  <Key size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-200">{t('settings.passwordSecurity')}</h4>
                  <p className="text-xs text-gray-500 mt-0.5">{t('settings.passwordDescription')}</p>
                </div>
              </div>
              <button onClick={() => setIsPasswordModalOpen(true)} className="bg-[#006ecf] hover:bg-[#005bb1] text-white px-5 py-1.5 rounded-lg text-xs font-semibold transition-colors">
                {t('settings.update')}
              </button>
            </div>

            {/* Clear Chat History Row */}
            <div className="bg-white dark:bg-[#1a1b20] border border-gray-200 dark:border-[#26272b] rounded-xl p-4 flex items-center justify-between shadow-sm dark:shadow-none">
              <div className="flex items-center gap-4">
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
                className="bg-transparent hover:bg-red-50 dark:hover:bg-red-950 text-red-500 dark:text-red-400 border border-red-200 dark:border-red-900/60 hover:border-red-500 px-6 py-1.5 rounded-lg text-xs font-semibold transition-all"
              >
                {t('settings.clear')}
              </button>
            </div>

            {/* Sign Out Row */}
            <div className="bg-white dark:bg-[#1a1b20] border border-gray-200 dark:border-[#26272b] rounded-xl p-4 flex items-center justify-between shadow-sm dark:shadow-none">
              <div className="flex items-center gap-4">
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
                className="bg-gray-100 dark:bg-[#26272b] hover:bg-gray-200 dark:hover:bg-[#33353b] text-gray-700 dark:text-gray-300 px-4 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 dark:border-[#3a3b40] transition-colors"
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
    </div>
  );
};

export default Settings;