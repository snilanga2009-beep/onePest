import React, { useState, useEffect } from 'react';
import {
  Briefcase, Plus, Search, Filter, Calendar as CalendarIcon,
  PlayCircle, CheckCircle2, Clock, AlertTriangle, XCircle,
  MapPin, Phone, User, Check, X, Camera, PenTool, Edit, UserPlus,
  Users, HardHat, Copy, Send, ExternalLink, MessageSquare, Smartphone, Sparkles
} from 'lucide-react';
import {
  getJobs, getJobById, createJob, assignJob, bulkAssignJobs,
  startJob, completeJob, postponeJob, cancelJob,
  getStaff, getTreatments, getCustomers, sendTechDispatchSms
} from '../api';
import SignaturePad from '../components/SignaturePad';
import EditJobModal from '../components/EditJobModal';

export default function JobsView({
  initialJobId,
  onSelectCustomer,
  onOpenAddCustomer,
  currentRole,
  currentTechnicianId,
  isMobileView = false
}) {
  const isTechnicianMode = currentRole === 'TECHNICIAN' || (Boolean(currentTechnicianId) && currentRole !== 'ADMIN' && currentRole !== 'MANAGER' && currentRole !== 'SUPERVISOR');
  const lockedTechId = currentTechnicianId ? String(currentTechnicianId) : (isTechnicianMode ? (typeof window !== 'undefined' ? localStorage.getItem('tech_preferred_id') || '' : '') : '');

  const [jobs, setJobs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Edit Job Modal
  const [editingJob, setEditingJob] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [technicianFilter, setTechnicianFilter] = useState(() => lockedTechId || '');
  const [treatmentFilter, setTreatmentFilter] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (isTechnicianMode && lockedTechId) {
      setTechnicianFilter(lockedTechId);
    }
  }, [isTechnicianMode, lockedTechId]);

  // Selected job for detail modal
  const [selectedJob, setSelectedJob] = useState(null);
  const [jobDetails, setJobDetails] = useState(null);
  const [drawerCopied, setDrawerCopied] = useState(false);
  const [drawerSmsSending, setDrawerSmsSending] = useState(false);
  const [drawerSmsFeedback, setDrawerSmsFeedback] = useState(null);

  // Multi-select for bulk assignment
  const [selectedJobIds, setSelectedJobIds] = useState([]);
  const [bulkTechId, setBulkTechId] = useState('');
  const [bulkSendSms, setBulkSendSms] = useState(false);
  const [createSendSms, setCreateSendSms] = useState(false);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showPostponeModal, setShowPostponeModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Completion Form
  const [completionNotes, setCompletionNotes] = useState('');
  const [customerSignature, setCustomerSignature] = useState(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [photoUrl, setPhotoUrl] = useState('');

  const handlePhotoCapture = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPhotoUrl(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Postpone Form
  const [postponeDate, setPostponeDate] = useState('');
  const [postponeReason, setPostponeReason] = useState('');

  // Metadata
  const [staff, setStaff] = useState([]);
  const [treatments, setTreatments] = useState([]);
  const [customers, setCustomers] = useState([]);

  // Create Manual Job Form
  const [newJobForm, setNewJobForm] = useState({
    customer_id: '', location_id: '', treatment_id: '', technician_id: '',
    salesman_id: '', scheduled_date: new Date().toISOString().substring(0, 10),
    scheduled_time: '09:00', duration_minutes: 60, crew_count: 1, notes: ''
  });

  const loadJobs = async () => {
    setLoading(true);
    try {
      const res = await getJobs({
        status: statusFilter,
        date: dateFilter,
        technician_id: technicianFilter,
        treatment_id: treatmentFilter,
        search,
        limit: 100
      });
      setJobs(res.jobs || []);
      setTotal(res.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadJobDetails = async (id) => {
    try {
      const res = await getJobById(id);
      setSelectedJob(res.job);
      setJobDetails(res);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadJobs();
  }, [statusFilter, dateFilter, technicianFilter, treatmentFilter, search]);

  useEffect(() => {
    getStaff().then(r => setStaff(r.staff || []));
    getTreatments().then(r => setTreatments(r.treatments || []));
    getCustomers({ limit: 100 }).then(r => setCustomers(r.customers || []));
  }, []);

  useEffect(() => {
    if (initialJobId) {
      loadJobDetails(initialJobId);
    }
  }, [initialJobId]);

  const handleStartJob = async (jobId) => {
    try {
      await startJob(jobId);
      loadJobs();
      if (selectedJob?.id === jobId) loadJobDetails(jobId);
    } catch (err) {
      alert(`Error starting job: ${err.message}`);
    }
  };

  const handleCompleteSubmit = async (e) => {
    e.preventDefault();
    if (!selectedJob) return;

    try {
      await completeJob(selectedJob.id, {
        technician_notes: completionNotes,
        customer_signature: customerSignature,
        photos: photoUrl ? [{ url: photoUrl, type: 'COMPLETION' }] : []
      });

      alert('Job marked as COMPLETED! Next recurring date calculated & next job generated.');
      setShowCompleteModal(false);
      setCompletionNotes('');
      setCustomerSignature(null);
      setPhotoUrl('');
      loadJobs();
      loadJobDetails(selectedJob.id);
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handlePostponeSubmit = async (e) => {
    e.preventDefault();
    if (!selectedJob || !postponeDate) return;

    try {
      await postponeJob(selectedJob.id, {
        postponed_to_date: postponeDate,
        reason: postponeReason
      });
      alert(`Job postponed to ${postponeDate}`);
      setShowPostponeModal(false);
      setPostponeDate('');
      setPostponeReason('');
      loadJobs();
      loadJobDetails(selectedJob.id);
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleBulkAssign = async () => {
    if (selectedJobIds.length === 0 || !bulkTechId) return;
    try {
      const res = await bulkAssignJobs(selectedJobIds, bulkTechId, {
        send_sms: bulkSendSms,
        custom_base_url: window.location.origin
      });
      if (bulkSendSms) {
        alert(`Successfully assigned ${selectedJobIds.length} jobs.\n\nSMS with unexpiring job links dispatched to technician phone.`);
      } else {
        alert(`Successfully assigned ${selectedJobIds.length} jobs to technician.\n(SMS dispatch was DISABLED - no SMS was sent).`);
      }
      setSelectedJobIds([]);
      setBulkTechId('');
      loadJobs();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleCreateJob = async (e) => {
    e.preventDefault();
    try {
      const res = await createJob({
        ...newJobForm,
        send_sms: createSendSms,
        custom_base_url: window.location.origin
      });
      if (createSendSms && res.smsResult && res.smsResult.success) {
        alert(`Job created successfully!\n\nSMS with Job Start Link was sent directly to technician (${res.smsResult.formattedPhone || 'Delivered'}).`);
      } else if (createSendSms && res.smsResult && !res.smsResult.success) {
        alert(`Job created successfully, but SMS could not be sent: ${res.smsResult.error || 'Failed'}`);
      } else {
        alert('Job created successfully! (SMS dispatch was disabled)');
      }
      setShowCreateModal(false);
      loadJobs();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const toggleSelectJob = (id) => {
    if (selectedJobIds.includes(id)) {
      setSelectedJobIds(selectedJobIds.filter(i => i !== id));
    } else {
      setSelectedJobIds([...selectedJobIds, id]);
    }
  };

  return (
    <div className="space-y-6 pb-12">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-emerald-600" />
            <span>Operational Jobs & Service Assignments</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manage daily dispatches, technician assignments, field completions, and postponements.
          </p>
        </div>

        {!isMobileView && !isTechnicianMode && (
          <div className="flex flex-wrap items-center gap-2">
            {onOpenAddCustomer && (
              <button
                type="button"
                onClick={onOpenAddCustomer}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 text-xs sm:text-sm font-bold rounded-xl border border-slate-200 hover:border-emerald-300 transition shadow-2xs"
              >
                <UserPlus className="w-4 h-4 text-emerald-600" />
                <span>+ Add Customer</span>
              </button>
            )}

            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>Create Manual Job</span>
            </button>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs">

          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search jobs..."
              className="w-full bg-slate-50 pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          {/* Date Filter */}
          <div className="relative flex items-center">
            <CalendarIcon className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full bg-slate-50 pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden"
            />
            {dateFilter && (
              <button onClick={() => setDateFilter('')} className="absolute right-2 text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden font-semibold"
          >
            <option value="">All Statuses</option>
            <option value="TO_BE_DONE">TO BE DONE</option>
            <option value="ASSIGNED">ASSIGNED</option>
            <option value="IN_PROGRESS">IN PROGRESS</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="POSTPONED">POSTPONED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>

          {/* Technician Filter */}
          <select
            value={technicianFilter}
            onChange={(e) => setTechnicianFilter(e.target.value)}
            className="w-full bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden"
          >
            <option value="">All Technicians</option>
            {staff.filter(s => s.role === 'TECHNICIAN').map(s => (
              <option key={s.id} value={s.id}>{s.full_name}</option>
            ))}
          </select>

          {/* Treatment Filter */}
          <select
            value={treatmentFilter}
            onChange={(e) => setTreatmentFilter(e.target.value)}
            className="w-full bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden"
          >
            <option value="">All Treatments</option>
            {treatments.map(t => (
              <option key={t.id} value={t.id}>{t.code}</option>
            ))}
          </select>

        </div>

        {/* Bulk Assign Action Bar (appears when 1 or more jobs are checked) */}
        {selectedJobIds.length > 0 && (
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in">
            <span className="font-bold text-emerald-900">{selectedJobIds.length} job(s) selected</span>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={bulkTechId}
                onChange={(e) => setBulkTechId(e.target.value)}
                className="bg-white px-3 py-1.5 rounded-lg border border-emerald-300 font-medium text-slate-800"
              >
                <option value="">Select Technician to Assign...</option>
                {staff.filter(s => s.role === 'TECHNICIAN').map(s => (
                  <option key={s.id} value={s.id}>{s.full_name}</option>
                ))}
              </select>

              {/* Click button to Enable / Disable sending SMS job link */}
              <button
                type="button"
                onClick={() => setBulkSendSms(!bulkSendSms)}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 border transition cursor-pointer ${
                  bulkSendSms
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                }`}
                title="Toggle whether to dispatch SMS with Job link to technician"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Send SMS Link: {bulkSendSms ? 'ENABLED ✓' : 'DISABLED ✕'}</span>
              </button>

              <button
                onClick={handleBulkAssign}
                disabled={!bulkTechId}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-2xs disabled:opacity-50"
              >
                Assign Jobs
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Jobs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="divide-y divide-slate-100 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-4 w-8">
                  <input
                    type="checkbox"
                    checked={selectedJobIds.length === jobs.length && jobs.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedJobIds(jobs.map(j => j.id));
                      else setSelectedJobIds([]);
                    }}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                </th>
                <th className="px-3 py-3">Job Code & Date</th>
                <th className="px-3 py-3">Customer</th>
                <th className="px-3 py-3">Location</th>
                <th className="px-3 py-3">Treatment</th>
                <th className="px-3 py-3">Technician</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jobs.map(job => (
                <tr
                  key={job.id}
                  onClick={() => loadJobDetails(job.id)}
                  className="hover:bg-slate-50/80 cursor-pointer transition"
                >
                  <td className="p-4" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedJobIds.includes(job.id)}
                      onChange={() => toggleSelectJob(job.id)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                  </td>

                  <td className="px-3 py-3.5 whitespace-nowrap">
                    <div className="font-mono font-bold text-slate-900">{job.job_code}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                      <span>{job.scheduled_date}</span>
                      <span>&bull;</span>
                      <span>{job.scheduled_time || '09:00'}</span>
                    </div>
                  </td>

                  <td className="px-3 py-3.5">
                    <div className="font-bold text-slate-900 text-sm">{job.customer_name}</div>
                    {job.customer_phone && (
                      <div className="text-[11px] text-slate-500">{job.customer_phone}</div>
                    )}
                  </td>

                  <td className="px-3 py-3.5 text-slate-600">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="line-clamp-1">{job.location_name || job.location_address || 'Main'}</span>
                    </div>
                  </td>

                  <td className="px-3 py-3.5 whitespace-nowrap">
                    <span
                      style={{ backgroundColor: `${job.treatment_color || '#10B981'}20`, color: job.treatment_color || '#10B981' }}
                      className="px-2.5 py-0.5 rounded-lg text-xs font-bold inline-block"
                    >
                      {job.treatment_code}
                    </span>
                  </td>

                  <td className="px-3 py-3.5 whitespace-nowrap">
                    {job.technician_name ? (
                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-slate-900">
                          <User className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{job.technician_name}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-semibold mt-0.5 flex items-center gap-1">
                          <span className="bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-bold inline-flex items-center gap-0.5">
                            <HardHat className="w-2.5 h-2.5 text-amber-700" />
                            {job.crew_count > 1 ? `${job.crew_count} workers` : 'Solo (1)'}
                          </span>
                          {job.workers_info && (
                            <span className="text-slate-400 font-normal">
                              +helpers
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-amber-500 font-semibold italic text-[11px]">Unassigned</span>
                    )}
                  </td>

                  <td className="px-3 py-3.5 whitespace-nowrap">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      job.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                      job.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-800 animate-pulse' :
                      job.status === 'POSTPONED' ? 'bg-indigo-100 text-indigo-800' :
                      job.status === 'CANCELLED' ? 'bg-rose-100 text-rose-800' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {job.status}
                    </span>
                  </td>

                  <td className="px-4 py-3.5 text-right whitespace-nowrap space-x-1.5" onClick={(e) => e.stopPropagation()}>
                    {/* Dedicated Edit Job Button */}
                    <button
                      type="button"
                      onClick={() => setEditingJob(job)}
                      className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-lg text-[11px] inline-flex items-center gap-1 border border-amber-200 transition shadow-2xs"
                      title="Edit Job Details"
                    >
                      <Edit className="w-3 h-3 text-amber-600" />
                      <span>Edit</span>
                    </button>

                    {job.status !== 'COMPLETED' && job.status !== 'CANCELLED' && (
                      <>
                        {job.status === 'IN_PROGRESS' ? (
                          <button
                            onClick={() => {
                              setSelectedJob(job);
                              setShowCompleteModal(true);
                            }}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-[11px] inline-flex items-center gap-1 shadow-2xs transition"
                          >
                            <CheckCircle2 className="w-3 h-3" /> Complete
                          </button>
                        ) : (
                          <button
                            onClick={() => handleStartJob(job.id)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 font-semibold rounded-lg text-[11px] inline-flex items-center gap-1 transition"
                          >
                            <PlayCircle className="w-3 h-3 text-emerald-600" /> Start
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Job Details Drawer / Inspection Modal */}
      {selectedJob && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex justify-end">
          <div className="bg-white w-full max-w-xl h-full shadow-2xl overflow-y-auto flex flex-col animate-in slide-in-from-right duration-200">

            {/* Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                  {selectedJob.job_code}
                </span>
                <h2 className="font-extrabold text-lg text-slate-900 mt-1">{selectedJob.customer_name}</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingJob(selectedJob)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs rounded-xl border border-amber-200 transition shadow-2xs"
                  title="Edit All Job Details"
                >
                  <Edit className="w-3.5 h-3.5 text-amber-600" />
                  <span>Edit Job</span>
                </button>
                <button onClick={() => setSelectedJob(null)} className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5 flex-1 text-xs">

              {/* Status and Action Buttons */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Current Status</div>
                  <span className={`mt-1 inline-block px-3 py-1 rounded-full text-xs font-black ${
                    selectedJob.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                    selectedJob.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-800' :
                    selectedJob.status === 'POSTPONED' ? 'bg-indigo-100 text-indigo-800' :
                    'bg-slate-200 text-slate-800'
                  }`}>
                    {selectedJob.status}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingJob(selectedJob)}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-xs flex items-center gap-1 transition"
                  >
                    <Edit className="w-3.5 h-3.5" /> Edit Details
                  </button>

                  {selectedJob.status !== 'COMPLETED' && (
                    <>
                      <button
                        onClick={() => setShowCompleteModal(true)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" /> Complete Job
                      </button>
                      <button
                        onClick={() => setShowPostponeModal(true)}
                        className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl"
                      >
                        Postpone
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Service Details Card */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-white rounded-2xl border border-slate-200">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Treatment</span>
                  <div className="font-bold text-slate-900 text-sm mt-0.5">{selectedJob.treatment_code}</div>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Scheduled Time</span>
                  <div className="font-bold text-slate-900 text-sm mt-0.5">{selectedJob.scheduled_date} at {selectedJob.scheduled_time || '09:00'}</div>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Technician</span>
                  <div className="font-bold text-slate-900 mt-0.5">{selectedJob.technician_name || 'Unassigned'}</div>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Location</span>
                  <div className="font-bold text-slate-900 mt-0.5">{selectedJob.location_name || 'Main Location'}</div>
                </div>
              </div>

              {/* Field Crew & Accompanying Labourers Allocation Card */}
              {(() => {
                let workers = [];
                try {
                  if (selectedJob.workers_info) {
                    workers = typeof selectedJob.workers_info === 'string'
                      ? JSON.parse(selectedJob.workers_info)
                      : selectedJob.workers_info;
                  }
                } catch (e) {}

                const crewSize = selectedJob.crew_count || (1 + workers.length);

                return (
                  <div className="p-4 bg-gradient-to-br from-indigo-50/60 to-blue-50/60 rounded-2xl border border-indigo-100 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                          <HardHat className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Field Crew Allocation</h4>
                          <p className="text-[11px] text-slate-500">Technician & deployed team members</p>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 bg-white border border-indigo-200 rounded-full text-[11px] font-bold text-indigo-700 shadow-2xs flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-indigo-600" />
                        {crewSize} {crewSize === 1 ? 'Person (Solo)' : 'People Total'}
                      </span>
                    </div>

                    <div className="bg-white/90 rounded-xl p-3 border border-indigo-100/80 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-semibold">Lead Technician:</span>
                        <span className="font-bold text-slate-900 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-emerald-600" />
                          {selectedJob.technician_name || 'Unassigned'}
                        </span>
                      </div>

                      {workers && workers.length > 0 ? (
                        <div className="pt-2 border-t border-indigo-50 space-y-2">
                          <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">
                            Accompanying Labourers / Helpers ({workers.length})
                          </span>
                          <div className="space-y-1.5">
                            {workers.map((w, idx) => (
                              <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200/70 text-xs">
                                <div className="flex items-center gap-2">
                                  <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-black">
                                    {idx + 1}
                                  </div>
                                  <span className="font-bold text-slate-800">{w.name || `Labourer #${idx + 1}`}</span>
                                </div>
                                {w.phone && (
                                  <a
                                    href={`tel:${w.phone}`}
                                    className="font-mono text-emerald-700 hover:text-emerald-800 text-[11px] font-bold flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-emerald-100"
                                  >
                                    <Phone className="w-3 h-3 text-emerald-600" /> {w.phone}
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400 italic pt-1">
                          No additional accompanying labourers registered (Solo dispatch or unassigned helpers).
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Technician Mobile Dispatch & Permanent Job Start Link */}
              {(() => {
                const jobStartUrl = typeof window !== 'undefined' ? `${window.location.origin}/tech?job=${selectedJob.id}` : `/tech?job=${selectedJob.id}`;
                const techPhone = selectedJob.technician_phone || '';
                const techName = selectedJob.technician_name || 'Assigned Technician';
                const cleanPhone = techPhone.replace(/\D/g, '');
                const intlPhone = cleanPhone.startsWith('0') ? '94' + cleanPhone.substring(1) : cleanPhone.startsWith('94') ? cleanPhone : '94' + cleanPhone;

                const smsText = `PestControl: Hello ${techName}, Job #${selectedJob.job_code} assigned for ${selectedJob.customer_name} on ${selectedJob.scheduled_date} at ${selectedJob.scheduled_time || '09:00'}. Click here to open your mobile panel & start work: ${jobStartUrl}`;
                const encodedSms = encodeURIComponent(smsText);

                const handleCopy = (e) => {
                  e.preventDefault();
                  navigator.clipboard.writeText(jobStartUrl);
                  setDrawerCopied(true);
                  setTimeout(() => setDrawerCopied(false), 2500);
                };

                const handleSendSms = async (e) => {
                  e.preventDefault();
                  if (!techPhone) {
                    alert('No phone number registered for this technician.');
                    return;
                  }
                  setDrawerSmsSending(true);
                  setDrawerSmsFeedback(null);
                  try {
                    const res = await sendTechDispatchSms({
                      job_id: selectedJob.id,
                      technician_phone: techPhone,
                      technician_name: techName,
                      custom_base_url: window.location.origin
                    });
                    setDrawerSmsFeedback({ type: 'success', msg: res.message || 'SMS dispatched successfully!' });
                  } catch (err) {
                    setDrawerSmsFeedback({ type: 'error', msg: `Failed: ${err.message}` });
                  } finally {
                    setDrawerSmsSending(false);
                  }
                };

                return (
                  <div className="p-4 bg-gradient-to-br from-emerald-50/70 via-teal-50/50 to-indigo-50/70 rounded-2xl border border-emerald-200/80 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-black shadow-xs">
                          <Smartphone className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                            <span>Tech Job Start Link (SMS / WhatsApp)</span>
                            <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded font-mono text-[9px] font-bold">Unexpiring</span>
                          </h4>
                          <p className="text-[11px] text-slate-500">1-tap auto open technician work panel</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-emerald-200">
                      <input
                        type="text"
                        readOnly
                        value={jobStartUrl}
                        className="flex-1 bg-transparent text-xs font-mono text-emerald-800 font-semibold focus:outline-hidden select-all truncate"
                      />
                      <button
                        type="button"
                        onClick={handleCopy}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-bold text-xs flex items-center gap-1 transition shrink-0 cursor-pointer"
                      >
                        {drawerCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-600" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                      <a
                        href={jobStartUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg shrink-0 cursor-pointer"
                        title="Open Mobile Tech View"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>

                    {drawerSmsFeedback && (
                      <div className={`p-2 rounded-xl text-xs flex items-center gap-2 ${
                        drawerSmsFeedback.type === 'success' ? 'bg-emerald-100 text-emerald-900 border border-emerald-200' : 'bg-rose-100 text-rose-900 border border-rose-200'
                      }`}>
                        {drawerSmsFeedback.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
                        <span className="text-[11px]">{drawerSmsFeedback.msg}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        disabled={drawerSmsSending || !techPhone}
                        onClick={handleSendSms}
                        className="py-2 px-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-[11px] flex items-center justify-center gap-1 shadow-xs transition cursor-pointer"
                      >
                        <Send className="w-3 h-3" />
                        <span>{drawerSmsSending ? 'Sending...' : 'SMS Gateway'}</span>
                      </button>

                      <a
                        href={techPhone ? `sms:${techPhone}?body=${encodedSms}` : '#'}
                        onClick={(e) => {
                          if (!techPhone) {
                            e.preventDefault();
                            alert('No technician phone registered.');
                          }
                        }}
                        className={`py-2 px-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-bold rounded-xl text-[11px] flex items-center justify-center gap-1 shadow-2xs transition ${!techPhone ? 'opacity-50 pointer-events-none' : ''}`}
                      >
                        <Smartphone className="w-3 h-3 text-slate-600" />
                        <span>Phone SMS</span>
                      </a>

                      <a
                        href={techPhone ? `https://wa.me/${intlPhone}?text=${encodedSms}` : '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => {
                          if (!techPhone) {
                            e.preventDefault();
                            alert('No technician phone registered.');
                          }
                        }}
                        className={`py-2 px-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-[11px] flex items-center justify-center gap-1 shadow-xs transition ${!techPhone ? 'opacity-50 pointer-events-none' : ''}`}
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>WhatsApp</span>
                      </a>
                    </div>
                  </div>
                );
              })()}

              {/* Customer Contact & Call */}
              {selectedJob.customer_phone && (
                <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900">{selectedJob.contact_person || selectedJob.customer_name}</div>
                    <div className="text-emerald-700 font-mono mt-0.5">{selectedJob.customer_phone}</div>
                  </div>
                  <a
                    href={`tel:${selectedJob.customer_phone}`}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center gap-1.5"
                  >
                    <Phone className="w-3.5 h-3.5" /> Call Client
                  </a>
                </div>
              )}

              {/* Customer Signature if completed */}
              {selectedJob.customer_signature && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <span className="text-slate-400 text-[10px] uppercase font-bold flex items-center gap-1">
                    <PenTool className="w-3.5 h-3.5 text-emerald-600" /> Customer Signature
                  </span>
                  <div className="border border-slate-200 bg-white p-2 rounded-xl">
                    <img src={selectedJob.customer_signature} alt="Signature" className="max-h-24 mx-auto" />
                  </div>
                </div>
              )}

              {/* Technician Notes */}
              {selectedJob.technician_notes && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Technician Notes</span>
                  <p className="mt-1 text-slate-700 italic font-medium">{selectedJob.technician_notes}</p>
                </div>
              )}

              {/* Audit Logs */}
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Audit Trail</span>
                <div className="mt-2 space-y-1.5">
                  {jobDetails?.logs?.map(log => (
                    <div key={log.id} className="p-2.5 bg-slate-50 rounded-xl text-[11px] flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-900">{log.action}</span>
                        {log.notes && <span className="text-slate-500 ml-1.5">- {log.notes}</span>}
                      </div>
                      <span className="text-slate-400 font-mono text-[9px]">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Complete Job Modal (with Touch Signature Pad) */}
      {showCompleteModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Job Completion & Customer Sign-off</span>
              </h2>
              <button onClick={() => setShowCompleteModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCompleteSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700">Service Notes / Findings</label>
                <textarea
                  rows={3}
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  placeholder="e.g. Completed GPC spraying. Bait stations inspected and replenished."
                  className="w-full mt-1 p-2 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden"
                />
              </div>

              {/* Photo attachment (Optional - Not Required) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-emerald-600" />
                    <span>Job Photo</span>
                    <span className="text-[10px] text-slate-400 font-normal">(Optional - Not Required)</span>
                  </label>
                  {photoUrl && (
                    <button
                      type="button"
                      onClick={() => setPhotoUrl('')}
                      className="text-[11px] text-rose-600 font-bold hover:underline"
                    >
                      Remove Photo
                    </button>
                  )}
                </div>

                {photoUrl ? (
                  <div className="relative rounded-xl overflow-hidden border border-emerald-200 bg-slate-50 p-1.5">
                    <img src={photoUrl} alt="Job completion" className="max-h-32 w-full object-cover rounded-lg" />
                  </div>
                ) : (
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      id="jobs-camera-input"
                      className="hidden"
                      onChange={handlePhotoCapture}
                    />
                    <label
                      htmlFor="jobs-camera-input"
                      className="flex items-center justify-center gap-2 py-2.5 px-3 bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 font-bold rounded-xl border-2 border-dashed border-slate-200 hover:border-emerald-300 transition cursor-pointer text-xs"
                    >
                      <Camera className="w-4 h-4 text-emerald-600" />
                      <span>Take Photo with Camera (Optional)</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Customer Signature Section */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <PenTool className="w-4 h-4 text-emerald-600" /> Customer Signature
                  </label>
                  {!showSignaturePad && (
                    <button
                      type="button"
                      onClick={() => setShowSignaturePad(true)}
                      className="text-xs font-bold text-emerald-600 hover:underline"
                    >
                      {customerSignature ? 'Re-sign' : 'Open Signature Pad'}
                    </button>
                  )}
                </div>

                {customerSignature ? (
                  <div className="border border-slate-200 rounded-xl p-2 bg-slate-50">
                    <img src={customerSignature} alt="Captured signature" className="max-h-20 mx-auto" />
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 italic">Signature not yet recorded.</div>
                )}

                {showSignaturePad && (
                  <div className="mt-2">
                    <SignaturePad
                      onSave={(dataUrl) => {
                        setCustomerSignature(dataUrl);
                        setShowSignaturePad(false);
                      }}
                      onCancel={() => setShowSignaturePad(false)}
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setShowCompleteModal(false)} className="px-4 py-2 text-slate-600 font-semibold">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs">
                  Save & Complete Job
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Postpone Modal */}
      {showPostponeModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-600" />
                <span>Postpone Service Job</span>
              </h2>
              <button onClick={() => setShowPostponeModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePostponeSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700">Reschedule to Date *</label>
                <input
                  type="date"
                  required
                  value={postponeDate}
                  onChange={(e) => setPostponeDate(e.target.value)}
                  className="w-full mt-1 p-2 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">Reason for Postponement</label>
                <textarea
                  rows={2}
                  value={postponeReason}
                  onChange={(e) => setPostponeReason(e.target.value)}
                  placeholder="e.g. Client requested postponement due to factory maintenance"
                  className="w-full mt-1 p-2 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setShowPostponeModal(false)} className="px-4 py-2 text-slate-600 font-semibold">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs">
                  Confirm Postponement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Manual Job Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">Create Ad-hoc Service Job</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateJob} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700">Customer *</label>
                <select
                  required
                  value={newJobForm.customer_id}
                  onChange={(e) => setNewJobForm({ ...newJobForm, customer_id: e.target.value })}
                  className="w-full mt-1 p-2 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden"
                >
                  <option value="">Select Customer</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.customer_code})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Treatment *</label>
                  <select
                    required
                    value={newJobForm.treatment_id}
                    onChange={(e) => setNewJobForm({ ...newJobForm, treatment_id: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden"
                  >
                    <option value="">Select Treatment</option>
                    {treatments.map(t => (
                      <option key={t.id} value={t.id}>{t.code} - {t.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700">Assign Technician</label>
                  <select
                    value={newJobForm.technician_id}
                    onChange={(e) => setNewJobForm({ ...newJobForm, technician_id: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden"
                  >
                    <option value="">Unassigned</option>
                    {staff.filter(s => s.role === 'TECHNICIAN').map(s => (
                      <option key={s.id} value={s.id}>{s.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Scheduled Date *</label>
                  <input
                    type="date"
                    required
                    value={newJobForm.scheduled_date}
                    onChange={(e) => setNewJobForm({ ...newJobForm, scheduled_date: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700">Scheduled Time</label>
                  <input
                    type="time"
                    value={newJobForm.scheduled_time}
                    onChange={(e) => setNewJobForm({ ...newJobForm, scheduled_time: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Crew Size (People)</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={newJobForm.crew_count}
                    onChange={(e) => setNewJobForm({ ...newJobForm, crew_count: parseInt(e.target.value) || 1 })}
                    className="w-full mt-1 p-2 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden"
                    placeholder="1"
                  />
                </div>
              </div>

              {/* SMS Dispatch Toggle Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setCreateSendSms(!createSendSms)}
                  className={`w-full py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                    createSendSms
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-emerald-600" />
                    <span>Send SMS Job Link to Technician:</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-black ${
                    createSendSms ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {createSendSms ? 'ENABLED ✓' : 'DISABLED ✕'}
                  </span>
                </button>
                <p className="text-[10px] text-slate-400 mt-1">
                  Keep disabled if technician already uses the mobile app to view assigned jobs.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 font-semibold text-slate-600">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl">Create Job</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Job Details Modal */}
      <EditJobModal
        isOpen={!!editingJob}
        job={editingJob}
        onClose={() => setEditingJob(null)}
        onJobUpdated={(updated) => {
          loadJobs();
          if (selectedJob?.id === updated.id) {
            loadJobDetails(updated.id);
          }
        }}
      />

    </div>
  );
}
