import React, { useState, useEffect } from 'react';
import {
  Database,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  RefreshCw,
  Clock,
  ShieldCheck,
  Table,
  Sparkles,
  AlertCircle,
  XCircle,
} from 'lucide-react';
import { api } from '../services/api';
import { DatasetStats, ImportJob } from '../types';

interface DatasetManagementViewProps {
  orgId?: string;
  onRefreshData?: () => void;
}

export const DatasetManagementView: React.FC<DatasetManagementViewProps> = ({
  orgId,
  onRefreshData,
}) => {
  const [stats, setStats] = useState<DatasetStats | null>(null);
  const [importJobs, setImportJobs] = useState<ImportJob[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState<string | null>(null);
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string | null>(null);
  const [isGeneratingSynthetic, setIsGeneratingSynthetic] = useState(false);
  const [syntheticSuccess, setSyntheticSuccess] = useState<string | null>(null);
  const [inspectJob, setInspectJob] = useState<ImportJob | null>(null);

  const loadDatasetData = async () => {
    if (!orgId) return;
    setIsLoading(true);
    try {
      const [statsData, jobsData] = await Promise.all([
        api.getDatasetStats(orgId).catch(() => null),
        api.getImportJobs(20, orgId).catch(() => []),
      ]);
      setStats(statsData);
      setImportJobs(jobsData);
    } catch (err) {
      console.error('Failed to load dataset management data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDatasetData();
  }, [orgId]);

  // Handle CSV file selection and client-side preview parsing
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setUploadErrorMessage('Only standard .csv files are supported.');
      return;
    }

    setSelectedFile(file);
    setUploadErrorMessage(null);
    setUploadSuccessMessage(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r\n|\n/).filter((l) => l.trim().length > 0);
      if (lines.length > 0) {
        const headers = lines[0].split(',').map((h) => h.replace(/^["']|["']$/g, '').trim());
        setFileHeaders(headers);

        const rows: Record<string, string>[] = [];
        for (let i = 1; i < Math.min(6, lines.length); i++) {
          const values = lines[i].split(',').map((v) => v.replace(/^["']|["']$/g, '').trim());
          const rowObj: Record<string, string> = {};
          headers.forEach((h, idx) => {
            rowObj[h] = values[idx] || '';
          });
          rows.push(rowObj);
        }
        setPreviewRows(rows);
      }
    };
    reader.readAsText(file);
  };

  const handleUploadSubmit = async () => {
    if (!selectedFile || !orgId) return;

    setIsUploading(true);
    setUploadSuccessMessage(null);
    setUploadErrorMessage(null);

    try {
      const res = await api.uploadCSV(selectedFile, orgId);
      setUploadSuccessMessage(res.message || 'Dataset ingested and verified successfully.');
      setSelectedFile(null);
      setFileHeaders([]);
      setPreviewRows([]);
      loadDatasetData();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      setUploadErrorMessage(err.message || 'Failed to ingest CSV dataset.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleGenerateSynthetic = async () => {
    if (!orgId) return;
    setIsGeneratingSynthetic(true);
    setSyntheticSuccess(null);
    try {
      const res = await api.generateSynthetic(50, true, orgId);
      setSyntheticSuccess(
        `Generated ${res.generated_count} synthetic student canteen records with recurring scenarios.`
      );
      loadDatasetData();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      setUploadErrorMessage(err.message || 'Failed to generate synthetic dataset.');
    } finally {
      setIsGeneratingSynthetic(false);
    }
  };

  // Canonical schema fields mapping detection
  const isZomatoDataset =
    fileHeaders.some((h) => h.toLowerCase() === 'rate') &&
    fileHeaders.some((h) => ['reviews_list', 'dish_liked', 'cuisines'].includes(h.toLowerCase()));

  const canonicalFields = [
    'feedback_id',
    'date',
    'meal_type',
    'item',
    'rating',
    'comment',
    'channel',
    'issue_category',
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-bold text-slate-900">Data &amp; Dataset Management</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              Multi-Dataset Ingestion
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Import CSV files, preview column mappings, audit deduplication, and enforce data segregation between student feedback and external reviews.
          </p>
        </div>

        <button
          onClick={loadDatasetData}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          <span>Refresh Datasets</span>
        </button>
      </div>

      {/* Dataset Segregation KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Student Canteen Feedback */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider">
            <span>Student Canteen</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {stats ? stats.student_canteen_count : '--'}
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            Raw student portal submissions &amp; manual complaint logs.
          </p>
        </div>

        {/* Synthetic Demonstration */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider">
            <span>Synthetic Demo</span>
            <span className="w-2 h-2 rounded-full bg-blue-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {stats ? stats.synthetic_count : '--'}
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            Seeded systemic failure scenarios for intelligence testing.
          </p>
        </div>

        {/* Zomato Bangalore Dataset */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider">
            <span>Kaggle Zomato</span>
            <span className="w-2 h-2 rounded-full bg-purple-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {stats ? stats.zomato_count : '--'}
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            External restaurant reviews strictly segregated from canteen stats.
          </p>
        </div>

        {/* Total Ingested Records */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider">
            <span>Total Ingested</span>
            <Database className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {stats ? stats.total_feedback : '--'}
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            Deduplicated records indexed with SHA-256 idempotency.
          </p>
        </div>
      </div>

      {/* Segregation Rule Notice */}
      <div className="p-4 rounded-xl bg-blue-50/80 border border-blue-200 flex items-start gap-3 text-xs text-blue-900">
        <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-bold text-blue-950">Architectural Data Segregation Enforced</div>
          <p className="text-blue-800 leading-relaxed font-normal">
            To satisfy quality audit requirements, external Kaggle Zomato restaurant reviews are partitioned under{' '}
            <code className="font-mono px-1 py-0.5 rounded bg-blue-100 text-blue-900 font-bold text-[11px]">
              source_dataset = 'zomato_bangalore'
            </code>{' '}
            and are strictly excluded from campus student satisfaction scoring and canteen staff CAPA task generation.
          </p>
        </div>
      </div>

      {/* CSV Ingestion & Preview Wizard */}
      <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Upload className="w-4 h-4 text-blue-600" />
              Upload &amp; Import CSV Dataset
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Supports standard canteen feedback schema (<code>feedback_id, date, meal_type, item, rating, comment, channel, issue_category</code>) and Zomato Bangalore Kaggle format.
            </p>
          </div>

          <button
            onClick={handleGenerateSynthetic}
            disabled={isGeneratingSynthetic}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 disabled:opacity-50 transition"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isGeneratingSynthetic ? 'animate-spin' : ''}`} />
            <span>{isGeneratingSynthetic ? 'Seeding...' : 'Seed Synthetic Demo'}</span>
          </button>
        </div>

        {syntheticSuccess && (
          <div className="p-3 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{syntheticSuccess}</span>
          </div>
        )}

        {uploadSuccessMessage && (
          <div className="p-3 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{uploadSuccessMessage}</span>
          </div>
        )}

        {uploadErrorMessage && (
          <div className="p-3 rounded-lg text-xs font-medium bg-red-50 text-red-800 border border-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{uploadErrorMessage}</span>
          </div>
        )}

        {/* File Dropzone */}
        <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-xl p-6 text-center transition bg-slate-50/50">
          <FileSpreadsheet className="w-8 h-8 text-blue-600 mx-auto mb-2" />
          <p className="text-xs font-bold text-slate-800">Choose a CSV file to inspect &amp; ingest</p>
          <p className="text-[11px] text-slate-500 mt-1">
            Accepts UTF-8 encoded .csv files up to 25MB with automatic column detection and deduplication.
          </p>
          <label className="mt-3 inline-block cursor-pointer px-4 py-2 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition shadow-2xs">
            <span>Browse CSV File</span>
            <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
          </label>
          {selectedFile && (
            <div className="mt-2 text-xs font-mono font-bold text-slate-700">
              Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
            </div>
          )}
        </div>

        {/* Dataset Preview & Column Mapping (when file selected) */}
        {selectedFile && fileHeaders.length > 0 && (
          <div className="space-y-4 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <Table className="w-4 h-4 text-slate-600" />
                  Dataset Preview &amp; Schema Validation
                </h4>
                <p className="text-[11px] text-slate-500">
                  Detected {fileHeaders.length} columns. Schema identified as:{' '}
                  <strong className="text-blue-700">
                    {isZomatoDataset ? 'Kaggle Zomato Bangalore Dataset' : 'Standard Canteen Feedback Schema'}
                  </strong>
                </p>
              </div>

              <button
                onClick={handleUploadSubmit}
                disabled={isUploading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition shadow-2xs"
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing Ingestion...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirm &amp; Ingest Dataset</span>
                  </>
                )}
              </button>
            </div>

            {/* Column Mapping Badges */}
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-[11px] font-bold text-slate-600 uppercase mb-2">
                Automatic Column Mapping Verification
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {fileHeaders.map((header) => {
                  const lower = header.toLowerCase();
                  const isMapped =
                    canonicalFields.includes(lower) ||
                    ['dish', 'dish_liked', 'review', 'reviews_list', 'rate'].includes(lower);

                  return (
                    <div
                      key={header}
                      className={`px-2 py-1 rounded-md border text-[11px] font-mono flex items-center gap-1.5 ${
                        isMapped
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      <span className="font-semibold">{header}</span>
                      <span className="text-[10px] text-slate-400">→</span>
                      <span className="text-blue-700 font-bold">{isMapped ? 'Mapped' : 'Ignored'}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Preview Table */}
            <div className="border border-slate-200 rounded-lg overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    {fileHeaders.map((h) => (
                      <th key={h} className="px-3 py-2 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {previewRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80">
                      {fileHeaders.map((h) => (
                        <td key={h} className="px-3 py-2 max-w-xs truncate" title={row[h]}>
                          {row[h] || <span className="text-slate-300">null</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Ingestion & Import History Table */}
      <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              Batch Ingestion &amp; Import History
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Audit log of previous file uploads, deduplication metrics, and error rates.
            </p>
          </div>
          <span className="text-xs font-mono font-semibold text-slate-500">
            {importJobs.length} Jobs Logged
          </span>
        </div>

        {importJobs.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No historical import jobs found for this organization.
          </div>
        ) : (
          <div className="border border-slate-200 rounded-lg overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-2.5">Date &amp; Time</th>
                  <th className="px-4 py-2.5">Filename</th>
                  <th className="px-4 py-2.5">Total Rows</th>
                  <th className="px-4 py-2.5">Imported</th>
                  <th className="px-4 py-2.5">Duplicates Filtered</th>
                  <th className="px-4 py-2.5">Failed</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {importJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2.5 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                      {new Date(job.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 font-bold text-slate-900 whitespace-nowrap">
                      {job.filename}
                    </td>
                    <td className="px-4 py-2.5 font-mono">{job.total_records}</td>
                    <td className="px-4 py-2.5 text-emerald-700 font-semibold font-mono">
                      {job.successful_records}
                    </td>
                    <td className="px-4 py-2.5 text-amber-700 font-mono">
                      {job.duplicate_records}
                    </td>
                    <td className="px-4 py-2.5 text-red-600 font-mono">{job.failed_records}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize border ${
                          job.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : job.status === 'processing'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      {job.errors && job.errors.length > 0 ? (
                        <button
                          onClick={() => setInspectJob(job)}
                          className="text-xs text-red-600 hover:text-red-800 font-semibold underline"
                        >
                          View Errors ({job.errors.length})
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400">Clean</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Error Details Modal */}
      {inspectJob && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white border border-slate-200 p-6 shadow-xl relative max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>Import Job Error Details</span>
              </div>
              <button
                onClick={() => setInspectJob(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-3 space-y-2 text-xs">
              <p className="text-slate-600 font-medium">
                Errors encountered during CSV row parsing in <code>{inspectJob.filename}</code>:
              </p>
              {inspectJob.errors.map((err, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-900 font-mono text-[11px]"
                >
                  <strong>Row {err.row}:</strong> {err.error}
                </div>
              ))}
            </div>
            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setInspectJob(null)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
