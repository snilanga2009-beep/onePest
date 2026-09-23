import React, { useState, useEffect } from 'react';
import {
  Database, Download, RefreshCw, Trash2, RotateCcw,
  CheckCircle2, AlertTriangle, Clock, HardDrive, Calendar,
  ShieldCheck, Sparkles, FileText, Check, X, AlertCircle, ArrowDownToLine, Zap
} from 'lucide-react';
import {
  getDatabaseBackups,
  createDatabaseBackup,
  restoreDatabaseBackup,
  deleteDatabaseBackup,
  getBackupDownloadUrl,
  getLiveDatabaseDownloadUrl
} from '../api';

export default function BackupDatabaseView() {
  const [stats, setStats] = useState(null);
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [restoreModalBackup, setRestoreModalBackup] = useState(null);
  const [restoring, setRestoring] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getDatabaseBackups();
      if (res.success) {
        setStats(res.stats);
        setBackups(res.backups || []);
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load database backups.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateInstantBackup = async (type = 'MANUAL_INSTANT') => {
    setCreating(true);
    setFeedback(null);
    try {
      const res = await createDatabaseBackup({
        type,
        notes: type === 'MONTHLY_AUTO' ? 'Manual trigger of monthly archive' : 'User-initiated on-demand snapshot'
      });
      if (res.success) {
        setFeedback({
          type: 'success',
          message: `Backup snapshot created successfully: ${res.backup?.filename} (${res.backup?.size_formatted})`
        });
        await loadData();
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Error creating database backup' });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id, filename) => {
    if (!window.confirm(`Are you sure you want to permanently delete backup "${filename}"?`)) {
      return;
    }
    try {
      const res = await deleteDatabaseBackup(id);
      if (res.success) {
        setFeedback({ type: 'success', message: `Backup "${filename}" deleted successfully.` });
        await loadData();
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to delete backup.' });
    }
  };

  const handleConfirmRestore = async () => {
    if (!restoreModalBackup) return;
    setRestoring(true);
    try {
      const res = await restoreDatabaseBackup(restoreModalBackup.id);
      if (res.success) {
        alert(res.message || 'Database restored successfully!');
        setRestoreModalBackup(null);
        await loadData();
      }
    } catch (err) {
      alert(`Error during restore: ${err.message}`);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="space-y-6 pb-16 font-sans">
      
      {/* Top Banner / Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-emerald-950 text-white p-6 rounded-3xl border border-indigo-900/40 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-black text-slate-950 shadow-lg shadow-emerald-950/50 shrink-0">
            <Database className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight">Database Backup & Monthly Archives</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                Automated Monthly Active ✓
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
              Automatic zero-downtime database backups run on the 1st of every month. Create instant snapshots anytime, or download the live SQLite database file.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            title="Refresh backups list"
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>

          <a
            href={getLiveDatabaseDownloadUrl()}
            download
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs border border-white/20 transition cursor-pointer shadow-xs"
            title="Directly download current active database file"
          >
            <ArrowDownToLine className="w-4 h-4 text-emerald-400" />
            <span>Download Live .db</span>
          </a>

          <button
            type="button"
            onClick={() => handleCreateInstantBackup('MANUAL_INSTANT')}
            disabled={creating}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs shadow-md shadow-emerald-950/40 active:scale-95 transition cursor-pointer disabled:opacity-60"
          >
            <Zap className={`w-4 h-4 ${creating ? 'animate-bounce' : ''}`} />
            <span>{creating ? 'Creating Snapshot...' : 'Create Instant Backup Now'}</span>
          </button>
        </div>
      </div>

      {/* Feedback Message */}
      {feedback && (
        <div className={`p-4 rounded-2xl border text-xs flex items-center justify-between animate-in fade-in ${
          feedback.type === 'success'
            ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
            : 'bg-rose-50 text-rose-900 border-rose-200'
        }`}>
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
            <span className="font-semibold">{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Live Database</span>
            <HardDrive className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {stats?.live_database_size || '0 Bytes'}
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>SQLite 3 &bull; WAL Engine Active</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Saved Backups</span>
            <Database className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {stats?.total_backups_count || 0} <span className="text-xs font-semibold text-slate-400">Files</span>
          </div>
          <div className="text-[11px] text-slate-500">
            Storage used: <strong>{stats?.total_storage_used || '0 Bytes'}</strong>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Monthly Auto-Backup</span>
            <Calendar className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {stats?.monthly_backups_count || 0} <span className="text-xs font-semibold text-slate-400">Months Saved</span>
          </div>
          <div className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            <span>{stats?.current_month} Status: {stats?.current_month_backup_status === 'COMPLETED' ? 'Completed ✓' : 'Pending'}</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Next Auto Schedule</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-sm font-black text-slate-900 mt-1">
            {stats?.next_scheduled_monthly_date || '1st of next month'}
          </div>
          <div className="text-[11px] text-slate-500">
            Repeats on the 1st of every month automatically
          </div>
        </div>
      </div>

      {/* Automated Monthly Schedule Details Banner */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-indigo-50 via-blue-50 to-emerald-50 rounded-3xl border border-indigo-100 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-extrabold text-slate-900 text-sm">Automated Monthly Backup Policy</h4>
            <p className="text-slate-600 text-xs mt-0.5 max-w-2xl">
              The system automatically captures an atomic snapshot of the entire database on the 1st of every month at midnight (Asia/Colombo). Each monthly archive is saved with month stamp (<code className="bg-white/80 px-1 py-0.5 rounded text-indigo-700 font-bold font-mono">monthly-backup-YYYY-MM.db</code>) and preserved indefinitely.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleCreateInstantBackup('MONTHLY_AUTO')}
          disabled={creating}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs shrink-0 transition cursor-pointer"
        >
          Force Monthly Backup
        </button>
      </div>

      {/* Backups List Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-extrabold text-slate-900 text-base">Monthly & Historical Backup Snapshots</h3>
            <p className="text-xs text-slate-500">All database files stored on disk in <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-mono text-[11px]">server/data/backups/</code></p>
          </div>
          <span className="text-xs text-slate-400 font-medium">
            Showing {backups.length} snapshot(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 font-black uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">Filename</th>
                <th className="px-4 py-3.5">Backup Type</th>
                <th className="px-4 py-3.5">Created Date & Time</th>
                <th className="px-4 py-3.5">File Size</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {backups.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    <Database className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold">No backups recorded yet.</p>
                    <p className="text-xs mt-1">Tap "Create Instant Backup Now" above to generate your first snapshot.</p>
                  </td>
                </tr>
              ) : (
                backups.map(b => (
                  <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Filename & Notes */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                        <div>
                          <div className="font-bold text-slate-900 font-mono text-[11px]">{b.filename}</div>
                          <div className="text-[10px] text-slate-400">{b.notes || 'Full database snapshot'}</div>
                        </div>
                      </div>
                    </td>

                    {/* Backup Type */}
                    <td className="px-4 py-3.5">
                      {b.backup_type === 'MONTHLY_AUTO' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide bg-indigo-100 text-indigo-800 border border-indigo-200">
                          <Calendar className="w-3 h-3 text-indigo-600" />
                          <span>Monthly Archive ({b.month_key || 'Auto'})</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <Zap className="w-3 h-3 text-emerald-600" />
                          <span>Instant Snapshot</span>
                        </span>
                      )}
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3.5 text-slate-600 font-medium">
                      {b.created_at}
                    </td>

                    {/* Size */}
                    <td className="px-4 py-3.5 font-mono font-bold text-slate-800">
                      {b.size_formatted}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Ready</span>
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Download */}
                        <a
                          href={getBackupDownloadUrl(b.id)}
                          download={b.filename}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 font-bold rounded-lg border border-slate-200 hover:border-emerald-300 transition flex items-center gap-1"
                          title="Download .db file to your computer"
                        >
                          <Download className="w-3 h-3 text-emerald-600" />
                          <span>Download</span>
                        </a>

                        {/* Restore */}
                        <button
                          type="button"
                          onClick={() => setRestoreModalBackup(b)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-800 font-bold rounded-lg border border-slate-200 hover:border-amber-300 transition flex items-center gap-1 cursor-pointer"
                          title="Restore database from this snapshot"
                        >
                          <RotateCcw className="w-3 h-3 text-amber-600" />
                          <span>Restore</span>
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => handleDelete(b.id, b.filename)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Delete backup file"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Restore Confirmation Modal */}
      {restoreModalBackup && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-rose-600">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-extrabold text-slate-900 text-sm">Confirm Database Restore</h3>
              </div>
              <button onClick={() => setRestoreModalBackup(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <p>
                Are you sure you want to restore the system database from:
              </p>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono text-xs font-bold text-slate-800">
                {restoreModalBackup.filename} ({restoreModalBackup.size_formatted})
              </div>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                <strong>Safety Notice:</strong> An emergency snapshot of your current database will be automatically created before restoring. All active jobs, users, and customers will be reverted to this backup's point in time.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRestoreModalBackup(null)}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                disabled={restoring}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md shadow-rose-200 disabled:opacity-50 transition cursor-pointer"
              >
                {restoring ? 'Restoring Database...' : 'Yes, Restore Database'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
