'use client';

import { useState, useEffect, useCallback } from 'react';

interface PostData {
  postNumber: string;
  templateId: string;
  baseCopy: string;
  season: string;
  subjectMatter: string;
  tag1: string;
  tag2: string;
  tag3: string;
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

export default function PostsPage() {
  // Post form state
  const [postData, setPostData] = useState<PostData>({
    postNumber: '',
    templateId: '',
    baseCopy: '',
    season: '',
    subjectMatter: '',
    tag1: '',
    tag2: '',
    tag3: '',
  });

  // Spreadsheet status state
  const [spreadsheetStatus, setSpreadsheetStatus] = useState<SpreadsheetStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Form submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string } | null>(null);

  // Auto-email state
  const [sendingEmails, setSendingEmails] = useState(false);
  const [emailProgress, setEmailProgress] = useState<{ sent: number; total: number; current: string } | null>(null);
  const [emailResult, setEmailResult] = useState<{ success: boolean; message: string; sent?: number } | null>(null);

  // Email delivery status state
  const [emailStatuses, setEmailStatuses] = useState<Record<string, EmailDeliveryStatus>>({});

  // Sorting state
  type SortField = 'dealer' | 'region' | 'status' | 'email' | 'lastPost' | 'postedBy';
  type SortDirection = 'asc' | 'desc';
  const [sortField, setSortField] = useState<SortField>('dealer');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Fetch email delivery status for a list of emails
  const fetchEmailStatuses = useCallback(async (emails: string[]) => {
    if (emails.length === 0) return;

    try {
      const response = await fetch(`/api/admin/email-status?emails=${encodeURIComponent(emails.join(','))}`);

      // Check if response is OK before parsing JSON
      if (!response.ok) {
        console.error('Email status API error:', response.status, response.statusText);
        return;
      }

      const text = await response.text();
      if (!text) {
        console.error('Email status API returned empty response');
        return;
      }

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

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch status');
      }

      setSpreadsheetStatus(data);

      // Also fetch email delivery status for all dealers
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

  // Fetch post data from Posts Excel
  const fetchPostData = async (postNumber: string) => {
    if (!postNumber) return;

    try {
      const response = await fetch(`/api/admin/posts-excel?postNumber=${postNumber}`);
      const data = await response.json();

      if (response.ok && data.post) {
        setPostData(prev => ({
          ...prev,
          baseCopy: data.post.postCopy || '',
          season: data.post.season || '',
          subjectMatter: data.post.subjectMatter || '',
          tag1: data.post.tag1 || '',
          tag2: data.post.tag2 || '',
          tag3: data.post.tag3 || '',
        }));
      }
    } catch (error) {
      console.error('Failed to fetch post data:', error);
    }
  };

  // Handle post number change - auto-fetch data
  const handlePostNumberChange = (value: string) => {
    setPostData(prev => ({ ...prev, postNumber: value }));
    if (value && value.length >= 2) {
      fetchPostData(value);
    }
  };

  // Submit post to spreadsheet
  const handleSubmitPost = async () => {
    if (!postData.postNumber || !postData.templateId || !postData.baseCopy) {
      setSubmitResult({ success: false, message: 'Post number, template ID, and base copy are required' });
      return;
    }

    try {
      setSubmitting(true);
      setSubmitResult(null);

      const response = await fetch('/api/admin/submit-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit post');
      }

      setSubmitResult({ success: true, message: data.message || 'Post submitted successfully' });
      // Refresh status after submission
      fetchSpreadsheetStatus();
    } catch (error) {
      setSubmitResult({ success: false, message: error instanceof Error ? error.message : 'Failed to submit post' });
    } finally {
      setSubmitting(false);
    }
  };

  // Send emails to dealers with "Done" status - one at a time with rate limiting
  const handleSendEmails = async () => {
    if (!spreadsheetStatus?.dealers) return;

    const doneDealers = spreadsheetStatus.dealers.filter(d => d.status === 'Done');
    if (doneDealers.length === 0) {
      setEmailResult({ success: false, message: 'No dealers with "Done" status to email' });
      return;
    }

    setSendingEmails(true);
    setEmailResult(null);
    setEmailProgress({ sent: 0, total: doneDealers.length, current: '' });

    let sentCount = 0;
    let failedCount = 0;

    // Process one dealer at a time to avoid serverless timeout
    for (let i = 0; i < doneDealers.length; i++) {
      const dealer = doneDealers[i];
      setEmailProgress({ sent: sentCount, total: doneDealers.length, current: dealer.displayName });

      try {
        const response = await fetch('/api/admin/send-batch-emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dealerNumbers: [dealer.dealerNo],
            emailType: 'post_scheduled',
          }),
        });

        const data = await response.json();

        if (response.ok && data.sent > 0) {
          sentCount++;
        } else {
          failedCount++;
        }
      } catch {
        failedCount++;
      }

      setEmailProgress({ sent: sentCount, total: doneDealers.length, current: '' });

      // Rate limit: Wait 600ms between emails to stay under Resend's 2 req/sec limit
      if (i < doneDealers.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    }

    setEmailProgress(null);
    setSendingEmails(false);

    if (sentCount > 0) {
      setEmailResult({
        success: true,
        message: `Sent ${sentCount} of ${doneDealers.length} emails${failedCount > 0 ? ` (${failedCount} failed)` : ''}`,
        sent: sentCount,
      });
      // Refresh status after sending emails
      fetchSpreadsheetStatus();
    } else {
      setEmailResult({
        success: false,
        message: `Failed to send emails (${failedCount} errors)`,
      });
    }
  };

  // Auto-refresh status every 30 seconds
  useEffect(() => {
    fetchSpreadsheetStatus();
    const interval = setInterval(fetchSpreadsheetStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchSpreadsheetStatus]);

  // Count dealers by status
  const statusCounts = spreadsheetStatus?.dealers.reduce(
    (acc, dealer) => {
      acc[dealer.status] = (acc[dealer.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  ) || {};

  // Handle column header click for sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Parse date string like "21-Jan" or "15-Dec" for sorting
  const parsePostDate = (dateStr: string): Date | null => {
    if (!dateStr || dateStr === '-') return null;
    // Try to parse formats like "21-Jan", "15-Dec", "1-Feb"
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
        // Assume current year, but if month is ahead of current month, use last year
        const now = new Date();
        let year = now.getFullYear();
        if (month > now.getMonth() + 1) {
          year--;
        }
        return new Date(year, month, day);
      }
    }
    return null;
  };

  // Sort dealers based on current sort field and direction
  const sortedDealers = spreadsheetStatus?.dealers ? [...spreadsheetStatus.dealers].sort((a, b) => {
    let comparison = 0;

    switch (sortField) {
      case 'dealer':
        comparison = (a.displayName || '').localeCompare(b.displayName || '');
        break;
      case 'region':
        comparison = (a.region || '').localeCompare(b.region || '');
        break;
      case 'status':
        // Custom order: Pending, Done, Email Sent
        const statusOrder: Record<string, number> = { 'Pending': 0, 'Done': 1, 'Email Sent': 2 };
        comparison = (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3);
        break;
      case 'email':
        // Sort by email delivery status
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
      case 'postedBy':
        comparison = (a.whoPosted || '').localeCompare(b.whoPosted || '');
        break;
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  }) : [];

  // Sort indicator component
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <span className="text-gray-300 ml-1">↕</span>;
    }
    return <span className="text-[#5378a8] ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#5378a8] text-white py-6 px-8 border-b-4 border-[#c87a3e]">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Post Workflow</h1>
            <p className="text-[#d7e7fd] mt-1">Manage posts and dealer status</p>
          </div>
          <a
            href="/admin"
            className="px-4 py-2 bg-[#c87a3e] rounded-lg hover:bg-[#b36a35] transition-colors"
          >
            Back to Dashboard
          </a>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Post Input Form */}
          <div className="lg:col-span-1">
            <div className="bg-white border-2 border-[#5378a8] rounded-lg shadow-lg overflow-hidden">
              <div className="bg-[#c87a3e] px-6 py-4 border-b-2 border-[#000000]">
                <h2 className="text-xl font-bold text-white">New Post</h2>
                <p className="text-sm text-white/90 mt-1">Enter post details</p>
              </div>

              <div className="p-6 space-y-4">
                {/* Post Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Post Number
                  </label>
                  <input
                    type="number"
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#5378a8] focus:ring-2 focus:ring-[#5378a8]/20 outline-none"
                    value={postData.postNumber}
                    onChange={(e) => handlePostNumberChange(e.target.value)}
                    placeholder="667"
                  />
                  <p className="text-xs text-gray-500 mt-1">Auto-fills from Posts Excel</p>
                </div>

                {/* Template ID */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Creatomate Template ID
                  </label>
                  <input
                    type="text"
                    className="w-full p-3 border-2 border-gray-300 rounded-lg font-mono text-sm focus:border-[#5378a8] focus:ring-2 focus:ring-[#5378a8]/20 outline-none"
                    value={postData.templateId}
                    onChange={(e) => setPostData(prev => ({ ...prev, templateId: e.target.value }))}
                    placeholder="603f269d-8019-40b9-8cc5-b4e1829b05bd"
                  />
                </div>

                {/* Season */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Season
                  </label>
                  <select
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#5378a8] focus:ring-2 focus:ring-[#5378a8]/20 outline-none"
                    value={postData.season}
                    onChange={(e) => setPostData(prev => ({ ...prev, season: e.target.value }))}
                  >
                    <option value="">Select season...</option>
                    <option value="Winter">Winter</option>
                    <option value="Spring">Spring</option>
                    <option value="Summer">Summer</option>
                    <option value="Fall">Fall</option>
                  </select>
                </div>

                {/* Subject Matter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subject Matter
                  </label>
                  <input
                    type="text"
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#5378a8] focus:ring-2 focus:ring-[#5378a8]/20 outline-none"
                    value={postData.subjectMatter}
                    onChange={(e) => setPostData(prev => ({ ...prev, subjectMatter: e.target.value }))}
                    placeholder="Heating, Cooling, Maintenance..."
                  />
                </div>

                {/* Tags */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tag 1</label>
                    <input
                      type="text"
                      className="w-full p-2 border-2 border-gray-300 rounded-lg text-sm focus:border-[#5378a8] outline-none"
                      value={postData.tag1}
                      onChange={(e) => setPostData(prev => ({ ...prev, tag1: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tag 2</label>
                    <input
                      type="text"
                      className="w-full p-2 border-2 border-gray-300 rounded-lg text-sm focus:border-[#5378a8] outline-none"
                      value={postData.tag2}
                      onChange={(e) => setPostData(prev => ({ ...prev, tag2: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tag 3</label>
                    <input
                      type="text"
                      className="w-full p-2 border-2 border-gray-300 rounded-lg text-sm focus:border-[#5378a8] outline-none"
                      value={postData.tag3}
                      onChange={(e) => setPostData(prev => ({ ...prev, tag3: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Base Copy */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Base Copy
                  </label>
                  <textarea
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#5378a8] focus:ring-2 focus:ring-[#5378a8]/20 outline-none resize-none"
                    rows={5}
                    value={postData.baseCopy}
                    onChange={(e) => setPostData(prev => ({ ...prev, baseCopy: e.target.value }))}
                    placeholder="Enter post copy with {name}, {phone}, {website} placeholders..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Use {'{name}'}, {'{phone}'}, {'{website}'} for personalization
                  </p>
                </div>

                {/* Submit Button */}
                <button
                  onClick={handleSubmitPost}
                  disabled={submitting || !postData.postNumber || !postData.templateId || !postData.baseCopy}
                  className="w-full px-6 py-3 bg-[#c87a3e] text-white rounded-lg hover:bg-[#b36a35] disabled:bg-gray-300 disabled:cursor-not-allowed font-semibold transition-colors"
                >
                  {submitting ? 'Submitting...' : 'Submit Post'}
                </button>

                {/* Submit Result */}
                {submitResult && (
                  <div
                    className={`p-4 rounded-lg ${
                      submitResult.success
                        ? 'bg-green-50 border border-green-500 text-green-800'
                        : 'bg-red-50 border border-red-500 text-red-800'
                    }`}
                  >
                    {submitResult.success ? '✅' : '❌'} {submitResult.message}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Dealer Status */}
          <div className="lg:col-span-2">
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

            {/* Send Emails Button */}
            {(statusCounts['Done'] || 0) > 0 && (
              <div className="mb-6">
                <button
                  onClick={handleSendEmails}
                  disabled={sendingEmails}
                  className="w-full px-6 py-3 bg-[#5378a8] text-white rounded-lg hover:bg-[#4a6890] disabled:bg-gray-300 disabled:cursor-not-allowed font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  {sendingEmails ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      Sending {emailProgress?.sent || 0} of {emailProgress?.total || statusCounts['Done']}...
                    </>
                  ) : (
                    <>
                      Send Emails to {statusCounts['Done']} Done Dealers
                    </>
                  )}
                </button>

                {/* Progress bar during sending */}
                {sendingEmails && emailProgress && (
                  <div className="mt-3 p-4 bg-blue-50 border border-blue-300 rounded-lg">
                    <div className="flex justify-between text-sm text-blue-800 mb-2">
                      <span>Sending emails...</span>
                      <span>{emailProgress.sent} / {emailProgress.total}</span>
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(emailProgress.sent / emailProgress.total) * 100}%` }}
                      />
                    </div>
                    {emailProgress.current && (
                      <p className="text-xs text-blue-600 mt-2">Currently: {emailProgress.current}</p>
                    )}
                  </div>
                )}

                {emailResult && !sendingEmails && (
                  <div
                    className={`mt-3 p-4 rounded-lg ${
                      emailResult.success
                        ? 'bg-green-50 border border-green-500 text-green-800'
                        : 'bg-red-50 border border-red-500 text-red-800'
                    }`}
                  >
                    {emailResult.success ? '✅' : '❌'} {emailResult.message}
                  </div>
                )}
              </div>
            )}

            {/* Dealer Status Table */}
            <div className="bg-white border-2 border-[#5378a8] rounded-lg shadow-lg overflow-hidden">
              <div className="bg-[#74a9de] px-6 py-4 border-b-2 border-[#5378a8] flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-black">Dealer Status</h2>
                  <p className="text-sm text-black/70 mt-1">
                    {spreadsheetStatus?.dealers.length || 0} dealers
                  </p>
                </div>
                <button
                  onClick={fetchSpreadsheetStatus}
                  disabled={loadingStatus}
                  className="px-4 py-2 bg-white text-[#5378a8] rounded-lg hover:bg-gray-100 disabled:bg-gray-200 font-medium transition-colors"
                >
                  {loadingStatus ? 'Loading...' : 'Refresh'}
                </button>
              </div>

              {statusError && (
                <div className="p-4 bg-red-50 text-red-800 border-b border-red-200">
                  Error: {statusError}
                </div>
              )}

              <div className="max-h-[600px] overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none"
                        onClick={() => handleSort('dealer')}
                      >
                        Dealer<SortIcon field="dealer" />
                      </th>
                      <th
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none"
                        onClick={() => handleSort('region')}
                      >
                        Region<SortIcon field="region" />
                      </th>
                      <th
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none"
                        onClick={() => handleSort('status')}
                      >
                        Status<SortIcon field="status" />
                      </th>
                      <th
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none"
                        onClick={() => handleSort('email')}
                      >
                        Email<SortIcon field="email" />
                      </th>
                      <th
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none"
                        onClick={() => handleSort('lastPost')}
                      >
                        Last Post<SortIcon field="lastPost" />
                      </th>
                      <th
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none"
                        onClick={() => handleSort('postedBy')}
                      >
                        Posted By<SortIcon field="postedBy" />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {sortedDealers.map((dealer) => (
                      <tr key={dealer.dealerNo} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-900">{dealer.displayName}</p>
                            <p className="text-xs text-gray-500">{dealer.dealerNo}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                            dealer.region === 'NORTH' ? 'bg-blue-100 text-blue-800' :
                            dealer.region === 'SOUTH' ? 'bg-orange-100 text-orange-800' :
                            'bg-purple-100 text-purple-800'
                          }`}>
                            {dealer.region}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                            dealer.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                            dealer.status === 'Done' ? 'bg-green-100 text-green-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {dealer.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {(() => {
                            const emailStatus = emailStatuses[dealer.email?.toLowerCase()];
                            if (!emailStatus?.latest_event) {
                              return <span className="text-xs text-gray-400">-</span>;
                            }
                            const event = emailStatus.latest_event.replace('email.', '');
                            const eventDate = emailStatus.latest_event_at
                              ? new Date(emailStatus.latest_event_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                              : '';
                            const eventColors: Record<string, string> = {
                              'delivered': 'bg-green-100 text-green-800',
                              'opened': 'bg-blue-100 text-blue-800',
                              'clicked': 'bg-purple-100 text-purple-800',
                              'bounced': 'bg-red-100 text-red-800',
                              'complained': 'bg-red-100 text-red-800',
                              'sent': 'bg-gray-100 text-gray-800',
                            };
                            const colorClass = eventColors[event] || 'bg-gray-100 text-gray-800';
                            return (
                              <div className="flex flex-col gap-0.5">
                                <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${colorClass}`}>
                                  {event === 'clicked' ? '📧 Clicked' :
                                   event === 'opened' ? '📖 Opened' :
                                   event === 'delivered' ? '✅ Delivered' :
                                   event === 'bounced' ? '❌ Bounced' :
                                   event === 'complained' ? '🚫 Spam' :
                                   event === 'sent' ? '📤 Sent' : event}
                                </span>
                                {eventDate && <span className="text-xs text-gray-400">{eventDate}</span>}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {dealer.lastPostDate || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {dealer.whoPosted || '-'}
                        </td>
                      </tr>
                    ))}

                    {sortedDealers.length === 0 && !loadingStatus && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                          No dealers found. Check API connection.
                        </td>
                      </tr>
                    )}

                    {loadingStatus && !spreadsheetStatus && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                          Loading dealer status...
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
