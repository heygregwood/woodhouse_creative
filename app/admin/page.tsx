'use client';

import { useState, useEffect, useCallback } from 'react';

interface DoneDealer {
  dealer_no: string;
  first_name: string;
  email: string;
  column: number;
  col_letter: string;
  has_received_first_post: boolean;
  email_type: 'first_post' | 'post_scheduled';
}

interface SyncChanges {
  new: Array<{ dealer_no: string; dealer_name: string; program_status: string }>;
  removed: Array<{ dealer_no: string; dealer_name: string; program_status: string }>;
  updated: Array<{ dealer_no: string; dealer_name: string; changes: string[] }>;
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

interface BatchInput {
  postNumber: string;
  templateId: string;
}

export default function CreativeAdminPage() {
  // Render State - now supports multiple batches
  const [batchInputs, setBatchInputs] = useState<BatchInput[]>([
    { postNumber: '', templateId: '' }
  ]);
  const [rendering, setRendering] = useState(false);
  const [renderResult, setRenderResult] = useState<any>(null);
  const [batchIds, setBatchIds] = useState<string[]>([]);
  const [batchStatuses, setBatchStatuses] = useState<Record<string, any>>({});

  // Excel Sync State
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  // Process Done State
  const [doneDealers, setDoneDealers] = useState<DoneDealer[]>([]);
  const [loadingDone, setLoadingDone] = useState(false);
  const [processingDealer, setProcessingDealer] = useState<string | null>(null);
  const [processResults, setProcessResults] = useState<Record<string, { success: boolean; error?: string }>>({});

  // Populate Post Copy State
  const [populatePostNumber, setPopulatePostNumber] = useState('');
  const [populateBaseCopy, setPopulateBaseCopy] = useState('');
  const [populateLoading, setPopulateLoading] = useState(false);
  const [populateResult, setPopulateResult] = useState<{
    success?: boolean;
    error?: string;
    dryRun?: boolean;
    baseCopy?: string;
    totalDealers?: number;
    totalUpdated?: number;
    preview?: { dealerNo: string; name: string; copy: string }[];
    message?: string;
  } | null>(null);

  // Insert variable at cursor position
  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('baseCopyTextarea') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText = populateBaseCopy.substring(0, start) + variable + populateBaseCopy.substring(end);
      setPopulateBaseCopy(newText);
      // Restore focus and cursor position after the inserted text
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    } else {
      setPopulateBaseCopy(populateBaseCopy + variable);
    }
  };

  // Fetch dealers with "Done" status
  const fetchDoneDealers = useCallback(async () => {
    try {
      setLoadingDone(true);
      const response = await fetch('/api/admin/process-done');
      const data = await response.json();
      if (data.success) {
        setDoneDealers(data.dealers || []);
      }
    } catch (error) {
      console.error('Failed to fetch done dealers:', error);
    } finally {
      setLoadingDone(false);
    }
  }, []);

  // Fetch active batches on mount
  const fetchActiveBatches = useCallback(async () => {
    try {
      const response = await fetch('/api/creative/active-batches');
      const data = await response.json();
      if (data.batches && data.batches.length > 0) {
        const ids = data.batches.map((b: any) => b.batchId);
        setBatchIds(ids);
        // Also fetch full status for each
        const statuses: Record<string, any> = {};
        for (const batch of data.batches) {
          statuses[batch.batchId] = {
            postNumber: batch.postNumber,
            status: batch.status,
            progress: {
              total: batch.totalJobs,
              completed: batch.completedJobs,
              failed: batch.failedJobs,
              pending: batch.pendingJobs,
              processing: batch.processingJobs,
            },
          };
        }
        setBatchStatuses(statuses);
      }
    } catch (error) {
      console.error('Failed to fetch active batches:', error);
    }
  }, []);

  // Load done dealers and active batches on mount
  useEffect(() => {
    fetchDoneDealers();
    fetchActiveBatches();
  }, [fetchDoneDealers, fetchActiveBatches]);

  // Process a single dealer
  const handleProcessDealer = async (dealer: DoneDealer) => {
    setProcessingDealer(dealer.dealer_no);
    try {
      const response = await fetch('/api/admin/process-done', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealer_no: dealer.dealer_no,
          email_type: dealer.email_type,
        }),
      });
      const data = await response.json();
      setProcessResults((prev) => ({
        ...prev,
        [dealer.dealer_no]: { success: data.success, error: data.error },
      }));
      if (data.success) {
        // Remove from list after success
        setDoneDealers((prev) => prev.filter((d) => d.dealer_no !== dealer.dealer_no));
      }
    } catch (error) {
      setProcessResults((prev) => ({
        ...prev,
        [dealer.dealer_no]: { success: false, error: 'Network error' },
      }));
    } finally {
      setProcessingDealer(null);
    }
  };

  // Process all dealers with rate limiting (Resend allows 2 req/sec)
  const handleProcessAll = async () => {
    for (let i = 0; i < doneDealers.length; i++) {
      await handleProcessDealer(doneDealers[i]);
      // Wait 600ms between emails to stay under 2 req/sec limit
      if (i < doneDealers.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    }
  };

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

  // Add a new batch input row
  const handleAddBatch = () => {
    setBatchInputs([...batchInputs, { postNumber: '', templateId: '' }]);
  };

  // Remove a batch input row
  const handleRemoveBatch = (index: number) => {
    if (batchInputs.length > 1) {
      setBatchInputs(batchInputs.filter((_, i) => i !== index));
    }
  };

  // Update a batch input
  const handleBatchChange = (index: number, field: 'postNumber' | 'templateId', value: string) => {
    const newInputs = [...batchInputs];
    newInputs[index][field] = value;
    setBatchInputs(newInputs);
  };

  // Start batch render (supports multiple batches)
  const handleStartRender = async () => {
    // Filter out empty rows
    const validBatches = batchInputs.filter(b => b.postNumber && b.templateId);

    if (validBatches.length === 0) {
      setRenderResult({ error: 'Please enter at least one post number and template ID' });
      return;
    }

    try {
      setRendering(true);
      setRenderResult(null);
      setBatchStatuses({});

      const response = await fetch('/api/creative/render-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batches: validBatches.map(b => ({
            postNumber: parseInt(b.postNumber),
            templateId: b.templateId,
          })),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setRenderResult(data);
        // Store all batch IDs for status tracking
        const ids = data.batches?.filter((b: any) => b.batchId).map((b: any) => b.batchId) || [];
        setBatchIds(ids);
      } else {
        setRenderResult({ error: data.error || 'Failed to start render' });
      }
    } catch (error) {
      setRenderResult({
        error: error instanceof Error ? error.message : 'Failed to start render',
      });
    } finally {
      setRendering(false);
    }
  };

  // Check status for all batches
  const handleCheckStatus = async () => {
    if (batchIds.length === 0) return;

    const statuses: Record<string, any> = {};
    for (const batchId of batchIds) {
      try {
        const response = await fetch(`/api/creative/render-batch?batchId=${batchId}`);
        const data = await response.json();
        if (response.ok) {
          statuses[batchId] = data;
        } else {
          statuses[batchId] = { error: data.error || 'Failed to get status' };
        }
      } catch (error) {
        statuses[batchId] = {
          error: error instanceof Error ? error.message : 'Failed to get status',
        };
      }
    }
    setBatchStatuses(statuses);
  };

  // Preview post copy population
  const handlePreviewPopulate = async () => {
    if (!populatePostNumber || !populateBaseCopy) return;

    try {
      setPopulateLoading(true);
      setPopulateResult(null);

      const response = await fetch('/api/admin/populate-post-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postNumber: parseInt(populatePostNumber),
          baseCopy: populateBaseCopy,
          dryRun: true,
        }),
      });
      const data = await response.json();
      setPopulateResult(data);
    } catch (error) {
      setPopulateResult({
        error: error instanceof Error ? error.message : 'Failed to preview',
      });
    } finally {
      setPopulateLoading(false);
    }
  };

  // Execute post copy population
  const handlePopulatePostCopy = async () => {
    if (!populatePostNumber || !populateBaseCopy) return;

    try {
      setPopulateLoading(true);

      const response = await fetch('/api/admin/populate-post-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postNumber: parseInt(populatePostNumber),
          baseCopy: populateBaseCopy,
        }),
      });
      const data = await response.json();
      setPopulateResult(data);
    } catch (error) {
      setPopulateResult({
        error: error instanceof Error ? error.message : 'Failed to populate',
      });
    } finally {
      setPopulateLoading(false);
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#5378a8] text-white py-6 px-8 border-b-4 border-[#c87a3e]">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Woodhouse Creative Automation</h1>
            <p className="text-[#d7e7fd] mt-1">124 FULL dealers ready for automation</p>
          </div>
          <div className="flex gap-3">
            <a
              href="/admin/posts"
              className="px-4 py-2 bg-[#c87a3e] rounded-lg hover:bg-[#b36a35] transition-colors font-medium"
            >
              Post Workflow
            </a>
            <a
              href="/admin/email-templates"
              className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors font-medium"
            >
              Email Templates
            </a>
            <a
              href="/admin/dealer-review"
              className="px-4 py-2 bg-yellow-400 text-yellow-900 rounded-lg hover:bg-yellow-300 transition-colors font-medium"
            >
              Dealer Review
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Excel Sync */}
          <div>
            <div className="bg-white border-2 border-[#5378a8] rounded-lg shadow-lg overflow-hidden">
              <div className="bg-[#74a9de] px-6 py-4 border-b-2 border-[#5378a8]">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-bold text-black">Sync from Allied Excel</h2>
                    <p className="text-sm text-black/70 mt-1">Check for new/changed dealers</p>
                  </div>
                  <a
                    href="https://woodhouseagency-my.sharepoint.com/:x:/p/greg/IQBRuqg2XiXNTIVnn6BLkArzAXUD3DR-8K3nxhQADxWtoP4?e=0MwJgK"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-2 py-1 bg-white/50 hover:bg-white/80 rounded text-black/70 hover:text-black transition-colors"
                  >
                    Open Excel
                  </a>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <button
                  onClick={handleCheckExcel}
                  disabled={syncing}
                  className="w-full px-6 py-3 bg-[#5378a8] text-white rounded-lg hover:bg-[#4a6890] disabled:bg-gray-300 disabled:cursor-not-allowed font-semibold transition-colors"
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
                                const wasPromoted = dealer.changes?.some(c => c.includes('program_status') && c.includes('FULL') && (c.includes('CONTENT') || c.includes('NEW')));
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
                                            {change}
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

          {/* Right Column: Batch Render */}
          <div>
            <div className="bg-white border-2 border-[#5378a8] rounded-lg shadow-lg overflow-hidden">
              <div className="bg-[#c87a3e] px-6 py-4 border-b-2 border-[#000000]">
                <h2 className="text-xl font-bold text-white">Batch Video Render</h2>
                <p className="text-sm text-white/90 mt-1">Render videos via Creatomate</p>
              </div>

              <div className="p-6 space-y-4">
                {/* Batch Inputs - Multiple rows */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="block text-sm font-medium text-gray-700">
                      Post Number &amp; Template ID
                    </label>
                    <button
                      onClick={handleAddBatch}
                      className="text-sm px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-600"
                    >
                      + Add Row
                    </button>
                  </div>

                  {batchInputs.map((batch, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <input
                        type="number"
                        className="w-24 p-2 border-2 border-gray-300 rounded-lg focus:border-[#5378a8] focus:ring-2 focus:ring-[#5378a8]/20 outline-none text-sm"
                        value={batch.postNumber}
                        onChange={(e) => handleBatchChange(index, 'postNumber', e.target.value)}
                        placeholder="Post #"
                      />
                      <input
                        type="text"
                        className="flex-1 p-2 border-2 border-gray-300 rounded-lg font-mono text-xs focus:border-[#5378a8] focus:ring-2 focus:ring-[#5378a8]/20 outline-none"
                        value={batch.templateId}
                        onChange={(e) => handleBatchChange(index, 'templateId', e.target.value)}
                        placeholder="Creatomate Template ID"
                      />
                      {batchInputs.length > 1 && (
                        <button
                          onClick={() => handleRemoveBatch(index)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded"
                        >
                          &times;
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Render Button */}
                <button
                  onClick={handleStartRender}
                  disabled={rendering || batchInputs.every(b => !b.postNumber || !b.templateId)}
                  className="w-full px-6 py-3 bg-[#c87a3e] text-white rounded-lg hover:bg-[#b36a35] disabled:bg-gray-300 disabled:cursor-not-allowed font-semibold transition-colors"
                >
                  {rendering ? 'Starting Render...' : `Start Batch Render (${batchInputs.filter(b => b.postNumber && b.templateId).length} post${batchInputs.filter(b => b.postNumber && b.templateId).length !== 1 ? 's' : ''})`}
                </button>

                {/* Render Result */}
                {renderResult && (
                  <div
                    className={`p-4 rounded-lg ${
                      renderResult.error
                        ? 'bg-red-50 border border-red-500 text-red-800'
                        : 'bg-green-50 border border-green-500 text-green-800'
                    }`}
                  >
                    {renderResult.error ? (
                      <>
                        <p className="font-medium">Error</p>
                        <p className="text-sm mt-1">{renderResult.error}</p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium mb-2">{renderResult.message}</p>
                        <p className="text-sm mb-2">Dealers: {renderResult.dealerCount}</p>
                        <div className="space-y-1">
                          {renderResult.batches?.map((b: any) => (
                            <div key={b.postNumber} className="text-sm flex justify-between items-center bg-green-100 px-2 py-1 rounded">
                              <span>Post {b.postNumber}</span>
                              <span className={b.status === 'queued' ? 'text-green-700' : 'text-yellow-700'}>
                                {b.status === 'queued' ? `${b.jobsCreated} jobs` : b.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Batch Status */}
                {batchIds.length > 0 && (
                  <div className="border border-[#5378a8] rounded-lg p-4 bg-[#d7e7fd]">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-bold text-gray-900">Status ({batchIds.length} batch{batchIds.length !== 1 ? 'es' : ''})</h3>
                      <button
                        onClick={handleCheckStatus}
                        className="px-3 py-1 bg-[#5378a8] text-white rounded text-sm hover:bg-[#4a6890]"
                      >
                        Refresh
                      </button>
                    </div>

                    <div className="space-y-3">
                      {batchIds.map((batchId) => {
                        const status = batchStatuses[batchId];
                        return (
                          <div key={batchId} className="bg-white rounded-lg p-3">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-medium text-gray-900">Post {status?.postNumber || '...'}</span>
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                status?.status === 'completed' ? 'bg-green-100 text-green-700' :
                                status?.status === 'failed' ? 'bg-red-100 text-red-700' :
                                'bg-yellow-100 text-yellow-700'
                              }`}>
                                {status?.status || 'loading'}
                              </span>
                            </div>
                            {status && !status.error && status.progress && (
                              <div className="grid grid-cols-4 gap-2">
                                <div className="text-center">
                                  <p className="text-lg font-bold text-[#5378a8]">{status.progress.total}</p>
                                  <p className="text-xs text-gray-500">Total</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-lg font-bold text-green-600">{status.progress.completed}</p>
                                  <p className="text-xs text-gray-500">Done</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-lg font-bold text-yellow-600">{status.progress.pending + status.progress.processing}</p>
                                  <p className="text-xs text-gray-500">Pending</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-lg font-bold text-red-600">{status.progress.failed}</p>
                                  <p className="text-xs text-gray-500">Failed</p>
                                </div>
                              </div>
                            )}
                            {status?.error && (
                              <p className="text-sm text-red-600">{status.error}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Populate Post Copy Section */}
        <div className="mt-6">
          <div className="bg-white border-2 border-purple-500 rounded-lg shadow-lg overflow-hidden">
            <div className="bg-purple-500 px-6 py-4 border-b-2 border-purple-600">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-white">Populate Post Copy</h2>
                  <p className="text-sm text-white/90 mt-1">
                    Fill in personalized copy for all dealers in the scheduling spreadsheet
                  </p>
                </div>
                <a
                  href="https://docs.google.com/spreadsheets/d/1KuyojiujcaxmyJeBIxExG87W2AwM3LM1awqWO9u44PY"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded text-white transition-colors"
                >
                  Open Spreadsheet
                </a>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Post Number */}
              <div className="flex gap-3 items-end">
                <div className="w-32">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Post #
                  </label>
                  <input
                    type="number"
                    className="w-full p-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none"
                    value={populatePostNumber}
                    onChange={(e) => setPopulatePostNumber(e.target.value)}
                    placeholder="666"
                  />
                </div>
              </div>

              {/* Base Copy Textarea */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Post Copy
                  </label>
                  <div className="flex gap-1">
                    <span className="text-xs text-gray-500 mr-2">Insert:</span>
                    <button
                      type="button"
                      onClick={() => insertVariable('{name}')}
                      className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors font-medium"
                    >
                      Name
                    </button>
                    <button
                      type="button"
                      onClick={() => insertVariable('{phone}')}
                      className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors font-medium"
                    >
                      Phone
                    </button>
                    <button
                      type="button"
                      onClick={() => insertVariable('{website}')}
                      className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors font-medium"
                    >
                      Website
                    </button>
                  </div>
                </div>
                <textarea
                  id="baseCopyTextarea"
                  className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none resize-none"
                  rows={4}
                  value={populateBaseCopy}
                  onChange={(e) => setPopulateBaseCopy(e.target.value)}
                  placeholder="Enter post copy here. Use the buttons above to insert variables like {name}, {phone}, or {website}."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Variables will be replaced with each dealer&apos;s values: <code className="bg-purple-100 px-1 rounded">{'{name}'}</code> = Display Name, <code className="bg-blue-100 px-1 rounded">{'{phone}'}</code> = Phone, <code className="bg-green-100 px-1 rounded">{'{website}'}</code> = Website
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handlePreviewPopulate}
                  disabled={populateLoading || !populatePostNumber || !populateBaseCopy}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 font-medium transition-colors"
                >
                  {populateLoading ? 'Loading...' : 'Preview'}
                </button>
                <button
                  onClick={handlePopulatePostCopy}
                  disabled={populateLoading || !populatePostNumber || !populateBaseCopy}
                  className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-gray-300 font-medium transition-colors"
                >
                  {populateLoading ? 'Populating...' : 'Populate All Dealers'}
                </button>
              </div>

              {/* Result */}
              {populateResult && (
                <div>
                  {populateResult.error ? (
                    <div className="p-4 bg-red-50 border border-red-500 rounded-lg text-red-800">
                      <p className="font-medium">Error</p>
                      <p className="text-sm mt-1">{populateResult.error}</p>
                    </div>
                  ) : (
                    <div className={`p-4 rounded-lg ${populateResult.dryRun ? 'bg-purple-50 border border-purple-400' : 'bg-green-50 border border-green-500'}`}>
                      <p className={`font-medium ${populateResult.dryRun ? 'text-purple-800' : 'text-green-800'}`}>
                        {populateResult.dryRun ? 'Preview' : 'Success!'}
                      </p>
                      <p className={`text-sm mt-1 ${populateResult.dryRun ? 'text-purple-700' : 'text-green-700'}`}>
                        {populateResult.message}
                      </p>

                      {populateResult.preview && populateResult.preview.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-medium text-gray-500 mb-2">Sample Output (first 5 dealers):</p>
                          <div className="space-y-2">
                            {populateResult.preview.map((item) => (
                              <div key={item.dealerNo} className="p-2 bg-white rounded border border-gray-200">
                                <p className="text-xs font-medium text-gray-600">{item.name} ({item.dealerNo})</p>
                                <p className="text-sm text-gray-800 mt-0.5">{item.copy}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mt-6 grid grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-[#5378a8]">124</p>
            <p className="text-sm text-gray-600">FULL Dealers</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-[#c87a3e]">656+</p>
            <p className="text-sm text-gray-600">Posts in Archive</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-green-600">100%</p>
            <p className="text-sm text-gray-600">Ready for Automation</p>
          </div>
        </div>

        {/* Process Done Status Section */}
        <div className="mt-6">
          <div className="bg-white border-2 border-green-500 rounded-lg shadow-lg overflow-hidden">
            <div className="bg-green-500 px-6 py-4 border-b-2 border-green-600">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-white">Process Scheduled Emails</h2>
                  <p className="text-sm text-white/90 mt-1">
                    Send emails to dealers with &quot;Done&quot; status in the scheduling spreadsheet
                  </p>
                </div>
                <a
                  href="https://docs.google.com/spreadsheets/d/1KuyojiujcaxmyJeBIxExG87W2AwM3LM1awqWO9u44PY"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded text-white transition-colors"
                >
                  Open Spreadsheet
                </a>
              </div>
            </div>

            <div className="p-6">
              {/* Action buttons */}
              <div className="flex gap-3 mb-4">
                <button
                  onClick={fetchDoneDealers}
                  disabled={loadingDone}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 font-medium transition-colors"
                >
                  {loadingDone ? 'Checking...' : 'Refresh'}
                </button>
                {doneDealers.length > 0 && (
                  <button
                    onClick={handleProcessAll}
                    disabled={processingDealer !== null}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 font-medium transition-colors"
                  >
                    Process All ({doneDealers.length})
                  </button>
                )}
              </div>

              {/* Status */}
              {loadingDone ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-2"></div>
                  Checking spreadsheet...
                </div>
              ) : doneDealers.length === 0 ? (
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                  <p className="text-lg font-medium">No dealers with &quot;Done&quot; status</p>
                  <p className="text-sm mt-1">When Olivia marks dealers as &quot;Done&quot; in the spreadsheet, they&apos;ll appear here.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {doneDealers.map((dealer) => {
                    const result = processResults[dealer.dealer_no];
                    const isProcessing = processingDealer === dealer.dealer_no;

                    return (
                      <div
                        key={dealer.dealer_no}
                        className={`flex items-center justify-between p-4 rounded-lg border ${
                          result?.success
                            ? 'bg-green-50 border-green-300'
                            : result?.error
                            ? 'bg-red-50 border-red-300'
                            : 'bg-white border-gray-200'
                        }`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-sm text-gray-500">#{dealer.dealer_no}</span>
                            <span className="font-medium text-gray-900">{dealer.first_name}</span>
                            <span className="text-gray-400">|</span>
                            <span className="text-sm text-gray-600">{dealer.email}</span>
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <span
                              className={`text-xs px-2 py-0.5 rounded ${
                                dealer.email_type === 'first_post'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-purple-100 text-purple-700'
                              }`}
                            >
                              {dealer.email_type === 'first_post' ? 'First Post' : 'Post Scheduled'}
                            </span>
                            <span className="text-xs text-gray-400">Column {dealer.col_letter}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {result?.success ? (
                            <span className="text-green-600 font-medium">Sent!</span>
                          ) : result?.error ? (
                            <span className="text-red-600 text-sm">{result.error}</span>
                          ) : (
                            <button
                              onClick={() => handleProcessDealer(dealer)}
                              disabled={isProcessing || processingDealer !== null}
                              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 font-medium transition-colors text-sm"
                            >
                              {isProcessing ? 'Sending...' : 'Send Email'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
