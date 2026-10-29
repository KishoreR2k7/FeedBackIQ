import { useState, useRef } from 'react';
import { Upload, Sparkles, FileText, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { Organization, ImportJob } from '../types';

interface IngestionPanelProps {
  currentOrg: Organization | null;
  onIngestionComplete: () => void;
}

export const IngestionPanel: React.FC<IngestionPanelProps> = ({
  currentOrg,
  onIngestionComplete,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [syntheticCount, setSyntheticCount] = useState(40);
  const [seedRecurring, setSeedRecurring] = useState(true);
  const [lastJob, setLastJob] = useState<ImportJob | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await api.uploadCSV(file, currentOrg?.id);
      setLastJob(res.import_job);
      setSuccessMessage(
        `Successfully processed "${file.name}": ${res.import_job.successful_records} records imported, ${res.import_job.duplicate_records} duplicates skipped.`
      );
      onIngestionComplete();
    } catch (err: any) {
      setErrorMessage(err.message || 'CSV upload failed');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleGenerateSynthetic = async () => {
    setIsGenerating(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await api.generateSynthetic(syntheticCount, seedRecurring, currentOrg?.id);
      setSuccessMessage(
        `Successfully generated ${res.generated_count} synthetic records with realistic recurring failure clusters.`
      );
      onIngestionComplete();
    } catch (err: any) {
      setErrorMessage(err.message || 'Synthetic data generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-200 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CSV Ingestion Box */}
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">Upload CSV Feedback</h3>
                <p className="text-xs text-slate-400">
                  Supports student complaint forms, mess logs, and Zomato Bangalore Kaggle datasets.
                </p>
              </div>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 border-2 border-dashed border-slate-700/80 hover:border-cyan-500/60 rounded-xl p-8 text-center cursor-pointer bg-slate-950/40 hover:bg-slate-950/60 transition group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <FileText className="w-8 h-8 text-slate-500 group-hover:text-cyan-400 mx-auto mb-2 transition" />
              <p className="text-xs font-semibold text-slate-200">
                {isUploading ? 'Ingesting and parsing CSV...' : 'Click to select CSV file'}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Automatic column normalization • Idempotent duplicate hashing
              </p>
            </div>
          </div>

          {lastJob && (
            <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between font-mono">
              <span>Last Ingest: {lastJob.filename}</span>
              <span className="text-emerald-400 font-semibold">{lastJob.status.toUpperCase()}</span>
            </div>
          )}
        </div>

        {/* Synthetic Generator Box */}
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">Synthetic Scenario Generator</h3>
                <p className="text-xs text-slate-400">
                  Populate realistic canteen feedback with seeded recurring failure patterns.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-4 bg-slate-950/40 border border-slate-800/80 rounded-xl p-4">
              <div>
                <div className="flex justify-between text-xs text-slate-300 font-medium mb-1.5">
                  <span>Record Count:</span>
                  <span className="font-mono text-purple-300 font-bold">{syntheticCount} Records</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="150"
                  step="10"
                  value={syntheticCount}
                  onChange={(e) => setSyntheticCount(Number(e.target.value))}
                  className="w-full accent-purple-500"
                />
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={seedRecurring}
                  onChange={(e) => setSeedRecurring(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 text-purple-600 focus:ring-purple-500"
                />
                <div className="text-xs text-slate-300">
                  <span className="font-semibold text-slate-200">Seed Systemic Failure Clusters</span>
                  <p className="text-[11px] text-slate-400">
                    Seeds recurring cold sambar at lunch, Tuesday salt spikes, Friday raw poultry, and sour paneer.
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="mt-4 pt-3 flex justify-end">
            <button
              onClick={handleGenerateSynthetic}
              disabled={isGenerating}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
              {isGenerating ? 'Generating Synthetic Data...' : 'Generate Canteen Dataset'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
