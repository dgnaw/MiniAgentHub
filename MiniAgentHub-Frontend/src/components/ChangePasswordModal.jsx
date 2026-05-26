import React, { useState } from 'react';
import { X } from 'lucide-react';
import axiosClient from '../services/axiosClient';
import { useTranslation } from 'react-i18next';
const ChangePasswordModal = ({ isOpen, onClose }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [ t ] = useTranslation();
  

  if (!isOpen) return null;

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword.length < 6) {
      setPasswordError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setIsSavingPassword(true);
    try {
      const res = await axiosClient.put('/users/change-password', { new_password: newPassword });
      setPasswordSuccess(res.message || 'Đổi mật khẩu thành công!');
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (error) {
      console.error(error);
      setPasswordError(error.response?.data?.message || 'Lỗi khi đổi mật khẩu.');
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleClose = () => {
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setPasswordSuccess('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="bg-white dark:bg-[#1a1b20] border border-gray-200 dark:border-[#26272b] rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
        <button 
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{t('change-password-modal.title')}</h3>
        <p className="text-sm text-gray-400 mb-6">{t('change-password-modal.description')}</p>

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('change-password-modal.newPassword')}</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t('change-password-modal.placeholderNewPassword')}
              className="w-full bg-gray-50 dark:bg-[#131417] border border-gray-300 dark:border-[#333] rounded-lg px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('change-password-modal.newPasswordConfirm')}</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('change-password-modal.placeholderNewPasswordConfirm')}
              className="w-full bg-gray-50 dark:bg-[#131417] border border-gray-300 dark:border-[#333] rounded-lg px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
              required
            />
          </div>

          {passwordError && <p className="text-red-400 text-sm">{passwordError}</p>}
          {passwordSuccess && <p className="text-green-400 text-sm">{passwordSuccess}</p>}

          <button
            type="submit"
            disabled={isSavingPassword}
            className="w-full bg-[#006ecf] hover:bg-[#005bb1] text-white font-semibold py-2.5 rounded-lg mt-4 transition-colors disabled:opacity-50"
          >
            {isSavingPassword ? 'Saving...' : ''}{t('change-password-modal.updatePassword')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordModal;
