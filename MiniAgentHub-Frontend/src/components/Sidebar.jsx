import { useState, useEffect } from 'react';
import useAuthStore from '../store/authStore';
import { MessageSquare, Settings, Users, User, LogOut, MoreVertical, Pencil, Trash2, Check, X } from 'lucide-react';
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

  const [activeMenuId, setActiveMenuId] = useState(null);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editTitle, setEditTitle] = useState('');

  useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

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

  const handleDeleteSession = async (e, sessionId) => {
    e.stopPropagation();
    setActiveMenuId(null);
    if (window.confirm(t('sidebar.deleteSessionConfirm', 'Bạn có chắc chắn muốn xóa cuộc trò chuyện này?'))) {
      try {
        await axiosClient.delete(`/chat-sessions/${sessionId}`);
        setSessions(prev => prev.filter(s => s.id !== sessionId));
        if (location.pathname === `/chat/${sessionId}`) {
          navigate('/');
        }
      } catch (error) {
        console.error('Lỗi xóa session:', error);
        alert(t('sidebar.deleteSessionError', 'Xóa thất bại.'));
      }
    }
  };

  const handleStartEdit = (e, session) => {
    e.stopPropagation();
    setActiveMenuId(null);
    setEditingSessionId(session.id);
    setEditTitle(session.title);
  };

  const handleSaveEdit = async (e, sessionId) => {
    e.stopPropagation();
    if (!editTitle.trim()) return;
    try {
      await axiosClient.put(`/chat-sessions/${sessionId}`, { title: editTitle.trim() });
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title: editTitle.trim() } : s));
      setEditingSessionId(null);
    } catch (error) {
      console.error('Lỗi đổi tên:', error);
      alert(t('sidebar.renameSessionError', 'Đổi tên thất bại.'));
    }
  };

  const handleCancelEdit = (e) => {
    e.stopPropagation();
    setEditingSessionId(null);
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
                    className={`relative group ${getNavClass(`/chat/${session.id}`)}`}
                    title={session.title}
                  >
                    <MessageSquare size={16} className="shrink-0 text-gray-400" />
                    
                    {editingSessionId === session.id ? (
                      <div className="flex items-center gap-2 flex-1 w-full" onClick={e => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={e => setEditTitle(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSaveEdit(e, session.id);
                            if (e.key === 'Escape') handleCancelEdit(e);
                          }}
                          className="flex-1 bg-white dark:bg-[#131417] text-sm text-gray-900 dark:text-white px-2 py-1 rounded outline-none border border-blue-500 w-full min-w-0"
                          autoFocus
                        />
                        <button onClick={e => handleSaveEdit(e, session.id)} className="text-green-500 hover:text-green-600 shrink-0"><Check size={16}/></button>
                        <button onClick={e => handleCancelEdit(e)} className="text-red-500 hover:text-red-600 shrink-0"><X size={16}/></button>
                      </div>
                    ) : (
                      <>
                        <span className="font-medium text-sm truncate flex-1">{session.title}</span>
                        
                        <div className={`opacity-0 group-hover:opacity-100 transition-opacity flex items-center shrink-0 ${activeMenuId === session.id ? 'opacity-100' : ''}`}>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuId(activeMenuId === session.id ? null : session.id);
                            }}
                            className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors rounded"
                          >
                            <MoreVertical size={14} />
                          </button>
                        </div>
                        
                        {activeMenuId === session.id && (
                          <div 
                            className="absolute right-4 top-10 w-32 bg-white dark:bg-[#1a1b20] border border-gray-200 dark:border-[#26272b] rounded-lg shadow-xl py-1 z-50"
                            onClick={e => e.stopPropagation()}
                          >
                            <button 
                              onClick={(e) => handleStartEdit(e, session)}
                              className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#26272b] flex items-center gap-2 transition-colors"
                            >
                              <Pencil size={14} /> {t('sidebar.rename', 'Đổi tên')}
                            </button>
                            <button 
                              onClick={(e) => handleDeleteSession(e, session.id)}
                              className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center gap-2 transition-colors"
                            >
                              <Trash2 size={14} /> {t('sidebar.delete', 'Xóa')}
                            </button>
                          </div>
                        )}
                      </>
                    )}
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