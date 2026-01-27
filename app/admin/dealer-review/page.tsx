'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import DealerCard, { type EditableDealer, type ApprovalResult } from './components/DealerCard';
import LogoFinderOverlay, { type LogoOverlayState, type LogoOption } from './components/LogoFinderOverlay';
import ManageExistingDealers, { type ManageExistingDealersHandle } from './components/ManageExistingDealers';

export default function DealerReviewPage() {
  // --- Pending review state ---
  const [pendingDealers, setPendingDealers] = useState<EditableDealer[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [pendingError, setPendingError] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [approveResults, setApproveResults] = useState<Record<string, ApprovalResult>>({});

  // --- Shared logo overlay state ---
  const [logoOverlay, setLogoOverlay] = useState<LogoOverlayState | null>(null);

  // Ref to ManageExistingDealers so we can update its dealer fields from logo save
  const manageRef = useRef<ManageExistingDealersHandle | null>(null);

  // --- Format helpers ---
  const formatDisplayName = useCallback((name: string | null): string => {
    if (!name) return '';
    return name
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .replace(/&/g, 'and')
      .replace(/\bLlc\b/gi, 'LLC')
      .replace(/\bHvac\b/gi, 'HVAC')
      .replace(/\bAc\b/gi, 'AC');
  }, []);

  const formatPhone = useCallback((phone: string | null): string => {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return phone;
  }, []);

  const formatWebsite = useCallback((url: string | null): string => {
    if (!url) return '';
    return url
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '');
  }, []);

  // --- Pending dealers ---
  const fetchPendingDealers = useCallback(async () => {
    try {
      setPendingLoading(true);
      const response = await fetch('/api/admin/dealer-review');
      const data = await response.json();

      if (data.success) {
        const editableDealers = data.dealers.map((d: EditableDealer) => ({
          ...d,
          edited_display_name: d.display_name || formatDisplayName(d.dealer_name),
          edited_phone: d.creatomate_phone || formatPhone(d.turnkey_phone),
          edited_website: d.creatomate_website || formatWebsite(d.dealer_web_address),
          edited_logo: d.creatomate_logo || '',
          edited_region: d.region || '',
        }));
        setPendingDealers(editableDealers);
      } else {
        setPendingError(data.error);
      }
    } catch (err) {
      setPendingError(err instanceof Error ? err.message : 'Failed to fetch dealers');
    } finally {
      setPendingLoading(false);
    }
  }, [formatDisplayName, formatPhone, formatWebsite]);

  useEffect(() => {
    fetchPendingDealers();
  }, [fetchPendingDealers]);

  const updatePendingField = (dealerNo: string, field: string, value: string) => {
    setPendingDealers((prev) =>
      prev.map((d) =>
        d.dealer_no === dealerNo ? { ...d, [field]: value } : d
      )
    );
  };

  const handleApprove = async (dealer: EditableDealer) => {
    if (!dealer.edited_display_name || !dealer.edited_phone || !dealer.edited_logo) {
      setApproveResults((prev) => ({
        ...prev,
        [dealer.dealer_no]: { success: false, message: 'Display name, phone, and logo are required (website is optional)' },
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
        setApproveResults((prev) => ({ ...prev, [dealer.dealer_no]: data }));
        setTimeout(() => {
          setPendingDealers((prev) => prev.filter((d) => d.dealer_no !== dealer.dealer_no));
        }, 5000);
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

  // --- Logo overlay (shared between both sections) ---
  const openLogoFinder = async (dealer: EditableDealer, source: 'pending' | 'existing') => {
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
      source,
    });

    if (!website) {
      setLogoOverlay((prev) => prev ? { ...prev, loading: false, error: 'No website available' } : null);
      return;
    }

    try {
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
    } catch {
      setLogoOverlay((prev) =>
        prev ? { ...prev, loading: false, error: 'Failed to fetch logos' } : null
      );
    }
  };

  const downloadLogoToStaging = async (logo: LogoOption) => {
    if (!logoOverlay) return;

    setLogoOverlay((prev) => (prev ? { ...prev, saving: true } : null));

    try {
      // Find dealer in pending or use the overlay's dealer info
      const pendingDealer = pendingDealers.find((d) => d.dealer_no === logoOverlay.dealerNo);
      const displayName = pendingDealer?.edited_display_name || logoOverlay.dealerName;

      const response = await fetch('/api/admin/save-logo-staging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealerNo: logoOverlay.dealerNo,
          displayName,
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

  const saveLogoPermanently = async () => {
    if (!logoOverlay?.savedToStaging) return;

    setLogoOverlay((prev) => (prev ? { ...prev, saving: true } : null));

    try {
      const response = await fetch('/api/admin/save-logo-permanent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stagingFileName: logoOverlay.savedToStaging,
          dealerNo: logoOverlay.dealerNo,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Update the correct section's dealer field
        if (logoOverlay.source === 'pending') {
          updatePendingField(logoOverlay.dealerNo, 'edited_logo', data.logoUrl);
        } else {
          // Update the manage section via ref
          manageRef.current?.updateField(logoOverlay.dealerNo, 'edited_logo', data.logoUrl);
        }
        setLogoOverlay(null);
      } else {
        setLogoOverlay((prev) =>
          prev ? { ...prev, saving: false, error: data.error || 'Failed to save logo permanently' } : null
        );
      }
    } catch (err) {
      setLogoOverlay((prev) =>
        prev ? { ...prev, saving: false, error: err instanceof Error ? err.message : 'Failed to save permanently' } : null
      );
    }
  };

  // Wrappers for passing to child components
  const openLogoFinderForPending = (dealer: EditableDealer) => openLogoFinder(dealer, 'pending');
  const openLogoFinderForExisting = (dealer: EditableDealer) => openLogoFinder(dealer, 'existing');

  const pendingDealerNos = useMemo(
    () => new Set(pendingDealers.map((d) => d.dealer_no)),
    [pendingDealers]
  );

  return (
    <>
      <div className="max-w-6xl mx-auto p-8">
        {/* Section 1: Pending Review */}
        {pendingLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading dealers...</p>
          </div>
        ) : pendingError ? (
          <div className="p-4 bg-red-50 border border-red-500 rounded-lg text-red-800">
            <p className="font-medium">Error</p>
            <p className="text-sm mt-1">{pendingError}</p>
          </div>
        ) : pendingDealers.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-green-400">
            <div className="text-6xl mb-4">&#10003;</div>
            <h2 className="text-2xl font-bold text-green-800">All Caught Up!</h2>
            <p className="text-gray-600 mt-2">No dealers pending review.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-800">
                {pendingDealers.length} Dealer{pendingDealers.length !== 1 ? 's' : ''} Pending Review
              </h2>
              <button
                onClick={fetchPendingDealers}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Refresh
              </button>
            </div>

            {pendingDealers.map((dealer) => (
              <DealerCard
                key={dealer.dealer_no}
                dealer={dealer}
                mode="review"
                onUpdateField={updatePendingField}
                onAction={handleApprove}
                actionLoading={approving === dealer.dealer_no}
                actionResult={approveResults[dealer.dealer_no] || null}
                onOpenLogoFinder={openLogoFinderForPending}
                formatPhone={formatPhone}
                formatWebsite={formatWebsite}
              />
            ))}
          </div>
        )}

        {/* Section 2: Manage Existing Dealers */}
        <ManageExistingDealers
          ref={manageRef}
          pendingDealerNos={pendingDealerNos}
          onOpenLogoFinder={openLogoFinderForExisting}
          formatPhone={formatPhone}
          formatWebsite={formatWebsite}
          formatDisplayName={formatDisplayName}
        />
      </div>

      {/* Shared Logo Finder Overlay */}
      {logoOverlay && (
        <LogoFinderOverlay
          state={logoOverlay}
          onClose={() => setLogoOverlay(null)}
          onSelectLogo={downloadLogoToStaging}
          onSavePermanently={saveLogoPermanently}
          onDownloadAnother={() => setLogoOverlay((prev) => prev ? { ...prev, savedToStaging: null } : null)}
        />
      )}
    </>
  );
}
