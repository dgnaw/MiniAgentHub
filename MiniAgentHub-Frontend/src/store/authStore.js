import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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