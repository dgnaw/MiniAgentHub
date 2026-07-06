import React, { useState } from 'react';
import { X } from 'lucide-react';
import axiosClient from '../../services/axiosClient';
import { useTranslation } from 'react-i18next';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';

const ChangePasswordModal = ({ isOpen, onClose, isForced = false }) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [oldPasswordError, setOldPasswordError] = useState('');
  const [newPasswordError, setNewPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [apiError, setApiError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  
  const [t] = useTranslation();

  if (!isOpen) return null;

  const validateOldPassword = (val) => {
    return val ? '' : t('change-password-modal.errorOld');
  };

  const validateNewPassword = (val) => {
    return val.length >= 6 ? '' : t('change-password-modal.errorLength');
  };

  const validateConfirmPassword = (val, newPwd) => {
    return val === newPwd ? '' : t('change-password-modal.errorMatch');
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setApiError('');
    setPasswordSuccess('');

    const oErr = validateOldPassword(oldPassword);
    const nErr = validateNewPassword(newPassword);
    const cErr = validateConfirmPassword(confirmPassword, newPassword);

    if (oErr || nErr || cErr) {
      setOldPasswordError(oErr);
      setNewPasswordError(nErr);
      setConfirmPasswordError(cErr);
      return;
    }

    setIsSavingPassword(true);
    try {
      const res = await axiosClient.put('/users/change-password', { old_password: oldPassword, new_password: newPassword });
      
      const successMsg = res.message || t('change-password-modal.success');
      setPasswordSuccess(successMsg);
      toast.success(successMsg);

      // If we change password successfully, we should also update the mustChangePassword state if it exists.
      useAuthStore.getState().setMustChangePassword(false);

      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (error) {
      console.error(error);
      const errorMsg = error.response?.data?.message || t('change-password-modal.errorChange');
      setApiError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleClose = () => {
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setOldPasswordError('');
    setNewPasswordError('');
    setConfirmPasswordError('');
    setApiError('');
    setPasswordSuccess('');
    useAuthStore.getState().setMustChangePassword(false);
    if (onClose) onClose();
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('change-password-modal.oldPassword')}</label>
            <input
              type="password"
              autoComplete="new-password"
              value={oldPassword}
              onChange={(e) => {
                setOldPassword(e.target.value);
                setOldPasswordError(validateOldPassword(e.target.value));
              }}
              onBlur={(e) => setOldPasswordError(validateOldPassword(e.target.value))}
              placeholder={t('change-password-modal.placeholderOldPassword')}
              className={`w-full bg-gray-50 dark:bg-[#131417] border ${oldPasswordError ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 dark:border-[#333] focus:border-blue-500 focus:ring-1 focus:ring-blue-500'} rounded-lg px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none transition-colors`}
              required
            />
            {oldPasswordError && <p className="text-red-500 dark:text-red-400 text-xs mt-1">{oldPasswordError}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('change-password-modal.newPassword')}</label>
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                setNewPasswordError(validateNewPassword(e.target.value));
                if (confirmPassword) {
                  setConfirmPasswordError(validateConfirmPassword(confirmPassword, e.target.value));
                }
              }}
              onBlur={(e) => setNewPasswordError(validateNewPassword(e.target.value))}
              placeholder={t('change-password-modal.placeholderNewPassword')}
              className={`w-full bg-gray-50 dark:bg-[#131417] border ${newPasswordError ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 dark:border-[#333] focus:border-blue-500 focus:ring-1 focus:ring-blue-500'} rounded-lg px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none transition-colors`}
              required
            />
            {newPasswordError && <p className="text-red-500 dark:text-red-400 text-xs mt-1">{newPasswordError}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('change-password-modal.newPasswordConfirm')}</label>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setConfirmPasswordError(validateConfirmPassword(e.target.value, newPassword));
              }}
              onBlur={(e) => setConfirmPasswordError(validateConfirmPassword(e.target.value, newPassword))}
              placeholder={t('change-password-modal.placeholderNewPasswordConfirm')}
              className={`w-full bg-gray-50 dark:bg-[#131417] border ${confirmPasswordError ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 dark:border-[#333] focus:border-blue-500 focus:ring-1 focus:ring-blue-500'} rounded-lg px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none transition-colors`}
              required
            />
            {confirmPasswordError && <p className="text-red-500 dark:text-red-400 text-xs mt-1">{confirmPasswordError}</p>}
          </div>

          {apiError && <p className="text-red-400 text-sm">{apiError}</p>}
          {passwordSuccess && <p className="text-green-400 text-sm">{passwordSuccess}</p>}

          <button
            type="submit"
            disabled={isSavingPassword}
            className="w-full bg-[#006ecf] hover:bg-[#005bb1] text-white font-semibold py-2.5 rounded-lg mt-4 transition-colors disabled:opacity-50"
          >
            {isSavingPassword ? t('change-password-modal.saving') : ''}{t('change-password-modal.updatePassword')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordModal;
