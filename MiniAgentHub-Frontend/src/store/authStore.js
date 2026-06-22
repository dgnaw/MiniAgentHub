import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// File này lưu trữ dữ liệu người dùng sau khi đã lấy được từ axiosClient.js
const useAuthStore = create(
  persist(
    (set) => ({

      user: null,            
      permissions: [],       
      isAuthenticated: false,
      mustChangePassword: false,

      
      setLoginData: (userData, userPermissions, mustChangePassword = false) => {
        set({
          user: userData,
          permissions: userPermissions,
          isAuthenticated: true,
          mustChangePassword: mustChangePassword,
        });
      },

      setMustChangePassword: (val) => set({ mustChangePassword: val }),

      updateUser: (updatedData) => {
        set((state) => ({
          user: { ...state.user, ...updatedData }
        }));
      },

      logout: () => {
        localStorage.removeItem('agentHub_token');
        
        set({
          user: null,
          permissions: [],
          isAuthenticated: false,
          mustChangePassword: false,
        });
      }
    }),
    {
      name: 'auth-storage', 
    }
  )
);

export default useAuthStore;