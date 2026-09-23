import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet, Upload, CheckCircle2, AlertTriangle, ArrowRight,
  RefreshCw, Check, Layers, Users, MapPin, Repeat, Calendar
} from 'lucide-react';
import { getImportSheets, previewImportSheet, executeImportSheet } from '../api';

export default function ExcelImportWizard({ onImportFinished }) {
  const [sheets, setSheets] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState('2026 - SEPTEMBER');
  const [loadingSheets, setLoadingSheets] = useState(true);

  // Preview data
  const [preview, setPreview] = useState(null);
  const [columnMapping, setColumnMapping] = useState({});
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Execution state
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  // Active Wizard Step: 1: Select Sheet, 2: Column Mapping & Duplicates, 3: Completed Result
  const [step, setStep] = useState(1);

  useEffect(() => {
    getImportSheets()
      .then(res => {
        setSheets(res.sheetNames || []);
        if (res.sheetNames?.includes('2026 - SEPTEMBER')) {
          setSelectedSheet('2026 - SEPTEMBER');
        } else if (res.sheetNames?.length > 0) {
          setSelectedSheet(res.sheetNames[0]);
        }
      })
      .catch(console.error)
      .finally(() => setLoadingSheets(false));
  }, []);

  const handleFetchPreview = async () => {
    if (!selectedSheet) return;
    setLoadingPreview(true);
    setImportResult(null);
    try {
      const res = await previewImportSheet(selectedSheet);
      setPreview(res.preview);
      setColumnMapping(res.preview.detectedColumnMapping || {});
      setStep(2);
    } catch (err) {
      alert(`Error loading preview: ${err.message}`);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!selectedSheet) return;
    setImporting(true);
    try {
      const res = await executeImportSheet(selectedSheet, columnMapping);
      setImportResult(res.result);
      setStep(3);
      if (onImportFinished) onImportFinished();
    } catch (err) {
      alert(`Import error: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">

      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
          <span>Excel Master Schedule Import Wizard</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Converts manual Excel operation sheets into the database system with automated column detection and duplicate customer prevention.
        </p>

        {/* Wizard Stepper */}
        <div className="mt-5 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 text-xs font-bold">
          <div className={`p-2.5 rounded-xl border flex items-center gap-2 ${step === 1 ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
            <span className="w-5 h-5 rounded-full bg-white flex items-center justify-center text-xs shadow-2xs">1</span>
            <span>Select Sheet</span>
          </div>

          <div className={`p-2.5 rounded-xl border flex items-center gap-2 ${step === 2 ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
            <span className="w-5 h-5 rounded-full bg-white flex items-center justify-center text-xs shadow-2xs">2</span>
            <span>Column Mapping & Duplicates</span>
          </div>

          <div className={`p-2.5 rounded-xl border flex items-center gap-2 ${step === 3 ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
            <span className="w-5 h-5 rounded-full bg-white flex items-center justify-center text-xs shadow-2xs">3</span>
            <span>Import Results</span>
          </div>
        </div>
      </div>

      {/* STEP 1: SHEET SELECTION */}
      {step === 1 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-6">
          <div>
            <h2 className="font-bold text-slate-900 text-base">Select Month Sheet to Import</h2>
            <p className="text-xs text-slate-500 mt-1">
              The uploaded file contains monthly operation schedules. Select a sheet to auto-detect its column structure:
            </p>
          </div>

          {loadingSheets ? (
            <div className="p-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" /> Reading Excel workbook...
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {sheets.map(sheetName => (
                <div
                  key={sheetName}
                  onClick={() => setSelectedSheet(sheetName)}
                  className={`p-4 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between ${
                    selectedSheet === sheetName
                      ? 'border-emerald-600 bg-emerald-50/50 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <FileSpreadsheet className={`w-5 h-5 ${selectedSheet === sheetName ? 'text-emerald-600' : 'text-slate-400'}`} />
                    {selectedSheet === sheetName && (
                      <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                    )}
                  </div>
                  <div className="font-bold text-slate-900 text-sm mt-3">{sheetName}</div>
                  <span className="text-[11px] text-slate-500 mt-1">Pest operation schedule</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              onClick={handleFetchPreview}
              disabled={loadingPreview || !selectedSheet}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs transition"
            >
              <span>{loadingPreview ? 'Inspecting Columns...' : 'Preview Column Mapping'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: COLUMN MAPPING PREVIEW & DUPLICATE DETECTION */}
      {step === 2 && preview && (
        <div className="space-y-6">

          {/* Duplicate Detection & Structure Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Sheet Name</span>
              <div className="font-black text-slate-900 text-lg mt-0.5">{preview.sheetName}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Year: {preview.detectedYear}, Month: {preview.detectedMonth}</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Total Rows</span>
              <div className="font-black text-slate-900 text-lg mt-0.5">{preview.totalRows}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Identified service entries</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Unique Customers</span>
              <div className="font-black text-slate-900 text-lg mt-0.5">{preview.uniqueCustomersInSheet}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Distinct client entities</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-amber-500 uppercase flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Duplicates Detected
              </span>
              <div className="font-black text-amber-600 text-lg mt-0.5">{preview.duplicatesDetected}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Will be unified (no duplicates)</div>
            </div>
          </div>

          {/* Column Mapping Controls */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="font-bold text-slate-900 text-base">Detected Column Positions</h2>
                <p className="text-xs text-slate-500">Columns automatically matched from row {preview.headerRowIndex + 1}. You can adjust mappings if necessary:</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {Object.keys(columnMapping).map(key => (
                <div key={key} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-700 capitalize">{key}</span>
                  <select
                    value={columnMapping[key]}
                    onChange={(e) => setColumnMapping({ ...columnMapping, [key]: parseInt(e.target.value, 10) })}
                    className="w-full mt-1.5 p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-hidden"
                  >
                    <option value={-1}>-- Not In Sheet --</option>
                    {preview.rawHeaders?.map((h, idx) => (
                      <option key={idx} value={idx}>
                        Col {idx}: {h || `Column ${idx}`}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Sample Rows Preview Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Sample Parsed Data Preview (First 15 Rows)</h3>
              <span className="text-xs text-slate-500">Check duplicate status and field extraction</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="px-3 py-2.5">Row</th>
                    <th className="px-3 py-2.5">Client Name</th>
                    <th className="px-3 py-2.5">Location</th>
                    <th className="px-3 py-2.5">Contact</th>
                    <th className="px-3 py-2.5">Treatment</th>
                    <th className="px-3 py-2.5">Frequency</th>
                    <th className="px-3 py-2.5">Salesman</th>
                    <th className="px-3 py-2.5">Next Date</th>
                    <th className="px-3 py-2.5">Duplicate?</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.sampleRows?.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-mono text-slate-400">{row.rowIndex}</td>
                      <td className="px-3 py-2 font-bold text-slate-900">{row.client}</td>
                      <td className="px-3 py-2 text-slate-600">{row.location || '-'}</td>
                      <td className="px-3 py-2 text-slate-600">{row.contact || '-'}</td>
                      <td className="px-3 py-2 font-bold text-emerald-700">{row.treatment || '-'}</td>
                      <td className="px-3 py-2 text-slate-600">{row.frequency || 'Monthly'}</td>
                      <td className="px-3 py-2 text-slate-600">{row.salesman || '-'}</td>
                      <td className="px-3 py-2 font-mono text-slate-700">{row.nextDate || '-'}</td>
                      <td className="px-3 py-2">
                        {row.isDuplicate ? (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px] font-bold">
                            Matches Existing
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">
                            New Customer
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Back to Sheet Selection
            </button>

            <button
              onClick={handleExecuteImport}
              disabled={importing}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-200 transition"
            >
              <span>{importing ? 'Importing Data Safely...' : 'Execute Transactional Import'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </div>
      )}

      {/* STEP 3: FINAL IMPORT RESULTS */}
      {step === 3 && importResult && (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-2xs space-y-6 text-center max-w-xl mx-auto">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div>
            <h2 className="text-xl font-black text-slate-900">Import Completed Successfully!</h2>
            <p className="text-xs text-slate-500 mt-1">Sheet "{importResult.sheetName}" has been safely processed into the database.</p>
          </div>

          {/* Metrics Card */}
          <div className="grid grid-cols-2 gap-3 text-left">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[10px] uppercase font-bold text-slate-400">New Customers</span>
              <div className="text-xl font-bold text-slate-900 mt-0.5">{importResult.customersCreated}</div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[10px] uppercase font-bold text-slate-400">Matched Existing (No Dups)</span>
              <div className="text-xl font-bold text-emerald-600 mt-0.5">{importResult.customersMatched}</div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[10px] uppercase font-bold text-slate-400">Locations Created</span>
              <div className="text-xl font-bold text-slate-900 mt-0.5">{importResult.locationsCreated}</div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[10px] uppercase font-bold text-slate-400">Jobs Generated</span>
              <div className="text-xl font-bold text-blue-600 mt-0.5">{importResult.jobsCreated}</div>
            </div>
          </div>

          <div className="pt-4 flex justify-center gap-3">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
            >
              Import Another Sheet
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
