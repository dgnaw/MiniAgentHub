import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ShieldCheck, ArrowLeft, Mail, X } from 'lucide-react';

import axiosClient from '../services/axiosClient';
import useAuthStore from '../store/authStore';
import { useTranslation } from 'react-i18next';
import ThemeToggle from '../components/common/ThemeToggle';
import useThemeStore from '../store/themeStore';
import toast from 'react-hot-toast';

function Login() {
  const navigate = useNavigate();
  const setLoginData = useAuthStore((state) => state.setLoginData);
  const { t } = useTranslation();
  useThemeStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [isSendingForgot, setIsSendingForgot] = useState(false);
  const [forgotError, setForgotError] = useState('');
  
  const [forgotStep, setForgotStep] = useState(1);
  const [tempPassword, setTempPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const validateEmail = (val) => {
    if (!val) {
      return t('login.emailRequired');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(val)) {
      return t('login.emailInvalid');
    }
    return '';
  };

  const validatePassword = (val) => {
    if (!val) {
      return t('login.passwordRequired');
    }
    if (val.length < 6) {
      return t('login.passwordLength');
    }
    return '';
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    const eErr = validateEmail(email);
    const pErr = validatePassword(password);

    if (eErr || pErr) {
      setEmailError(eErr);
      setPasswordError(pErr);
      return;
    }

    setIsLoading(true);

    try {
      const data = await axiosClient.post('/login', { email, password });
      setLoginData(data.user, data.permissions, data.must_change_password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || t('login.loginFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setForgotError('');
    if (!forgotEmail.trim()) {
      setForgotError(t('login.emailRequired'));
      return;
    }
    
    setIsSendingForgot(true);
    try {
      const data = await axiosClient.post('/forgot-password', { email: forgotEmail.trim() });
      toast.success(data.message || t('login.resetPasswordSuccess'));
      setForgotStep(2);
    } catch (err) {
      setForgotError(err.response?.data?.message || t('login.resetPasswordError'));
    } finally {
      setIsSendingForgot(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetError('');
    if (!tempPassword || !newPassword || !confirmPassword) {
      setResetError(t('login.fillAllFields'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError(t('login.passwordMismatch'));
      return;
    }
    if (newPassword.length < 6) {
      setResetError(t('login.passwordTooShort'));
      return;
    }

    setIsResettingPassword(true);
    try {
      const loginData = await axiosClient.post('/login', { email: forgotEmail.trim(), password: tempPassword });
      await axiosClient.put('/users/change-password', { old_password: tempPassword, new_password: newPassword });
      toast.success(t('login.changePasswordSuccess'));
      setIsForgotModalOpen(false);
      setLoginData(loginData.user, loginData.permissions, false);
      navigate('/');
    } catch (err) {
      setResetError(err.response?.data?.message || t('login.changePasswordError'));
    } finally {
      setIsResettingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#131417] text-gray-900 dark:text-white flex flex-col items-center justify-center relative px-6 sm:px-8 transition-colors duration-300">
      <div className="absolute top-0 w-full flex justify-between items-center p-6">
        <h1 className="text-xl font-bold tracking-wider text-gray-900 dark:text-white">Agent Hub</h1>
        <div className="w-40">
          <ThemeToggle />
        </div>
      </div>

      <div className="bg-white dark:bg-[#1a1b20] w-full max-w-md mt-5 p-8 rounded-2xl border border-gray-200 dark:border-[#26272b] shadow-2xl transition-colors duration-300">
        <div className="mb-8">
          <p className="text-blue-500 text-xs font-semibold tracking-widest mb-2 uppercase">
            {t('login.secureAccess')}
          </p>
          <h2 className="text-3xl font-bold mb-2">{t('login.title')}</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {t('login.description')}
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5" noValidate>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('login.emailLabel')} <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                const val = e.target.value;
                setEmail(val);
                setEmailError(validateEmail(val));
              }}
              onBlur={(e) => {
                setEmailError(validateEmail(e.target.value));
              }}
              placeholder={t('login.emailPlaceholder')}
              className={`w-full bg-gray-50 dark:bg-[#131417] border ${emailError ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : error ? 'border-red-500' : 'border-gray-300 dark:border-[#26272b] focus:border-blue-500 focus:ring-1 focus:ring-blue-500'} rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 transition-colors`}
            />
            {emailError && <p className="text-red-500 dark:text-red-400 text-xs mt-1">{emailError}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('login.passwordLabel')} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  const val = e.target.value;
                  setPassword(val);
                  setPasswordError(validatePassword(val));
                }}
                onBlur={(e) => {
                  setPasswordError(validatePassword(e.target.value));
                }}
                placeholder={t('login.passwordPlaceholder')}
                className={`w-full bg-gray-50 dark:bg-[#131417] border ${passwordError ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : error ? 'border-red-500' : 'border-gray-300 dark:border-[#26272b] focus:border-blue-500 focus:ring-1 focus:ring-blue-500'} rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 transition-colors`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {passwordError && <p className="text-red-500 dark:text-red-400 text-xs mt-1">{passwordError}</p>}
            <div className="flex justify-end mt-2">
              <button
                type="button"
                onClick={() => setIsForgotModalOpen(true)}
                className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline transition-colors focus:outline-none"
              >
                {t('login.forgotPassword')}
              </button>
            </div>
          </div>

          {error && <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg mt-4 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? t('login.authenticating') : t('login.submitBtn')}
          </button>
        </form>
      </div>

      <div className="flex gap-6 mt-8 text-xs text-gray-500 uppercase tracking-widest font-medium">
        <span className="flex items-center gap-2">
          <ShieldCheck size={14} /> {t('login.encrypted')}
        </span>
        <span className="flex items-center gap-2">
          <ShieldCheck size={14} /> {t('login.certified')}
        </span>
      </div>

      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1a1b20] w-full max-w-md p-6 rounded-2xl border border-gray-200 dark:border-[#26272b] shadow-2xl relative">
            <button 
              onClick={() => { 
                setIsForgotModalOpen(false); 
                setForgotError(''); 
                setResetError('');
                setForgotEmail(''); 
                setTempPassword('');
                setNewPassword('');
                setConfirmPassword('');
                setForgotStep(1);
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X size={20} />
            </button>
            
            {forgotStep === 1 ? (
              <>
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('login.resetPasswordTitle')}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('login.resetPasswordDesc')}
                  </p>
                </div>

                <form onSubmit={handleForgotPassword} className="space-y-4" noValidate>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      {t('login.emailLabel')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => { setForgotEmail(e.target.value); setForgotError(''); }}
                      placeholder={t('login.emailPlaceholder')}
                      className="w-full bg-gray-50 dark:bg-[#131417] border border-gray-300 dark:border-[#26272b] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white focus:outline-none transition-colors"
                      autoFocus
                    />
                    {forgotError && <p className="text-red-500 dark:text-red-400 text-xs mt-1.5">{forgotError}</p>}
                  </div>
                  <button
                    type="submit"
                    disabled={isSendingForgot}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg mt-2 transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
                  >
                    {isSendingForgot ? t('login.sending') : (
                      <>
                        <Mail size={16} />
                        {t('login.sendNewPassword')}
                      </>
                    )}
                  </button>
                </form>
              </>
            ) : (
              <>
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('login.changePasswordTitle')}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('login.changePasswordDesc1')}<strong>{forgotEmail}</strong>{t('login.changePasswordDesc2')}
                  </p>
                </div>

                <form onSubmit={handleResetPassword} className="space-y-4" noValidate>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      {t('login.tempPasswordLabel')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={tempPassword}
                      onChange={(e) => { setTempPassword(e.target.value); setResetError(''); }}
                      className="w-full bg-gray-50 dark:bg-[#131417] border border-gray-300 dark:border-[#26272b] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white focus:outline-none transition-colors"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      {t('login.newPasswordLabel')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => { setNewPassword(e.target.value); setResetError(''); }}
                      className="w-full bg-gray-50 dark:bg-[#131417] border border-gray-300 dark:border-[#26272b] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      {t('login.confirmPasswordLabel')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); setResetError(''); }}
                      className="w-full bg-gray-50 dark:bg-[#131417] border border-gray-300 dark:border-[#26272b] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white focus:outline-none transition-colors"
                    />
                    {resetError && <p className="text-red-500 dark:text-red-400 text-xs mt-1.5">{resetError}</p>}
                  </div>
                  <button
                    type="submit"
                    disabled={isResettingPassword}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg mt-2 transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
                  >
                    {isResettingPassword ? t('login.updating') : t('login.updateAndLoginBtn')}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Login;