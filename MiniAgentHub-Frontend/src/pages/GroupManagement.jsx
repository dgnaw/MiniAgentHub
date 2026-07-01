import React, { useState, useEffect } from 'react';
import { UserPlus, Info, Users, Settings, Trash2, Loader2, AlertCircle } from 'lucide-react';
import axiosClient from '../services/axiosClient';
import Sidebar from '../components/Sidebar';
import GroupFormModal from '../components/GroupFormModal';
import ConfirmModal from '../components/ConfirmModal';
import useAuthStore from '../store/authStore';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

const GroupManagement = () => {
  const user = useAuthStore((state) => state.user);
  const permissions = useAuthStore((state) => state.permissions) || [];
  const { t } = useTranslation();

  const [groups, setGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  const fetchGroups = async () => {
    try {
      setIsLoading(true);
      
      const hasGroupAccess = user?.role === 'Admin' || permissions.includes('GROUP_R') || permissions.includes('GROUP_U') || permissions.includes('GROUP_D');

      if (hasGroupAccess) {
        const response = await axiosClient.get('/groups');
        const data = Array.isArray(response) ? response : (response.data || []);
        setGroups(data);
      } else {
        const response = await axiosClient.get(`/users/${user.id}`);
        const responseData = response.data || response;
        const userData = responseData.user || responseData;
        const userGroups = userData.Groups || userData.groups || [];
        
        // Fetch thêm số lượng member cho mỗi nhóm vì API user không trả về member_count
        const groupsWithCounts = await Promise.all(
          userGroups.map(async (g) => {
            try {
              const detailRes = await axiosClient.get(`/groups/${g.id}`);
              const detailData = detailRes.data || detailRes;
              return {
                ...g,
                member_count: detailData.member_count || detailData.memberCount || detailData.members?.length || g.member_count || 0
              };
            } catch (err) {
              return g;
            }
          })
        );
        
        setGroups(groupsWithCounts);
      }
      setError('');
    } catch (err) {
      console.error('Lỗi tải danh sách nhóm:', err);
      setError(t('groupManagement.errorLoad', 'Không thể tải dữ liệu nhóm. Vui lòng kiểm tra lại kết nối.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleDeleteGroup = (id) => {
    setConfirmDialog({
      isOpen: true,
      title: t('groupManagement.deleteConfirmTitle', 'Xác nhận xóa'),
      message: t('groupManagement.deleteConfirm', 'Bạn có chắc chắn muốn xóa nhóm này không?'),
      onConfirm: async () => {
        try {
          await axiosClient.delete(`/groups/${id}`);
          setGroups((prev) => prev.filter((g) => g.id !== id));
          toast.success(t('groupManagement.deleteSuccess', 'Xóa nhóm thành công!'));
        } catch (err) {
          console.error('Lỗi khi xóa nhóm:', err);
          toast.error(err.response?.data?.message || err.response?.data?.error || t('groupManagement.deleteError', 'Xóa nhóm thất bại. Vui lòng thử lại sau.'));
        }
      }
    });
  };

  const handleOpenCreateModal = () => {
    setModalMode('create');
    setSelectedGroup(null);
    setIsModalOpen(true);
  };

  const handleOpenUpdateModal = (group) => {
    setModalMode('update');
    setSelectedGroup(group);
    setIsModalOpen(true);
  };

  const handleOpenMembersModal = (group) => {
    setModalMode('members');
    setSelectedGroup(group);
    setIsModalOpen(true);
  };

  const handleOpenInfoModal = (group) => {
    setModalMode('info');
    setSelectedGroup(group);
    setIsModalOpen(true);
  };

  const handleSaveGroup = async (formData) => {
    try {
      if (modalMode === 'create') {
        await axiosClient.post('/groups', formData);
        toast.success(t('groupManagement.createSuccess', 'Tạo nhóm thành công!'));
      } else {
        await axiosClient.put(`/groups/${selectedGroup.id}`, formData);
        toast.success(t('groupManagement.updateSuccess', 'Cập nhật nhóm thành công!'));
      }
      setIsModalOpen(false);
      fetchGroups(); 
    } catch (err) {
      throw err; 
    }
  };

  return (
    <div className="flex h-[100dvh] bg-gray-50 dark:bg-[#131417] text-gray-900 dark:text-white font-sans overflow-hidden">
      <Sidebar />
      
      <div className="flex-1 p-4 pt-20 md:p-10 overflow-y-auto min-w-0">
        <div className="max-w-5xl mx-auto">
        
        <div className="flex flex-col md:flex-row md:items-start md:items-center justify-between gap-4 md:gap-6 mb-6 md:mb-10">
          <div className="max-w-2xl">
            <h1 className="text-2xl md:text-4xl font-bold mb-2 md:mb-3 text-gray-900 dark:text-white">{t('groupManagement.title', 'Group Management')}</h1>
            <p className="text-gray-400 text-sm leading-relaxed">
              {t('groupManagement.description', 'Monitor and coordinate high-performance intelligence teams. View active groups, manage permissions, and inspect nested member hierarchies.')}
            </p>
          </div>
          
          {(user?.role === 'Admin' || permissions.includes('GROUP_C')) && (
            <button 
              onClick={handleOpenCreateModal}
              className="flex items-center gap-2 bg-[#d1e5fb] hover:bg-[#b8d5fa] text-[#0f2c6b] px-6 py-3 rounded-full font-semibold text-sm transition-colors shrink-0"
            >
              <UserPlus size={18} />
              {t('groupManagement.createNewGroup', 'Create New Group')}
            </button>
          )}
        </div>

        <div className="bg-white dark:bg-[#1a1b20] border border-gray-200 dark:border-[#26272b] rounded-2xl shadow-lg flex flex-col overflow-hidden w-full">
          
          <div className="px-4 md:px-6 py-5 border-b border-gray-200 dark:border-[#26272b] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-[#1a1b20]">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t('groupManagement.activeGroups', 'Active Groups')}</h2>
            <div className="bg-gray-100 dark:bg-[#2a2b30] text-gray-600 dark:text-gray-400 text-xs font-bold px-3 py-1 rounded-md tracking-widest">
              {groups.length} {t('groupManagement.total', 'TOTAL')}
            </div>
          </div>

          <div className="w-full overflow-x-auto custom-scrollbar">
            <div className="min-w-full md:min-w-[700px]">
          {/* --- Table Header (Desktop Only) --- */}
          <div className="hidden md:grid grid-cols-12 px-4 md:px-6 py-4 border-b border-gray-200 dark:border-[#26272b] bg-gray-50 dark:bg-[#1a1b20]">
            <div className="col-span-5 text-[10px] font-bold text-gray-500 tracking-[0.15em] uppercase">
              {t('groupManagement.groupName', 'Group Name')}
            </div>
            <div className="col-span-4 text-[10px] font-bold text-gray-500 tracking-[0.15em] uppercase">
              {t('groupManagement.memberCount', 'Member Count')}
            </div>
            <div className="col-span-3 text-[10px] font-bold text-gray-500 tracking-[0.15em] uppercase text-right">
              {t('groupManagement.actions', 'Actions')}
            </div>
          </div>

          <div className="divide-y divide-gray-200 dark:divide-[#26272b]">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Loader2 className="animate-spin mb-3 text-blue-500" size={28} />
                <p className="text-sm font-medium tracking-wide">{t('groupManagement.loading', 'Đang tải dữ liệu...')}</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12 text-red-400">
                <AlertCircle className="mb-3" size={28} />
                <p className="text-sm">{error}</p>
              </div>
            ) : groups.length === 0 ? (
              <div className="text-center py-12 text-gray-500 text-sm tracking-wide">
                {t('groupManagement.emptyGroup', 'Chưa có nhóm nào trong hệ thống.')}
              </div>
            ) : (
              groups.map((group) => (
                <div 
                  key={group.id} 
                  className="block md:grid md:grid-cols-12 px-4 py-4 md:px-6 items-center hover:bg-gray-50 dark:hover:bg-[#1e1f25] transition-colors group"
                >
                  {/* --- Mobile Card Layout --- */}
                  <div className="flex justify-between items-start md:contents">
                    <div className="md:col-span-5">
                      <div className="text-sm font-medium text-blue-600 dark:text-[#a5c6f7]">
                        {group.group_name || group.name || t('groupManagement.noName', 'Không có tên')}
                      </div>
                      <div className="md:hidden text-xs text-gray-500 mt-1">
                        {group.member_count || group.memberCount || group.members?.length || 0} {t('groupManagement.members', 'members')}
                      </div>
                    </div>
                    
                    <div className="hidden md:block md:col-span-4 text-sm text-gray-700 dark:text-gray-300">
                      {group.member_count || group.memberCount || group.members?.length || 0} {t('groupManagement.members', 'members')}
                    </div>
                    
                    <div className="md:col-span-3 flex items-center justify-end gap-4 text-gray-500 dark:text-gray-400">
                      <button onClick={() => handleOpenInfoModal(group)} className="hover:text-gray-900 dark:hover:text-white transition-colors" title={t('groupManagement.tooltipInfo', 'Group Info')}>
                        <Info size={18} />
                      </button>
                      
                      {(user?.role === 'Admin' || permissions.includes('GROUP_U')) && (
                        <>
                        <button onClick={() => handleOpenMembersModal(group)} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors" title={t('groupManagement.tooltipMembers', 'Manage Members')}>
                            <Users size={18} />
                          </button>
                        <button onClick={() => handleOpenUpdateModal(group)} className="hover:text-gray-900 dark:hover:text-white transition-colors" title={t('groupManagement.tooltipSettings', 'Edit Group / Permissions Settings')}>
                            <Settings size={18} />
                          </button>
                        </>
                      )}

                      {(user?.role === 'Admin' || permissions.includes('GROUP_D')) && (
                      <button onClick={() => handleDeleteGroup(group.id)} className="hover:text-red-600 dark:hover:text-red-400 transition-colors" title={t('groupManagement.tooltipDelete', 'Delete Group')}>
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
            </div>
          </div>

        </div>
      </div>

      <GroupFormModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        mode={modalMode}
        initialData={selectedGroup}
        onSave={handleSaveGroup}
      />
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

export default GroupManagement;