import React, { useState, useEffect } from 'react';
import {
  Settings, Plus, Edit, Shield, User, Palette,
  Clock, CheckCircle2, AlertCircle, X, FileSpreadsheet, Smartphone,
  Phone, Mail, Trash2, Power, Search, Building2, Globe, Check,
  AlertTriangle, Filter, Sparkles, Key, Lock, Database
} from 'lucide-react';
import {
  getTreatments, createTreatment, updateTreatment,
  getStaff, createStaff, updateStaff, deleteStaff
} from '../api';
import ExcelImportWizard from './ExcelImportWizard';
import SmsGatewaySettings from './SmsGatewaySettings';
import BackupDatabaseView from './BackupDatabaseView';
import BrandingSettingsModal, { getSavedBranding, fetchServerBranding, PresetLogoIcon } from '../components/BrandingSettingsModal';

export default function TreatmentsSettingsView({ currentRole }) {
  const [activeTab, setActiveTab] = useState('sms'); // 'sms', 'staff', 'treatments', 'company', 'migration'
  const [treatments, setTreatments] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);

  // Staff Filters & Search
  const [staffRoleFilter, setStaffRoleFilter] = useState('ALL');
  const [staffSearchQuery, setStaffSearchQuery] = useState('');

  // Treatment Modal
  const [showTreatmentModal, setShowTreatmentModal] = useState(false);
  const [editingTreatment, setEditingTreatment] = useState(null);
  const [treatmentForm, setTreatmentForm] = useState({
    code: '', name: '', description: '', default_duration_minutes: 60, color_hex: '#10B981'
  });

  // Staff Add / Edit Modal
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [staffForm, setStaffForm] = useState({
    username: '', full_name: '', role: 'TECHNICIAN', phone: '', email: '', is_active: 1, password: ''
  });

  // Staff Password Reset Modal
  const [passwordModalUser, setPasswordModalUser] = useState(null);
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [passwordModalLoading, setPasswordModalLoading] = useState(false);

  // Company Preferences State (Local / System config)
  const [companySettings, setCompanySettings] = useState({
    company_name: 'Ceylon Pest Management Solutions',
    hotline: '+94 11 234 5678 / +94 77 123 4567',
    email: 'operations@ceylonpestcontrol.lk',
    address: 'No. 45/2, Galle Road, Colombo 03, Sri Lanka',
    timezone: 'Asia/Colombo (GMT+5:30)',
    currency: 'LKR (Rs.)',
    business_hours: '08:00 AM - 06:00 PM',
    auto_sms_reminders: true,
    reminder_lead_hours: 24
  });
  const [companySavedMsg, setCompanySavedMsg] = useState(false);

  // System Branding & Logos
  const [showBrandingModal, setShowBrandingModal] = useState(false);
  const [brandingData, setBrandingData] = useState(() => getSavedBranding());

  const loadData = async () => {
    setLoading(true);
    try {
      const [tRes, sRes] = await Promise.all([getTreatments(), getStaff()]);
      setTreatments(tRes.treatments || []);
      setStaff(sRes.staff || []);
    } catch (e) {
      console.error('Error loading settings data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    fetchServerBranding().then(b => {
      if (b) setBrandingData(b);
    });

    const handleBrandingUpdated = (e) => {
      setBrandingData(e.detail || getSavedBranding());
    };
    window.addEventListener('branding-updated', handleBrandingUpdated);
    return () => window.removeEventListener('branding-updated', handleBrandingUpdated);
  }, []);

  // Save Treatment
  const handleSaveTreatment = async (e) => {
    e.preventDefault();
    try {
      if (editingTreatment) {
        await updateTreatment(editingTreatment.id, treatmentForm);
        alert('Treatment updated successfully!');
      } else {
        await createTreatment(treatmentForm);
        alert('Treatment created successfully!');
      }
      setShowTreatmentModal(false);
      setEditingTreatment(null);
      setTreatmentForm({ code: '', name: '', description: '', default_duration_minutes: 60, color_hex: '#10B981' });
      loadData();
    } catch (err) {
      alert(`Error saving treatment: ${err.message}`);
    }
  };

  // Save Staff (Add or Edit)
  const handleSaveStaff = async (e) => {
    e.preventDefault();
    try {
      if (editingStaff) {
        await updateStaff(editingStaff.id, {
          full_name: staffForm.full_name,
          role: staffForm.role,
          phone: staffForm.phone,
          email: staffForm.email,
          is_active: staffForm.is_active ? 1 : 0,
          password: staffForm.password ? staffForm.password.trim() : undefined
        });
        alert(`Staff member ${staffForm.full_name} updated successfully!`);
      } else {
        await createStaff({
          username: staffForm.username.trim().toLowerCase(),
          full_name: staffForm.full_name.trim(),
          role: staffForm.role,
          phone: staffForm.phone.trim(),
          email: staffForm.email.trim(),
          password: staffForm.password ? staffForm.password.trim() : undefined
        });
        alert(`New user ${staffForm.full_name} registered successfully!`);
      }
      setShowStaffModal(false);
      setEditingStaff(null);
      setStaffForm({ username: '', full_name: '', role: 'TECHNICIAN', phone: '', email: '', is_active: 1, password: '' });
      loadData();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  // Reset Staff Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!passwordModalUser || !newStaffPassword || newStaffPassword.length < 4) {
      alert('Password must be at least 4 characters long');
      return;
    }
    setPasswordModalLoading(true);
    try {
      const res = await fetch(`/api/staff/${passwordModalUser.id}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newStaffPassword.trim() })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      alert(`Password for ${passwordModalUser.full_name} updated successfully!`);
      setPasswordModalUser(null);
      setNewStaffPassword('');
    } catch (err) {
      alert(`Error updating password: ${err.message}`);
    } finally {
      setPasswordModalLoading(false);
    }
  };

  // Toggle Staff Active / Inactive Status
  const handleToggleStaffStatus = async (staffMember) => {
    const newStatus = staffMember.is_active ? 0 : 1;
    try {
      await updateStaff(staffMember.id, { is_active: newStatus });
      loadData();
    } catch (err) {
      alert(`Could not toggle status: ${err.message}`);
    }
  };

  // Delete Staff Member
  const handleDeleteStaff = async (staffMember) => {
    if (!window.confirm(`Are you sure you want to remove user "${staffMember.full_name}"?`)) {
      return;
    }
    try {
      const res = await deleteStaff(staffMember.id);
      alert(res.message || 'Staff member processed successfully.');
      loadData();
    } catch (err) {
      alert(`Error deleting staff: ${err.message}`);
    }
  };

  // Filtered staff list
  const filteredStaff = staff.filter(s => {
    const matchesRole = staffRoleFilter === 'ALL' || s.role === staffRoleFilter;
    const matchesSearch = !staffSearchQuery ||
      s.full_name.toLowerCase().includes(staffSearchQuery.toLowerCase()) ||
      s.username.toLowerCase().includes(staffSearchQuery.toLowerCase()) ||
      (s.phone && s.phone.includes(staffSearchQuery)) ||
      (s.email && s.email.toLowerCase().includes(staffSearchQuery.toLowerCase()));
    return matchesRole && matchesSearch;
  });

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-purple-100 text-purple-800 border border-purple-200';
      case 'MANAGER':
        return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'SUPERVISOR':
        return 'bg-amber-100 text-amber-800 border border-amber-200';
      case 'TECHNICIAN':
        return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
      case 'SALESMAN':
        return 'bg-rose-100 text-rose-800 border border-rose-200';
      default:
        return 'bg-slate-100 text-slate-800 border border-slate-200';
    }
  };

  const getRoleAvatarBg = (role) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-gradient-to-tr from-purple-600 to-indigo-600 text-white';
      case 'MANAGER':
        return 'bg-gradient-to-tr from-blue-600 to-cyan-600 text-white';
      case 'SUPERVISOR':
        return 'bg-gradient-to-tr from-amber-500 to-orange-500 text-white';
      case 'TECHNICIAN':
        return 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-white';
      case 'SALESMAN':
        return 'bg-gradient-to-tr from-rose-500 to-pink-500 text-white';
      default:
        return 'bg-gradient-to-tr from-slate-600 to-slate-400 text-white';
    }
  };

  return (
    <div className="space-y-6 pb-12">

      {/* Dynamic Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-3xl shadow-lg border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/20 text-violet-300 text-xs font-bold uppercase tracking-wider mb-2 border border-violet-500/30">
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            Central System Configuration & Controls
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <span>Settings, Users & Sri Lanka SMS Gateway</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
            Configure live Text.lk SMS provider, manage user accounts & technician field roles, customize pest treatment formulas, and company parameters.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {activeTab === 'staff' && (
            <button
              onClick={() => {
                setEditingStaff(null);
                setStaffForm({ username: '', full_name: '', role: 'TECHNICIAN', phone: '', email: '', is_active: 1 });
                setShowStaffModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-2xl text-xs shadow-md shadow-blue-900/30 transition scale-100 hover:scale-[1.02]"
            >
              <Plus className="w-4 h-4" />
              <span>Add New User / Staff</span>
            </button>
          )}

          {activeTab === 'treatments' && (
            <button
              onClick={() => {
                setEditingTreatment(null);
                setTreatmentForm({ code: '', name: '', description: '', default_duration_minutes: 60, color_hex: '#10B981' });
                setShowTreatmentModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-2xl text-xs shadow-md shadow-emerald-900/30 transition scale-100 hover:scale-[1.02]"
            >
              <Plus className="w-4 h-4" />
              <span>Add Treatment Type</span>
            </button>
          )}
        </div>
      </div>

      {/* Colorful Tab Switcher */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap gap-2 text-xs">
        <button
          onClick={() => setActiveTab('sms')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all duration-200 ${
            activeTab === 'sms'
              ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-md shadow-violet-200'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          <span>Sri Lanka SMS Gateway</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-extrabold ${activeTab === 'sms' ? 'bg-white/20 text-white' : 'bg-violet-100 text-violet-700'}`}>
            Text.lk Active
          </span>
        </button>

        <button
          onClick={() => setActiveTab('staff')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all duration-200 ${
            activeTab === 'staff'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-200'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <User className="w-4 h-4" />
          <span>User & Staff Management</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${activeTab === 'staff' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'}`}>
            {staff.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('treatments')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all duration-200 ${
            activeTab === 'treatments'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-200'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Palette className="w-4 h-4" />
          <span>Treatment Formulas</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${activeTab === 'treatments' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
            {treatments.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('company')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all duration-200 ${
            activeTab === 'company'
              ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md shadow-amber-200'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Company & System Preferences</span>
        </button>

        <button
          onClick={() => setActiveTab('backup')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all duration-200 ${
            activeTab === 'backup'
              ? 'bg-gradient-to-r from-teal-600 to-emerald-700 text-white shadow-md shadow-teal-200'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Database Backup & Archives</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${activeTab === 'backup' ? 'bg-white/20 text-white' : 'bg-teal-100 text-teal-700'}`}>
            Monthly
          </span>
        </button>

        <button
          onClick={() => setActiveTab('migration')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all duration-200 ${
            activeTab === 'migration'
              ? 'bg-gradient-to-r from-slate-700 to-slate-900 text-white shadow-md shadow-slate-200'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Legacy Excel Migration</span>
        </button>
      </div>

      {/* ========================================================
          TAB 1: SRI LANKA SMS GATEWAYS
         ======================================================== */}
      {activeTab === 'sms' && (
        <SmsGatewaySettings />
      )}

      {/* ========================================================
          TAB 2: USER & STAFF MANAGEMENT
         ======================================================== */}
      {activeTab === 'staff' && (
        <div className="space-y-4">

          {/* Search and Role Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={staffSearchQuery}
                onChange={(e) => setStaffSearchQuery(e.target.value)}
                placeholder="Search staff by name, user, phone..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500 transition"
              />
            </div>

            {/* Role Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
              <span className="text-slate-400 font-bold text-[11px] mr-1 hidden sm:inline flex items-center gap-1">
                <Filter className="w-3 h-3" /> Role:
              </span>
              {['ALL', 'ADMIN', 'MANAGER', 'SUPERVISOR', 'TECHNICIAN', 'SALESMAN'].map(role => (
                <button
                  key={role}
                  onClick={() => setStaffRoleFilter(role)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-[11px] transition ${
                    staffRoleFilter === role
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>

          {/* Staff Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 font-black uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">User Profile</th>
                  <th className="px-4 py-3.5">Assigned Role</th>
                  <th className="px-4 py-3.5">Phone & Contact</th>
                  <th className="px-4 py-3.5">Email Address</th>
                  <th className="px-4 py-3.5">Account Status</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                      No staff members match the selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map(s => {
                    const initials = s.full_name
                      .split(' ')
                      .map(p => p[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase();

                    return (
                      <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Profile */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-2xl flex items-center justify-center font-black text-xs shadow-2xs shrink-0 ${getRoleAvatarBg(s.role)}`}>
                              {initials}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                <span>{s.full_name}</span>
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono">@{s.username}</div>
                            </div>
                          </div>
                        </td>

                        {/* Role */}
                        <td className="px-4 py-3.5">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide ${getRoleBadgeClass(s.role)}`}>
                            {s.role}
                          </span>
                        </td>

                        {/* Phone */}
                        <td className="px-4 py-3.5">
                          {s.phone ? (
                            <a
                              href={`tel:${s.phone}`}
                              className="inline-flex items-center gap-1.5 text-slate-700 hover:text-blue-600 font-mono font-semibold"
                            >
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span>{s.phone}</span>
                            </a>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        {/* Email */}
                        <td className="px-4 py-3.5 text-slate-600">
                          {s.email ? (
                            <span className="flex items-center gap-1.5">
                              <Mail className="w-3 h-3 text-slate-400" />
                              <span>{s.email}</span>
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5">
                          <button
                            onClick={() => handleToggleStaffStatus(s)}
                            title="Click to toggle Active / Inactive"
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition cursor-pointer ${
                              s.is_active
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${s.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                            <span>{s.is_active ? 'Active' : 'Inactive'}</span>
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setPasswordModalUser(s);
                                setNewStaffPassword('');
                              }}
                              title="Set or reset account password"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition"
                            >
                              <Key className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => {
                                setEditingStaff(s);
                                setStaffForm({
                                  username: s.username,
                                  full_name: s.full_name,
                                  role: s.role,
                                  phone: s.phone || '',
                                  email: s.email || '',
                                  is_active: s.is_active,
                                  password: ''
                                });
                                setShowStaffModal(true);
                              }}
                              title="Edit user details"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition"
                            >
                              <Edit className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleDeleteStaff(s)}
                              title="Delete user"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Roles Scope Quick Guide */}
          <div className="p-4 bg-gradient-to-r from-blue-50/70 to-indigo-50/70 border border-blue-100 rounded-2xl text-xs space-y-2">
            <div className="font-black text-blue-900 flex items-center gap-1.5 text-xs">
              <Shield className="w-4 h-4 text-blue-600" /> System Roles & Access Permissions Overview
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 text-[11px] text-slate-600">
              <div className="bg-white p-2.5 rounded-xl border border-blue-100">
                <span className="font-bold text-purple-700">ADMIN:</span> Full unrestricted access to all operations, SMS gateway credentials, databases, staff and exports.
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-blue-100">
                <span className="font-bold text-blue-700">MANAGER:</span> Full operations control, daily schedule oversight, customer CRM, dispatching, and reports.
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-blue-100">
                <span className="font-bold text-amber-700">SUPERVISOR:</span> Job assigning, route verification, technician tracking, and completion sign-off.
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-blue-100">
                <span className="font-bold text-emerald-700">TECHNICIAN:</span> Field mobile interface, assigned daily visits, GPS directions, notes & customer signature.
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-blue-100">
                <span className="font-bold text-rose-700">SALESMAN:</span> Customer onboarding, contracts creation, and recurring treatment setup.
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================
          TAB 3: TREATMENTS CONFIGURATION
         ======================================================== */}
      {activeTab === 'treatments' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {treatments.map(t => (
              <div key={t.id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs hover:shadow-md transition space-y-3">
                <div className="flex items-center justify-between">
                  <span
                    style={{ backgroundColor: `${t.color_hex}18`, color: t.color_hex, borderColor: `${t.color_hex}40` }}
                    className="px-3 py-1 rounded-xl text-xs font-black tracking-wider border font-mono"
                  >
                    {t.code}
                  </span>

                  <button
                    onClick={() => {
                      setEditingTreatment(t);
                      setTreatmentForm({
                        code: t.code,
                        name: t.name,
                        description: t.description || '',
                        default_duration_minutes: t.default_duration_minutes || 60,
                        color_hex: t.color_hex || '#10B981'
                      });
                      setShowTreatmentModal(true);
                    }}
                    className="text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 p-1.5 rounded-xl transition"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{t.name}</h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{t.description || 'Standard treatment protocol'}</p>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span className="flex items-center gap-1 font-mono">
                    <Clock className="w-3.5 h-3.5 text-slate-400" /> {t.default_duration_minutes} mins default
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-bold">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color_hex }}></span> Active
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 4: COMPANY & SYSTEM PREFERENCES
         ======================================================== */}
      {activeTab === 'company' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-6 max-w-4xl">
          {/* Logo & Branding Management Card */}
          <div className="p-5 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white border border-emerald-200 shadow-xs flex items-center justify-center overflow-hidden shrink-0">
                {brandingData?.logoType === 'custom' && brandingData?.customLogoUrl ? (
                  <img src={brandingData.customLogoUrl} alt="Dashboard Logo" className="w-full h-full object-contain p-1" />
                ) : (
                  <PresetLogoIcon id={brandingData?.presetId || 'shield'} className="w-8 h-8" />
                )}
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm">Main Dashboard Logo & Mobile App Icon</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Customize the company logo displayed on the desktop dashboard, navbar, login page, and mobile PWA launcher icon.
                </p>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[11px] text-emerald-800 font-semibold mt-1">
                  <span>Dashboard Logo: <strong>{brandingData?.logoType === 'custom' ? 'Custom Upload ✓' : 'Preset Emblem'}</strong></span>
                  <span>&bull;</span>
                  <span>Mobile App Icon: <strong>{brandingData?.appIconUrl ? 'Custom Icon ✓' : 'Emblem / Default'}</strong></span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowBrandingModal(true)}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 shrink-0 transition cursor-pointer"
            >
              <Palette className="w-4 h-4" />
              <span>Change Logos & App Icon</span>
            </button>
          </div>

          <div>
            <h2 className="text-base font-bold text-slate-900">Company Details & Regional Settings</h2>
            <p className="text-xs text-slate-500 mt-0.5">These parameters are rendered on customer SMS reminders, PDF reports, and technician job sheets.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-bold text-slate-700">Company Business Name</label>
              <input
                type="text"
                value={companySettings.company_name}
                onChange={(e) => setCompanySettings({ ...companySettings, company_name: e.target.value })}
                className="w-full mt-1.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden focus:border-amber-500 font-medium"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700">Official Customer Hotline</label>
              <input
                type="text"
                value={companySettings.hotline}
                onChange={(e) => setCompanySettings({ ...companySettings, hotline: e.target.value })}
                className="w-full mt-1.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden focus:border-amber-500 font-medium"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700">Operations Email</label>
              <input
                type="email"
                value={companySettings.email}
                onChange={(e) => setCompanySettings({ ...companySettings, email: e.target.value })}
                className="w-full mt-1.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden focus:border-amber-500 font-medium"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700">Business Operating Hours</label>
              <input
                type="text"
                value={companySettings.business_hours}
                onChange={(e) => setCompanySettings({ ...companySettings, business_hours: e.target.value })}
                className="w-full mt-1.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden focus:border-amber-500 font-medium"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="font-bold text-slate-700">Head Office Address (Sri Lanka)</label>
              <input
                type="text"
                value={companySettings.address}
                onChange={(e) => setCompanySettings({ ...companySettings, address: e.target.value })}
                className="w-full mt-1.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden focus:border-amber-500 font-medium"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700">System Timezone</label>
              <div className="mt-1.5 p-2.5 bg-slate-100 rounded-xl border border-slate-200 font-bold text-slate-700 flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-600" />
                <span>Asia/Colombo (GMT+5:30)</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Guaranteed across all scheduling, recurring triggers and technician logs.</p>
            </div>

            <div>
              <label className="font-bold text-slate-700">Currency</label>
              <div className="mt-1.5 p-2.5 bg-slate-100 rounded-xl border border-slate-200 font-bold text-slate-700 flex items-center gap-2">
                <span>🇱🇰 LKR (Sri Lankan Rupee)</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Used for SMS unit costing and operational reporting.</p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            {companySavedMsg ? (
              <span className="text-emerald-600 font-bold text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Preferences saved!
              </span>
            ) : <span></span>}

            <button
              onClick={() => {
                setCompanySavedMsg(true);
                setTimeout(() => setCompanySavedMsg(false), 3000);
              }}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold rounded-xl text-xs shadow-md shadow-amber-200 hover:scale-[1.01] transition"
            >
              Save Company Preferences
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 5: LEGACY EXCEL MIGRATION
         ======================================================== */}
      {activeTab === 'migration' && (
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong>Legacy Excel Data Migration:</strong> This utility is strictly for importing legacy spreadsheets into the SQLite database.
              Your daily scheduling, technician dispatch, automatic recurring jobs, and SMS gateways are <strong>100% database-driven</strong> without needing any Excel interaction.
            </div>
          </div>
          <ExcelImportWizard />
        </div>
      )}

      {/* ========================================================
          TAB 6: DATABASE BACKUP & MONTHLY ARCHIVES
         ======================================================== */}
      {activeTab === 'backup' && (
        <BackupDatabaseView />
      )}

      {/* ========================================================
          USER / STAFF MODAL (ADD & EDIT)
         ======================================================== */}
      {showStaffModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                  <User className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold text-slate-900">
                  {editingStaff ? `Edit User: ${editingStaff.full_name}` : 'Register New User / Staff'}
                </h2>
              </div>
              <button
                onClick={() => setShowStaffModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStaff} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700">Full Name *</label>
                <input
                  type="text"
                  required
                  value={staffForm.full_name}
                  onChange={(e) => setStaffForm({ ...staffForm, full_name: e.target.value })}
                  placeholder="e.g. Ruwan Jayawardena"
                  className="w-full mt-1 p-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden focus:border-blue-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700">Username *</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingStaff}
                    value={staffForm.username}
                    onChange={(e) => setStaffForm({ ...staffForm, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                    placeholder="e.g. ruwan"
                    className="w-full mt-1 p-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden focus:border-blue-500 font-mono"
                  />
                  {editingStaff && (
                    <span className="text-[10px] text-slate-400">Username cannot be changed</span>
                  )}
                </div>

                <div>
                  <label className="font-bold text-slate-700">Assigned Role *</label>
                  <select
                    value={staffForm.role}
                    onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}
                    className="w-full mt-1 p-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden focus:border-blue-500 font-bold"
                  >
                    <option value="TECHNICIAN">TECHNICIAN (Field Mobile)</option>
                    <option value="SUPERVISOR">SUPERVISOR (Dispatch & Routes)</option>
                    <option value="MANAGER">MANAGER (Operations & CRM)</option>
                    <option value="SALESMAN">SALESMAN (Customer Acquisition)</option>
                    <option value="ADMIN">ADMIN (Full Access)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700">Phone (Sri Lanka)</label>
                  <input
                    type="text"
                    value={staffForm.phone}
                    onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
                    placeholder="0771234567"
                    className="w-full mt-1 p-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden focus:border-blue-500 font-mono"
                  />
                  <span className="text-[10px] text-slate-400">Used for WhatsApp & route SMS</span>
                </div>

                <div>
                  <label className="font-bold text-slate-700">Email Address</label>
                  <input
                    type="email"
                    value={staffForm.email}
                    onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                    placeholder="staff@ceylonpest.lk"
                    className="w-full mt-1 p-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 flex items-center justify-between">
                  <span>{editingStaff ? 'Set New Password (leave empty to keep current)' : 'Account Password *'}</span>
                  <span className="text-[10px] text-slate-400 font-normal">Min 4 characters</span>
                </label>
                <div className="relative mt-1">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={staffForm.password || ''}
                    onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                    placeholder={editingStaff ? '••••••••' : 'Enter password (e.g. admin123, tech123)'}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden focus:border-blue-500 font-mono text-xs"
                  />
                </div>
              </div>

              {editingStaff && (
                <div className="pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!staffForm.is_active}
                      onChange={(e) => setStaffForm({ ...staffForm, is_active: e.target.checked ? 1 : 0 })}
                      className="w-4 h-4 text-emerald-600 rounded"
                    />
                    <span className="font-bold text-slate-800">Account is Active and allowed to sign in</span>
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowStaffModal(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl shadow-md shadow-blue-200 hover:scale-[1.01] transition"
                >
                  {editingStaff ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          STAFF PASSWORD RESET MODAL
         ======================================================== */}
      {passwordModalUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-sm w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Change Password</h3>
                  <div className="text-[11px] text-slate-500 font-semibold">{passwordModalUser.full_name} ({passwordModalUser.role})</div>
                </div>
              </div>
              <button
                onClick={() => setPasswordModalUser(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  New Password (minimum 4 characters)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    autoFocus
                    value={newStaffPassword}
                    onChange={(e) => setNewStaffPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPasswordModalUser(null)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={passwordModalLoading || newStaffPassword.length < 4}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 disabled:opacity-50 text-white font-bold rounded-xl shadow-md shadow-amber-200 hover:scale-[1.01] transition"
                >
                  {passwordModalLoading ? 'Saving...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          TREATMENT MODAL (ADD & EDIT)
         ======================================================== */}
      {showTreatmentModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                {editingTreatment ? 'Edit Treatment Type' : 'Add Treatment Type'}
              </h2>
              <button onClick={() => setShowTreatmentModal(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTreatment} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700">Treatment Code *</label>
                <input
                  type="text"
                  required
                  disabled={!!editingTreatment}
                  value={treatmentForm.code}
                  onChange={(e) => setTreatmentForm({ ...treatmentForm, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. GPC/RC/MC"
                  className="w-full mt-1 p-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden font-mono font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Full Name *</label>
                <input
                  type="text"
                  required
                  value={treatmentForm.name}
                  onChange={(e) => setTreatmentForm({ ...treatmentForm, name: e.target.value })}
                  placeholder="e.g. General Pest & Cockroach Control"
                  className="w-full mt-1 p-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700">Duration (Minutes)</label>
                  <input
                    type="number"
                    value={treatmentForm.default_duration_minutes}
                    onChange={(e) => setTreatmentForm({ ...treatmentForm, default_duration_minutes: parseInt(e.target.value, 10) })}
                    className="w-full mt-1 p-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700">Badge Color Tag</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="color"
                      value={treatmentForm.color_hex}
                      onChange={(e) => setTreatmentForm({ ...treatmentForm, color_hex: e.target.value })}
                      className="w-12 h-9 p-1 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer"
                    />
                    <span className="font-mono text-xs font-semibold text-slate-600">{treatmentForm.color_hex}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700">Description / Protocol</label>
                <textarea
                  rows={2}
                  value={treatmentForm.description}
                  onChange={(e) => setTreatmentForm({ ...treatmentForm, description: e.target.value })}
                  placeholder="Chemical concentration, application method, target pests..."
                  className="w-full mt-1 p-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setShowTreatmentModal(false)} className="px-4 py-2 font-semibold text-slate-600">Cancel</button>
                <button type="submit" className="px-5 py-2.5 bg-emerald-600 text-white font-bold rounded-xl shadow-md shadow-emerald-200">Save Treatment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Branding & Logo Settings Modal */}
      <BrandingSettingsModal
        isOpen={showBrandingModal}
        onClose={() => setShowBrandingModal(false)}
      />

    </div>
  );
}
