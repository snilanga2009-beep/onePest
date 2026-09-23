import React, { useState, useEffect } from 'react';
import {
  Briefcase, Calendar as CalendarIcon, Clock, User,
  MapPin, CheckCircle2, AlertTriangle, X, Check,
  AlertCircle, Shield, FileText, ChevronDown,
  Users, Plus, Trash2, Phone, HardHat,
  Copy, Send, ExternalLink, MessageSquare, Smartphone, Sparkles
} from 'lucide-react';
import { updateJob, getStaff, getTreatments, getCustomerById, sendTechDispatchSms } from '../api';

export default function EditJobModal({ isOpen, job, onClose, onJobUpdated }) {
  const [formData, setFormData] = useState({
    scheduled_date: '',
    scheduled_time: '09:00',
    duration_minutes: 60,
    treatment_id: '',
    technician_id: '',
    salesman_id: '',
    location_id: '',
    status: 'TO_BE_DONE',
    technician_notes: ''
  });

  const [crewCount, setCrewCount] = useState(1);
  const [enableLabourers, setEnableLabourers] = useState(false);
  const [labourers, setLabourers] = useState([]);

  const [staff, setStaff] = useState([]);
  const [treatments, setTreatments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Dispatch Link & SMS states
  const [dispatchSending, setDispatchSending] = useState(false);
  const [dispatchFeedback, setDispatchFeedback] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [autoSendSms, setAutoSendSms] = useState(false);

  useEffect(() => {
    getStaff().then(r => setStaff(r.staff || []));
    getTreatments().then(r => setTreatments(r.treatments || []));
  }, []);

  useEffect(() => {
    if (job) {
      let parsedWorkers = [];
      try {
        if (job.workers_info) {
          parsedWorkers = typeof job.workers_info === 'string'
            ? JSON.parse(job.workers_info)
            : job.workers_info;
        }
      } catch (e) {
        console.error(e);
      }

      setFormData({
        scheduled_date: job.scheduled_date || '',
        scheduled_time: job.scheduled_time || '09:00',
        duration_minutes: job.duration_minutes || 60,
        treatment_id: job.treatment_id || '',
        technician_id: job.technician_id || '',
        salesman_id: job.salesman_id || '',
        location_id: job.location_id || '',
        status: job.status || 'TO_BE_DONE',
        technician_notes: job.technician_notes || ''
      });

      const hasWorkers = Array.isArray(parsedWorkers) && parsedWorkers.length > 0;
      setLabourers(hasWorkers ? parsedWorkers : []);
      setEnableLabourers(hasWorkers);
      setCrewCount(job.crew_count || (hasWorkers ? parsedWorkers.length + 1 : 1));
      setError(null);

      // Load locations for customer
      if (job.customer_id) {
        getCustomerById(job.customer_id)
          .then(res => setLocations(res.locations || []))
          .catch(() => setLocations([]));
      }
    }
  }, [job, isOpen]);

  if (!isOpen || !job) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const handleAddLabourer = () => {
    setLabourers(prev => [...prev, { name: '', phone: '' }]);
    setCrewCount(prev => Math.max(prev, labourers.length + 2)); // 1 tech + helpers
  };

  const handleRemoveLabourer = (index) => {
    setLabourers(prev => prev.filter((_, i) => i !== index));
  };

  const handleLabourerChange = (index, field, value) => {
    setLabourers(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.scheduled_date) {
      setError('Scheduled date is required');
      return;
    }

    setLoading(true);
    setError(null);

    const validLabourers = enableLabourers ? labourers.filter(l => l.name && l.name.trim()) : [];
    const calculatedCrew = parseInt(crewCount, 10) || (validLabourers.length > 0 ? validLabourers.length + 1 : 1);

    try {
      const res = await updateJob(job.id, {
        ...formData,
        technician_id: formData.technician_id ? parseInt(formData.technician_id, 10) : null,
        salesman_id: formData.salesman_id ? parseInt(formData.salesman_id, 10) : null,
        location_id: formData.location_id ? parseInt(formData.location_id, 10) : null,
        treatment_id: formData.treatment_id ? parseInt(formData.treatment_id, 10) : job.treatment_id,
        duration_minutes: parseInt(formData.duration_minutes, 10) || 60,
        crew_count: calculatedCrew,
        workers_info: validLabourers,
        send_sms: autoSendSms,
        custom_base_url: typeof window !== 'undefined' ? window.location.origin : undefined
      });

      if (res.success && res.job) {
        if (res.smsResult) {
          if (res.smsResult.success) {
            alert(`Job updated successfully!\n\nSMS with live Job Start Link was sent directly to technician (${res.smsResult.formattedPhone || 'Delivered'}).`);
          } else {
            alert(`Job saved, but SMS could not be delivered:\n${res.smsResult.error || 'Failed'}\n\nPlease check your SMS Gateway settings.`);
          }
        }
        if (onJobUpdated) onJobUpdated(res.job);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to update job details');
    } finally {
      setLoading(false);
    }
  };

  const selectedTreatment = treatments.find(t => t.id === parseInt(formData.treatment_id, 10));

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-bold bg-white/20 text-white px-2 py-0.5 rounded">
                  {job.job_code}
                </span>
                <h2 className="text-lg font-black tracking-tight">Edit Job & Crew Assignment</h2>
              </div>
              <p className="text-xs text-amber-100 mt-0.5">
                Client: <strong className="text-white">{job.customer_name}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white rounded-xl hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body */}
        <form id="edit-job-form" onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
          
          {/* Scheduling Details */}
          <div>
            <div className="flex items-center gap-2 text-slate-400 font-bold uppercase tracking-wider text-[11px] mb-3 pb-1 border-b border-slate-100">
              <CalendarIcon className="w-3.5 h-3.5 text-amber-600" />
              <span>Schedule Timing & Operational Status</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="font-bold text-slate-800">
                  Scheduled Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  name="scheduled_date"
                  value={formData.scheduled_date}
                  onChange={handleChange}
                  required
                  className="w-full bg-slate-50 font-semibold px-3.5 py-2 rounded-xl border border-slate-200 focus:bg-white focus:border-amber-500 focus:outline-hidden transition"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" /> Scheduled Time
                </label>
                <input
                  type="time"
                  name="scheduled_time"
                  value={formData.scheduled_time}
                  onChange={handleChange}
                  className="w-full bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 focus:bg-white focus:border-amber-500 focus:outline-hidden transition"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-800">
                  Duration (Minutes)
                </label>
                <input
                  type="number"
                  name="duration_minutes"
                  value={formData.duration_minutes}
                  onChange={handleChange}
                  min={15}
                  step={15}
                  className="w-full bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 focus:bg-white focus:border-amber-500 focus:outline-hidden transition"
                />
              </div>

              <div className="sm:col-span-3 space-y-1">
                <label className="font-bold text-slate-800">
                  Job Operational Status
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'TO_BE_DONE', label: 'TO BE DONE', color: 'border-slate-300 text-slate-700 bg-slate-50' },
                    { id: 'ASSIGNED', label: 'ASSIGNED', color: 'border-blue-400 text-blue-800 bg-blue-50' },
                    { id: 'IN_PROGRESS', label: 'IN PROGRESS', color: 'border-amber-400 text-amber-800 bg-amber-50' },
                    { id: 'COMPLETED', label: 'COMPLETED', color: 'border-emerald-400 text-emerald-800 bg-emerald-50' },
                    { id: 'POSTPONED', label: 'POSTPONED', color: 'border-indigo-400 text-indigo-800 bg-indigo-50' },
                    { id: 'CANCELLED', label: 'CANCELLED', color: 'border-rose-400 text-rose-800 bg-rose-50' }
                  ].map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, status: s.id }))}
                      className={`p-2.5 rounded-xl border-2 font-bold text-center text-xs transition ${
                        formData.status === s.id
                          ? `${s.color} ring-2 ring-amber-300 shadow-xs font-black`
                          : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Treatment & Site Location */}
          <div>
            <div className="flex items-center gap-2 text-slate-400 font-bold uppercase tracking-wider text-[11px] mb-3 pb-1 border-b border-slate-100">
              <Shield className="w-3.5 h-3.5 text-amber-600" />
              <span>Treatment & Location</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="font-bold text-slate-800">
                  Treatment Type
                </label>
                <select
                  name="treatment_id"
                  value={formData.treatment_id}
                  onChange={handleChange}
                  className="w-full bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-200 focus:bg-white focus:border-amber-500 focus:outline-hidden transition font-semibold"
                >
                  {treatments.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.code} - {t.name}
                    </option>
                  ))}
                </select>
                {selectedTreatment && (
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 pt-1">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: selectedTreatment.color_hex }} />
                    <span>{selectedTreatment.name} &bull; default: {selectedTreatment.default_duration_minutes} min</span>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-800 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" /> Service Location
                </label>
                <select
                  name="location_id"
                  value={formData.location_id}
                  onChange={handleChange}
                  className="w-full bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-200 focus:bg-white focus:border-amber-500 focus:outline-hidden transition"
                >
                  <option value="">Default / Main Location</option>
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>
                      {loc.location_name} {loc.is_primary ? '(Primary)' : ''} - {loc.address}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Personnel Assignment & Crew Members */}
          <div className="bg-amber-50/40 p-4 rounded-2xl border border-amber-200/80 space-y-4">
            <div className="flex items-center justify-between text-amber-900 font-bold uppercase tracking-wider text-[11px] pb-1 border-b border-amber-200/60">
              <span className="flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-600" />
                <span>Personnel & Crew Members Allocation</span>
              </span>
              <span className="text-[10px] bg-amber-200 text-amber-900 font-mono font-bold px-2 py-0.5 rounded-full">
                Total People: {crewCount}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              
              {/* Assigned Technician */}
              <div className="space-y-1 sm:col-span-2">
                <label className="font-bold text-slate-800 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-emerald-600" /> Assigned Lead Technician <span className="text-rose-500">*</span>
                </label>
                <select
                  name="technician_id"
                  value={formData.technician_id}
                  onChange={handleChange}
                  className="w-full bg-white px-3.5 py-2.5 rounded-xl border border-slate-200 focus:bg-white focus:border-amber-500 focus:outline-hidden transition font-semibold"
                >
                  <option value="">-- Unassigned --</option>
                  {staff.filter(s => s.role === 'TECHNICIAN').map(s => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} ({s.phone || 'No phone'})
                    </option>
                  ))}
                </select>

                {formData.technician_id && (
                  <label className="flex items-center gap-2 pt-1.5 cursor-pointer select-none text-xs font-semibold text-emerald-800">
                    <input
                      type="checkbox"
                      checked={autoSendSms}
                      onChange={(e) => setAutoSendSms(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span className="flex items-center gap-1.5">
                      <Send className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Send unexpiring Job Start Link SMS to technician on save</span>
                    </span>
                  </label>
                )}
              </div>

              {/* Number of People going to job */}
              <div className="space-y-1">
                <label className="font-bold text-slate-800 flex items-center gap-1.5">
                  <HardHat className="w-3.5 h-3.5 text-amber-600" /> Total People Going
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={crewCount}
                  onChange={(e) => setCrewCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full bg-white font-black text-slate-900 px-3.5 py-2 rounded-xl border border-slate-200 focus:border-amber-500 focus:outline-hidden transition"
                />
              </div>

              {/* Sales Representative */}
              <div className="space-y-1 sm:col-span-3">
                <label className="font-bold text-slate-800">
                  Assigned Sales Representative
                </label>
                <select
                  name="salesman_id"
                  value={formData.salesman_id}
                  onChange={handleChange}
                  className="w-full bg-white px-3.5 py-2 rounded-xl border border-slate-200 focus:bg-white focus:border-amber-500 focus:outline-hidden transition"
                >
                  <option value="">-- None --</option>
                  {staff.filter(s => s.role === 'SALESMAN').map(s => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}
                    </option>
                  ))}
                </select>
              </div>

            </div>

            {/* Checkbox: Add Accompanying Labourers / Helpers */}
            <div className="pt-2 border-t border-amber-200/60">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 select-none">
                <input
                  type="checkbox"
                  checked={enableLabourers}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setEnableLabourers(checked);
                    if (checked && labourers.length === 0) {
                      setLabourers([{ name: '', phone: '' }]);
                    }
                  }}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300"
                />
                <span className="flex items-center gap-1.5">
                  <span>Add Accompanying Labourers / Helpers</span>
                  <span className="text-[10px] text-slate-500 font-normal">(Optional names & contact numbers)</span>
                </span>
              </label>

              {/* Dynamic Labourers / Helpers List */}
              {enableLabourers && (
                <div className="mt-3 space-y-2.5 bg-white p-3.5 rounded-2xl border border-amber-200">
                  <div className="text-[11px] font-bold text-slate-500 flex items-center justify-between">
                    <span>Accompanying Workers List ({labourers.length})</span>
                    <button
                      type="button"
                      onClick={handleAddLabourer}
                      className="flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:text-amber-800 hover:underline"
                    >
                      <Plus className="w-3.5 h-3.5" /> + Add Another Worker
                    </button>
                  </div>

                  {labourers.map((worker, index) => (
                    <div key={index} className="flex items-center gap-2 animate-in fade-in">
                      <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px] flex items-center justify-center shrink-0">
                        {index + 1}
                      </span>
                      <input
                        type="text"
                        value={worker.name || ''}
                        onChange={(e) => handleLabourerChange(index, 'name', e.target.value)}
                        placeholder="Labourer / Helper Full Name"
                        className="flex-1 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold focus:bg-white focus:border-amber-500 focus:outline-hidden"
                      />
                      <div className="relative w-36 sm:w-44">
                        <Phone className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={worker.phone || ''}
                          onChange={(e) => handleLabourerChange(index, 'phone', e.target.value)}
                          placeholder="Phone No"
                          className="w-full bg-slate-50 pl-7 pr-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-mono focus:bg-white focus:border-amber-500 focus:outline-hidden"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveLabourer(index)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition shrink-0"
                        title="Remove worker"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  {labourers.length === 0 && (
                    <div className="text-center py-2 text-slate-400 text-xs">
                      No labourers added yet. Click "+ Add Another Worker" above.
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>

          {/* Technician Mobile Dispatch & Permanent Job Start Link */}
          {(() => {
            const assignedTech = staff.find(s => s.id === parseInt(formData.technician_id, 10)) || (job.technician_id ? staff.find(s => s.id === job.technician_id) : null);
            const techPhone = assignedTech?.phone || job.technician_phone || '';
            const techName = assignedTech?.full_name || job.technician_name || 'Technician';
            const jobStartUrl = typeof window !== 'undefined' ? `${window.location.origin}/tech?job=${job.id}` : `/tech?job=${job.id}`;

            const cleanPhone = techPhone.replace(/\D/g, '');
            const intlPhone = cleanPhone.startsWith('0') ? '94' + cleanPhone.substring(1) : cleanPhone.startsWith('94') ? cleanPhone : '94' + cleanPhone;

            const smsText = `PestControl: Hello ${techName}, Job #${job.job_code} assigned for ${job.customer_name} on ${formData.scheduled_date || job.scheduled_date} at ${formData.scheduled_time || job.scheduled_time || '09:00'}. Click here to open your mobile panel & start work: ${jobStartUrl}`;
            const encodedSms = encodeURIComponent(smsText);

            const handleCopyLink = (e) => {
              e.preventDefault();
              navigator.clipboard.writeText(jobStartUrl);
              setCopiedLink(true);
              setTimeout(() => setCopiedLink(false), 2500);
            };

            const handleSendSystemSms = async (e) => {
              e.preventDefault();
              if (!techPhone) {
                alert('Please select or specify a technician with a registered phone number.');
                return;
              }
              setDispatchSending(true);
              setDispatchFeedback(null);
              try {
                const res = await sendTechDispatchSms({
                  job_id: job.id,
                  technician_phone: techPhone,
                  technician_name: techName,
                  custom_base_url: window.location.origin
                });
                setDispatchFeedback({ type: 'success', msg: res.message || 'SMS dispatched successfully!' });
              } catch (err) {
                setDispatchFeedback({ type: 'error', msg: `Failed: ${err.message}` });
              } finally {
                setDispatchSending(false);
              }
            };

            return (
              <div className="p-4 bg-gradient-to-br from-emerald-50/70 via-teal-50/50 to-indigo-50/70 rounded-2xl border border-emerald-200/80 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-black shadow-xs">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <span>Technician Job Start Link & SMS Dispatch</span>
                        <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded font-mono text-[9px] font-bold">Unexpiring</span>
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Technician opens this link to start work with 0-login friction & save app icon to home screen
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-600">
                      Tech: <strong className="text-slate-900">{techName}</strong> {techPhone ? `(${techPhone})` : '<No Phone>'}
                    </span>
                  </div>
                </div>

                {/* Permanent Link Box */}
                <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-emerald-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase font-mono pl-1">URL:</span>
                  <input
                    type="text"
                    readOnly
                    value={jobStartUrl}
                    className="flex-1 bg-transparent text-xs font-mono text-emerald-800 font-semibold focus:outline-hidden select-all truncate"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-bold text-xs flex items-center gap-1 transition shrink-0 cursor-pointer"
                    title="Copy Permanent Link"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-600" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>
                  <a
                    href={jobStartUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg shrink-0 cursor-pointer"
                    title="Open Mobile Tech Panel Preview"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                {/* Dispatch Feedback Alert */}
                {dispatchFeedback && (
                  <div className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                    dispatchFeedback.type === 'success' ? 'bg-emerald-100 text-emerald-900 border border-emerald-200' : 'bg-rose-100 text-rose-900 border border-rose-200'
                  }`}>
                    {dispatchFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                    <span>{dispatchFeedback.msg}</span>
                  </div>
                )}

                {/* Dispatch Action Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  {/* System Gateway SMS */}
                  <button
                    type="button"
                    disabled={dispatchSending || !techPhone}
                    onClick={handleSendSystemSms}
                    className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{dispatchSending ? 'Sending SMS...' : 'Send SMS via Gateway'}</span>
                  </button>

                  {/* Native Phone SMS */}
                  <a
                    href={techPhone ? `sms:${techPhone}?body=${encodedSms}` : '#'}
                    onClick={(e) => {
                      if (!techPhone) {
                        e.preventDefault();
                        alert('No phone number available for technician.');
                      }
                    }}
                    className={`py-2.5 px-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-2xs transition ${!techPhone ? 'opacity-50 pointer-events-none' : ''}`}
                  >
                    <Smartphone className="w-3.5 h-3.5 text-slate-600" />
                    <span>Send via Phone SMS</span>
                  </a>

                  {/* WhatsApp */}
                  <a
                    href={techPhone ? `https://wa.me/${intlPhone}?text=${encodedSms}` : '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      if (!techPhone) {
                        e.preventDefault();
                        alert('No phone number available for technician.');
                      }
                    }}
                    className={`py-2.5 px-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition ${!techPhone ? 'opacity-50 pointer-events-none' : ''}`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Send WhatsApp</span>
                  </a>
                </div>

                <div className="text-[10px] text-slate-500 bg-white/60 p-2 rounded-lg border border-slate-200/60 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                  <span>
                    <strong>1-Tap Home Screen Icon:</strong> When the technician opens this link on their phone, they can tap <em>"Add Icon"</em> to save the Tech App to their phone screen without logging in again!
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Technician Notes */}
          <div>
            <div className="flex items-center gap-2 text-slate-400 font-bold uppercase tracking-wider text-[11px] mb-3 pb-1 border-b border-slate-100">
              <FileText className="w-3.5 h-3.5 text-amber-600" />
              <span>Technician Notes & Work Instructions</span>
            </div>

            <div className="space-y-1">
              <textarea
                name="technician_notes"
                value={formData.technician_notes}
                onChange={handleChange}
                rows={3}
                placeholder="Specific pests observed, chemicals applied, dilution rates, customer access feedback..."
                className="w-full bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 focus:bg-white focus:border-amber-500 focus:outline-hidden transition resize-none"
              />
            </div>
          </div>

        </form>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:text-slate-800 font-semibold text-xs rounded-xl hover:bg-slate-200 transition"
            >
              Cancel
            </button>

            {/* Click button to Enable / Disable sending SMS job link URL on Save */}
            <button
              type="button"
              onClick={() => setAutoSendSms(!autoSendSms)}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer ${
                autoSendSms
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
              }`}
              title="Toggle whether to dispatch SMS with Job link to technician when saving"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>SMS Dispatch: {autoSendSms ? 'ENABLED (Will Send SMS)' : 'DISABLED (No SMS)'}</span>
            </button>
          </div>

          <button
            type="submit"
            form="edit-job-form"
            disabled={loading}
            className="flex items-center gap-1.5 px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md shadow-amber-200 disabled:opacity-50 transition"
          >
            <Check className="w-4 h-4" />
            <span>{loading ? 'Saving Job Changes...' : 'Save Job Details'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
