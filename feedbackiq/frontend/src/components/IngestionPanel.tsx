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
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5 shadow-2xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2.5 shadow-2xs">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CSV Ingestion Box */}
        <div className="rounded-2xl bg-white border border-slate-200 p-6 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Upload CSV Feedback</h3>
                <p className="text-xs text-slate-500">
                  Native mapping for Zomato Bangalore Kaggle datasets &amp; canteen feedback forms.
                </p>
              </div>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 border-2 border-dashed border-slate-200 hover:border-blue-500 rounded-xl p-8 text-center cursor-pointer bg-slate-50/70 hover:bg-blue-50/30 transition-all group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <FileText className="w-8 h-8 text-slate-400 group-hover:text-blue-600 mx-auto mb-2 transition-colors" />
              <p className="text-xs font-semibold text-slate-800 group-hover:text-blue-700">
                {isUploading ? 'Ingesting and parsing CSV...' : 'Click to select CSV file'}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Kaggle mapping: <code className="bg-white px-1 py-0.5 rounded border border-slate-200 font-mono">name</code> → item, <code className="bg-white px-1 py-0.5 rounded border border-slate-200 font-mono">rate</code> → rating, <code className="bg-white px-1 py-0.5 rounded border border-slate-200 font-mono">reviews_list</code> → comment
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-mono">Dataset: Zomato Kaggle / Canteen Form</span>
            {lastJob ? (
              <span className="text-blue-600 font-mono font-bold">{lastJob.status.toUpperCase()}</span>
            ) : (
              <span className="text-slate-400 font-mono">Ready for CSV</span>
            )}
          </div>
        </div>

        {/* Synthetic Generator Box */}
        <div className="rounded-2xl bg-white border border-slate-200 p-6 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Synthetic Scenario Generator</h3>
                <p className="text-xs text-slate-500">
                  Seeds realistic recurrence clusters across 8 canonical canteen feedback fields.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-4 bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div>
                <div className="flex justify-between text-xs text-slate-700 font-medium mb-1.5">
                  <span>Record Volume:</span>
                  <span className="font-mono text-blue-600 font-bold">{syntheticCount} Records</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="150"
                  step="10"
                  value={syntheticCount}
                  onChange={(e) => setSyntheticCount(Number(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={seedRecurring}
                  onChange={(e) => setSeedRecurring(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <div className="text-xs text-slate-700">
                  <span className="font-semibold text-slate-900">Seed Systemic Failure Scenarios</span>
                  <p className="text-[11px] text-slate-500">
                    Fields: <code className="bg-white px-1 py-0.5 rounded border border-slate-200 font-mono">feedback_id, date, meal_type, item, rating, comment, channel, issue_category</code>
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="mt-4 pt-3 flex justify-end">
            <button
              onClick={handleGenerateSynthetic}
              disabled={isGenerating}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-all shadow-md shadow-blue-500/20"
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
