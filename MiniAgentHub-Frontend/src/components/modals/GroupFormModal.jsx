import React, { useState, useEffect, useRef } from 'react';
import { X, UserPlus, ChevronDown, ChevronUp } from 'lucide-react';
import axiosClient from '../../services/axiosClient';
import useAuthStore from '../../store/authStore';
import { useTranslation } from 'react-i18next';

const GroupFormModal = ({ isOpen, onClose, onSave, mode = 'create', initialData = null }) => {
  const user = useAuthStore((state) => state.user);
  const userPermissions = useAuthStore((state) => state.permissions) || [];
  const { t } = useTranslation();
  const [groupName, setGroupName] = useState('');
  const [entityType, setEntityType] = useState(initialData?.entityType || 'users');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState('');
  
  const [permissions, setPermissions] = useState({
    create: initialData?.permissions?.create || false,
    read: initialData?.permissions?.read || false,
    update: initialData?.permissions?.update || false,
    delete: initialData?.permissions?.delete || false,
  });

  const canUpdate = user?.role === 'Admin' || userPermissions.includes('GROUP_U');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [members, setMembers] = useState([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [allUsers, setAllUsers] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setFormError('');
      setGroupName(initialData?.group_name || initialData?.name || '');
      setDescription(initialData?.description || '');
      setEntityType(initialData?.entityType || 'users');
      setPermissions({
        create: initialData?.permissions?.create || false,
        read: initialData?.permissions?.read || false,
        update: initialData?.permissions?.update || false,
        delete: initialData?.permissions?.delete || false,
      });

      if ((mode === 'update' || mode === 'members' || mode === 'info') && initialData?.id) {
        const fetchMembers = async () => {
          try {
            const res = await axiosClient.get(`/groups/${initialData.id}`);
            const groupData = res.data || res;
            const membersData = groupData.members || [];
            setMembers(membersData.map(u => ({
              id: u.id,
              name: u.full_name || u.email,
              avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(u.full_name || u.email)}&background=random`
            })));
          } catch (error) { console.error('Lỗi lấy thành viên nhóm:', error); }
        };
        fetchMembers();
      } else {
        setMembers([]);
      }
    }
  }, [isOpen, initialData, mode]);

  useEffect(() => {
    if (isOpen) {
      const fetchUsers = async () => {
        try {
          const res = await axiosClient.get('/users');
          setAllUsers(Array.isArray(res) ? res : (res.data || []));
        } catch (error) {
          console.error('Lỗi khi lấy danh sách người dùng:', error);
        }
      };
      fetchUsers();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredUsers = allUsers.filter(u => {
    const term = searchQuery.toLowerCase();
    const match = (u.full_name?.toLowerCase().includes(term) || u.email?.toLowerCase().includes(term));
    const notSelected = !members.some(m => m.id === u.id);
    return match && notSelected;
  });

  const handleSelectUser = (user) => {
    setMembers([...members, { 
      id: user.id, 
      name: user.full_name || user.email, 
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name || user.email)}&background=random` 
    }]);
    setSearchQuery('');
    setShowSuggestions(false);
  };

  const handleTogglePermission = (key) => {
    if (user?.role !== 'Admin' && key === 'read' && permissions.read) {
      setFormError(t('groupFormModal.alertReadRequired'));
      return;
    }
    setFormError('');
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleRemoveMember = (id) => {
    if (user?.role !== 'Admin' && id === user?.id) {
      setFormError(t('groupFormModal.alertSelfRemove'));
      return;
    }
    setFormError('');
    setMembers(members.filter(m => m.id !== id));
  };

  const handleSubmit = async () => {
    setFormError('');
    if (mode !== 'members' && !groupName.trim()) {
      setFormError(t('groupFormModal.alertNoName'));
      return;
    }
    
    setIsSubmitting(true);
    try {
      if (mode === 'members') {
        await onSave({
          userIds: members.map(m => m.id)
        });
      } else {
        await onSave({
          name: groupName,
          description: description,
          entityType: entityType,
          userIds: members.map(m => m.id),
          permissions: permissions
        });
      }
    } catch (error) {
      console.error('Lỗi khi lưu modal:', error);
      setFormError(error.response?.data?.message || t('groupManagement.saveError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-sans">
      
      <div className="bg-white dark:bg-[#131417] border border-gray-200 dark:border-[#26272b] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        <div className="p-8 pb-6 relative shrink-0">
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {mode === 'create' ? t('groupFormModal.createTitle') : mode === 'members' ? t('groupFormModal.membersTitle') : mode === 'info' ? t('groupFormModal.infoTitle') : t('groupFormModal.updateTitle')}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {mode === 'create' 
              ? t('groupFormModal.createDesc') 
              : mode === 'members'
                ? t('groupFormModal.membersDesc')
                : mode === 'info'
                  ? t('groupFormModal.infoDesc')
                  : t('groupFormModal.updateDesc')}
          </p>
        </div>

        <div className="px-8 pb-8 overflow-y-auto flex-1 space-y-8 custom-scrollbar">
          
          {mode === 'info' && (
            <section>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('groupFormModal.groupNameLabel')}</label>
                  <input 
                    type="text" 
                    value={groupName}
                    readOnly
                    className="w-full bg-gray-50 dark:bg-[#1e1f24] border border-gray-300 dark:border-[#26272b] rounded-xl px-4 py-3 text-sm text-gray-500 dark:text-gray-400 outline-none transition-colors cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('groupFormModal.descriptionLabel')}</label>
                  <textarea 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    readOnly={!canUpdate}
                    rows={4}
                    placeholder={t('groupFormModal.descriptionPlaceholder')}
                    className={`w-full bg-white dark:bg-[#1e1f24] border border-gray-300 dark:border-transparent focus:border-[#3b82f6] rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white outline-none transition-colors resize-none ${
                      !canUpdate && 'bg-gray-50 dark:bg-[#1e1f24] !border-gray-300 dark:!border-[#26272b] text-gray-500 dark:text-gray-400 cursor-not-allowed'
                    }`}
                  />
                </div>
              </div>
            </section>
          )}
          
          {mode !== 'members' && mode !== 'info' && (
          <section>
            <h3 className="text-[10px] font-bold text-blue-400 tracking-[0.2em] uppercase mb-4">{t('groupFormModal.identity')}</h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="col-span-2 md:col-span-1">
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  {t('groupFormModal.groupNameLabel')} <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  value={groupName}
                  onChange={(e) => { setGroupName(e.target.value); setFormError(''); }}
                  placeholder={mode === 'create' ? t('groupFormModal.groupNamePlaceholder') : ""}
                  className={`w-full bg-white dark:bg-[#1e1f24] border ${formError && !groupName.trim() ? 'border-red-500' : 'border-gray-300 dark:border-transparent focus:border-[#3b82f6]'} rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none transition-colors`}
                />
              </div>

              <div className="col-span-2 md:col-span-1">
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('groupFormModal.targetEntity')}</label>
                <div className="flex bg-gray-50 dark:bg-[#1a1b20] p-1 rounded-xl border border-gray-200 dark:border-[#26272b]">
                  <button 
                    onClick={() => setEntityType('users')}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                      entityType === 'users' 
                        ? 'bg-blue-50 dark:bg-[#1e2b4d] text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 shadow-sm' 
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                  >
                    {t('groupFormModal.users')}
                  </button>
                  <button 
                    onClick={() => setEntityType('groups')}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                      entityType === 'groups' 
                        ? 'bg-blue-50 dark:bg-[#1e2b4d] text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 shadow-sm' 
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                  >
                    {t('groupFormModal.groups')}
                  </button>
                </div>
              </div>
            </div>
          </section>
          )}

          {mode !== 'members' && mode !== 'info' && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-bold text-blue-400 tracking-[0.2em] uppercase">{t('groupFormModal.rbacMatrix')}</h3>
              <span className="text-xs italic text-gray-500">{t('groupFormModal.rbacDesc')}</span>
            </div>
            
            <div className="bg-white dark:bg-[#1a1b20] border border-gray-200 dark:border-[#26272b] rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-[#26272b]">
                    <th className="py-4 px-6 text-xs font-semibold text-gray-700 dark:text-gray-300">{t('groupFormModal.action')}</th>
                    <th className="py-4 px-6 text-xs font-semibold text-gray-700 dark:text-gray-300">{t('groupFormModal.description')}</th>
                    <th className="py-4 px-6 text-xs font-semibold text-gray-700 dark:text-gray-300 text-center">{t('groupFormModal.grant')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-[#26272b]">
                  <tr className="hover:bg-gray-50 dark:hover:bg-[#1e1f25] transition-colors">
                    <td className="py-4 px-6 text-sm text-gray-900 dark:text-gray-200">{t('groupFormModal.actionCreate')}</td>
                    <td className="py-4 px-6 text-sm text-gray-500">{t('groupFormModal.permCreateDesc')}</td>
                    <td className="py-4 px-6 text-center">
                      <input type="checkbox" checked={permissions.create} onChange={() => handleTogglePermission('create')} className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-[#2a2b30] text-blue-500 focus:ring-0 cursor-pointer" />
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50 dark:hover:bg-[#1e1f25] transition-colors">
                    <td className="py-4 px-6 text-sm text-gray-900 dark:text-gray-200">{t('groupFormModal.actionRead')}</td>
                    <td className="py-4 px-6 text-sm text-gray-500">{t('groupFormModal.permReadDesc')}</td>
                    <td className="py-4 px-6 text-center">
                      <input 
                        type="checkbox" 
                        checked={permissions.read} 
                        onChange={() => handleTogglePermission('read')} 
                        disabled={user?.role !== 'Admin' && permissions.read}
                        title={user?.role !== 'Admin' && permissions.read ? t('groupFormModal.readRequiredTitle') : ""}
                        className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-[#2a2b30] text-blue-500 focus:ring-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" 
                      />
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50 dark:hover:bg-[#1e1f25] transition-colors">
                    <td className="py-4 px-6 text-sm text-gray-900 dark:text-gray-200">{t('groupFormModal.actionUpdate')}</td>
                    <td className="py-4 px-6 text-sm text-gray-500">{t('groupFormModal.permUpdateDesc')}</td>
                    <td className="py-4 px-6 text-center">
                      <input type="checkbox" checked={permissions.update} onChange={() => handleTogglePermission('update')} className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-[#2a2b30] text-blue-500 focus:ring-0 cursor-pointer" />
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50 dark:hover:bg-[#1e1f25] transition-colors">
                    <td className="py-4 px-6 text-sm text-gray-900 dark:text-gray-200">{t('groupFormModal.actionDelete')}</td>
                    <td className="py-4 px-6 text-sm text-gray-500">{t('groupFormModal.permDeleteDesc')}</td>
                    <td className="py-4 px-6 text-center">
                      <input type="checkbox" checked={permissions.delete} onChange={() => handleTogglePermission('delete')} className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-[#2a2b30] text-blue-500 focus:ring-0 cursor-pointer" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
          )}

          {mode !== 'update' && mode !== 'info' && (
            <section>
            <h3 className="text-[10px] font-bold text-blue-400 tracking-[0.2em] uppercase mb-4">{t('groupFormModal.membersManagement')}</h3>
              
              <div className="relative mb-4" ref={dropdownRef}>
                <div 
                  className="flex items-center gap-3 bg-white dark:bg-[#1e1f24] border border-gray-300 dark:border-[#26272b] rounded-xl px-4 py-3 cursor-pointer"
                  onClick={() => setShowSuggestions(!showSuggestions)}
                >
                  <UserPlus size={18} className="text-gray-500 shrink-0" />
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowSuggestions(true);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onFocus={() => setShowSuggestions(true)}
                    placeholder={t('groupFormModal.searchPlaceholder')} 
                    className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none cursor-text"
                  />
                  {showSuggestions ? (
                    <ChevronUp size={18} className="text-gray-500 shrink-0" />
                  ) : (
                    <ChevronDown size={18} className="text-gray-500 shrink-0" />
                  )}
                </div>

                {showSuggestions && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#1e1f24] border border-gray-200 dark:border-[#26272b] rounded-xl shadow-2xl max-h-48 overflow-y-auto z-10 custom-scrollbar">
                    {filteredUsers.length > 0 ? (
                      filteredUsers.map(user => (
                        <div key={user.id} onClick={() => handleSelectUser(user)} className="flex flex-col px-4 py-2 hover:bg-gray-50 dark:hover:bg-[#2a2b30] cursor-pointer border-b border-gray-100 dark:border-[#26272b] last:border-0 transition-colors">
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-200">{user.full_name || t('groupFormModal.noName')}</span>
                          <span className="text-xs text-gray-500">{user.email}</span>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-gray-500 text-center">{t('groupFormModal.noUsersFound')}</div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {members.map(member => {
                  const isCurrentUser = member.id === user?.id;
                  const canRemove = user?.role === 'Admin' || !isCurrentUser;
                  return (
                    <div key={member.id} className="flex items-center gap-2 bg-blue-50 dark:bg-[#1a233a] border border-blue-200 dark:border-[#2a3b63] rounded-full pl-1 pr-3 py-1">
                      <img src={member.avatar} alt="avatar" className="w-5 h-5 rounded-full object-cover" />
                      <span className="text-xs text-blue-700 dark:text-[#a5c6f7] font-medium">
                        {member.name} {isCurrentUser ? t('groupFormModal.you') : ''}
                      </span>
                      {canRemove && (
                        <button onClick={() => handleRemoveMember(member.id)} className="text-blue-600 dark:text-[#a5c6f7] hover:text-blue-800 dark:hover:text-white ml-1">
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

        </div>

        <div className="px-8 pb-4">
          {formError && <p className="text-red-500 text-sm font-medium">{formError}</p>}
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-[#26272b] flex items-center justify-end gap-4 shrink-0 bg-gray-50 dark:bg-[#131417]">
          <button 
            onClick={onClose}
            className="text-sm font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors px-4 py-2"
          >
            {mode === 'info' && !canUpdate ? t('userFormModal.close') : t('groupFormModal.cancel')}
          </button>
          {(mode !== 'info' || canUpdate) && (
            <button 
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-[#b5d6ff] hover:bg-[#9cc4f5] text-[#0b1c3f] px-6 py-2.5 rounded-full text-sm font-bold shadow-lg shadow-blue-900/20 transition-all disabled:opacity-50"
            >
              {isSubmitting ? t('groupFormModal.saving') : (mode === 'create' ? t('groupFormModal.btnCreate') : mode === 'members' ? t('groupFormModal.btnUpdateMembers') : mode === 'info' ? t('groupFormModal.btnUpdateInfo') : t('groupFormModal.btnUpdate'))}
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default GroupFormModal;