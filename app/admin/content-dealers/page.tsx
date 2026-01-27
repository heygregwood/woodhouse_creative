'use client';

import { useState } from 'react';

export default function ContentDealersPage() {
  // Mail Merge state
  const [mailMergePreview, setMailMergePreview] = useState<{
    totalContent: number;
    toAdd: number;
    preview: Array<{
      firstName: string;
      businessName: string;
      brand: string;
      distributor: string;
      email: string;
    }>;
  } | null>(null);
  const [loadingMailMerge, setLoadingMailMerge] = useState(false);
  const [populatingMailMerge, setPopulatingMailMerge] = useState(false);
  const [mailMergeResult, setMailMergeResult] = useState<{ success: boolean; message: string } | null>(null);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#5378a8] text-white py-6 px-8 border-b-4 border-[#c87a3e]">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold">Content Dealers</h1>
          </div>
          <div className="flex gap-3">
            <a href="/admin" className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors font-medium">Dashboard</a>
            <a href="/admin/posts" className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors font-medium">Posts</a>
            <a href="/admin/scheduling" className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors font-medium">Scheduling</a>
            <a href="/admin/content-dealers" className="px-4 py-2 bg-white/40 rounded-lg hover:bg-white/50 transition-colors font-medium">Content Dealers</a>
            <a href="/admin/dealer-review" className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors font-medium">Dealer Review</a>
            <a href="/admin/email-templates" className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors font-medium">Email Templates</a>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-8">
        {/* Overview */}
        <div className="mb-6 p-4 bg-white border-2 border-gray-200 rounded-lg">
          <p className="text-gray-600">
            <strong>Content Dealers</strong> receive monthly content packages but post to their own Facebook pages.
            Use the tools below to manage welcome emails and content distribution.
          </p>
        </div>

        {/* Populate Mail Merge Section */}
        <div className="mb-8">
          <div className="bg-white border-2 border-green-500 rounded-lg shadow-lg overflow-hidden">
            <div className="bg-green-600 px-6 py-4 border-b-2 border-green-700">
              <h2 className="text-xl font-bold text-white">Populate Mail Merge</h2>
              <p className="text-sm text-white/90 mt-1">
                Add CONTENT dealers to the welcome email spreadsheet
              </p>
            </div>

            <div className="p-6">
              <div className="flex flex-wrap items-center gap-4 mb-4">
                <button
                  onClick={async () => {
                    setLoadingMailMerge(true);
                    setMailMergeResult(null);
                    try {
                      const response = await fetch('/api/admin/populate-mail-merge');
                      const data = await response.json();
                      if (!response.ok) throw new Error(data.error);
                      setMailMergePreview(data);
                    } catch (error: unknown) {
                      setMailMergeResult({
                        success: false,
                        message: error instanceof Error ? error.message : 'Failed to fetch preview',
                      });
                    } finally {
                      setLoadingMailMerge(false);
                    }
                  }}
                  disabled={loadingMailMerge}
                  className="px-6 py-3 bg-green-100 text-green-700 font-medium rounded-lg hover:bg-green-200 disabled:bg-gray-200 disabled:text-gray-500 transition-colors"
                >
                  {loadingMailMerge ? 'Loading...' : 'Preview Dealers'}
                </button>

                {mailMergePreview && mailMergePreview.toAdd > 0 && (
                  <button
                    onClick={async () => {
                      setPopulatingMailMerge(true);
                      setMailMergeResult(null);
                      try {
                        const response = await fetch('/api/admin/populate-mail-merge', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ dryRun: false }),
                        });
                        const data = await response.json();
                        if (!response.ok) throw new Error(data.error);
                        setMailMergeResult({
                          success: true,
                          message: data.message,
                        });
                        setMailMergePreview(null);
                      } catch (error: unknown) {
                        setMailMergeResult({
                          success: false,
                          message: error instanceof Error ? error.message : 'Failed to populate',
                        });
                      } finally {
                        setPopulatingMailMerge(false);
                      }
                    }}
                    disabled={populatingMailMerge}
                    className="px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    {populatingMailMerge ? 'Adding...' : `Add ${mailMergePreview.toAdd} Dealers to Spreadsheet`}
                  </button>
                )}

                <a
                  href="https://docs.google.com/spreadsheets/d/1_FCqDNpssdWZ32o6ORSxuZ0BS8RFORh6AWojHxMCfas/edit#gid=1885240601"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-3 text-green-600 hover:text-green-800 font-medium transition-colors"
                >
                  Open Spreadsheet
                </a>
              </div>

              {/* Preview Stats */}
              {mailMergePreview && (
                <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex justify-center gap-8 text-center mb-4">
                    <div>
                      <p className="text-2xl font-bold text-green-700">{mailMergePreview.totalContent}</p>
                      <p className="text-sm text-green-600">CONTENT/NEW Dealers with Email</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-600">{mailMergePreview.toAdd}</p>
                      <p className="text-sm text-green-600">Will Be Added</p>
                    </div>
                  </div>

                  {mailMergePreview.preview.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-green-800 mb-2">
                        Preview (first {mailMergePreview.preview.length}):
                      </p>
                      <div className="max-h-48 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-green-100">
                            <tr>
                              <th className="px-2 py-1 text-left text-xs font-medium text-green-800">Name</th>
                              <th className="px-2 py-1 text-left text-xs font-medium text-green-800">Business</th>
                              <th className="px-2 py-1 text-left text-xs font-medium text-green-800">Brand</th>
                              <th className="px-2 py-1 text-left text-xs font-medium text-green-800">Email</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-green-100">
                            {mailMergePreview.preview.map((dealer, i) => (
                              <tr key={i} className="hover:bg-green-50">
                                <td className="px-2 py-1 text-gray-900">{dealer.firstName}</td>
                                <td className="px-2 py-1 text-gray-700 truncate max-w-[200px]">{dealer.businessName}</td>
                                <td className="px-2 py-1">
                                  <span className={`inline-flex px-1.5 py-0.5 text-xs rounded ${
                                    dealer.brand.includes('Armstrong') ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                                  }`}>
                                    {dealer.brand.includes('Armstrong') ? 'Armstrong' : 'AirEase'}
                                  </span>
                                </td>
                                <td className="px-2 py-1 text-gray-600 text-xs">{dealer.email}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Result message */}
              {mailMergeResult && (
                <div className={`p-4 rounded-lg ${
                  mailMergeResult.success
                    ? 'bg-green-50 border border-green-500 text-green-800'
                    : 'bg-red-50 border border-red-500 text-red-800'
                }`}>
                  {mailMergeResult.success ? '✅' : '❌'} {mailMergeResult.message}
                </div>
              )}

              <p className="mt-4 text-sm text-gray-500">
                Adds ALL CONTENT/NEW dealers to the Mail Merge spreadsheet for welcome email campaigns.
                Workflow: Add dealers → Open spreadsheet → Update Dropbox link in email template → Run mail merge.
              </p>
            </div>
          </div>
        </div>

        {/* Future: Monthly Content Distribution could go here */}
        <div className="p-6 bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg text-center text-gray-500">
          <p className="text-lg font-medium mb-2">Monthly Content Distribution</p>
          <p className="text-sm">Coming soon: Tools for sending monthly content packages to CONTENT dealers.</p>
        </div>
      </div>
    </div>
  );
}
