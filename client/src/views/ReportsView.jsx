import React, { useState, useEffect } from 'react';
import {
  BarChart3, FileSpreadsheet, Download, Printer, Filter,
  Calendar, User, CheckCircle2, AlertTriangle, Clock
} from 'lucide-react';
import { getReport, getStaff } from '../api';

export default function ReportsView() {
  const [reportType, setReportType] = useState('daily');
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().substring(0, 10));
  const [selectedTechId, setSelectedTechId] = useState('');
  const [staff, setStaff] = useState([]);

  const reportTabs = [
    { id: 'daily', label: 'Daily Job Report' },
    { id: 'weekly', label: 'Weekly Job Report' },
    { id: 'monthly', label: 'Monthly Job Report' },
    { id: 'technician', label: 'Technician Report' },
    { id: 'customer_history', label: 'Customer History' },
    { id: 'treatment', label: 'Treatment Report' },
    { id: 'pending', label: 'Pending Jobs' },
    { id: 'overdue', label: 'Overdue Jobs' },
    { id: 'postponed', label: 'Postponed Jobs' }
  ];

  useEffect(() => {
    getStaff({ role: 'TECHNICIAN' }).then(r => setStaff(r.staff || []));
  }, []);

  const loadReport = async () => {
    setLoading(true);
    try {
      const res = await getReport(reportType, {
        date: selectedDate,
        technician_id: selectedTechId || undefined
      });
      setReportData(res.rows || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [reportType, selectedDate, selectedTechId]);

  const handleExportCsv = () => {
    const url = `/api/reports/${reportType}/export/csv?date=${selectedDate}&technician_id=${selectedTechId}`;
    window.open(url, '_blank');
  };

  const handleExportExcel = () => {
    const url = `/api/reports/${reportType}/export/excel?date=${selectedDate}&technician_id=${selectedTechId}`;
    window.open(url, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12">

      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-emerald-600" />
            <span>Operations Reporting & Export Engine</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Audit-ready operational summaries, technician performances, and multi-format exports.
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl shadow-xs transition"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition"
          >
            <Printer className="w-4 h-4" />
            <span>Print PDF</span>
          </button>
        </div>
      </div>

      {/* Report Tabs Bar */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap gap-1 text-xs no-print">
        {reportTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setReportType(tab.id)}
            className={`px-3 py-2 rounded-xl font-bold transition ${
              reportType === tab.id
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter Parameters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs no-print">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium"
            />
          </div>

          {reportType === 'technician' && (
            <div className="flex items-center gap-1.5">
              <User className="w-4 h-4 text-slate-400" />
              <select
                value={selectedTechId}
                onChange={(e) => setSelectedTechId(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium"
              >
                <option value="">All Technicians</option>
                {staff.map(s => (
                  <option key={s.id} value={s.id}>{s.full_name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="font-semibold text-slate-500">
          Total Records: <strong className="text-slate-900">{reportData.length}</strong>
        </div>
      </div>

      {/* Printable Report Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
          <div>
            <h2 className="font-black text-lg text-slate-900 uppercase">
              {reportTabs.find(t => t.id === reportType)?.label || 'Operations Report'}
            </h2>
            <div className="text-xs text-slate-500 mt-0.5">
              Target Date: {selectedDate} | Timezone: Asia/Colombo
            </div>
          </div>
          <div className="text-right text-xs font-bold text-emerald-700">
            PestControl Pro Operational Document
          </div>
        </div>

        {/* Report Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-y border-slate-200">
              <tr>
                <th className="px-3 py-2.5">Job Code</th>
                <th className="px-3 py-2.5">Date & Time</th>
                <th className="px-3 py-2.5">Customer Name</th>
                <th className="px-3 py-2.5">Location</th>
                <th className="px-3 py-2.5">Treatment</th>
                <th className="px-3 py-2.5">Technician</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reportData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    No records found for the selected report filters.
                  </td>
                </tr>
              ) : (
                reportData.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-mono font-bold text-slate-900">{r.job_code}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div>{r.scheduled_date}</div>
                      <div className="text-[10px] text-slate-400">{r.scheduled_time || '09:00'}</div>
                    </td>
                    <td className="px-3 py-2.5 font-bold text-slate-800">{r.customer_name}</td>
                    <td className="px-3 py-2.5 text-slate-600">{r.location_name || '-'}</td>
                    <td className="px-3 py-2.5 font-bold text-emerald-700">{r.treatment_code}</td>
                    <td className="px-3 py-2.5 text-slate-700">{r.technician_name || 'Unassigned'}</td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        r.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                        r.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-800' :
                        r.status === 'POSTPONED' ? 'bg-indigo-100 text-indigo-800' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 max-w-xs truncate">{r.technician_notes || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
