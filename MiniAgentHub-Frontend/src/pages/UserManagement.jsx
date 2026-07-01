import React, { useState, useEffect } from 'react';
import { UserPlus, Filter, Eye, Trash2, RefreshCw, ChevronLeft, ChevronRight, Loader2, AlertCircle, X } from 'lucide-react';
import UserFormModal from '../components/UserFormModal';
import ConfirmModal from '../components/ConfirmModal';
import axiosClient from '../services/axiosClient';
import { useTranslation } from 'react-i18next';
import Sidebar from '../components/Sidebar';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';

const UserManagement = () => {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const permissions = useAuthStore((state) => state.permissions) || [];
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [isAddGroupModalOpen, setIsAddGroupModalOpen] = useState(false);
  const [allGroups, setAllGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [addGroupError, setAddGroupError] = useState('');

  const [modalConfig, setModalConfig] = useState({ isOpen: false, mode: 'create', data: null });
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  const [sortOrder, setSortOrder] = useState('newest');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  useEffect(() => {
    const handleClickOutside = () => setShowFilterDropdown(false);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const response = await axiosClient.get('/users');
      setUsers(Array.isArray(response) ? response : (response.data || []));
      setError('');
    } catch (err) {
      console.error('Lỗi khi tải danh sách users:', err);
      
      if (err.response?.status === 403) {
        toast.error(t('userManagement.forbidden', 'Quyền truy cập của bạn đã bị thay đổi! Hệ thống sẽ tự động điều hướng về trang chủ.'));
        window.location.href = '/'; 
      } else {
        setError(t('userManagement.errorLoad', 'Không thể tải danh sách người dùng.'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleDeleteUser = async (id) => {
    if (id === user?.id) {
      toast.error(t('userManagement.alertSelfDelete', 'Bạn không thể tự xóa chính tài khoản của mình!'));
      return;
    }
    setConfirmDialog({
      isOpen: true,
      title: t('userManagement.deleteConfirmTitle', 'Xác nhận xóa'),
      message: t('userManagement.deleteConfirm', 'Bạn có chắc chắn muốn xóa người dùng này?'),
      onConfirm: async () => {
        try {
          await axiosClient.delete(`/users/${id}`);
          setUsers(users.filter(u => u.id !== id));
          toast.success(t('userManagement.deleteSuccess', 'Xóa người dùng thành công!'));
        } catch (err) {
          toast.error(err.response?.data?.message || t('userManagement.deleteError', 'Xóa thất bại.'));
        }
      }
    });
  };

  const sortedUsers = [...users].sort((a, b) => {
    const nameA = (a.full_name || a.email || '').toLowerCase();
    const nameB = (b.full_name || b.email || '').toLowerCase();
    if (sortOrder === 'az') return nameA.localeCompare(nameB);
    if (sortOrder === 'za') return nameB.localeCompare(nameA);
    return 0; 
  });

  const totalPages = Math.ceil(sortedUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const displayedUsers = sortedUsers.slice(startIndex, startIndex + itemsPerPage);
  const hasPagination = totalPages > 1;

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const newIds = displayedUsers.filter(u => u.id !== user?.id).map(u => u.id);
      setSelectedUserIds(prev => [...new Set([...prev, ...newIds])]);
    } else {
      const displayedIds = displayedUsers.map(u => u.id);
      setSelectedUserIds(prev => prev.filter(id => !displayedIds.includes(id)));
    }
  };

  const handleSelectUser = (id) => {
    setSelectedUserIds(prev => 
      prev.includes(id) ? prev.filter(userId => userId !== id) : [...prev, id]
    );
  };

  const handleDeleteSelected = async () => {
    if (selectedUserIds.length === 0) return;
    if (selectedUserIds.includes(user?.id)) {
      toast.error(t('userManagement.alertSelfDelete', 'Bạn không thể tự xóa chính tài khoản của mình!'));
      return;
    }
    
    setConfirmDialog({
      isOpen: true,
      title: t('userManagement.deleteMultipleConfirmTitle', 'Xác nhận xóa'),
      message: t('userManagement.deleteMultipleConfirm', { count: selectedUserIds.length }),
      onConfirm: async () => {
        try {
          setIsLoading(true);
          await Promise.all(selectedUserIds.map(id => axiosClient.delete(`/users/${id}`)));
          setUsers(users.filter(u => !selectedUserIds.includes(u.id)));
          setSelectedUserIds([]);
          toast.success(t('userManagement.deleteMultipleSuccess', 'Đã xóa các người dùng được chọn!'));
        } catch (err) {
          console.error('Lỗi khi xóa nhiều users:', err);
          toast.error(t('userManagement.deleteMultipleError', 'Có lỗi xảy ra khi xóa một số người dùng.'));
          fetchUsers();
        } finally {
          setIsLoading(false);
        }
      }
    });
  };

  const handleOpenAddGroupModal = async () => {
    if (selectedUserIds.length === 0) return;
    setAddGroupError('');
    try {
      const res = await axiosClient.get('/groups');
      setAllGroups(Array.isArray(res) ? res : (res.data || []));
      setIsAddGroupModalOpen(true);
    } catch (err) {
      console.error('Lỗi lấy danh sách nhóm:', err);
      toast.error(t('userManagement.errorLoadGroups', 'Không thể tải danh sách nhóm.'));
    }
  };

  const handleAddSelectedToGroup = async () => {
    setAddGroupError('');
    if (!selectedGroupId) {
      setAddGroupError(t('userManagement.alertSelectGroup', 'Vui lòng chọn một nhóm!'));
      return;
    }
    try {
      await axiosClient.post(`/groups/${selectedGroupId}/users`, { userIds: selectedUserIds });
      setIsAddGroupModalOpen(false);
      setSelectedUserIds([]);
      setSelectedGroupId('');
      fetchUsers(); 
      toast.success(t('userManagement.addUsersSuccess', 'Thêm người dùng vào nhóm thành công!'));
    } catch (err) {
      console.error('Lỗi thêm vào nhóm:', err);
      setAddGroupError(t('userManagement.addUsersError', 'Có lỗi xảy ra khi thêm vào nhóm.') + ' ' + (err.response?.data?.message || ''));
    }
  };

  const handleOpenCreate = () => setModalConfig({ isOpen: true, mode: 'create', data: null });
  const handleOpenUpdate = (user) => setModalConfig({ isOpen: true, mode: 'update', data: user });

  const getInitials = (name, email) => {
    if (name) {
      const parts = name.split(' ').filter(Boolean);
      if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      return parts[0].substring(0, 2).toUpperCase();
    }
    return email ? email.substring(0, 2).toUpperCase() : 'U';
  };

  return (
    <div className="flex h-[100dvh] bg-gray-50 dark:bg-[#131417] text-gray-900 dark:text-white font-sans overflow-hidden">
        <Sidebar />
      <div className="flex-1 p-4 pt-20 md:p-10 overflow-y-auto min-w-0">
      <div className="max-w-6xl mx-auto">
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6 mb-6 md:mb-8">
          <div className="max-w-xl">
            <h1 className="text-2xl md:text-4xl font-bold mb-2 md:mb-3 text-gray-900 dark:text-white">{t('userManagement.title', 'User Management')}</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
              {t('userManagement.description', 'Orchestrate your intelligence network. Manage system permissions, roles, and collaborative groups across the Mini AgentHub ecosystem.')}
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button 
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className="flex items-center gap-2 bg-white dark:bg-[#1a1b20] hover:bg-gray-50 dark:hover:bg-[#26272b] border border-gray-200 dark:border-[#26272b] text-gray-700 dark:text-gray-300 px-5 py-2.5 rounded-xl font-medium text-sm transition-colors"
              >
                <Filter size={16} /> {t('userManagement.filter', 'Filter')}
              </button>
              {showFilterDropdown && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-[#1a1b20] border border-gray-200 dark:border-[#26272b] rounded-xl shadow-lg py-1 z-50">
                  <button onClick={() => { setSortOrder('newest'); setShowFilterDropdown(false); setCurrentPage(1); }} className={`w-full text-left px-4 py-2 text-sm ${sortOrder === 'newest' ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#26272b]'}`}>{t('userManagement.sortNewest', 'Newest')}</button>
                  <button onClick={() => { setSortOrder('az'); setShowFilterDropdown(false); setCurrentPage(1); }} className={`w-full text-left px-4 py-2 text-sm ${sortOrder === 'az' ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#26272b]'}`}>{t('userManagement.sortAZ', 'A to Z')}</button>
                  <button onClick={() => { setSortOrder('za'); setShowFilterDropdown(false); setCurrentPage(1); }} className={`w-full text-left px-4 py-2 text-sm ${sortOrder === 'za' ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#26272b]'}`}>{t('userManagement.sortZA', 'Z to A')}</button>
                </div>
              )}
            </div>
            {(user?.role === 'Admin' || permissions.includes('USER_C')) && (
              <button 
                onClick={handleOpenCreate}
                className="flex items-center gap-2 bg-[#b5d6ff] hover:bg-[#9cc4f5] text-[#0b1c3f] px-5 py-2.5 rounded-xl font-bold text-sm transition-colors"
              >
                <UserPlus size={16} /> {t('userManagement.addUser', 'Add User')}
              </button>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-[#1a1b20] border border-gray-200 dark:border-[#26272b] rounded-2xl shadow-lg flex flex-col overflow-hidden w-full">
          
          <div className="px-4 md:px-6 py-4 border-b border-gray-200 dark:border-[#26272b] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-[#1a1b20]">
            <div className="flex items-center gap-4">
               <input 
                 type="checkbox" 
                 checked={displayedUsers.length > 0 && displayedUsers.every(u => selectedUserIds.includes(u.id))}
                 onChange={handleSelectAll}
                 className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-[#2a2b30] accent-blue-500 cursor-pointer" 
               />
               <span className="text-sm text-gray-700 dark:text-gray-300">
                 {selectedUserIds.length > 0 ? t('userManagement.selectedCount', '{{count}} Đã chọn', { count: selectedUserIds.length }) : `${users.length} ${t('userManagement.usersTotal', 'Users Total')}`}
               </span>
            </div>
            <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
              {(user?.role === 'Admin' || permissions.includes('USER_U')) && (
                <button 
                  onClick={handleOpenAddGroupModal}
                  disabled={selectedUserIds.length === 0}
                  className={`text-xs font-bold tracking-widest flex items-center gap-2 transition-colors ${selectedUserIds.length === 0 ? 'text-gray-600 cursor-not-allowed' : 'text-[#a5c6f7] hover:text-white'}`}
                >
                  <UserPlus size={14} /> {t('userManagement.addToGroup', 'ADD TO GROUP')}
                </button>
              )}
              {(user?.role === 'Admin' || permissions.includes('USER_D')) && (
                <button 
                  onClick={handleDeleteSelected}
                  disabled={selectedUserIds.length === 0}
                  className={`text-xs font-bold tracking-widest transition-colors ${selectedUserIds.length === 0 ? 'text-gray-600 cursor-not-allowed' : 'text-red-400 hover:text-red-300'}`}
                >
                  {t('userManagement.deleteSelected', 'DELETE SELECTED')}
                </button>
              )}
            </div>
          </div>

          <div className="w-full overflow-x-auto custom-scrollbar">
            <div className="min-w-full md:min-w-[900px]">
          {/* --- Table Header (Desktop Only) --- */}
          <div className="hidden md:grid grid-cols-12 px-4 md:px-6 py-4 border-b border-gray-200 dark:border-[#26272b] bg-gray-50 dark:bg-[#1a1b20] items-center">
            <div className="col-span-4 text-[10px] font-bold text-gray-500 tracking-[0.15em] uppercase pl-[60px]">{t('userManagement.colName', 'Name')}</div>
            <div className="col-span-3 text-[10px] font-bold text-gray-500 tracking-[0.15em] uppercase">{t('userManagement.colEmail', 'Email')}</div>
            <div className="col-span-2 text-[10px] font-bold text-gray-500 tracking-[0.15em] uppercase">{t('userManagement.colRole', 'Role')}</div>
            <div className="col-span-2 text-[10px] font-bold text-gray-500 tracking-[0.15em] uppercase">{t('userManagement.colGroups', 'Nhóm')}</div>
            <div className="col-span-1 text-[10px] font-bold text-gray-500 tracking-[0.15em] uppercase text-right">{t('userManagement.colActions', 'Actions')}</div>
          </div>

          <div className="divide-y divide-gray-200 dark:divide-[#26272b]">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Loader2 className="animate-spin mb-3 text-blue-500" size={28} />
                <p className="text-sm font-medium tracking-wide">{t('userManagement.loading', 'Đang tải dữ liệu...')}</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12 text-red-400">
                <AlertCircle className="mb-3" size={28} />
                <p className="text-sm">{error}</p>
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-12 text-gray-500 text-sm tracking-wide">{t('userManagement.emptyUser', 'Chưa có người dùng nào.')}</div>
            ) : (
            displayedUsers.map((u) => {
              const isCurrentUser = u.id === user?.id;
              return (
              <div key={u.id} className="block md:grid md:grid-cols-12 px-4 py-4 md:px-6 items-center hover:bg-gray-50 dark:hover:bg-[#1e1f25] transition-colors group">
                
                <div className="md:col-span-4 flex items-center justify-between md:justify-start gap-4">
                  <div className="flex items-center gap-3 md:gap-4 min-w-0">
                    <input 
                      type="checkbox" 
                      checked={selectedUserIds.includes(u.id)}
                      onChange={() => handleSelectUser(u.id)}
                      disabled={isCurrentUser}
                      className={`w-4 h-4 shrink-0 rounded border-gray-300 dark:border-gray-600 accent-blue-500 ${isCurrentUser ? 'bg-gray-200 opacity-50 cursor-not-allowed' : 'bg-gray-50 dark:bg-[#2a2b30] cursor-pointer'}`} 
                    />
                    <div className="w-8 h-8 shrink-0 rounded-full bg-gray-200 dark:bg-[#2a2b30] text-gray-700 dark:text-gray-300 flex items-center justify-center text-xs font-bold">
                      {getInitials(u.full_name, u.email)}
                    </div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-200 cursor-pointer hover:text-blue-600 dark:hover:text-white truncate" onClick={() => handleOpenUpdate(u)}>
                      {u.full_name || t('userManagement.noName', 'No Name')} {isCurrentUser && <span className="text-blue-500 text-xs font-normal ml-1 shrink-0">(Bạn)</span>}
                    </span>
                  </div>
                  
                  {/* --- Mobile Actions --- */}
                  <div className="md:hidden flex items-center justify-end gap-2 text-gray-400 dark:text-gray-500 shrink-0">
                    <button className="hover:text-gray-900 dark:hover:text-white transition-colors" onClick={() => handleOpenUpdate(u)} title={t('userManagement.tooltipView', 'View Details')}><Eye size={16} /></button>
                    {(user?.role === 'Admin' || permissions.includes('USER_U')) && (
                      <button className="hover:text-gray-900 dark:hover:text-white transition-colors" onClick={() => handleOpenUpdate(u)} title={t('userManagement.tooltipReset', 'Reset Password')}><RefreshCw size={16} /></button>
                    )}
                    {(user?.role === 'Admin' || permissions.includes('USER_D')) && !isCurrentUser && (
                      <button className="hover:text-red-600 dark:hover:text-red-400 transition-colors" onClick={() => handleDeleteUser(u.id)} title={t('userManagement.tooltipDelete', 'Delete User')}><Trash2 size={16} /></button>
                    )}
                  </div>
                </div>
                
                {/* --- Mobile Details --- */}
                <div className="md:hidden grid grid-cols-2 gap-x-4 gap-y-2 text-sm mt-3 pl-12">
                  <div className="text-gray-500">{t('userManagement.colEmail', 'Email')}</div>
                  <div className="text-gray-800 dark:text-gray-300 truncate text-right">{u.email}</div>

                  <div className="text-gray-500">{t('userManagement.colRole', 'Role')}</div>
                  <div className="text-right">
                    <span className={`text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-full border ${(u.role_id === 1 || u.Role?.name === 'Admin') ? 'bg-blue-50 dark:bg-[#1e2b4d] text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20' : 'bg-gray-100 dark:bg-[#2a2b30] text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600/30'}`}>
                      {(u.role_id === 1 || u.Role?.name === 'Admin') ? t('roles.Admin', 'ADMIN').toUpperCase() : t('roles.User', 'USER').toUpperCase()}
                    </span>
                  </div>

                  <div className="text-gray-500">{t('userManagement.colGroups', 'Nhóm')}</div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-full border bg-gray-100 dark:bg-[#2a2b30] text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600/30">
                      {u.Groups?.length || 0} {t('userManagement.groupsCountBadge', 'NHÓM')}
                    </span>
                  </div>
                </div>

                {/* --- Desktop Columns --- */}
                <div className="hidden md:block md:col-span-3 text-sm text-gray-500 dark:text-gray-400 truncate pr-2">{u.email}</div>
                <div className="hidden md:block md:col-span-2"><span className={`text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-full border ${(u.role_id === 1 || u.Role?.name === 'Admin') ? 'bg-blue-50 dark:bg-[#1e2b4d] text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20' : 'bg-gray-100 dark:bg-[#2a2b30] text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600/30'}`}>{(u.role_id === 1 || u.Role?.name === 'Admin') ? t('roles.Admin', 'ADMIN').toUpperCase() : t('roles.User', 'USER').toUpperCase()}</span></div>
                <div className="hidden md:block md:col-span-2"><span className="text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-full border bg-gray-100 dark:bg-[#2a2b30] text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600/30">{u.Groups?.length || 0} {t('userManagement.groupsCountBadge', 'NHÓM')}</span></div>
                <div className="hidden md:flex md:col-span-1 items-center justify-end gap-3 text-gray-400 dark:text-gray-500">
                  <button className="hover:text-gray-900 dark:hover:text-white transition-colors" onClick={() => handleOpenUpdate(u)} title={t('userManagement.tooltipView', 'View Details')}><Eye size={16} /></button>
                  {(user?.role === 'Admin' || permissions.includes('USER_U')) && (
                    <button className="hover:text-gray-900 dark:hover:text-white transition-colors" onClick={() => handleOpenUpdate(u)} title={t('userManagement.tooltipReset', 'Reset Password')}><RefreshCw size={16} /></button>
                  )}
                  {(user?.role === 'Admin' || permissions.includes('USER_D')) && !isCurrentUser && (
                    <button className="hover:text-red-600 dark:hover:text-red-400 transition-colors" onClick={() => handleDeleteUser(u.id)} title={t('userManagement.tooltipDelete', 'Delete User')}><Trash2 size={16} /></button>
                  )}
                </div>
              </div>
            );
          }))}
          </div>
            </div>
          </div>

          <div className="px-4 md:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-200 dark:border-[#26272b] bg-white dark:bg-[#1a1b20]">
            <span className="text-sm text-gray-500 dark:text-gray-400">{t('userManagement.totalUsers', 'Total Users: {{count}}', { count: users.length })}</span>
            
            {hasPagination && (
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-1 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={18} />
                </button>
                
                {[...Array(totalPages)].map((_, idx) => (
                  <button 
                    key={idx}
                    onClick={() => setCurrentPage(idx + 1)}
                    className={`w-8 h-8 rounded-lg text-sm flex items-center justify-center transition-colors ${currentPage === idx + 1 ? 'bg-blue-100 dark:bg-[#d1e5fb] text-blue-800 dark:text-[#0f2c6b] font-bold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#26272b]'}`}
                  >
                    {idx + 1}
                  </button>
                ))}

                <button 
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-1 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

      <UserFormModal 
        isOpen={modalConfig.isOpen}
        mode={modalConfig.mode}
        initialData={modalConfig.data}
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
        onSuccess={fetchUsers}
      />

      {isAddGroupModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-sans">
          <div className="bg-white dark:bg-[#1a1b20] border border-gray-200 dark:border-[#26272b] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-[#26272b] flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t('userManagement.modalAddGroupTitle', 'Thêm {{count}} người dùng vào nhóm', { count: selectedUserIds.length })}</h2>
              <button onClick={() => setIsAddGroupModalOpen(false)} className="text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                {t('userManagement.selectTargetGroup', 'Chọn nhóm đích')} <span className="text-red-500">*</span>
              </label>
              <select 
                value={selectedGroupId}
                onChange={(e) => {
                  setSelectedGroupId(e.target.value);
                  if (e.target.value) setAddGroupError('');
                }}
                className={`w-full bg-white dark:bg-[#131417] border ${addGroupError ? 'border-red-500' : 'border-gray-300 dark:border-[#26272b] focus:border-[#3b82f6]'} rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white outline-none transition-colors`}
              >
                <option value="">{t('userManagement.placeholderSelectGroup', '-- Chọn nhóm --')}</option>
                {allGroups.map(g => (
                  <option key={g.id} value={g.id}>{g.name || g.group_name} ({g.member_count || g.memberCount || g.members?.length || 0} {t('userManagement.members', 'thành viên')})</option>
                ))}
              </select>
              {addGroupError && <p className="text-red-500 text-sm mt-2">{addGroupError}</p>}
            </div>
            <div className="p-6 pt-0 flex justify-end gap-3">
              <button onClick={() => setIsAddGroupModalOpen(false)} className="px-5 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#26272b] rounded-xl transition-colors">
                {t('userManagement.cancel', 'Hủy')}
              </button>
              <button onClick={handleAddSelectedToGroup} className="bg-[#3b82f6] hover:bg-[#2563eb] text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-blue-900/20 transition-all">
                {t('userManagement.btnAddGroup', 'Thêm vào nhóm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
      <ConfirmModal 
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={confirmDialog.onConfirm}
        isDanger={true}
      />
    </div>
  );
};

export default UserManagement;