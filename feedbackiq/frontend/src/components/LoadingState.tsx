import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
  subtext?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading system components...',
  subtext = 'Connecting to FeedbackIQ services and fetching latest data',
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
      <div className="relative mb-4">
        <div className="w-12 h-12 rounded-full border-2 border-emerald-500/20 animate-ping absolute inset-0"></div>
        <Loader2 className="w-12 h-12 text-emerald-400 animate-spin" />
      </div>
      <h3 className="text-base font-semibold text-slate-100">{message}</h3>
      <p className="text-xs text-slate-400 mt-1 max-w-sm">{subtext}</p>
    </div>
  );
};
