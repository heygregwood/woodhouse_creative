'use client';

import { useState } from 'react';

interface FieldChange {
  field: string;
  old: string | null;
  new: string | null;
}

interface SyncChanges {
  new: Array<{ dealer_no: string; dealer_name: string; program_status: string }>;
  removed: Array<{ dealer_no: string; dealer_name: string; program_status: string }>;
  updated: Array<{ dealer_no: string; dealer_name: string; changes?: FieldChange[] }>;
  unchanged: number;
}

interface SyncResult {
  success: boolean;
  changes?: SyncChanges;
  error?: string;
  output?: string;
  autoApplied?: boolean;
  emailsSent?: number;
  emailsFailed?: number;
  emailResults?: Array<{ dealer_no: string; email_type?: string; success: boolean; error?: string }>;
  pendingReviewCount?: number;
  pendingReviewDealers?: string[];
}

export default function CreativeAdminPage() {
  // Excel Sync State
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  // Sync from Excel - auto-applies all changes and sends appropriate emails
  const handleCheckExcel = async () => {
    try {
      setSyncing(true);
      setSyncResult(null);

      const response = await fetch('/api/admin/sync-excel');
      const data = await response.json();

      setSyncResult(data);
    } catch (error) {
      setSyncResult({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sync from Excel',
      });
    } finally {
      setSyncing(false);
    }
  };

  const hasChanges = syncResult?.changes && (
    syncResult.changes.new.length > 0 ||
    syncResult.changes.removed.length > 0 ||
    syncResult.changes.updated.length > 0
  );

  // Check if changes were auto-applied (new dealers found)
  const autoApplied = syncResult?.autoApplied === true;

  return (
      <div className="max-w-5xl mx-auto p-8">
        {/* Excel Sync Section */}
        <div className="mb-8">
          <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-lg font-semibold text-text">Sync from Allied Excel</h2>
                  <p className="text-sm text-gray-500 mt-1">Check for new/changed dealers</p>
                </div>
                <a
                  href="ms-excel:ofe|u|https://woodhouseagency-my.sharepoint.com/:x:/p/greg/IQBRuqg2XiXNTIVnn6BLkArzAXUD3DR-8K3nxhQADxWtoP4?e=0MwJgK"
                  className="text-xs px-2 py-1 text-brand hover:text-brand-dark transition-colors"
                >
                  Open Excel
                </a>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <button
                onClick={handleCheckExcel}
                disabled={syncing}
                className="w-full px-6 py-3 bg-brand text-white rounded-lg hover:bg-brand-dark disabled:bg-gray-300 disabled:cursor-not-allowed font-semibold transition-colors"
              >
                {syncing ? 'Syncing...' : 'Sync from Excel'}
              </button>
              <p className="text-xs text-gray-500 text-center">
                New dealers are auto-added with welcome emails
              </p>

              {/* Sync Result */}
              {syncResult && (
                <div className="space-y-4">
                  {syncResult.error ? (
                    <div className="p-4 bg-red-50 border border-red-500 rounded-lg text-red-800">
                      <p className="font-medium">Error</p>
                      <p className="text-sm mt-1">{syncResult.error}</p>
                    </div>
                  ) : syncResult.changes && (
                    <>
                      {/* Summary */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className={`p-3 rounded-lg text-center ${syncResult.changes.new.length > 0 ? 'bg-green-50 border border-green-400' : 'bg-gray-50 border border-gray-200'}`}>
                          <p className={`text-2xl font-bold ${syncResult.changes.new.length > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                            {syncResult.changes.new.length}
                          </p>
                          <p className="text-xs text-gray-600">New</p>
                        </div>
                        <div className={`p-3 rounded-lg text-center ${syncResult.changes.updated.length > 0 ? 'bg-yellow-50 border border-yellow-400' : 'bg-gray-50 border border-gray-200'}`}>
                          <p className={`text-2xl font-bold ${syncResult.changes.updated.length > 0 ? 'text-yellow-600' : 'text-gray-400'}`}>
                            {syncResult.changes.updated.length}
                          </p>
                          <p className="text-xs text-gray-600">Updated</p>
                        </div>
                        <div className={`p-3 rounded-lg text-center ${syncResult.changes.removed.length > 0 ? 'bg-red-50 border border-red-400' : 'bg-gray-50 border border-gray-200'}`}>
                          <p className={`text-2xl font-bold ${syncResult.changes.removed.length > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                            {syncResult.changes.removed.length}
                          </p>
                          <p className="text-xs text-gray-600">Removed</p>
                        </div>
                      </div>

                      {/* Auto-applied results */}
                      {autoApplied && (
                        <div className="p-4 bg-green-50 border border-green-400 rounded-lg">
                          <p className="font-semibold text-green-800">Changes Applied!</p>
                          <p className="text-sm text-green-700 mt-1">
                            {(syncResult.changes?.new.length || 0) > 0 && `${syncResult.changes?.new.length} new dealer(s) added. `}
                            {(syncResult.changes?.updated.length || 0) > 0 && `${syncResult.changes?.updated.length} dealer(s) updated. `}
                            {(syncResult.changes?.removed.length || 0) > 0 && `${syncResult.changes?.removed.length} dealer(s) removed.`}
                          </p>
                          {(syncResult.emailsSent || 0) > 0 && (
                            <p className="text-sm text-green-700">
                              {syncResult.emailsSent} welcome email(s) sent
                            </p>
                          )}
                          {(syncResult.emailsFailed || 0) > 0 && (
                            <p className="text-sm text-red-700">
                              {syncResult.emailsFailed} email(s) failed to send
                            </p>
                          )}
                        </div>
                      )}

                      {/* Pending Review Notice */}
                      {(syncResult.pendingReviewCount || 0) > 0 && (
                        <div className="p-4 bg-yellow-50 border border-yellow-400 rounded-lg">
                          <p className="font-semibold text-yellow-800">
                            {syncResult.pendingReviewCount} dealer(s) promoted to FULL - Review Required
                          </p>
                          <p className="text-sm text-yellow-700 mt-1">
                            These dealers need logo and display name validation before being added to the scheduling spreadsheet.
                          </p>
                          <a
                            href="/admin/dealer-review"
                            className="inline-block mt-3 px-4 py-2 bg-yellow-400 text-yellow-900 rounded-lg hover:bg-yellow-300 transition-colors font-medium text-sm"
                          >
                            Review Now
                          </a>
                        </div>
                      )}

                      {/* New Dealers List (after auto-apply) */}
                      {syncResult.changes.new.length > 0 && autoApplied && (
                        <div className="border border-green-400 rounded-lg overflow-hidden">
                          <div className="bg-green-50 px-4 py-2 border-b border-green-400">
                            <p className="font-semibold text-green-800">New Dealers Added</p>
                          </div>
                          <div className="divide-y divide-green-200">
                            {syncResult.changes.new.map((dealer) => {
                              const emailResult = syncResult.emailResults?.find(e => e.dealer_no === dealer.dealer_no);
                              return (
                                <div key={dealer.dealer_no} className="p-3 bg-white flex justify-between items-center">
                                  <div>
                                    <p className="font-medium text-gray-900">{dealer.dealer_name}</p>
                                    <p className="text-sm text-gray-500">#{dealer.dealer_no} - {dealer.program_status}</p>
                                  </div>
                                  <span className={`text-xs px-2 py-1 rounded ${emailResult?.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {emailResult?.success ? 'Email Sent' : 'Email Failed'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Updated Dealers List */}
                      {syncResult.changes.updated.length > 0 && autoApplied && (
                        <div className="border border-yellow-400 rounded-lg overflow-hidden">
                          <div className="bg-yellow-50 px-4 py-2 border-b border-yellow-400">
                            <p className="font-semibold text-yellow-800">Updated Dealers</p>
                          </div>
                          <div className="divide-y divide-yellow-200 max-h-60 overflow-y-auto">
                            {syncResult.changes.updated.map((dealer) => {
                              const wasPromoted = dealer.changes?.some(c =>
                                c.field === 'program_status' &&
                                c.new === 'FULL' &&
                                (c.old === 'CONTENT' || c.old === 'NEW')
                              );
                              return (
                                <div key={dealer.dealer_no} className="p-3 bg-white">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <p className="font-medium text-gray-900">{dealer.dealer_name}</p>
                                      <p className="text-sm text-gray-500">#{dealer.dealer_no}</p>
                                    </div>
                                    {wasPromoted && (
                                      <span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-700">
                                        Needs Review
                                      </span>
                                    )}
                                  </div>
                                  {dealer.changes && dealer.changes.length > 0 && (
                                    <div className="mt-1 space-y-0.5">
                                      {dealer.changes.map((change, idx) => (
                                        <p key={idx} className="text-xs text-yellow-700 font-mono">
                                          {change.field}: {change.old || 'null'} &rarr; {change.new || 'null'}
                                        </p>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Removed Dealers List */}
                      {syncResult.changes.removed.length > 0 && autoApplied && (
                        <div className="border border-red-400 rounded-lg overflow-hidden">
                          <div className="bg-red-50 px-4 py-2 border-b border-red-400">
                            <p className="font-semibold text-red-800">Removed Dealers</p>
                          </div>
                          <div className="divide-y divide-red-200">
                            {syncResult.changes.removed.map((dealer) => (
                              <div key={dealer.dealer_no} className="p-3 bg-white">
                                <p className="font-medium text-gray-900">{dealer.dealer_name}</p>
                                <p className="text-sm text-gray-500">#{dealer.dealer_no}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* No Changes */}
                      {!hasChanges && !autoApplied && (
                        <div className="p-4 bg-green-50 border border-green-400 rounded-lg text-green-800 text-center">
                          Database is in sync with Excel. No changes needed.
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Cards */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Quick Navigation</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Posts Card */}
            <a
              href="/admin/posts"
              className="block p-6 bg-white border border-border rounded-lg shadow-sm hover:shadow hover:border-brand transition-all group"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-brand/10 rounded-lg flex items-center justify-center text-brand text-xl">
                  +
                </div>
                <h3 className="text-lg font-bold text-gray-900 group-hover:text-brand">Posts</h3>
              </div>
              <p className="text-sm text-gray-600">Create new posts, view existing posts, generate copy deck PDFs</p>
            </a>

            {/* Scheduling Card */}
            <a
              href="/admin/scheduling"
              className="block p-6 bg-white border border-border rounded-lg shadow-sm hover:shadow hover:border-brand transition-all group"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-brand/10 rounded-lg flex items-center justify-center text-brand text-xl">
                  &#9654;
                </div>
                <h3 className="text-lg font-bold text-gray-900 group-hover:text-brand">Scheduling</h3>
              </div>
              <p className="text-sm text-gray-600">FULL dealer operations: batch render, process emails, populate copy</p>
            </a>

            {/* Content Dealers Card */}
            <a
              href="/admin/content-dealers"
              className="block p-6 bg-white border border-border rounded-lg shadow-sm hover:shadow hover:border-brand transition-all group"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-brand/10 rounded-lg flex items-center justify-center text-brand text-xl">
                  &#9993;
                </div>
                <h3 className="text-lg font-bold text-gray-900 group-hover:text-brand">Content Dealers</h3>
              </div>
              <p className="text-sm text-gray-600">CONTENT dealer operations: mail merge for welcome emails</p>
            </a>

            {/* Dealer Review Card */}
            <a
              href="/admin/dealer-review"
              className="block p-6 bg-white border border-border rounded-lg shadow-sm hover:shadow hover:border-brand transition-all group"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-brand/10 rounded-lg flex items-center justify-center text-brand text-xl">
                  &#10003;
                </div>
                <h3 className="text-lg font-bold text-gray-900 group-hover:text-brand">Dealer Review</h3>
              </div>
              <p className="text-sm text-gray-600">Review and approve dealers promoted to FULL status</p>
            </a>

            {/* Email Templates Card */}
            <a
              href="/admin/email-templates"
              className="block p-6 bg-white border border-border rounded-lg shadow-sm hover:shadow hover:border-brand transition-all group"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-brand/10 rounded-lg flex items-center justify-center text-brand text-xl">
                  &#9998;
                </div>
                <h3 className="text-lg font-bold text-gray-900 group-hover:text-brand">Email Templates</h3>
              </div>
              <p className="text-sm text-gray-600">View and edit email templates for dealer communications</p>
            </a>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white border border-border rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-brand">124</p>
            <p className="text-sm text-gray-600">FULL Dealers</p>
          </div>
          <div className="bg-white border border-border rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-brand">656+</p>
            <p className="text-sm text-gray-600">Posts in Archive</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-green-600">100%</p>
            <p className="text-sm text-gray-600">Ready for Automation</p>
          </div>
        </div>
      </div>
  );
}
