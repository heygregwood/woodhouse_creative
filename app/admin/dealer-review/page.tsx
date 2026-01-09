'use client';

import { useState, useEffect } from 'react';

interface LogoOption {
  url: string;
  width: number;
  height: number;
  format: string;
  source: string;
}

interface DealerReview {
  dealer_no: string;
  dealer_name: string;
  display_name: string | null;
  distributor_name: string | null;
  contact_name: string | null;
  contact_first_name: string | null;
  contact_email: string | null;
  turnkey_phone: string | null;
  dealer_web_address: string | null;
  creatomate_phone: string | null;
  creatomate_website: string | null;
  creatomate_logo: string | null;
  region: string | null;
  program_status: string;
  review_status: string;
  updated_at: string;
}

interface EditableDealer extends DealerReview {
  edited_display_name: string;
  edited_phone: string;
  edited_website: string;
  edited_logo: string;
  edited_region: string;
}

const LOGOS_FOLDER_URL = 'https://drive.google.com/drive/folders/17TNIFS-5Nnrn3b-_knPPm5u-f1X_UUbR?usp=sharing';

export default function DealerReviewPage() {
  const [dealers, setDealers] = useState<EditableDealer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [approveResults, setApproveResults] = useState<Record<string, { success: boolean; message: string }>>({});

  // Logo finder overlay state
  const [logoOverlay, setLogoOverlay] = useState<{
    dealerNo: string;
    dealerName: string;
    website: string;
    loading: boolean;
    logos: LogoOption[];
    error: string | null;
    saving: boolean;
    savedToStaging: string | null;
  } | null>(null);

  // Fetch dealers pending review
  useEffect(() => {
    fetchDealers();
  }, []);

  const fetchDealers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/dealer-review');
      const data = await response.json();

      if (data.success) {
        // Initialize editable fields with existing values or smart defaults
        const editableDealers = data.dealers.map((d: DealerReview) => ({
          ...d,
          edited_display_name: d.display_name || formatDisplayName(d.dealer_name),
          edited_phone: d.creatomate_phone || formatPhone(d.turnkey_phone),
          edited_website: d.creatomate_website || formatWebsite(d.dealer_web_address),
          edited_logo: d.creatomate_logo || '',
          edited_region: d.region || '',
        }));
        setDealers(editableDealers);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dealers');
    } finally {
      setLoading(false);
    }
  };

  // Format display name: Title Case, "and" not "&"
  const formatDisplayName = (name: string | null): string => {
    if (!name) return '';
    return name
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .replace(/&/g, 'and')
      .replace(/\bLlc\b/gi, 'LLC')
      .replace(/\bHvac\b/gi, 'HVAC')
      .replace(/\bAc\b/gi, 'AC');
  };

  // Format phone: XXX-XXX-XXXX
  const formatPhone = (phone: string | null): string => {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return phone;
  };

  // Format website: domain only, no https://
  const formatWebsite = (url: string | null): string => {
    if (!url) return '';
    return url
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '');
  };

  // Update editable field
  const updateField = (dealerNo: string, field: string, value: string) => {
    setDealers((prev) =>
      prev.map((d) =>
        d.dealer_no === dealerNo ? { ...d, [field]: value } : d
      )
    );
  };

  // Open logo finder overlay
  const openLogoFinder = async (dealer: EditableDealer) => {
    const website = dealer.edited_website || formatWebsite(dealer.dealer_web_address);

    setLogoOverlay({
      dealerNo: dealer.dealer_no,
      dealerName: dealer.edited_display_name || dealer.dealer_name,
      website,
      loading: true,
      logos: [],
      error: null,
      saving: false,
      savedToStaging: null,
    });

    if (!website) {
      setLogoOverlay((prev) => prev ? { ...prev, loading: false, error: 'No website available' } : null);
      return;
    }

    try {
      // Pass website directly so we use the edited value, not the database value
      const response = await fetch(`/api/admin/fetch-logos?website=${encodeURIComponent(website)}`);
      const data = await response.json();

      setLogoOverlay((prev) =>
        prev
          ? {
              ...prev,
              loading: false,
              logos: data.logos || [],
              error: data.error || (data.logos?.length === 0 ? 'No logos found on website' : null),
            }
          : null
      );
    } catch (err) {
      setLogoOverlay((prev) =>
        prev ? { ...prev, loading: false, error: 'Failed to fetch logos' } : null
      );
    }
  };

  // Download logo to staging folder
  const downloadLogoToStaging = async (logo: LogoOption) => {
    if (!logoOverlay) return;

    setLogoOverlay((prev) => (prev ? { ...prev, saving: true } : null));

    try {
      // Find the dealer to get display name
      const dealer = dealers.find((d) => d.dealer_no === logoOverlay.dealerNo);
      if (!dealer) throw new Error('Dealer not found');

      const response = await fetch('/api/admin/save-logo-staging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealerNo: logoOverlay.dealerNo,
          displayName: dealer.edited_display_name || dealer.dealer_name,
          logoUrl: logo.url,
          logoSource: logo.source,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setLogoOverlay((prev) =>
          prev ? { ...prev, saving: false, error: null, savedToStaging: data.fileName } : null
        );
      } else {
        setLogoOverlay((prev) =>
          prev ? { ...prev, saving: false, error: data.error || 'Failed to save logo' } : null
        );
      }
    } catch (err) {
      setLogoOverlay((prev) =>
        prev ? { ...prev, saving: false, error: err instanceof Error ? err.message : 'Failed to save' } : null
      );
    }
  };

  // Approve dealer
  const approveDealer = async (dealer: EditableDealer) => {
    if (!dealer.edited_display_name || !dealer.edited_phone || !dealer.edited_website || !dealer.edited_logo) {
      setApproveResults((prev) => ({
        ...prev,
        [dealer.dealer_no]: { success: false, message: 'All fields are required' },
      }));
      return;
    }

    try {
      setApproving(dealer.dealer_no);
      const response = await fetch('/api/admin/dealer-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealer_no: dealer.dealer_no,
          display_name: dealer.edited_display_name,
          creatomate_phone: dealer.edited_phone,
          creatomate_website: dealer.edited_website,
          creatomate_logo: dealer.edited_logo,
          region: dealer.edited_region || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setApproveResults((prev) => ({
          ...prev,
          [dealer.dealer_no]: {
            success: true,
            message: `Approved! Spreadsheet: ${data.spreadsheet?.success ? 'Added' : 'Failed'}, Email: ${data.email?.success ? 'Sent' : 'Failed'}`,
          },
        }));
        // Remove from list after short delay
        setTimeout(() => {
          setDealers((prev) => prev.filter((d) => d.dealer_no !== dealer.dealer_no));
        }, 2000);
      } else {
        setApproveResults((prev) => ({
          ...prev,
          [dealer.dealer_no]: { success: false, message: data.error },
        }));
      }
    } catch (err) {
      setApproveResults((prev) => ({
        ...prev,
        [dealer.dealer_no]: { success: false, message: err instanceof Error ? err.message : 'Failed to approve' },
      }));
    } finally {
      setApproving(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#5378a8] text-white py-6 px-8 border-b-4 border-[#c87a3e]">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold">Woodhouse Creative Admin</h1>
          </div>
          <div className="flex gap-3">
            <a
              href="/admin"
              className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors font-medium"
            >
              Dashboard
            </a>
            <a
              href="/admin/posts"
              className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors font-medium"
            >
              Posts
            </a>
            <a
              href="/admin/email-templates"
              className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors font-medium"
            >
              Email Templates
            </a>
            <a
              href="/admin/dealer-review"
              className="px-4 py-2 bg-white/40 rounded-lg hover:bg-white/50 transition-colors font-medium"
            >
              Dealer Review
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5378a8] mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading dealers...</p>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 border border-red-500 rounded-lg text-red-800">
            <p className="font-medium">Error</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        ) : dealers.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border-2 border-green-400">
            <div className="text-6xl mb-4">&#10003;</div>
            <h2 className="text-2xl font-bold text-green-800">All Caught Up!</h2>
            <p className="text-gray-600 mt-2">No dealers pending review.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-800">
                {dealers.length} Dealer{dealers.length !== 1 ? 's' : ''} Pending Review
              </h2>
              <button
                onClick={fetchDealers}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Refresh
              </button>
            </div>

            {dealers.map((dealer) => (
              <div
                key={dealer.dealer_no}
                className="bg-white border-2 border-[#5378a8] rounded-lg shadow-lg overflow-hidden"
              >
                {/* Dealer Header */}
                <div className="bg-[#74a9de] px-6 py-4 border-b-2 border-[#5378a8]">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-bold text-black">{dealer.dealer_name}</h3>
                      <p className="text-sm text-black/70">
                        #{dealer.dealer_no} | {dealer.distributor_name}
                      </p>
                    </div>
                    <span className="px-3 py-1 bg-yellow-400 text-yellow-900 rounded-full text-sm font-medium">
                      Pending Review
                    </span>
                  </div>
                </div>

                {/* Edit Form */}
                <div className="p-6 space-y-4">
                  {/* Row 1: Display Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Display Name <span className="text-gray-400">(for videos)</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={dealer.edited_display_name}
                        onChange={(e) => updateField(dealer.dealer_no, 'edited_display_name', e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5378a8] focus:border-transparent"
                        placeholder="Ron's Heating and Cooling"
                      />
                      <span className="text-xs text-gray-500 self-center whitespace-nowrap">
                        Raw: {dealer.dealer_name}
                      </span>
                    </div>
                  </div>

                  {/* Row 2: Phone & Website */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Phone <span className="text-gray-400">(XXX-XXX-XXXX)</span>
                      </label>
                      <input
                        type="text"
                        value={dealer.edited_phone}
                        onChange={(e) => updateField(dealer.dealer_no, 'edited_phone', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5378a8] focus:border-transparent"
                        placeholder="555-555-5555"
                      />
                      {dealer.turnkey_phone && dealer.edited_phone !== formatPhone(dealer.turnkey_phone) && (
                        <p className="text-xs text-gray-500 mt-1">Raw: {dealer.turnkey_phone}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Website <span className="text-gray-400">(domain only)</span>
                      </label>
                      <input
                        type="text"
                        value={dealer.edited_website}
                        onChange={(e) => updateField(dealer.dealer_no, 'edited_website', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5378a8] focus:border-transparent"
                        placeholder="example.com"
                      />
                      {dealer.dealer_web_address && dealer.edited_website !== formatWebsite(dealer.dealer_web_address) && (
                        <p className="text-xs text-gray-500 mt-1">Raw: {dealer.dealer_web_address}</p>
                      )}
                    </div>
                  </div>

                  {/* Row 3: Logo URL */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-gray-700">
                        Logo URL <span className="text-gray-400">(Google Drive shareable link)</span>
                      </label>
                      <a
                        href={LOGOS_FOLDER_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Open Logos Folder
                      </a>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={dealer.edited_logo}
                        onChange={(e) => updateField(dealer.dealer_no, 'edited_logo', e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5378a8] focus:border-transparent"
                        placeholder="https://drive.google.com/file/d/..."
                      />
                      <button
                        onClick={() => openLogoFinder(dealer)}
                        className="px-4 py-2 bg-[#c87a3e] text-white rounded-lg hover:bg-[#b06930] transition-colors font-medium whitespace-nowrap"
                      >
                        Find Logo
                      </button>
                    </div>
                    {dealer.edited_logo && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-green-600">Preview:</span>
                        <a
                          href={dealer.edited_logo}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline truncate max-w-md"
                        >
                          {dealer.edited_logo}
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Row 4: Region (optional) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Region <span className="text-gray-400">(optional - for scheduling)</span>
                    </label>
                    <select
                      value={dealer.edited_region}
                      onChange={(e) => updateField(dealer.dealer_no, 'edited_region', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5378a8] focus:border-transparent"
                    >
                      <option value="">Select region...</option>
                      <option value="North">North</option>
                      <option value="South">South</option>
                      <option value="Canada">Canada</option>
                    </select>
                  </div>

                  {/* Contact Info (read-only) */}
                  <div className="pt-4 border-t border-gray-200">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Contact:</span> {dealer.contact_name || 'N/A'} ({dealer.contact_email || 'No email'})
                    </p>
                  </div>

                  {/* Approve Result */}
                  {approveResults[dealer.dealer_no] && (
                    <div
                      className={`p-3 rounded-lg ${
                        approveResults[dealer.dealer_no].success
                          ? 'bg-green-50 border border-green-400 text-green-800'
                          : 'bg-red-50 border border-red-400 text-red-800'
                      }`}
                    >
                      {approveResults[dealer.dealer_no].message}
                    </div>
                  )}

                  {/* Approve Button */}
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => approveDealer(dealer)}
                      disabled={approving === dealer.dealer_no || !dealer.edited_logo}
                      className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                        !dealer.edited_logo
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : approving === dealer.dealer_no
                          ? 'bg-gray-400 text-white cursor-wait'
                          : 'bg-green-600 text-white hover:bg-green-700'
                      }`}
                    >
                      {approving === dealer.dealer_no ? 'Approving...' : 'Approve & Add to Spreadsheet'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Logo Finder Overlay */}
      {logoOverlay && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Overlay Header */}
            <div className="bg-[#5378a8] text-white px-6 py-4 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold">Find Logo</h3>
                <p className="text-white/80 text-sm">{logoOverlay.dealerName}</p>
              </div>
              <button
                onClick={() => setLogoOverlay(null)}
                className="text-white/80 hover:text-white text-2xl font-bold"
              >
                &times;
              </button>
            </div>

            {/* Overlay Content */}
            <div className="p-6 overflow-y-auto flex-1">
              {logoOverlay.loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5378a8] mx-auto"></div>
                  <p className="mt-4 text-gray-600">Searching {logoOverlay.website} for logos...</p>
                </div>
              ) : logoOverlay.error ? (
                <div className="text-center py-12">
                  <p className="text-red-600 mb-4">{logoOverlay.error}</p>
                  <p className="text-gray-500 text-sm mb-4">
                    You can manually find the logo and paste the URL, or check the logos folder.
                  </p>
                  <a
                    href={LOGOS_FOLDER_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-4 py-2 bg-[#5378a8] text-white rounded-lg hover:bg-[#4a6890] transition-colors"
                  >
                    Open Logos Folder
                  </a>
                </div>
              ) : logoOverlay.saving ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5378a8] mx-auto"></div>
                  <p className="mt-4 text-gray-600">Saving logo to staging folder...</p>
                </div>
              ) : logoOverlay.savedToStaging ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">&#10003;</div>
                  <h3 className="text-xl font-bold text-green-800 mb-2">Saved to Staging!</h3>
                  <p className="text-gray-600 mb-4">
                    <strong>{logoOverlay.savedToStaging}</strong> saved to logos_staging folder.
                  </p>
                  <p className="text-sm text-gray-500 mb-4">
                    Process the logo offline, upload to the logos folder, then paste the URL in the form.
                  </p>
                  <button
                    onClick={() => setLogoOverlay((prev) => prev ? { ...prev, savedToStaging: null } : null)}
                    className="px-4 py-2 bg-[#5378a8] text-white rounded-lg hover:bg-[#4a6890] transition-colors"
                  >
                    Download Another
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-gray-600 mb-4">
                    Found {logoOverlay.logos.length} logo(s) on {logoOverlay.website}. Click to download to staging:
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {logoOverlay.logos.map((logo, idx) => (
                      <button
                        key={idx}
                        onClick={() => downloadLogoToStaging(logo)}
                        className="border-2 border-gray-200 rounded-lg p-4 hover:border-[#5378a8] hover:bg-blue-50 transition-colors group"
                      >
                        <div className="aspect-video bg-gray-100 rounded flex items-center justify-center mb-2 overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`/api/admin/proxy-image?url=${encodeURIComponent(logo.url)}`}
                            alt={`Logo option ${idx + 1}`}
                            className="max-w-full max-h-full object-contain"
                            onError={(e) => {
                              // Hide broken image and show fallback text
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
                        <p className="text-xs text-[#5378a8] font-medium mt-1 opacity-0 group-hover:opacity-100">
                          Click to download
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Overlay Footer */}
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
                onClick={() => setLogoOverlay(null)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
