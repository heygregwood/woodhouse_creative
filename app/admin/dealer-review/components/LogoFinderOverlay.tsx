'use client';

export interface LogoOption {
  url: string;
  width: number;
  height: number;
  format: string;
  source: string;
}

export interface LogoOverlayState {
  dealerNo: string;
  dealerName: string;
  website: string;
  loading: boolean;
  logos: LogoOption[];
  error: string | null;
  saving: boolean;
  savedToStaging: string | null;
  source: 'pending' | 'existing';
}

interface LogoFinderOverlayProps {
  state: LogoOverlayState;
  onClose: () => void;
  onSelectLogo: (logo: LogoOption) => void;
  onSavePermanently: () => void;
  onDownloadAnother: () => void;
}

const LOGOS_FOLDER_URL = 'https://drive.google.com/drive/folders/17TNIFS-5Nnrn3b-_knPPm5u-f1X_UUbR?usp=sharing';

export default function LogoFinderOverlay({
  state,
  onClose,
  onSelectLogo,
  onSavePermanently,
  onDownloadAnother,
}: LogoFinderOverlayProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-brand text-white px-6 py-4 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold">Find Logo</h3>
            <p className="text-white/80 text-sm">{state.dealerName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white text-2xl font-bold"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {state.loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand mx-auto"></div>
              <p className="mt-4 text-gray-600">Searching {state.website} for logos...</p>
            </div>
          ) : state.error ? (
            <div className="text-center py-12">
              <p className="text-red-600 mb-4">{state.error}</p>
              <p className="text-gray-500 text-sm mb-4">
                You can manually find the logo and paste the URL, or check the logos folder.
              </p>
              <a
                href={LOGOS_FOLDER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-dark transition-colors"
              >
                Open Logos Folder
              </a>
            </div>
          ) : state.saving ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand mx-auto"></div>
              <p className="mt-4 text-gray-600">Saving logo to staging folder...</p>
            </div>
          ) : state.savedToStaging ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">&#10003;</div>
              <h3 className="text-xl font-bold text-green-800 mb-2">Saved to Staging!</h3>
              <p className="text-gray-600 mb-4">
                <strong>{state.savedToStaging}</strong> saved to logos_staging folder.
              </p>
              <p className="text-sm text-gray-500 mb-4">Choose an option:</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={onSavePermanently}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
                >
                  Save Permanently & Auto-Fill
                </button>
                <button
                  onClick={onDownloadAnother}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Download Another
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-gray-600 mb-4">
                Found {state.logos.length} logo(s) on {state.website}. Click to download to staging:
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {state.logos.map((logo, idx) => (
                  <button
                    key={idx}
                    onClick={() => onSelectLogo(logo)}
                    className="border border-gray-200 rounded-lg p-4 hover:border-brand hover:bg-brand/5 transition-colors group"
                  >
                    <div className="aspect-video bg-gray-100 rounded flex items-center justify-center mb-2 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/admin/proxy-image?url=${encodeURIComponent(logo.url)}`}
                        alt={`Logo option ${idx + 1}`}
                        className="max-w-full max-h-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          const parent = (e.target as HTMLImageElement).parentElement;
                          if (parent && !parent.querySelector('.fallback-text')) {
                            const span = document.createElement('span');
                            span.className = 'fallback-text text-gray-400 text-xs';
                            span.textContent = 'Preview unavailable';
                            parent.appendChild(span);
                          }
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 truncate">{logo.source}</p>
                    <p className="text-xs text-gray-400">
                      {logo.width}x{logo.height} {logo.format}
                    </p>
                    <p className="text-xs text-brand font-medium mt-1 opacity-0 group-hover:opacity-100">
                      Click to download
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t flex justify-between items-center">
          <a
            href={LOGOS_FOLDER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline"
          >
            Open Logos Folder in Drive
          </a>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
