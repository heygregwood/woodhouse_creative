'use client';

import { useState, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import DealerCard, { type EditableDealer, type SaveResult } from './DealerCard';

export interface ManageExistingDealersHandle {
  updateField: (dealerNo: string, field: string, value: string) => void;
}

interface ManageExistingDealersProps {
  pendingDealerNos: Set<string>;
  onOpenLogoFinder: (dealer: EditableDealer) => void;
  formatPhone: (phone: string | null) => string;
  formatWebsite: (url: string | null) => string;
  formatDisplayName: (name: string | null) => string;
}

const RECENT_COUNT = 10;

const ManageExistingDealers = forwardRef<ManageExistingDealersHandle, ManageExistingDealersProps>(function ManageExistingDealers({
  pendingDealerNos,
  onOpenLogoFinder,
  formatPhone,
  formatWebsite,
  formatDisplayName,
}, ref) {
  const [dealers, setDealers] = useState<EditableDealer[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [saveResults, setSaveResults] = useState<Record<string, SaveResult>>({});

  const fetchExistingDealers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/admin/dealer-review?section=existing');
      const data = await response.json();

      if (data.success) {
        const editableDealers = data.dealers
          .filter((d: EditableDealer) => !pendingDealerNos.has(d.dealer_no))
          .map((d: EditableDealer) => ({
            ...d,
            edited_display_name: d.display_name || formatDisplayName(d.dealer_name),
            edited_phone: d.creatomate_phone || formatPhone(d.turnkey_phone),
            edited_website: d.creatomate_website || formatWebsite(d.dealer_web_address),
            edited_logo: d.creatomate_logo || '',
            edited_region: d.region || '',
          }));
        setDealers(editableDealers);
        setLoaded(true);
      } else {
        setError(data.error || 'Failed to fetch dealers');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dealers');
    } finally {
      setLoading(false);
    }
  }, [pendingDealerNos, formatDisplayName, formatPhone, formatWebsite]);

  const handleLoadDealers = () => {
    if (!loaded) {
      fetchExistingDealers();
    }
  };

  const updateField = (dealerNo: string, field: string, value: string) => {
    setDealers((prev) =>
      prev.map((d) =>
        d.dealer_no === dealerNo ? { ...d, [field]: value } : d
      )
    );
  };

  // Expose updateField to parent via ref (used when logo overlay saves from 'existing' source)
  useImperativeHandle(ref, () => ({
    updateField,
  }));

  const handleSave = async (dealer: EditableDealer) => {
    try {
      setSaving(dealer.dealer_no);
      setSaveResults((prev) => ({ ...prev, [dealer.dealer_no]: undefined as unknown as SaveResult }));

      const response = await fetch('/api/admin/dealer-review', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealer_no: dealer.dealer_no,
          display_name: dealer.edited_display_name,
          creatomate_phone: dealer.edited_phone,
          creatomate_website: dealer.edited_website,
          creatomate_logo: dealer.edited_logo,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Update original values to match edited values so "Save" button disables
        setDealers((prev) =>
          prev.map((d) =>
            d.dealer_no === dealer.dealer_no
              ? {
                  ...d,
                  display_name: d.edited_display_name,
                  creatomate_phone: d.edited_phone,
                  creatomate_website: d.edited_website,
                  creatomate_logo: d.edited_logo,
                }
              : d
          )
        );
        setSaveResults((prev) => ({
          ...prev,
          [dealer.dealer_no]: { success: true, message: `Updated: ${data.updated_fields.join(', ')}` },
        }));
        // Clear success message after 3 seconds
        setTimeout(() => {
          setSaveResults((prev) => {
            const next = { ...prev };
            delete next[dealer.dealer_no];
            return next;
          });
        }, 3000);
      } else {
        setSaveResults((prev) => ({
          ...prev,
          [dealer.dealer_no]: { success: false, message: data.error || 'Failed to save' },
        }));
      }
    } catch (err) {
      setSaveResults((prev) => ({
        ...prev,
        [dealer.dealer_no]: { success: false, message: err instanceof Error ? err.message : 'Failed to save' },
      }));
    } finally {
      setSaving(null);
    }
  };

  // Filter dealers based on search query
  const filteredDealers = useMemo(() => {
    if (!searchQuery) return dealers;
    const q = searchQuery.toLowerCase();
    return dealers.filter((d) =>
      d.dealer_no.includes(q) ||
      (d.display_name || '').toLowerCase().includes(q) ||
      (d.dealer_name || '').toLowerCase().includes(q)
    );
  }, [dealers, searchQuery]);

  // Determine which dealers to display
  const displayDealers = useMemo(() => {
    if (searchQuery) return filteredDealers;
    if (showAll) {
      // Sort alphabetically by display name when showing all
      return [...dealers].sort((a, b) =>
        (a.edited_display_name || '').localeCompare(b.edited_display_name || '')
      );
    }
    // Default: show most recently modified (already sorted by updated_at desc from API)
    return dealers.slice(0, RECENT_COUNT);
  }, [dealers, filteredDealers, showAll, searchQuery]);

  return (
    <div className="mt-10">
      <div className="border-t border-gray-300 pt-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800">
            Manage Existing Dealers {loaded ? `(${dealers.length} FULL)` : ''}
          </h2>
          {loaded && (
            <button
              onClick={fetchExistingDealers}
              className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Refresh
            </button>
          )}
        </div>

        {!loaded && !loading ? (
          <div className="text-center py-8 bg-white rounded-lg border border-border">
            <p className="text-gray-500 mb-4">Load approved FULL dealers to view and edit their details.</p>
            <button
              onClick={handleLoadDealers}
              className="px-6 py-3 bg-brand text-white rounded-lg hover:bg-brand-dark transition-colors font-semibold"
            >
              Load Existing Dealers
            </button>
          </div>
        ) : loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand mx-auto"></div>
            <p className="mt-3 text-gray-600">Loading dealers...</p>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 border border-red-500 rounded-lg text-red-800">
            <p className="font-medium">Error</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        ) : (
          <>
            {/* Search */}
            <div className="mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or dealer number..."
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand/20 focus:border-brand"
              />
            </div>

            {/* Results label */}
            <p className="text-sm text-gray-500 mb-3">
              {searchQuery
                ? `${filteredDealers.length} result${filteredDealers.length !== 1 ? 's' : ''} for "${searchQuery}"`
                : showAll
                ? `All ${dealers.length} dealers (A-Z)`
                : `Recently modified (${Math.min(RECENT_COUNT, dealers.length)} of ${dealers.length})`}
            </p>

            {/* Dealer cards */}
            <div className="space-y-2">
              {displayDealers.map((dealer) => (
                <DealerCard
                  key={dealer.dealer_no}
                  dealer={dealer}
                  mode="manage"
                  onUpdateField={updateField}
                  onAction={handleSave}
                  actionLoading={saving === dealer.dealer_no}
                  actionResult={saveResults[dealer.dealer_no] || null}
                  onOpenLogoFinder={onOpenLogoFinder}
                  formatPhone={formatPhone}
                  formatWebsite={formatWebsite}
                />
              ))}
            </div>

            {/* Show All / Show Recent toggle */}
            {!searchQuery && dealers.length > RECENT_COUNT && (
              <div className="text-center mt-4">
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="px-6 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-gray-700"
                >
                  {showAll ? 'Show Recent Only' : `Show All ${dealers.length} Dealers`}
                </button>
              </div>
            )}

            {displayDealers.length === 0 && searchQuery && (
              <div className="text-center py-8 text-gray-500">
                No dealers match &quot;{searchQuery}&quot;
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
});

export default ManageExistingDealers;
