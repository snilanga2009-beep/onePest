import React, { useState, useEffect } from 'react';
import {
  Calendar, Clock, MapPin, CheckCircle2, AlertCircle, AlertTriangle,
  Shield, Check, ArrowRight, X, Phone
} from 'lucide-react';
import { getCustomerAppointment, confirmAppointment, requestReschedule } from '../api';

export default function CustomerConfirmationPortal({ jobCode: propJobCode, onBack }) {
  const [jobCode, setJobCode] = useState(propJobCode || '');
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // Reschedule Form
  const [showRescheduleForm, setShowRescheduleForm] = useState(false);
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchAppointment = async (code) => {
    if (!code) return;
    setLoading(true);
    setStatusMessage(null);
    try {
      const res = await getCustomerAppointment(code);
      setAppointment(res.appointment);
    } catch (e) {
      setStatusMessage({ type: 'error', text: `Appointment not found for code: ${code}` });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let code = propJobCode;
    if (!code && typeof window !== 'undefined' && window.location.pathname.includes('/confirmations/')) {
      code = window.location.pathname.split('/confirmations/')[1]?.split('/')[0]?.split('?')[0];
    }
    if (code) {
      setJobCode(code);
      fetchAppointment(code);
    }
  }, [propJobCode]);

  const handleConfirm = async () => {
    if (!appointment) return;
    setSubmitting(true);
    try {
      await confirmAppointment(appointment.job_code);
      setStatusMessage({ type: 'success', text: 'Thank you! Your appointment has been confirmed.' });
      fetchAppointment(appointment.job_code);
    } catch (e) {
      setStatusMessage({ type: 'error', text: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRescheduleSubmit = async (e) => {
    e.preventDefault();
    if (!appointment) return;
    setSubmitting(true);
    try {
      await requestReschedule(appointment.job_code, {
        preferred_date: preferredDate,
        preferred_time: preferredTime,
        reason: rescheduleReason
      });
      setStatusMessage({ type: 'success', text: 'Reschedule request submitted. Our team will contact you to confirm the new time!' });
      setShowRescheduleForm(false);
      fetchAppointment(appointment.job_code);
    } catch (e) {
      setStatusMessage({ type: 'error', text: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto p-4 sm:p-6 space-y-6">

      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white font-black text-xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-200">
          PC
        </div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          Pest Control Service Confirmation
        </h1>
        <p className="text-xs text-slate-500">
          Verify your upcoming pest control appointment or request an alternate service time.
        </p>
      </div>

      {/* Code Input if not provided */}
      {!propJobCode && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex gap-2">
          <input
            type="text"
            value={jobCode}
            onChange={(e) => setJobCode(e.target.value)}
            placeholder="Enter Job Code (e.g. JOB-20260913-0084)..."
            className="flex-1 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-mono font-bold focus:outline-hidden"
          />
          <button
            onClick={() => fetchAppointment(jobCode)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs"
          >
            Find
          </button>
        </div>
      )}

      {/* Status Message */}
      {statusMessage && (
        <div className={`p-4 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
          statusMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Appointment Card */}
      {appointment && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                {appointment.job_code}
              </span>
              <h2 className="text-lg font-black text-slate-900 mt-1">{appointment.customer_name}</h2>
            </div>

            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
              appointment.customer_confirmation_status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-800' :
              appointment.customer_confirmation_status === 'RESCHEDULE_REQUESTED' ? 'bg-amber-100 text-amber-800' :
              'bg-slate-100 text-slate-700'
            }`}>
              {appointment.customer_confirmation_status || 'UNCONFIRMED'}
            </span>
          </div>

          {/* Details */}
          <div className="space-y-3 text-xs">
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
              <Calendar className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <div className="font-bold text-slate-900 text-sm">{appointment.scheduled_date}</div>
                <div className="text-slate-500 text-[11px]">Scheduled Time: {appointment.scheduled_time || '09:00'} ({appointment.duration_minutes || 60} mins)</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
              <MapPin className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <div className="font-bold text-slate-900">{appointment.location_name || 'Primary Site'}</div>
                <div className="text-slate-500 text-[11px]">{appointment.location_address || 'Customer Premises'}</div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Treatment Plan</span>
              <div className="font-bold text-emerald-700 text-sm">{appointment.treatment_name || appointment.treatment_code}</div>
              {appointment.treatment_description && (
                <p className="text-[11px] text-slate-500">{appointment.treatment_description}</p>
              )}
            </div>

            {appointment.technician_name && (
              <div className="text-[11px] text-slate-600 px-1">
                Assigned Specialist: <strong className="text-slate-900">{appointment.technician_name}</strong>
              </div>
            )}
          </div>

          {/* Customer Action Buttons */}
          <div className="pt-2 space-y-2">
            {appointment.customer_confirmation_status !== 'CONFIRMED' ? (
              <button
                onClick={handleConfirm}
                disabled={submitting}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs shadow-md shadow-emerald-200 flex items-center justify-center gap-2 transition"
              >
                <Check className="w-4 h-4" />
                <span>CONFIRM APPOINTMENT</span>
              </button>
            ) : (
              <div className="p-3 bg-emerald-50 text-emerald-800 text-center font-bold rounded-xl text-xs">
                ✓ YOU HAVE CONFIRMED THIS APPOINTMENT
              </div>
            )}

            {!showRescheduleForm ? (
              <button
                onClick={() => setShowRescheduleForm(true)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
              >
                REQUEST RESCHEDULE
              </button>
            ) : (
              <form onSubmit={handleRescheduleSubmit} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 text-xs mt-3">
                <div className="font-bold text-slate-900">Preferred New Date & Time</div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    required
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                    className="p-2 bg-white rounded-lg border border-slate-200"
                  />
                  <input
                    type="time"
                    value={preferredTime}
                    onChange={(e) => setPreferredTime(e.target.value)}
                    className="p-2 bg-white rounded-lg border border-slate-200"
                  />
                </div>
                <textarea
                  rows={2}
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  placeholder="Notes or reason for reschedule..."
                  className="w-full p-2 bg-white rounded-lg border border-slate-200"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowRescheduleForm(false)}
                    className="w-1/3 py-2 bg-slate-200 text-slate-700 font-bold rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-2/3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-xs"
                  >
                    Submit Request
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {onBack && (
        <div className="text-center pt-2">
          <button onClick={onBack} className="text-xs text-slate-500 hover:text-slate-900 underline">
            Return to Dashboard
          </button>
        </div>
      )}

    </div>
  );
}
