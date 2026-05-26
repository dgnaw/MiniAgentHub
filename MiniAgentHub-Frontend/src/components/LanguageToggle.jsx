import React, { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const LanguageToggle = () => {
  const { i18n } = useTranslation();
  const [language, setLanguage] = useState(i18n.language || 'en');

  const handleLanguageChange = (e) => {
    const newLang = e.target.value;
    setLanguage(newLang);
    i18n.changeLanguage(newLang);
    localStorage.setItem('language', newLang);
  };

  // Đồng bộ UI nếu i18n bị thay đổi ngôn ngữ từ một component khác
  useEffect(() => {
    setLanguage(i18n.language);
  }, [i18n.language]);

  return (
    <div className="relative">
      <select 
        value={language}
        onChange={handleLanguageChange}
        className="appearance-none flex items-center justify-between w-full bg-gray-50 dark:bg-[#131417] border border-gray-200 dark:border-[#26272b] hover:border-gray-300 dark:hover:border-[#444] rounded-xl px-4 py-3 text-xs text-gray-700 dark:text-gray-300 transition-colors focus:outline-none cursor-pointer"
      >
        <option value="en">English (US)</option>
        <option value="vi">Vietnamese</option>
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center">
        <ChevronDown size={14} className="text-gray-500" />
      </div>
    </div>
  );
};

export default LanguageToggle;