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

interface DealerStatus {
  dealerNo: string;
  displayName: string;
  status: 'Pending' | 'Done' | 'Email Sent';
  lastPostDate: string;
  whoPosted: string;
  email: string;
  region: string;
}

interface EmailDeliveryStatus {
  email: string;
  latest_event: string | null;
  latest_event_at: string | null;
  events: {
    sent?: string;
    delivered?: string;
    opened?: string;
    clicked?: string;
    bounced?: string;
    complained?: string;
  };
}

interface SpreadsheetStatus {
  dealers: DealerStatus[];
  postInfo: {
    postNumber: string;
    baseCopy: string;
  } | null;
}

interface BatchInput {
  postNumber: string;
  templateId: string;
}

interface RenderBatchItem {
  postNumber: number;
  batchId?: string;
  status: string;
  jobsCreated?: number;
}

interface RenderResult {
  error?: string;
  message?: string;
  dealerCount?: number;
  batches?: RenderBatchItem[];
}

interface BatchStatusProgress {
  total: number;
  completed: number;
  failed: number;
  pending: number;
  processing: number;
}

interface BatchStatusInfo {
  postNumber?: string;
  status?: string;
  progress?: BatchStatusProgress;
  error?: string;
}

export default function SchedulingPage() {
  // Spreadsheet status state
  const [spreadsheetStatus, setSpreadsheetStatus] = useState<SpreadsheetStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Email delivery status state
  const [emailStatuses, setEmailStatuses] = useState<Record<string, EmailDeliveryStatus>>({});

  // Process Done State
  const [doneDealers, setDoneDealers] = useState<DoneDealer[]>([]);
  const [loadingDone, setLoadingDone] = useState(false);
  const [processingDealer, setProcessingDealer] = useState<string | null>(null);
  const [processResults, setProcessResults] = useState<Record<string, { success: boolean; error?: string }>>({});

  // Batch Render State
  const [batchInputs, setBatchInputs] = useState<BatchInput[]>([{ postNumber: '', templateId: '' }]);
  const [rendering, setRendering] = useState(false);
  const [renderResult, setRenderResult] = useState<RenderResult | null>(null);
  const [batchIds, setBatchIds] = useState<string[]>([]);
  const [batchStatuses, setBatchStatuses] = useState<Record<string, BatchStatusInfo>>({});

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

  // Sorting state for dealer table
  type SortField = 'dealer' | 'region' | 'status' | 'email' | 'lastPost' | 'postedBy';
  type SortDirection = 'asc' | 'desc';
  const [sortField, setSortField] = useState<SortField>('dealer');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Fetch email delivery status for a list of emails
  const fetchEmailStatuses = useCallback(async (emails: string[]) => {
    if (emails.length === 0) return;
    try {
      const response = await fetch(`/api/admin/email-status?emails=${encodeURIComponent(emails.join(','))}`);
      if (!response.ok) return;
      const text = await response.text();
      if (!text) return;
      const data = JSON.parse(text);
      if (data.success && data.statuses) {
        const statusMap: Record<string, EmailDeliveryStatus> = {};
        for (const status of data.statuses) {
          statusMap[status.email.toLowerCase()] = status;
        }
        setEmailStatuses(statusMap);
      }
    } catch (error) {
      console.error('Failed to fetch email statuses:', error);
    }
  }, []);

  // Fetch current spreadsheet status
  const fetchSpreadsheetStatus = useCallback(async () => {
    try {
      setLoadingStatus(true);
      setStatusError(null);
      const response = await fetch('/api/admin/spreadsheet-status');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch status');
      setSpreadsheetStatus(data);
      if (data.dealers && data.dealers.length > 0) {
        const emails = data.dealers
          .map((d: DealerStatus) => d.email)
          .filter((e: string) => e && e.includes('@'));
        fetchEmailStatuses(emails);
      }
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : 'Failed to fetch status');
    } finally {
      setLoadingStatus(false);
    }
  }, [fetchEmailStatuses]);

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
        const ids = data.batches.map((b: { batchId: string }) => b.batchId);
        setBatchIds(ids);
        const statuses: Record<string, BatchStatusInfo> = {};
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

  // Load data on mount
  useEffect(() => {
    fetchSpreadsheetStatus();
    fetchDoneDealers();
    fetchActiveBatches();
  }, [fetchSpreadsheetStatus, fetchDoneDealers, fetchActiveBatches]);

  // Auto-refresh status every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchSpreadsheetStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchSpreadsheetStatus]);

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

  // Process all dealers with rate limiting
  const handleProcessAll = async () => {
    for (let i = 0; i < doneDealers.length; i++) {
      await handleProcessDealer(doneDealers[i]);
      if (i < doneDealers.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    }
  };

  // Batch render functions
  const handleAddBatch = () => setBatchInputs([...batchInputs, { postNumber: '', templateId: '' }]);
  const handleRemoveBatch = (index: number) => {
    if (batchInputs.length > 1) setBatchInputs(batchInputs.filter((_, i) => i !== index));
  };
  const handleBatchChange = (index: number, field: 'postNumber' | 'templateId', value: string) => {
    const newInputs = [...batchInputs];
    newInputs[index][field] = value;
    setBatchInputs(newInputs);
  };

  const handleStartRender = async () => {
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
        const ids = data.batches?.filter((b: RenderBatchItem) => b.batchId).map((b: RenderBatchItem) => b.batchId as string) || [];
        setBatchIds(ids);
      } else {
        setRenderResult({ error: data.error || 'Failed to start render' });
      }
    } catch (error) {
      setRenderResult({ error: error instanceof Error ? error.message : 'Failed to start render' });
    } finally {
      setRendering(false);
    }
  };

  const handleCheckStatus = async () => {
    if (batchIds.length === 0) return;
    const statuses: Record<string, BatchStatusInfo> = {};
    for (const batchId of batchIds) {
      try {
        const response = await fetch(`/api/creative/render-batch?batchId=${batchId}`);
        const data = await response.json();
        statuses[batchId] = response.ok ? data : { error: data.error || 'Failed to get status' };
      } catch (error) {
        statuses[batchId] = { error: error instanceof Error ? error.message : 'Failed to get status' };
      }
    }
    setBatchStatuses(statuses);
  };

  // Populate post copy functions
  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('baseCopyTextarea') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText = populateBaseCopy.substring(0, start) + variable + populateBaseCopy.substring(end);
      setPopulateBaseCopy(newText);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    } else {
      setPopulateBaseCopy(populateBaseCopy + variable);
    }
  };

  const handlePreviewPopulate = async () => {
    if (!populatePostNumber || !populateBaseCopy) return;
    try {
      setPopulateLoading(true);
      setPopulateResult(null);
      const response = await fetch('/api/admin/populate-post-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postNumber: parseInt(populatePostNumber), baseCopy: populateBaseCopy, dryRun: true }),
      });
      setPopulateResult(await response.json());
    } catch (error) {
      setPopulateResult({ error: error instanceof Error ? error.message : 'Failed to preview' });
    } finally {
      setPopulateLoading(false);
    }
  };

  const handlePopulatePostCopy = async () => {
    if (!populatePostNumber || !populateBaseCopy) return;
    try {
      setPopulateLoading(true);
      const response = await fetch('/api/admin/populate-post-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postNumber: parseInt(populatePostNumber), baseCopy: populateBaseCopy }),
      });
      setPopulateResult(await response.json());
    } catch (error) {
      setPopulateResult({ error: error instanceof Error ? error.message : 'Failed to populate' });
    } finally {
      setPopulateLoading(false);
    }
  };

  // Sorting functions
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const parsePostDate = (dateStr: string): Date | null => {
    if (!dateStr || dateStr === '-') return null;
    const match = dateStr.match(/(\d{1,2})-(\w{3})/);
    if (match) {
      const day = parseInt(match[1]);
      const monthStr = match[2];
      const months: Record<string, number> = {
        'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
        'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
      };
      const month = months[monthStr];
      if (month !== undefined) {
        const now = new Date();
        let year = now.getFullYear();
        if (month > now.getMonth() + 1) year--;
        return new Date(year, month, day);
      }
    }
    return null;
  };

  const sortedDealers = spreadsheetStatus?.dealers ? [...spreadsheetStatus.dealers].sort((a, b) => {
    let comparison = 0;
    switch (sortField) {
      case 'dealer': comparison = (a.displayName || '').localeCompare(b.displayName || ''); break;
      case 'region': comparison = (a.region || '').localeCompare(b.region || ''); break;
      case 'status':
        const statusOrder: Record<string, number> = { 'Pending': 0, 'Done': 1, 'Email Sent': 2 };
        comparison = (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3);
        break;
      case 'email':
        const aStatus = emailStatuses[a.email?.toLowerCase()]?.latest_event_at;
        const bStatus = emailStatuses[b.email?.toLowerCase()]?.latest_event_at;
        if (!aStatus && !bStatus) comparison = 0;
        else if (!aStatus) comparison = 1;
        else if (!bStatus) comparison = -1;
        else comparison = new Date(bStatus).getTime() - new Date(aStatus).getTime();
        break;
      case 'lastPost':
        const aDate = parsePostDate(a.lastPostDate);
        const bDate = parsePostDate(b.lastPostDate);
        if (!aDate && !bDate) comparison = 0;
        else if (!aDate) comparison = 1;
        else if (!bDate) comparison = -1;
        else comparison = bDate.getTime() - aDate.getTime();
        break;
      case 'postedBy': comparison = (a.whoPosted || '').localeCompare(b.whoPosted || ''); break;
    }
    return sortDirection === 'asc' ? comparison : -comparison;
  }) : [];

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="text-gray-300 ml-1">↕</span>;
    return <span className="text-[#5378a8] ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

  const statusCounts = spreadsheetStatus?.dealers.reduce(
    (acc, dealer) => { acc[dealer.status] = (acc[dealer.status] || 0) + 1; return acc; },
    {} as Record<string, number>
  ) || {};

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#5378a8] text-white py-6 px-8 border-b-4 border-[#c87a3e]">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold">Scheduling</h1>
          </div>
          <div className="flex gap-3">
            <a href="/admin" className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors font-medium">Dashboard</a>
            <a href="/admin/posts" className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors font-medium">Posts</a>
            <a href="/admin/scheduling" className="px-4 py-2 bg-white/40 rounded-lg hover:bg-white/50 transition-colors font-medium">Scheduling</a>
            <a href="/admin/content-dealers" className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors font-medium">Content Dealers</a>
            <a href="/admin/dealer-review" className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors font-medium">Dealer Review</a>
            <a href="/admin/email-templates" className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors font-medium">Email Templates</a>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-8">
        {/* Status Summary Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-yellow-700">{statusCounts['Pending'] || 0}</p>
            <p className="text-sm font-medium text-yellow-800">Pending</p>
          </div>
          <div className="bg-green-50 border-2 border-green-400 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-green-700">{statusCounts['Done'] || 0}</p>
            <p className="text-sm font-medium text-green-800">Done</p>
          </div>
          <div className="bg-blue-50 border-2 border-blue-400 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-blue-700">{statusCounts['Email Sent'] || 0}</p>
            <p className="text-sm font-medium text-blue-800">Email Sent</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Process Scheduled Emails */}
          <div className="bg-white border-2 border-green-500 rounded-lg shadow-lg overflow-hidden">
            <div className="bg-green-500 px-6 py-4 border-b-2 border-green-600">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-white">Process Scheduled Emails</h2>
                  <p className="text-sm text-white/90 mt-1">Send emails to dealers with &quot;Done&quot; status</p>
                </div>
                <a href="https://docs.google.com/spreadsheets/d/1KuyojiujcaxmyJeBIxExG87W2AwM3LM1awqWO9u44PY" target="_blank" rel="noopener noreferrer" className="text-xs px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded text-white transition-colors">Open Spreadsheet</a>
              </div>
            </div>
            <div className="p-6">
              <div className="flex gap-3 mb-4">
                <button onClick={fetchDoneDealers} disabled={loadingDone} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 font-medium transition-colors">
                  {loadingDone ? 'Checking...' : 'Refresh'}
                </button>
                {doneDealers.length > 0 && (
                  <button onClick={handleProcessAll} disabled={processingDealer !== null} className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 font-medium transition-colors">
                    Process All ({doneDealers.length})
                  </button>
                )}
              </div>
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
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {doneDealers.map((dealer) => {
                    const result = processResults[dealer.dealer_no];
                    const isProcessing = processingDealer === dealer.dealer_no;
                    return (
                      <div key={dealer.dealer_no} className={`flex items-center justify-between p-4 rounded-lg border ${result?.success ? 'bg-green-50 border-green-300' : result?.error ? 'bg-red-50 border-red-300' : 'bg-white border-gray-200'}`}>
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-sm text-gray-500">#{dealer.dealer_no}</span>
                            <span className="font-medium text-gray-900">{dealer.first_name}</span>
                            <span className="text-gray-400">|</span>
                            <span className="text-sm text-gray-600">{dealer.email}</span>
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded ${dealer.email_type === 'first_post' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
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
                            <button onClick={() => handleProcessDealer(dealer)} disabled={isProcessing || processingDealer !== null} className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 font-medium transition-colors text-sm">
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

          {/* Batch Video Render */}
          <div className="bg-white border-2 border-[#5378a8] rounded-lg shadow-lg overflow-hidden">
            <div className="bg-[#c87a3e] px-6 py-4 border-b-2 border-[#000000]">
              <h2 className="text-xl font-bold text-white">Batch Video Render</h2>
              <p className="text-sm text-white/90 mt-1">Render videos via Creatomate</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="block text-sm font-medium text-gray-700">Post Number &amp; Template ID</label>
                  <button onClick={handleAddBatch} className="text-sm px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-600">+ Add Row</button>
                </div>
                {batchInputs.map((batch, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <input type="number" className="w-24 p-2 border-2 border-gray-300 rounded-lg focus:border-[#5378a8] focus:ring-2 focus:ring-[#5378a8]/20 outline-none text-sm" value={batch.postNumber} onChange={(e) => handleBatchChange(index, 'postNumber', e.target.value)} placeholder="Post #" />
                    <input type="text" className="flex-1 p-2 border-2 border-gray-300 rounded-lg font-mono text-xs focus:border-[#5378a8] focus:ring-2 focus:ring-[#5378a8]/20 outline-none" value={batch.templateId} onChange={(e) => handleBatchChange(index, 'templateId', e.target.value)} placeholder="Creatomate Template ID" />
                    {batchInputs.length > 1 && (
                      <button onClick={() => handleRemoveBatch(index)} className="p-2 text-red-500 hover:bg-red-50 rounded">&times;</button>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={handleStartRender} disabled={rendering || batchInputs.every(b => !b.postNumber || !b.templateId)} className="w-full px-6 py-3 bg-[#c87a3e] text-white rounded-lg hover:bg-[#b36a35] disabled:bg-gray-300 disabled:cursor-not-allowed font-semibold transition-colors">
                {rendering ? 'Starting Render...' : `Start Batch Render (${batchInputs.filter(b => b.postNumber && b.templateId).length} post${batchInputs.filter(b => b.postNumber && b.templateId).length !== 1 ? 's' : ''})`}
              </button>
              {renderResult && (
                <div className={`p-4 rounded-lg ${renderResult.error ? 'bg-red-50 border border-red-500 text-red-800' : 'bg-green-50 border border-green-500 text-green-800'}`}>
                  {renderResult.error ? (
                    <><p className="font-medium">Error</p><p className="text-sm mt-1">{renderResult.error}</p></>
                  ) : (
                    <><p className="font-medium mb-2">{renderResult.message}</p><p className="text-sm mb-2">Dealers: {renderResult.dealerCount}</p>
                      <div className="space-y-1">{renderResult.batches?.map((b: RenderBatchItem) => (
                        <div key={b.postNumber} className="text-sm flex justify-between items-center bg-green-100 px-2 py-1 rounded">
                          <span>Post {b.postNumber}</span>
                          <span className={b.status === 'queued' ? 'text-green-700' : 'text-yellow-700'}>{b.status === 'queued' ? `${b.jobsCreated} jobs` : b.status}</span>
                        </div>
                      ))}</div>
                    </>
                  )}
                </div>
              )}
              {batchIds.length > 0 && (
                <div className="border border-[#5378a8] rounded-lg p-4 bg-[#d7e7fd]">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-gray-900">Status ({batchIds.length} batch{batchIds.length !== 1 ? 'es' : ''})</h3>
                    <button onClick={handleCheckStatus} className="px-3 py-1 bg-[#5378a8] text-white rounded text-sm hover:bg-[#4a6890]">Refresh</button>
                  </div>
                  <div className="space-y-3">
                    {batchIds.map((batchId) => {
                      const status = batchStatuses[batchId];
                      return (
                        <div key={batchId} className="bg-white rounded-lg p-3">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium text-gray-900">Post {status?.postNumber || '...'}</span>
                            <span className={`text-xs px-2 py-0.5 rounded ${status?.status === 'completed' ? 'bg-green-100 text-green-700' : status?.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{status?.status || 'loading'}</span>
                          </div>
                          {status && !status.error && status.progress && (
                            <div className="grid grid-cols-4 gap-2">
                              <div className="text-center"><p className="text-lg font-bold text-[#5378a8]">{status.progress.total}</p><p className="text-xs text-gray-500">Total</p></div>
                              <div className="text-center"><p className="text-lg font-bold text-green-600">{status.progress.completed}</p><p className="text-xs text-gray-500">Done</p></div>
                              <div className="text-center"><p className="text-lg font-bold text-yellow-600">{status.progress.pending + status.progress.processing}</p><p className="text-xs text-gray-500">Pending</p></div>
                              <div className="text-center"><p className="text-lg font-bold text-red-600">{status.progress.failed}</p><p className="text-xs text-gray-500">Failed</p></div>
                            </div>
                          )}
                          {status?.error && <p className="text-sm text-red-600">{status.error}</p>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Populate Post Copy Section */}
        <div className="mb-6">
          <div className="bg-white border-2 border-purple-500 rounded-lg shadow-lg overflow-hidden">
            <div className="bg-purple-500 px-6 py-4 border-b-2 border-purple-600">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-white">Populate Post Copy</h2>
                  <p className="text-sm text-white/90 mt-1">Fill in personalized copy for all dealers in the scheduling spreadsheet</p>
                </div>
                <a href="https://docs.google.com/spreadsheets/d/1KuyojiujcaxmyJeBIxExG87W2AwM3LM1awqWO9u44PY" target="_blank" rel="noopener noreferrer" className="text-xs px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded text-white transition-colors">Open Spreadsheet</a>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex gap-3 items-end">
                <div className="w-32">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Post #</label>
                  <input type="number" className="w-full p-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none" value={populatePostNumber} onChange={(e) => setPopulatePostNumber(e.target.value)} placeholder="666" />
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-gray-700">Post Copy</label>
                  <div className="flex gap-1">
                    <span className="text-xs text-gray-500 mr-2">Insert:</span>
                    <button type="button" onClick={() => insertVariable('{name}')} className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors font-medium">Name</button>
                    <button type="button" onClick={() => insertVariable('{phone}')} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors font-medium">Phone</button>
                    <button type="button" onClick={() => insertVariable('{website}')} className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors font-medium">Website</button>
                  </div>
                </div>
                <textarea id="baseCopyTextarea" className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none resize-none" rows={4} value={populateBaseCopy} onChange={(e) => setPopulateBaseCopy(e.target.value)} placeholder="Enter post copy here. Use the buttons above to insert variables like {name}, {phone}, or {website}." />
                <p className="text-xs text-gray-500 mt-1">Variables will be replaced with each dealer&apos;s values: <code className="bg-purple-100 px-1 rounded">{'{name}'}</code> = Display Name, <code className="bg-blue-100 px-1 rounded">{'{phone}'}</code> = Phone, <code className="bg-green-100 px-1 rounded">{'{website}'}</code> = Website</p>
              </div>
              <div className="flex gap-3">
                <button onClick={handlePreviewPopulate} disabled={populateLoading || !populatePostNumber || !populateBaseCopy} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 font-medium transition-colors">{populateLoading ? 'Loading...' : 'Preview'}</button>
                <button onClick={handlePopulatePostCopy} disabled={populateLoading || !populatePostNumber || !populateBaseCopy} className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-gray-300 font-medium transition-colors">{populateLoading ? 'Populating...' : 'Populate All Dealers'}</button>
              </div>
              {populateResult && (
                <div>
                  {populateResult.error ? (
                    <div className="p-4 bg-red-50 border border-red-500 rounded-lg text-red-800"><p className="font-medium">Error</p><p className="text-sm mt-1">{populateResult.error}</p></div>
                  ) : (
                    <div className={`p-4 rounded-lg ${populateResult.dryRun ? 'bg-purple-50 border border-purple-400' : 'bg-green-50 border border-green-500'}`}>
                      <p className={`font-medium ${populateResult.dryRun ? 'text-purple-800' : 'text-green-800'}`}>{populateResult.dryRun ? 'Preview' : 'Success!'}</p>
                      <p className={`text-sm mt-1 ${populateResult.dryRun ? 'text-purple-700' : 'text-green-700'}`}>{populateResult.message}</p>
                      {populateResult.preview && populateResult.preview.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-medium text-gray-500 mb-2">Sample Output (first 5 dealers):</p>
                          <div className="space-y-2">{populateResult.preview.map((item) => (
                            <div key={item.dealerNo} className="p-2 bg-white rounded border border-gray-200">
                              <p className="text-xs font-medium text-gray-600">{item.name} ({item.dealerNo})</p>
                              <p className="text-sm text-gray-800 mt-0.5">{item.copy}</p>
                            </div>
                          ))}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Dealer Status Table */}
        <div className="bg-white border-2 border-[#5378a8] rounded-lg shadow-lg overflow-hidden">
          <div className="bg-[#74a9de] px-6 py-4 border-b-2 border-[#5378a8] flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-black">Dealer Status</h2>
              <p className="text-sm text-black/70 mt-1">{spreadsheetStatus?.dealers.length || 0} dealers</p>
            </div>
            <button onClick={fetchSpreadsheetStatus} disabled={loadingStatus} className="px-4 py-2 bg-white text-[#5378a8] rounded-lg hover:bg-gray-100 disabled:bg-gray-200 font-medium transition-colors">
              {loadingStatus ? 'Loading...' : 'Refresh'}
            </button>
          </div>
          {statusError && <div className="p-4 bg-red-50 text-red-800 border-b border-red-200">Error: {statusError}</div>}
          <div className="max-h-[600px] overflow-y-auto">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort('dealer')}>Dealer<SortIcon field="dealer" /></th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort('region')}>Region<SortIcon field="region" /></th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort('status')}>Status<SortIcon field="status" /></th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort('email')}>Email<SortIcon field="email" /></th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort('lastPost')}>Last Post<SortIcon field="lastPost" /></th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort('postedBy')}>Posted By<SortIcon field="postedBy" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sortedDealers.map((dealer) => (
                  <tr key={dealer.dealerNo} className="hover:bg-gray-50">
                    <td className="px-4 py-3"><div><p className="font-medium text-gray-900">{dealer.displayName}</p><p className="text-xs text-gray-500">{dealer.dealerNo}</p></div></td>
                    <td className="px-4 py-3"><span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${dealer.region === 'NORTH' ? 'bg-blue-100 text-blue-800' : dealer.region === 'SOUTH' ? 'bg-orange-100 text-orange-800' : 'bg-purple-100 text-purple-800'}`}>{dealer.region}</span></td>
                    <td className="px-4 py-3"><span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${dealer.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' : dealer.status === 'Done' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>{dealer.status}</span></td>
                    <td className="px-4 py-3">
                      {(() => {
                        const emailStatus = emailStatuses[dealer.email?.toLowerCase()];
                        if (!emailStatus?.latest_event) return <span className="text-xs text-gray-400">-</span>;
                        const event = emailStatus.latest_event.replace('email.', '');
                        const eventDate = emailStatus.latest_event_at ? new Date(emailStatus.latest_event_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
                        const eventColors: Record<string, string> = { 'delivered': 'bg-green-100 text-green-800', 'opened': 'bg-blue-100 text-blue-800', 'clicked': 'bg-purple-100 text-purple-800', 'bounced': 'bg-red-100 text-red-800', 'complained': 'bg-red-100 text-red-800', 'sent': 'bg-gray-100 text-gray-800' };
                        const colorClass = eventColors[event] || 'bg-gray-100 text-gray-800';
                        return (
                          <div className="flex flex-col gap-0.5">
                            <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${colorClass}`}>
                              {event === 'clicked' ? '📧 Clicked' : event === 'opened' ? '📖 Opened' : event === 'delivered' ? '✅ Delivered' : event === 'bounced' ? '❌ Bounced' : event === 'complained' ? '🚫 Spam' : event === 'sent' ? '📤 Sent' : event}
                            </span>
                            {eventDate && <span className="text-xs text-gray-400">{eventDate}</span>}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{dealer.lastPostDate || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{dealer.whoPosted || '-'}</td>
                  </tr>
                ))}
                {sortedDealers.length === 0 && !loadingStatus && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No dealers found. Check API connection.</td></tr>
                )}
                {loadingStatus && !spreadsheetStatus && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Loading dealer status...</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
