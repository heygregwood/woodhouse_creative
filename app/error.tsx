'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[error-boundary] Unhandled error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-page flex items-center justify-center p-8">
      <div className="bg-white border border-red-400 rounded-lg shadow-sm max-w-lg w-full p-8 text-center">
        <h2 className="text-2xl font-bold text-text mb-2">Something went wrong</h2>
        <p className="text-gray-600 mb-6">
          {error.message || 'An unexpected error occurred.'}
        </p>
        <button
          onClick={reset}
          className="px-6 py-3 bg-brand text-white rounded-lg hover:bg-brand-dark font-medium transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
