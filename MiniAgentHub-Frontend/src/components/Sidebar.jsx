import { useState, useEffect } from 'react';
import useAuthStore from '../store/authStore';
import useSidebarStore from '../store/sidebarStore';
import { MessageSquare, Settings, Users, User, LogOut, MoreVertical, Pencil, Trash2, Check, X, Menu, PanelLeftClose, PanelLeftOpen, Share2, Copy, ChevronDown, ChevronRight, Download } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import axiosClient from '../services/axiosClient';
import useThemeStore from '../store/themeStore';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import ConfirmModal from './ConfirmModal';
import html2canvas from 'html2canvas';

function Sidebar() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const role = useAuthStore((state) => state.role);
  const permissions = useAuthStore((state) => state.permissions) || [];
  const { isCollapsed, toggleSidebar } = useSidebarStore();

  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  
  useThemeStore();

  const [isInGroup, setIsInGroup] = useState(false);
  const [sessions, setSessions] = useState([]);

  const [activeMenuId, setActiveMenuId] = useState(null);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  
  const [exportConfig, setExportConfig] = useState({
    isOpen: false,
    session: null,
    format: 'md',
    fileName: '',
    isExporting: false
  });
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, type: '', data: null });
  const [shareSessionId, setShareSessionId] = useState(null);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(true);

  useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null);
    const handleSessionsCleared = () => setSessions([]);
    
    document.addEventListener('click', handleClickOutside);
    window.addEventListener('sessions-cleared', handleSessionsCleared);
    
    return () => {
      document.removeEventListener('click', handleClickOutside);
      window.removeEventListener('sessions-cleared', handleSessionsCleared);
    };
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
        const permissionsFromServer = responseData.permissions || [];

        useAuthStore.setState(state => {
          const currentRoleFromServer = userData.Role?.name || userData.role || (userData.role_id === 1 ? 'Admin' : 'User');
          const updatedUser = {
            ...state.user,
            email: userData.email,
            full_name: userData.full_name,
            phone: userData.phone,
            address: userData.address,
            role_id: userData.role_id,
            role: currentRoleFromServer
          };

          const isUserChanged = JSON.stringify(state.user) !== JSON.stringify(updatedUser);
          
          const statePermsSorted = [...(state.permissions || [])].sort();
          const serverPermsSorted = [...permissionsFromServer].sort();
          const isPermissionsChanged = JSON.stringify(statePermsSorted) !== JSON.stringify(serverPermsSorted);

          if (isUserChanged || isPermissionsChanged) {
            const isRoleChanged = state.user?.role !== currentRoleFromServer;
            if (isRoleChanged && state.user?.role === 'Admin' && currentRoleFromServer !== 'Admin') {
               setTimeout(() => {
                  toast.error(t('sidebar.roleChanged', 'Your permissions have changed. The system will log you out to update!'));
                  logout();
                  navigate('/login');
               }, 300);
               return state;
            }
            return { 
              user: updatedUser,
              permissions: permissionsFromServer
            };
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

  useEffect(() => {
    if (shareSessionId) {
      axiosClient.put(`/chat-sessions/${shareSessionId}/share`).catch(err => {
        console.error("Lỗi khi kích hoạt chế độ công khai cho cuộc trò chuyện:", err);
      });
    }
  }, [shareSessionId]);

  const handleLogout = () => {
    setConfirmConfig({ isOpen: true, type: 'logout', data: null });
  };

  const getNavClass = (path) => {
    const isActive = location.pathname === path;
    const baseClass = isActive 
      ? "bg-blue-50 dark:bg-[#1a233a] text-blue-600 dark:text-blue-400"
      : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#1a1a1a] hover:text-gray-900 dark:hover:text-gray-200";
    return `flex items-center gap-3 ${isCollapsed ? 'md:justify-center md:gap-0 md:px-0 px-4' : 'px-4'} w-full py-3 rounded-lg cursor-pointer transition-colors ${baseClass}`;
  };

  const handleDeleteSession = async (e, sessionId) => {
    e.stopPropagation();
    setActiveMenuId(null);
    setConfirmConfig({ isOpen: true, type: 'deleteSession', data: sessionId });
  };

  const executeConfirm = async () => {
    if (confirmConfig.type === 'logout') {
      logout(); 
      navigate('/login'); 
      setConfirmConfig({ isOpen: false, type: '', data: null });
    } else if (confirmConfig.type === 'deleteSession') {
      const sessionId = confirmConfig.data;
      try {
        await axiosClient.delete(`/chat-sessions/${sessionId}`);
        setSessions(prev => prev.filter(s => s.id !== sessionId));
        toast.success(t('sidebar.deleteSessionSuccess', 'Xóa phiên trò chuyện thành công!'));
        if (location.pathname === `/chat/${sessionId}`) {
          navigate('/');
        }
      } catch (error) {
        console.error('Lỗi xóa session:', error);
        toast.error(t('sidebar.deleteSessionError', 'Failed to delete.'));
      } finally {
        setConfirmConfig({ isOpen: false, type: '', data: null });
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
      toast.success(t('sidebar.renameSessionSuccess', 'Đổi tên phiên trò chuyện thành công!'));
    } catch (error) {
      console.error('Lỗi đổi tên:', error);
      toast.error(t('sidebar.renameSessionError', 'Failed to rename.'));
    }
  };

  const handleCancelEdit = (e) => {
    e.stopPropagation();
    setEditingSessionId(null);
  };

  const handleExportSession = (e, session) => {
    e.stopPropagation();
    setActiveMenuId(null);
    setExportConfig({
      isOpen: true,
      session: session,
      format: 'md',
      fileName: (session.title || 'chat').replace(/[^a-z0-9\u00C0-\u024F\u4e00-\u9fa5]/gi, '_').substring(0, 50),
      isExporting: false
    });
  };

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const processExport = async () => {
    const { session, format, fileName } = exportConfig;
    if (!session) return;
    
    setExportConfig(prev => ({ ...prev, isExporting: true }));

    try {
      const res = await axiosClient.get(`/chat-sessions/${session.id}/messages`);
      const messages = Array.isArray(res) ? res : (res.data || []);
      const finalFileName = fileName.trim() || 'export';

      if (format === 'json') {
        const jsonStr = JSON.stringify(messages, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
        downloadBlob(blob, `${finalFileName}.json`);
      } 
      else if (format === 'csv') {
        let csvContent = "Role,Content,Time\n";
        messages.forEach(msg => {
          const role = msg.role === 'ai' ? 'AI' : 'User';
          const content = (msg.content || '').replace(/"/g, '""');
          const time = msg.createdAt ? new Date(msg.createdAt).toLocaleString() : new Date().toLocaleString();
          csvContent += `"${role}","${content}","${time}"\n`;
        });
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8' });
        downloadBlob(blob, `${finalFileName}.csv`);
      }
      else if (format === 'txt') {
        const lines = [`Chat Session: ${session.title || 'Untitled'}`, `Exported: ${new Date().toLocaleString()}`, ''];
        messages.forEach(msg => {
          lines.push(`${msg.role === 'ai' ? 'AI' : 'User'}:`);
          lines.push(msg.content || '');
          lines.push('----------------------------------------');
        });
        const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
        downloadBlob(blob, `${finalFileName}.txt`);
      }
      else if (format === 'md') {
        const lines = [`# ${session.title || 'Chat Session'}`, `> Exported from Agent Hub — ${new Date().toLocaleString()}`, ''];
        messages.forEach(msg => {
          lines.push(`### ${msg.role === 'ai' ? '🤖 AI' : '👤 User'}`);
          lines.push(msg.content || '');
          lines.push('');
        });
        const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
        downloadBlob(blob, `${finalFileName}.md`);
      }
      else if (format === 'png') {
        const theme = useThemeStore.getState().theme;
        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.left = '-9999px';
        container.style.top = '0';
        container.style.width = '800px';
        container.style.backgroundColor = theme === 'dark' ? '#131417' : '#f9fafb';
        container.style.color = theme === 'dark' ? '#ffffff' : '#111827';
        container.style.padding = '40px';
        container.style.fontFamily = 'sans-serif';
        
        const title = document.createElement('h2');
        title.innerText = session.title || 'Chat Session';
        title.style.textAlign = 'center';
        title.style.marginBottom = '30px';
        title.style.color = theme === 'dark' ? '#ffffff' : '#111827';
        container.appendChild(title);

        messages.forEach(msg => {
          const msgDiv = document.createElement('div');
          msgDiv.style.marginBottom = '20px';
          msgDiv.style.display = 'flex';
          msgDiv.style.flexDirection = 'column';
          msgDiv.style.alignItems = msg.role === 'user' ? 'flex-end' : 'flex-start';

          const bubble = document.createElement('div');
          bubble.style.maxWidth = '80%';
          bubble.style.padding = '15px 20px';
          bubble.style.borderRadius = '16px';
          bubble.style.lineHeight = '1.5';
          bubble.innerText = msg.content || ''; 
          
          if (msg.role === 'user') {
            bubble.style.backgroundColor = '#2563eb';
            bubble.style.color = '#ffffff';
            bubble.style.borderBottomRightRadius = '4px';
          } else {
            bubble.style.backgroundColor = theme === 'dark' ? '#1e1f24' : '#ffffff';
            bubble.style.border = theme === 'dark' ? '1px solid #2a2b30' : '1px solid #e5e7eb';
            bubble.style.color = theme === 'dark' ? '#e5e7eb' : '#374151';
            bubble.style.borderBottomLeftRadius = '4px';
          }

          msgDiv.appendChild(bubble);
          container.appendChild(msgDiv);
        });

        document.body.appendChild(container);
        
        const canvas = await html2canvas(container, {
          backgroundColor: theme === 'dark' ? '#131417' : '#f9fafb',
          scale: 2,
          logging: false
        });
        
        document.body.removeChild(container);

        const imgUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = imgUrl;
        a.download = `${finalFileName}.png`;
        a.click();
      }

      toast.success(t('sidebar.exportSuccess', 'Chat exported!'));
      setExportConfig(prev => ({ ...prev, isOpen: false }));
    } catch (err) {
      console.error('Export error:', err);
      toast.error(t('sidebar.exportError', 'Failed to export chat.'));
    } finally {
      setExportConfig(prev => ({ ...prev, isExporting: false }));
    }
  };

  return (
    <>
      {/* Mobile Top Header Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white/90 dark:bg-[#131417]/90 backdrop-blur-md border-b border-gray-200 dark:border-[#26272b] z-30 flex items-center justify-between px-4 shadow-sm">
        <div className="flex items-center">
          <button onClick={() => setIsMobileOpen(true)} className="p-2 -ml-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#26272b] rounded-lg transition-colors">
            <Menu size={22} />
          </button>
          <span className="font-bold text-gray-900 dark:text-white ml-2 tracking-wide">Agent Hub</span>
        </div>
      </div>

      {/* Overlay tối mờ khi mở Sidebar trên Mobile */}
      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={() => setIsMobileOpen(false)} />
      )}

      <div className={`fixed inset-y-0 left-0 z-50 transform ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition-all duration-300 ${isCollapsed ? 'w-80 md:w-20' : 'w-80'} bg-white dark:bg-[#0d0d0d] border-r border-gray-200 dark:border-gray-800 h-screen flex flex-col text-gray-900 dark:text-white shrink-0`}>
      <div className="p-6 flex-1 flex flex-col min-h-0">
        <div className={`flex items-center ${isCollapsed ? 'md:justify-center justify-between' : 'justify-between'} mb-8 shrink-0`}>
          <h2 className={`text-xl font-bold text-gray-900 dark:text-white tracking-wide truncate ${isCollapsed ? 'md:hidden' : ''}`}>Agent Hub</h2>
          <div className="flex items-center gap-2">
            <button 
              onClick={toggleSidebar}
              className={`hidden md:flex p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-[#26272b] transition-colors ${isCollapsed ? '' : '-mr-2'}`}
              title={isCollapsed ? "Mở rộng Sidebar" : "Thu gọn Sidebar"}
            >
              {isCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
            </button>
            <button className="md:hidden text-gray-500 hover:text-gray-900 dark:hover:text-white" onClick={() => setIsMobileOpen(false)}>
              <X size={20} />
            </button>
          </div>
        </div>
        
        <nav className="space-y-1 flex flex-col flex-1 min-h-0">
          <div 
            onClick={() => { navigate('/'); setIsMobileOpen(false); }}
            className={`${getNavClass('/')} shrink-0`}
          >
            <MessageSquare size={20} />
            <span className={`font-medium text-sm ${isCollapsed ? 'md:hidden' : ''}`}>{t('sidebar.chat', 'Chat')}</span>
          </div>

          {(user?.role === 'Admin' || permissions.includes('USER_R') || permissions.includes('USER_U')) && (
            <div 
              onClick={() => { navigate('/users'); setIsMobileOpen(false); }}
              className={`${getNavClass('/users')} shrink-0`}
            >
              <User size={20} />
              <span className={`font-medium text-sm ${isCollapsed ? 'md:hidden' : ''}`}>{t('sidebar.users', 'Users')}</span>
            </div>
          )}

          {(user?.role === 'Admin' || permissions.includes('GROUP_R') || permissions.includes('GROUP_U') || permissions.includes('GROUP_C') || permissions.includes('GROUP_D')) && (
            <div 
              onClick={() => { navigate('/groups'); setIsMobileOpen(false); }}
              className={`${getNavClass('/groups')} shrink-0`}
            >
              <Users size={20} />
              <span className={`font-medium text-sm ${isCollapsed ? 'md:hidden' : ''}`}>{t('sidebar.group', 'Groups')}</span>
            </div>
          )}

          <div 
            onClick={() => { navigate('/settings'); setIsMobileOpen(false); }}
            className={`${getNavClass('/settings')} shrink-0`}
          >
            <Settings size={20} />
            <span className={`font-medium text-sm ${isCollapsed ? 'md:hidden' : ''}`}>{t('sidebar.setting', 'Settings')}</span>
          </div>

          {sessions.length > 0 && (
            <div className="mt-4 border-t border-gray-100 dark:border-gray-800/60 pt-4 flex flex-col flex-1 min-h-0">
              <div 
                className={`pb-2 px-4 text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider shrink-0 flex items-center ${isCollapsed ? 'md:justify-center md:px-0' : 'justify-between cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 transition-colors'}`}
                onClick={() => !isCollapsed && setIsHistoryExpanded(!isHistoryExpanded)}
              >
                <span className={isCollapsed ? 'md:hidden' : ''}>{t('sidebar.history', 'History')}</span>
                <span className={`hidden ${isCollapsed ? 'md:inline' : ''}`}>...</span>
                {!isCollapsed && (
                  isHistoryExpanded ? <ChevronDown size={14} className="opacity-70" /> : <ChevronRight size={14} className="opacity-70" />
                )}
              </div>
              
              {isHistoryExpanded && (
                <div className="space-y-1 mb-2 overflow-y-auto pr-1 flex-1">
                {sessions.map((session) => (
                  <div 
                    key={session.id}
                    onClick={() => { navigate(`/chat/${session.id}`); setIsMobileOpen(false); }}
                    className={`relative group ${getNavClass(`/chat/${session.id}`)}`}
                    title={session.title}
                  >
                    <MessageSquare size={16} className="shrink-0 text-gray-400" />
                    
                    {editingSessionId === session.id ? (
                      <div className={`flex items-center gap-2 flex-1 w-full ${isCollapsed ? 'md:hidden' : ''}`} onClick={e => e.stopPropagation()}>
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
                        <span className={`font-medium text-sm truncate flex-1 ${isCollapsed ? 'md:hidden' : ''}`}>{session.title}</span>
                        
                        <div className={`opacity-0 group-hover:opacity-100 transition-opacity flex items-center shrink-0 ${activeMenuId === session.id ? 'opacity-100' : ''} ${isCollapsed ? 'md:hidden' : ''}`}>
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
                            className="absolute right-4 top-10 w-36 bg-white dark:bg-[#1a1b20] border border-gray-200 dark:border-[#26272b] rounded-lg shadow-xl py-1 z-50"
                            onClick={e => e.stopPropagation()}
                          >
                            <button 
                              onClick={(e) => { e.stopPropagation(); setActiveMenuId(null); setShareSessionId(session.id); }}
                              className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#26272b] flex items-center gap-2 transition-colors"
                            >
                              <Share2 size={14} /> {t('sidebar.share', 'Share')}
                            </button>
                            <button 
                              onClick={(e) => handleStartEdit(e, session)}
                              className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#26272b] flex items-center gap-2 transition-colors"
                            >
                              <Pencil size={14} /> {t('sidebar.rename', 'Rename')}
                            </button>
                            <button 
                              onClick={(e) => handleExportSession(e, session)}
                              className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#26272b] flex items-center gap-2 transition-colors"
                            >
                              <Download size={14} /> {t('sidebar.export', 'Export')}
                            </button>
                            <div className="border-t border-gray-100 dark:border-[#333] my-1" />
                            <button 
                              onClick={(e) => handleDeleteSession(e, session.id)}
                              className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center gap-2 transition-colors"
                            >
                              <Trash2 size={14} /> {t('sidebar.delete', 'Delete')}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
                </div>
              )}
            </div>
          )}
        </nav>
      </div>

      {user && (
        <div className={`p-4 border-t border-gray-200 dark:border-gray-800 flex items-center ${isCollapsed ? 'md:justify-center' : 'justify-between'} shrink-0`}>
          <div className={`flex items-center gap-3 ${isCollapsed ? 'md:px-0' : 'px-2'}`}>
            <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-[#2a2a2a] flex items-center justify-center text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
              <User size={20} />
            </div>
            
            <div className={`flex flex-col text-left overflow-hidden ${isCollapsed ? 'md:hidden' : ''}`}>
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
            className={`text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#1a1a1a] transition-colors ${isCollapsed ? 'md:hidden' : ''}`}
            title={t('sidebar.logoutTitle', 'Log out')}
          >
            <LogOut size={18} />
          </button>
        </div>
      )}
      </div>
      
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.type === 'logout' ? t('sidebar.logoutTitle', 'Đăng xuất') : t('sidebar.delete', 'Xóa')}
        message={confirmConfig.type === 'logout' ? t('sidebar.logoutConfirm', 'Bạn có chắc chắn muốn đăng xuất khỏi hệ thống?') : t('sidebar.deleteSessionConfirm', 'Bạn có chắc chắn muốn xóa cuộc trò chuyện này?')}
        onConfirm={executeConfirm}
        onCancel={() => setConfirmConfig({ isOpen: false, type: '', data: null })}
        confirmText={confirmConfig.type === 'logout' ? t('sidebar.logoutTitle', 'Đăng xuất') : t('sidebar.delete', 'Xóa')}
        cancelText={t('confirmModal.cancel', 'Hủy')}
      />

      {/* Export Modal */}
      {exportConfig.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-[#1e1e1e] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-[#333]">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {t('sidebar.exportTitle', 'Export Session')}
              </h3>
              <button
                onClick={() => setExportConfig(prev => ({ ...prev, isOpen: false }))}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 rounded-md hover:bg-gray-100 dark:hover:bg-[#333]"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('sidebar.exportFileName', 'File Name')}
                </label>
                <input
                  type="text"
                  value={exportConfig.fileName}
                  onChange={(e) => setExportConfig(prev => ({ ...prev, fileName: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#2d2d2d] border border-gray-300 dark:border-[#444] rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-shadow"
                  placeholder="my_chat_export"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('sidebar.exportFormat', 'Format')}
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {['md', 'txt', 'csv', 'json', 'png'].map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => setExportConfig(prev => ({ ...prev, format: fmt }))}
                      className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors flex items-center justify-center uppercase ${
                        exportConfig.format === fmt
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
                          : 'border-gray-200 dark:border-[#444] text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#333]'
                      }`}
                    >
                      .{fmt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 dark:bg-[#252525] border-t border-gray-100 dark:border-[#333] flex justify-end gap-3">
              <button
                onClick={() => setExportConfig(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#333] rounded-lg transition-colors"
                disabled={exportConfig.isExporting}
              >
                {t('sidebar.exportCancel', 'Cancel')}
              </button>
              <button
                onClick={processExport}
                disabled={exportConfig.isExporting || !exportConfig.fileName.trim()}
                className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-sm transition-all flex items-center justify-center min-w-[100px]"
              >
                {exportConfig.isExporting ? t('sidebar.exporting', 'Exporting...') : t('sidebar.exportConfirm', 'Export')}
              </button>
            </div>
          </div>
        </div>
      )}

      {shareSessionId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity p-4" onClick={() => setShareSessionId(null)}>
          <div className="bg-white dark:bg-[#1a1b20] border border-gray-200 dark:border-[#26272b] rounded-2xl w-full max-w-md p-6 shadow-2xl relative animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
            <button onClick={() => setShareSessionId(null)} className="absolute top-4 right-4 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors">
              <X size={20} />
            </button>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('sidebar.shareSession', 'Share Chat')}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{t('sidebar.shareDesc', 'Copy the link below to share this chat session.')}</p>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="text"
                readOnly
                value={`${window.location.origin}/shared/chat/${shareSessionId}`}
                className="flex-1 bg-gray-50 dark:bg-[#131417] border border-gray-300 dark:border-[#333] rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/shared/chat/${shareSessionId}`);
                  toast.success(t('sidebar.copied', 'Copied to clipboard!'));
                }}
                className="bg-[#3b82f6] hover:bg-[#2563eb] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shrink-0"
              >
                <Copy size={16} />
                {t('sidebar.copyLink', 'Copy')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Sidebar;