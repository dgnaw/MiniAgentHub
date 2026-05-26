import { create } from 'zustand';

const applyTheme = (theme) => {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
};

const initialTheme = localStorage.getItem('theme') || 'dark';
applyTheme(initialTheme);

const useThemeStore = create((set) => ({
  theme: initialTheme,
  setTheme: (newTheme) => {
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
    set({ theme: newTheme });
  }
}));

export default useThemeStore;
