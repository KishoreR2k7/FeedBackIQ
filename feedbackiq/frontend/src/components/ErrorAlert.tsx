import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorAlertProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  isRetrying?: boolean;
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({
  title = 'Service Connection Issue',
  message,
  onRetry,
  isRetrying = false,
}) => {
  return (
    <div className="rounded-xl bg-red-950/30 border border-red-800/40 p-4 text-red-200">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="text-sm font-medium text-red-300">{title}</h4>
          <p className="text-xs text-red-200/80 mt-1">{message}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              disabled={isRetrying}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-900/40 hover:bg-red-800/40 border border-red-700/50 text-red-200 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
              {isRetrying ? 'Retrying Connection...' : 'Retry Connection'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
