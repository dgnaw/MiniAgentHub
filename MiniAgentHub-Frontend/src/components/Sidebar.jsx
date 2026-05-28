import { useState, useEffect } from 'react';
import useAuthStore from '../store/authStore';
import { MessageSquare, Settings, Users, User, LogOut } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import axiosClient from '../services/axiosClient';
import useThemeStore from '../store/themeStore';
import { useTranslation } from 'react-i18next';

function Sidebar() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const role = useAuthStore((state) => state.role);
  const permissions = useAuthStore((state) => state.permissions) || [];

  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  
  useThemeStore();

  const [isInGroup, setIsInGroup] = useState(false);
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const res = await axiosClient.get('/chat-sessions');
        const data = Array.isArray(res) ? res : (res.data || []);
        setSessions(data);
      } catch (error) {
        console.error("Lỗi lấy danh sách chat:", error);
      }
    };
    if (user?.id) {
      fetchSessions();
    }
  }, [user, location.pathname]); 

  useEffect(() => {
    const checkUserGroups = async () => {
      try {
        const response = await axiosClient.get(`/users/${user.id}`);
        
        const responseData = response.data || response; 
        
        const userData = responseData.user || responseData;

        useAuthStore.setState(state => {
          const currentRoleFromServer = userData.Role?.name || userData.role || (userData.role_id === 1 ? 'Admin' : 'User');
          const isRoleChanged = state.user?.role !== currentRoleFromServer;
          
          if (isRoleChanged) {
            // Nếu quyền bị thay đổi (vd: từ Admin xuống User), buộc đăng xuất để làm mới token và mảng permissions
            if (state.user?.role === 'Admin' && currentRoleFromServer !== 'Admin') {
               setTimeout(() => {
                  alert(t('sidebar.roleChanged', 'Quyền hạn của bạn đã thay đổi. Hệ thống sẽ đăng xuất để cập nhật!'));
                  logout();
                  navigate('/login');
               }, 300);
            }
            return { user: { ...state.user, role: currentRoleFromServer } };
          }
          return state;
        });

        const userGroups = userData.Groups || userData.groups || [];
        
        if (userGroups.length > 0) {
          setIsInGroup(true);
        } else {
          setIsInGroup(false);
        }
      } catch (error) {
        console.error("Lỗi kiểm tra nhóm của user:", error);
      }
    };

    if (user?.id) {
      checkUserGroups();
    }
    // SỬA LỖI TẠI ĐÂY: Thêm location.pathname vào dependency để trigger chạy lại mỗi khi chuyển tab
  }, [user, location.pathname]);

  const handleLogout = () => {
    if (window.confirm(t('sidebar.logoutConfirm'))) {
      logout(); 
      navigate('/login'); 
    }
  };

  const getNavClass = (path) => {
    const isActive = location.pathname === path;
    return isActive 
      ? "flex items-center gap-3 w-full px-4 py-3 bg-blue-50 dark:bg-[#1a233a] text-blue-600 dark:text-blue-400 rounded-lg cursor-pointer transition-colors"
      : "flex items-center gap-3 w-full px-4 py-3 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#1a1a1a] hover:text-gray-900 dark:hover:text-gray-200 rounded-lg cursor-pointer transition-colors";
  };

  return (
    <div className="w-80 bg-white dark:bg-[#0d0d0d] border-r border-gray-200 dark:border-gray-800 h-screen flex flex-col text-gray-900 dark:text-white">
      <div className="p-6 flex-1 flex flex-col min-h-0">
        <h2 className="text-xl font-bold mb-8 text-gray-900 dark:text-white tracking-wide shrink-0">Agent Hub</h2>
        
        <nav className="space-y-1 flex flex-col flex-1 min-h-0">
          <div 
            onClick={() => navigate('/')}
            className={`${getNavClass('/')} shrink-0`}
          >
            <MessageSquare size={20} />
            <span className="font-medium text-sm">{t('sidebar.chat')}</span>
          </div>

          {(user?.role === 'Admin' || permissions.includes('USER_R') || permissions.includes('USER_U')) && (
            <div 
              onClick={() => navigate('/users')}
              className={`${getNavClass('/users')} shrink-0`}
            >
              <User size={20} />
              <span className="font-medium text-sm">{t('sidebar.users')}</span>
            </div>
          )}

          {(user?.role === 'Admin' || permissions.includes('GROUP_R') || permissions.includes('GROUP_U') || permissions.includes('GROUP_C') || permissions.includes('GROUP_D')) && (
            <div 
              onClick={() => navigate('/groups')}
              className={`${getNavClass('/groups')} shrink-0`}
            >
              <Users size={20} />
              <span className="font-medium text-sm">{t('sidebar.group')}</span>
            </div>
          )}

          <div 
            onClick={() => navigate('/settings')}
            className={`${getNavClass('/settings')} shrink-0`}
          >
            <Settings size={20} />
            <span className="font-medium text-sm">{t('sidebar.setting')}</span>
          </div>

          {sessions.length > 0 && (
            <div className="mt-4 border-t border-gray-100 dark:border-gray-800/60 pt-4 flex flex-col flex-1 min-h-0">
              <div className="pb-2 px-4 text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider shrink-0">
                {t('sidebar.history')}
              </div>
              <div className="space-y-1 mb-2 overflow-y-auto pr-1 flex-1">
                {sessions.map((session) => (
                  <div 
                    key={session.id}
                    onClick={() => navigate(`/chat/${session.id}`)}
                    className={getNavClass(`/chat/${session.id}`)}
                    title={session.title}
                  >
                    <MessageSquare size={16} className="shrink-0 text-gray-400" />
                    <span className="font-medium text-sm truncate">{session.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </nav>
      </div>

      {user && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-[#2a2a2a] flex items-center justify-center text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
              <User size={20} />
            </div>
            
            <div className="flex flex-col text-left overflow-hidden">
              <span className="text-gray-900 dark:text-white text-sm font-semibold truncate">
                {user.full_name}
              </span>
              <span className="text-blue-500 text-[10px] tracking-widest uppercase font-bold">
                {user?.role ? t(`roles.${user.role}`) : ''}
              </span>
            </div>
          </div>

          <button 
            onClick={handleLogout}
            className="text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#1a1a1a] transition-colors"
            title={t('sidebar.logoutTitle')}
          >
            <LogOut size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

export default Sidebar;