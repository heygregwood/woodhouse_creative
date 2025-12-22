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
  const [emailResult, setEmailResult] = useState<{ success: boolean; message: string; sent?: number } | null>(null);

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
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : 'Failed to fetch status');
    } finally {
      setLoadingStatus(false);
    }
  }, []);

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

  // Send emails to dealers with "Done" status
  const handleSendEmails = async () => {
    if (!spreadsheetStatus?.dealers) return;

    const doneDealers = spreadsheetStatus.dealers.filter(d => d.status === 'Done');
    if (doneDealers.length === 0) {
      setEmailResult({ success: false, message: 'No dealers with "Done" status to email' });
      return;
    }

    try {
      setSendingEmails(true);
      setEmailResult(null);

      const response = await fetch('/api/admin/send-batch-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealerNumbers: doneDealers.map(d => d.dealerNo),
          emailType: 'post_scheduled',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send emails');
      }

      setEmailResult({
        success: true,
        message: data.message || 'Emails sent successfully',
        sent: data.sent,
      });

      // Refresh status after sending emails
      fetchSpreadsheetStatus();
    } catch (error) {
      setEmailResult({ success: false, message: error instanceof Error ? error.message : 'Failed to send emails' });
    } finally {
      setSendingEmails(false);
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
                    <>Sending Emails...</>
                  ) : (
                    <>
                      Send Emails to {statusCounts['Done']} Done Dealers
                    </>
                  )}
                </button>

                {emailResult && (
                  <div
                    className={`mt-3 p-4 rounded-lg ${
                      emailResult.success
                        ? 'bg-green-50 border border-green-500 text-green-800'
                        : 'bg-red-50 border border-red-500 text-red-800'
                    }`}
                  >
                    {emailResult.success ? '✅' : '❌'} {emailResult.message}
                    {emailResult.sent !== undefined && ` (${emailResult.sent} emails sent)`}
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
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Dealer</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Region</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Last Post</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Posted By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {spreadsheetStatus?.dealers.map((dealer) => (
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
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {dealer.lastPostDate || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {dealer.whoPosted || '-'}
                        </td>
                      </tr>
                    ))}

                    {(!spreadsheetStatus?.dealers || spreadsheetStatus.dealers.length === 0) && !loadingStatus && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                          No dealers found. Check API connection.
                        </td>
                      </tr>
                    )}

                    {loadingStatus && !spreadsheetStatus && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
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
