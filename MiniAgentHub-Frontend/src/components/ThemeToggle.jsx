import React from 'react';
import { Moon, Sun } from 'lucide-react';
import useThemeStore from '../store/themeStore';
import { useTranslation } from 'react-i18next';

const ThemeToggle = () => {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const { t } = useTranslation();


  return (
    <div className="grid grid-cols-2 gap-2 bg-gray-50 dark:bg-[#131417] p-1 rounded-xl border border-gray-200 dark:border-[#26272b]">
      <button 
        onClick={() => setTheme('dark')}
        className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium transition-all ${
          theme === 'dark' 
            ? 'bg-white dark:bg-[#1a1b20] text-gray-900 dark:text-white border border-gray-200 dark:border-[#333] shadow-md' 
            : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
        }`}
      >
        <Moon size={14} />
        {t('theme.dark')}
      </button>
      <button 
        onClick={() => setTheme('light')}
        className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium transition-all ${
          theme === 'light' 
            ? 'bg-white dark:bg-[#1a1b20] text-gray-900 dark:text-white border border-gray-200 dark:border-[#333] shadow-md' 
            : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
        }`}
      >
        <Sun size={14} />
        {t('theme.light')}
      </button>
    </div>
  );
};

export default ThemeToggle;
