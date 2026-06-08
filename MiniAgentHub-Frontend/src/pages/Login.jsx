import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ShieldCheck, ArrowLeft } from 'lucide-react';

import axiosClient from '../services/axiosClient';
import useAuthStore from '../store/authStore';
import { useTranslation } from 'react-i18next';
import ThemeToggle from '../components/ThemeToggle';
import useThemeStore from '../store/themeStore';

function Login() {
  const navigate = useNavigate();
  const setLoginData = useAuthStore((state) => state.setLoginData);
  const { t } = useTranslation();
  useThemeStore(); 

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault(); 
    setError('');
    setIsLoading(true);

    try {

      const data = await axiosClient.post('/login', { email, password });


      localStorage.setItem('agentHub_token', data.token);

      setLoginData(data.user, data.permissions);

      navigate('/');
      
    } catch (err) {
      setError(err.response?.data?.message || t('login.loginFailed', 'Đăng nhập thất bại. Vui lòng kiểm tra lại!'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#131417] text-gray-900 dark:text-white flex flex-col items-center justify-center relative px-4 transition-colors duration-300">
      <div className="absolute top-0 w-full flex justify-between items-center p-6">
        <h1 className="text-xl font-bold tracking-wider text-gray-900 dark:text-white">Agent Hub</h1>
        <div className="w-40">
          <ThemeToggle />
        </div>
      </div>

      <div className="bg-white dark:bg-[#1a1b20] w-full max-w-md p-8 rounded-2xl border border-gray-200 dark:border-[#26272b] shadow-2xl transition-colors duration-300">
        <div className="mb-8">
          <p className="text-blue-500 text-xs font-semibold tracking-widest mb-2 uppercase">
            {t('login.secureAccess', 'Secure Access')}
          </p>
          <h2 className="text-3xl font-bold mb-2">{t('login.title', 'Log In')}</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {t('login.description', 'Welcome back to Agent Hub. Enter your credentials to access your dashboard.')}
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          {/* Email Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('login.emailLabel', 'Email Address')}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('login.emailPlaceholder', 'name@company.com')}
              required
              className="w-full bg-gray-50 dark:bg-[#131417] border border-gray-300 dark:border-[#26272b] rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('login.passwordLabel', 'Password')}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('login.passwordPlaceholder', 'Enter your password')}
                required
                className="w-full bg-gray-50 dark:bg-[#131417] border border-gray-300 dark:border-[#26272b] rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg mt-4 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? t('login.authenticating', 'Đang xác thực...') : t('login.submitBtn', 'Continue to Dashboard')}
          </button>
        </form>
      </div>

      <div className="flex gap-6 mt-8 text-xs text-gray-500 uppercase tracking-widest font-medium">
        <span className="flex items-center gap-2">
          <ShieldCheck size={14} /> {t('login.encrypted', 'End-to-End Encrypted')}
        </span>
        <span className="flex items-center gap-2">
          <ShieldCheck size={14} /> {t('login.certified', 'ISO 27001 Certified')}
        </span>
      </div>
    </div>
  );
}

export default Login;