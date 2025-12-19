'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

interface LogoOption {
  url: string;
  width: number;
  height: number;
  format: string;
  source: string;
}

interface Dealer {
  dealer_no: string;
  display_name: string;
  creatomate_website: string;
  creatomate_logo: string;
  ready_for_automate: string;
  logoOptions?: LogoOption[];
  loading?: boolean;
  error?: string;
  selectedLogo?: LogoOption;
  saved?: boolean;
}

export default function LogoFetchPage() {
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'not-ready' | 'no-logo'>('not-ready');
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch dealers on mount
  useEffect(() => {
    fetchDealers();
  }, [filter]);

  const fetchDealers = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/dealers?filter=${filter}`);
      const data = await response.json();
      setDealers(data.dealers || []);
    } catch (error) {
      console.error('Failed to fetch dealers:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch logo options for a single dealer
  const fetchLogosForDealer = async (dealerNo: string) => {
    setDealers(prev => prev.map(d => 
      d.dealer_no === dealerNo ? { ...d, loading: true, error: undefined } : d
    ));

    try {
      const response = await fetch(`/api/admin/fetch-logos?dealerNo=${dealerNo}`);
      const data = await response.json();

      setDealers(prev => prev.map(d => 
        d.dealer_no === dealerNo 
          ? { ...d, loading: false, logoOptions: data.logos || [], error: data.error }
          : d
      ));
    } catch (error) {
      setDealers(prev => prev.map(d => 
        d.dealer_no === dealerNo 
          ? { ...d, loading: false, error: 'Failed to fetch logos' }
          : d
      ));
    }
  };

  // Fetch logos for all dealers
  const fetchAllLogos = async () => {
    for (const dealer of dealers) {
      if (!dealer.logoOptions && dealer.creatomate_website) {
        await fetchLogosForDealer(dealer.dealer_no);
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  };

  // Select a logo for a dealer
  const selectLogo = (dealerNo: string, logo: LogoOption) => {
    setDealers(prev => prev.map(d => 
      d.dealer_no === dealerNo ? { ...d, selectedLogo: logo } : d
    ));
  };

  // Save selected logo
  const saveLogo = async (dealer: Dealer) => {
    if (!dealer.selectedLogo) return;

    setSaving(dealer.dealer_no);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/save-logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealerNo: dealer.dealer_no,
          displayName: dealer.display_name,
          logoUrl: dealer.selectedLogo.url,
          logoSource: dealer.selectedLogo.source,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setDealers(prev => prev.map(d => 
          d.dealer_no === dealer.dealer_no 
            ? { ...d, saved: true, creatomate_logo: data.driveUrl }
            : d
        ));
        setMessage({ type: 'success', text: `Logo saved for ${dealer.display_name}` });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save logo' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save logo' });
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#5378a8] text-white py-6 px-8 border-b-4 border-[#c87a3e]">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold">Logo Finder</h1>
          <p className="text-[#d7e7fd] mt-1">Fetch and select logos for dealers needing automation</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Controls */}
        <div className="bg-white rounded-lg shadow p-4 mb-6 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="font-medium text-gray-700">Filter:</label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="border-2 border-[#5378a8] rounded-lg px-3 py-2"
            >
              <option value="not-ready">Not Ready for Automation</option>
              <option value="no-logo">Missing Logo</option>
              <option value="all">All FULL Dealers</option>
            </select>
          </div>

          <button
            onClick={fetchAllLogos}
            disabled={loading}
            className="px-4 py-2 bg-[#c87a3e] text-white rounded-lg hover:bg-[#b36a35] disabled:bg-gray-300 font-medium"
          >
            Fetch All Logos
          </button>

          <button
            onClick={fetchDealers}
            className="px-4 py-2 bg-[#5378a8] text-white rounded-lg hover:bg-[#4a6890] font-medium"
          >
            Refresh List
          </button>

          <div className="ml-auto text-sm text-gray-600">
            {dealers.length} dealer(s)
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-4 p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {message.text}
          </div>
        )}

        {/* Dealers Grid */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading dealers...</div>
        ) : dealers.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No dealers found</div>
        ) : (
          <div className="space-y-6">
            {dealers.map((dealer) => (
              <div
                key={dealer.dealer_no}
                className={`bg-white rounded-lg shadow-lg overflow-hidden border-2 ${
                  dealer.saved ? 'border-green-500' : 'border-gray-200'
                }`}
              >
                {/* Dealer Header */}
                <div className="bg-gray-100 px-6 py-4 border-b flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {dealer.display_name || `[${dealer.dealer_no}]`}
                    </h2>
                    <p className="text-sm text-gray-600">
                      {dealer.creatomate_website || 'No website'} • 
                      {dealer.creatomate_logo ? ' Has logo' : ' No logo'} •
                      {dealer.ready_for_automate === 'yes' ? ' Ready ✓' : ' Not ready'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {dealer.saved && (
                      <span className="text-green-600 font-medium">✓ Saved</span>
                    )}
                    <button
                      onClick={() => fetchLogosForDealer(dealer.dealer_no)}
                      disabled={dealer.loading || !dealer.creatomate_website}
                      className="px-4 py-2 bg-[#5378a8] text-white rounded hover:bg-[#4a6890] disabled:bg-gray-300 font-medium text-sm"
                    >
                      {dealer.loading ? 'Fetching...' : 'Fetch Logos'}
                    </button>
                  </div>
                </div>

                {/* Logo Options */}
                {dealer.error && (
                  <div className="p-4 bg-red-50 text-red-700">
                    Error: {dealer.error}
                  </div>
                )}

                {dealer.logoOptions && dealer.logoOptions.length === 0 && (
                  <div className="p-4 bg-yellow-50 text-yellow-700">
                    No suitable logos found. May need manual upload.
                  </div>
                )}

                {dealer.logoOptions && dealer.logoOptions.length > 0 && (
                  <div className="p-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {dealer.logoOptions.map((logo, index) => (
                        <button
                          key={index}
                          onClick={() => selectLogo(dealer.dealer_no, logo)}
                          className={`p-2 rounded-lg border-2 transition hover:shadow-lg ${
                            dealer.selectedLogo?.url === logo.url
                              ? 'border-[#c87a3e] bg-orange-50 ring-2 ring-[#c87a3e]'
                              : 'border-gray-200 hover:border-[#5378a8]'
                          }`}
                        >
                          <div className="aspect-square bg-gray-100 rounded flex items-center justify-center overflow-hidden">
                            <img
                              src={logo.url}
                              alt={`Logo option ${index + 1}`}
                              className="max-w-full max-h-full object-contain"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          </div>
                          <div className="mt-2 text-xs text-center">
                            <div className="font-medium text-gray-900">
                              {logo.width}×{logo.height}
                            </div>
                            <div className="text-gray-500 capitalize">
                              {logo.source} • {logo.format}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* Save Button */}
                    {dealer.selectedLogo && (
                      <div className="mt-4 flex items-center gap-4 pt-4 border-t">
                        <div className="flex-1">
                          <p className="text-sm text-gray-600">
                            Selected: {dealer.selectedLogo.width}×{dealer.selectedLogo.height} {dealer.selectedLogo.format} from {dealer.selectedLogo.source}
                          </p>
                        </div>
                        <button
                          onClick={() => saveLogo(dealer)}
                          disabled={saving === dealer.dealer_no}
                          className="px-6 py-2 bg-[#c87a3e] text-white rounded-lg hover:bg-[#b36a35] disabled:bg-gray-300 font-medium"
                        >
                          {saving === dealer.dealer_no ? 'Saving...' : 'Save to Google Drive'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Current Logo Preview */}
                {dealer.creatomate_logo && !dealer.logoOptions && (
                  <div className="p-4 bg-gray-50 flex items-center gap-4">
                    <div className="w-16 h-16 bg-white rounded border flex items-center justify-center overflow-hidden">
                      <img
                        src={dealer.creatomate_logo.replace('/view?', '/preview?').replace('usp=drive_link', '')}
                        alt="Current logo"
                        className="max-w-full max-h-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/placeholder-logo.png';
                        }}
                      />
                    </div>
                    <div className="text-sm text-gray-600">
                      Current logo saved
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
