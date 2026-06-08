import React, { useState, useEffect } from 'react';
import { X, UserPlus, UserCog } from 'lucide-react';
import axiosClient from '../services/axiosClient';
import useAuthStore from '../store/authStore';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

const UserFormModal = ({ isOpen, onClose, onSuccess, mode = 'create', initialData = null }) => {
  const { t } = useTranslation();
  const userStore = useAuthStore((state) => state.user);
  const permissions = useAuthStore((state) => state.permissions) || [];
  const canUpdate = userStore?.role === 'Admin' || permissions.includes('USER_U');
  const isReadOnly = mode === 'update' && !canUpdate;

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('User');
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [allGroups, setAllGroups] = useState([]);
  const [searchGroup, setSearchGroup] = useState('');
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const fetchGroups = async () => {
        try {
          const res = await axiosClient.get('/groups');
          setAllGroups(Array.isArray(res) ? res : res.data || []);
        } catch (error) {
          console.error("Lỗi lấy danh sách nhóm:", error);
        }
      };
      fetchGroups();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && initialData && mode === 'update') {
      setFormError('');
      setFullName(initialData.full_name || initialData.name || '');
      setEmail(initialData.email || '');
      setRole(initialData.role_id === 1 || initialData.Role?.name === 'Admin' || initialData.role === 'Admin' ? 'Admin' : 'User');
      setSelectedGroups(initialData.Groups ? initialData.Groups.map(g => ({ id: g.id, name: g.name })) : []);
    } else if (isOpen && mode === 'create') {
      setFormError('');
      setFullName('');
      setEmail('');
      setRole('User');
      setSelectedGroups([]);
    }
  }, [isOpen, initialData, mode]);

  if (!isOpen) return null;

  const handleAddGroup = (group) => {
    if (!isReadOnly && !selectedGroups.find(g => g.id === group.id)) {
      setSelectedGroups([...selectedGroups, group]);
    }
    setSearchGroup('');
    setShowGroupDropdown(false);
  };

  const removeGroup = (groupId) => {
    if (!isReadOnly) setSelectedGroups(selectedGroups.filter(g => g.id !== groupId));
  };

  const filteredGroups = allGroups.filter(g => 
    g.name?.toLowerCase().includes(searchGroup.toLowerCase()) && 
    !selectedGroups.find(sg => sg.id === g.id)
  );

  const handleSubmit = async () => {
    setFormError('');
    if (!fullName.trim() || !email.trim()) {
      setFormError(t('userFormModal.alertNoNameEmail', 'Vui lòng nhập tên và email!'));
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        full_name: fullName.trim(),
        email: email.trim(),
        role_name: role,
        role: role,
        group_ids: selectedGroups.map(g => g.id)
      };

      if (mode === 'create') {
        await axiosClient.post('/users', payload);
        toast.success(t('userFormModal.createSuccess', 'Tạo người dùng thành công!'));
      } else {
        await axiosClient.put(`/users/${initialData.id}`, payload);
        toast.success(t('userFormModal.updateSuccess', 'Cập nhật người dùng thành công!'));
      }

      if (onSuccess) onSuccess(); 
      onClose(); 
    } catch (error) {
      console.error(error);
      setFormError(error.response?.data?.message || t('userFormModal.alertSaveError', 'Có lỗi xảy ra khi lưu người dùng!'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-sans">
      <div className="bg-white dark:bg-[#1a1b20] border border-gray-200 dark:border-[#26272b] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        
        <div className="p-6 pb-4 relative flex items-center gap-2 border-b border-gray-200 dark:border-[#26272b]/50">
          <button onClick={onClose} className="absolute top-6 right-6 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors">
            <X size={20} />
          </button>
          {mode === 'create' ? <UserPlus size={20} className="text-blue-500 dark:text-blue-400" /> : <UserCog size={20} className="text-blue-500 dark:text-blue-400" />}
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {mode === 'create' ? t('userFormModal.addTitle', 'Add New User') : t('userFormModal.updateTitle', 'Update User')}
          </h2>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
              {t('userFormModal.fullName', 'Full Name')} <span className="text-red-500">*</span>
            </label>
            <input 
              type="text" 
              value={fullName}
              onChange={(e) => { setFullName(e.target.value); setFormError(''); }}
              placeholder={mode === 'create' ? t('userFormModal.fullNamePlaceholder', 'Enter full name') : ""}
              disabled={isReadOnly}
              className={`w-full bg-white dark:bg-[#131417] border ${formError && !fullName.trim() ? 'border-red-500' : 'border-gray-300 dark:border-[#26272b] focus:border-[#3b82f6]'} rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none transition-colors`}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
              {t('userFormModal.emailLabel', 'Email Address')} <span className="text-red-500">*</span>
            </label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => { setEmail(e.target.value); setFormError(''); }}
              placeholder={mode === 'create' ? t('userFormModal.emailPlaceholder', 'name@company.com') : ""}
              disabled={isReadOnly}
              className={`w-full bg-white dark:bg-[#131417] border ${formError && !email.trim() ? 'border-red-500' : 'border-gray-300 dark:border-[#26272b] focus:border-[#3b82f6]'} rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none transition-colors`}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
              {t('userFormModal.assignGroups', 'Assign to Groups (Optional)')}
            </label>
            
            <div className="relative">
              <div className="w-full bg-white dark:bg-[#131417] border border-gray-300 dark:border-[#26272b] rounded-xl px-3 py-2 flex flex-wrap gap-2 items-center min-h-[46px]">
                {selectedGroups.map((g) => (
                  <span key={g.id} className="flex items-center gap-1 bg-blue-50 dark:bg-[#1e2b4d] text-blue-600 dark:text-blue-400 text-xs px-2.5 py-1.5 rounded-md border border-blue-200 dark:border-blue-500/20">
                    {g.name}
                    {!isReadOnly && <button onClick={() => removeGroup(g.id)} className="hover:text-gray-900 dark:hover:text-white ml-1"><X size={12} /></button>}
                  </span>
                ))}
                {!isReadOnly && (
                  <input 
                  type="text" 
                  value={searchGroup}
                  onChange={(e) => {
                    setSearchGroup(e.target.value);
                    setShowGroupDropdown(true);
                  }}
                  onFocus={() => setShowGroupDropdown(true)}
                  placeholder={t('userFormModal.addGroupPlaceholder', 'Add group...')} 
                  className="bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-400 placeholder-gray-400 dark:placeholder-gray-500 flex-1 min-w-[100px]"
                />
                )}
              </div>

              {showGroupDropdown && searchGroup.trim() !== '' && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#1a1b20] border border-gray-200 dark:border-[#26272b] rounded-xl shadow-2xl max-h-40 overflow-y-auto z-10 custom-scrollbar">
                  {filteredGroups.length > 0 ? (
                    filteredGroups.map(group => (
                      <div key={group.id} onClick={() => handleAddGroup(group)} className="px-4 py-2 hover:bg-gray-50 dark:hover:bg-[#26272b] cursor-pointer text-sm text-gray-700 dark:text-gray-300 transition-colors flex justify-between items-center">
                        <span>{group.name || group.group_name}</span>
                        <span className="text-gray-500 text-xs">{group.member_count || group.memberCount || group.members?.length || 0} {t('userFormModal.members', 'thành viên')}</span>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-sm text-gray-500 text-center">{t('userFormModal.noGroupsFound', 'Không tìm thấy nhóm phù hợp')}</div>
                  )}
                </div>
              )}
            </div>
          </div>

        </div>
        
        <div className="px-6 py-2">
          {formError && <p className="text-red-500 text-sm font-medium">{formError}</p>}
        </div>

        <div className="p-6 pt-2 flex items-center justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#26272b] border border-gray-300 dark:border-[#333] rounded-xl transition-colors"
          >
            {isReadOnly ? t('userFormModal.close', 'Close') : t('userFormModal.cancel', 'Cancel')}
          </button>
          {!isReadOnly && (
            <button 
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-[#3b82f6] hover:bg-[#2563eb] text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-blue-900/20 transition-all flex items-center gap-2"
            >
              {isSubmitting ? t('userFormModal.saving', 'Saving...') : mode === 'create' ? (
                <>{t('userFormModal.btnCreate', 'Create User')} &rarr;</>
              ) : (
                <>{t('userFormModal.btnUpdate', 'Update User')} &#10003;</>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default UserFormModal;