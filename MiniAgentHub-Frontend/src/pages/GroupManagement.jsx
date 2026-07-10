import React, { useState, useEffect, useRef } from 'react';
import { UserPlus, Info, Users, Settings, Trash2, Loader2, AlertCircle } from 'lucide-react';
import axiosClient from '../services/axiosClient';
import Sidebar from '../components/layout/Sidebar';
import GroupFormModal from '../components/modals/GroupFormModal';
import ConfirmModal from '../components/modals/ConfirmModal';
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

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchGroups = async () => {
    try {
      setIsLoading(true);

      const hasGroupAccess = user?.role === 'Admin' || permissions.includes('GROUP_R') || permissions.includes('GROUP_U') || permissions.includes('GROUP_D');

      if (hasGroupAccess) {
        const response = await axiosClient.get('/groups');
        if (isMounted.current) {
          const data = Array.isArray(response) ? response : (response.data || []);
          setGroups(data);
        }
      } else {
        const response = await axiosClient.get(`/users/${user.id}`);
        if (isMounted.current) {
          const responseData = response.data || response;
          const userData = responseData.user || responseData;
          const userGroups = userData.Groups || userData.groups || [];
          setGroups(userGroups);
        }
      }
      if (isMounted.current) setError('');
    } catch (err) {
      if (isMounted.current) {
        console.error('Lỗi tải danh sách nhóm:', err);
        setError(t('groupManagement.errorLoad'));
      }
    } finally {
      if (isMounted.current) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, [user?.id, JSON.stringify(permissions)]);

  const handleDeleteGroup = (id, force = false) => {
    setConfirmDialog({
      isOpen: true,
      title: t('groupManagement.deleteConfirmTitle'),
      message: force ? t('groupManagement.forceDeleteConfirm') : t('groupManagement.deleteConfirm'),
      onConfirm: async () => {
        try {
          await axiosClient.delete(`/groups/${id}${force ? '?force=true' : ''}`);
          setGroups((prev) => prev.filter((g) => g.id !== id));
          toast.success(t('groupManagement.deleteSuccess'));
        } catch (err) {
          console.error('Lỗi khi xóa nhóm:', err);
          if (!force && err.response?.data?.errorKey === 'group.deleteHasUsers') {
            setTimeout(() => handleDeleteGroup(id, true), 300);
          } else {
            toast.error(err.response?.data?.message || err.response?.data?.error || t('groupManagement.deleteError'));
          }
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
        toast.success(t('groupManagement.createSuccess'));
      } else {
        await axiosClient.put(`/groups/${selectedGroup.id}`, formData);
        toast.success(t('groupManagement.updateSuccess'));
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
              <h1 className="text-2xl md:text-4xl font-bold mb-2 md:mb-3 text-gray-900 dark:text-white">{t('groupManagement.title')}</h1>
              <p className="text-gray-400 text-sm leading-relaxed">
                {t('groupManagement.description')}
              </p>
            </div>

            {(user?.role === 'Admin' || permissions.includes('GROUP_C')) && (
              <button
                onClick={handleOpenCreateModal}
                className="flex items-center gap-2 bg-[#d1e5fb] hover:bg-[#b8d5fa] text-[#0f2c6b] px-6 py-3 rounded-full font-semibold text-sm transition-colors shrink-0"
              >
                <UserPlus size={18} />
                {t('groupManagement.createNewGroup')}
              </button>
            )}
          </div>

          <div className="bg-white dark:bg-[#1a1b20] border border-gray-200 dark:border-[#26272b] rounded-2xl shadow-lg flex flex-col overflow-hidden w-full">

            <div className="px-4 md:px-6 py-5 border-b border-gray-200 dark:border-[#26272b] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-[#1a1b20]">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t('groupManagement.activeGroups')}</h2>
              <div className="bg-gray-100 dark:bg-[#2a2b30] text-gray-600 dark:text-gray-400 text-xs font-bold px-3 py-1 rounded-md tracking-widest">
                {groups.length} {t('groupManagement.total')}
              </div>
            </div>

            <div className="w-full overflow-x-auto custom-scrollbar">
              <div className="min-w-full md:min-w-[700px]">
                {/* --- Table Header (Desktop Only) --- */}
                <div className="hidden md:grid grid-cols-12 px-4 md:px-6 py-4 border-b border-gray-200 dark:border-[#26272b] bg-gray-50 dark:bg-[#1a1b20]">
                  <div className="col-span-5 text-[10px] font-bold text-gray-500 tracking-[0.15em] uppercase">
                    {t('groupManagement.groupName')}
                  </div>
                  <div className="col-span-4 text-[10px] font-bold text-gray-500 tracking-[0.15em] uppercase text-center">
                    {t('groupManagement.memberCount')}
                  </div>
                  <div className="col-span-3 text-[10px] font-bold text-gray-500 tracking-[0.15em] uppercase text-right">
                    {t('groupManagement.actions')}
                  </div>
                </div>

                <div className="divide-y divide-gray-200 dark:divide-[#26272b]">
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                      <Loader2 className="animate-spin mb-3 text-blue-500" size={28} />
                      <p className="text-sm font-medium tracking-wide">{t('groupManagement.loading')}</p>
                    </div>
                  ) : error ? (
                    <div className="flex flex-col items-center justify-center py-12 text-red-400">
                      <AlertCircle className="mb-3" size={28} />
                      <p className="text-sm">{error}</p>
                    </div>
                  ) : groups.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 text-sm tracking-wide">
                      {t('groupManagement.emptyGroup')}
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
                              {group.group_name || group.name || t('groupManagement.noName')}
                            </div>
                            <div className="md:hidden text-xs text-gray-500 mt-1">
                              {group.member_count || group.memberCount || group.members?.length || 0} {t('groupManagement.members')}
                            </div>
                          </div>

                          <div className="hidden md:block md:col-span-4 text-sm text-gray-700 dark:text-gray-300 text-center">
                            {group.member_count || group.memberCount || group.members?.length || 0} {t('groupManagement.members')}
                          </div>

                          <div className="md:col-span-3 flex items-center justify-end gap-4 text-gray-500 dark:text-gray-400">
                            <button onClick={() => handleOpenInfoModal(group)} className="hover:text-gray-900 dark:hover:text-white transition-colors" title={t('groupManagement.tooltipInfo')}>
                              <Info size={18} />
                            </button>

                            {(user?.role === 'Admin' || permissions.includes('GROUP_U')) && (
                              <>
                                <button onClick={() => handleOpenMembersModal(group)} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors" title={t('groupManagement.tooltipMembers')}>
                                  <Users size={18} />
                                </button>
                                <button onClick={() => handleOpenUpdateModal(group)} className="hover:text-gray-900 dark:hover:text-white transition-colors" title={t('groupManagement.tooltipSettings')}>
                                  <Settings size={18} />
                                </button>
                              </>
                            )}

                            {(user?.role === 'Admin' || permissions.includes('GROUP_D')) && (
                              <button onClick={() => handleDeleteGroup(group.id)} className="hover:text-red-600 dark:hover:text-red-400 transition-colors" title={t('groupManagement.tooltipDelete')}>
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