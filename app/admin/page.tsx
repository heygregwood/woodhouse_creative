'use client';

import { useState } from 'react';

interface Dealer {
  contactFirstName: string;
  publicCompanyPhone: string;
  publicCompanyName: string;
  publicWebAddress?: string;
  logoShareUrl: string;
  dealerNo?: string;
  contactEmail?: string;
}

interface Duplicate {
  imported: Dealer;
  existing: {
    id: string;
    businessName: string;
    phone: string;
    website: string;
    logoUrl: string;
    dealerNo?: string;
  };
  matchType: 'name' | 'dealerNo';
}

export default function CreativeAdminPage() {
  // CSV Import State
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [duplicates, setDuplicates] = useState<Duplicate[]>([]);
  const [resolvingDuplicates, setResolvingDuplicates] = useState(false);

  // Render State
  const [postNumber, setPostNumber] = useState('');
  const [templateId, setTemplateId] = useState('603f269d-8019-40b9-8cc5-b4e1829b05bd');
  const [rendering, setRendering] = useState(false);
  const [renderResult, setRenderResult] = useState<any>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [batchStatus, setBatchStatus] = useState<any>(null);

  // Parse CSV file to JSON
  const parseCSV = (text: string): Dealer[] => {
    const lines = text.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim());

    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const dealer: any = {};

      headers.forEach((header, index) => {
        dealer[header] = values[index] || '';
      });

      return dealer;
    });
  };

  // Handle CSV file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'text/csv') {
      setCsvFile(file);
      setImportResult(null);
      setDuplicates([]);
    } else {
      alert('Please select a valid CSV file');
    }
  };

  // Import dealers from CSV
  const handleImport = async () => {
    if (!csvFile) return;

    try {
      setImporting(true);
      setImportResult(null);
      setDuplicates([]);

      // Read CSV file
      const text = await csvFile.text();
      const dealers = parseCSV(text);

      // Send to API for duplicate check
      const response = await fetch('/api/creative/import-dealers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealers, checkDuplicates: true }),
      });

      const data = await response.json();

      if (data.duplicates && data.duplicates.length > 0) {
        // Show duplicates for resolution
        setDuplicates(data.duplicates);
        setImportResult({
          success: true,
          message: `Found ${data.duplicates.length} duplicate(s). Please resolve them below.`,
          imported: data.imported || 0,
        });
      } else {
        // No duplicates, import successful
        setImportResult({
          success: true,
          message: data.message || `Successfully imported ${data.imported} dealer(s)`,
          imported: data.imported || 0,
        });
        setCsvFile(null);
      }
    } catch (error) {
      setImportResult({
        success: false,
        message: error instanceof Error ? error.message : 'Import failed',
      });
    } finally {
      setImporting(false);
    }
  };

  // Resolve duplicate - keep imported or keep existing
  const handleResolveDuplicate = async (index: number, keepImported: boolean) => {
    const duplicate = duplicates[index];

    try {
      setResolvingDuplicates(true);

      const response = await fetch('/api/creative/resolve-duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imported: duplicate.imported,
          existingId: duplicate.existing.id,
          keepImported,
        }),
      });

      if (response.ok) {
        // Remove resolved duplicate from list
        const newDuplicates = duplicates.filter((_, i) => i !== index);
        setDuplicates(newDuplicates);

        if (newDuplicates.length === 0) {
          setImportResult({
            success: true,
            message: 'All duplicates resolved! Import complete.',
          });
          setCsvFile(null);
        }
      }
    } catch (error) {
      alert('Failed to resolve duplicate');
    } finally {
      setResolvingDuplicates(false);
    }
  };

  // Start batch render
  const handleStartRender = async () => {
    try {
      setRendering(true);
      setRenderResult(null);
      setBatchStatus(null);

      const response = await fetch('/api/creative/render-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postNumber: parseInt(postNumber),
          templateId,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setRenderResult(data);
        setBatchId(data.batchId);
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

  // Check batch status
  const handleCheckStatus = async () => {
    if (!batchId) return;

    try {
      const response = await fetch(`/api/creative/render-batch?batchId=${batchId}`);
      const data = await response.json();

      if (response.ok) {
        setBatchStatus(data);
      } else {
        setBatchStatus({ error: data.error || 'Failed to get status' });
      }
    } catch (error) {
      setBatchStatus({
        error: error instanceof Error ? error.message : 'Failed to get status',
      });
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-[#5378a8] text-white py-6 px-8 border-b-4 border-[#c87a3e]">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold">Woodhouse Creative Automation</h1>
          <p className="text-[#d7e7fd] mt-1">Manage dealers and video rendering</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Dealer Management */}
          <div>
            <div className="bg-white border-2 border-[#5378a8] rounded-lg shadow-lg overflow-hidden">
              <div className="bg-[#74a9de] px-6 py-4 border-b-2 border-[#5378a8]">
                <h2 className="text-xl font-bold text-[#000000]">Import Dealers</h2>
                <p className="text-sm text-[#000000] mt-1">Upload CSV to add new dealers</p>
              </div>

              <div className="p-6 space-y-4">
                {/* File Upload */}
                <div>
                  <label className="block text-sm font-medium text-[#000000] mb-2">
                    Upload CSV File
                  </label>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="block w-full text-sm text-[#000000]
                      file:mr-4 file:py-2 file:px-4
                      file:rounded file:border-0
                      file:text-sm file:font-semibold
                      file:bg-[#c87a3e] file:text-white
                      hover:file:bg-[#b36a35]
                      cursor-pointer border-2 border-[#d7e7fd] rounded-lg"
                  />
                  {csvFile && (
                    <p className="text-sm text-[#5378a8] mt-2">
                      Selected: {csvFile.name}
                    </p>
                  )}
                </div>

                {/* Import Button */}
                <button
                  onClick={handleImport}
                  disabled={!csvFile || importing}
                  className="w-full px-6 py-3 bg-[#c87a3e] text-white rounded-lg hover:bg-[#b36a35] disabled:bg-gray-300 disabled:cursor-not-allowed font-semibold text-lg transition-colors border-2 border-[#000000]"
                >
                  {importing ? 'Importing...' : 'Import Dealers'}
                </button>

                {/* Import Result */}
                {importResult && (
                  <div
                    className={`p-4 rounded-lg border-2 ${
                      importResult.success
                        ? 'bg-green-50 border-green-500'
                        : 'bg-red-50 border-red-500'
                    }`}
                  >
                    <p className={`font-medium ${importResult.success ? 'text-green-900' : 'text-red-900'}`}>
                      {importResult.success ? '✅ Success' : '❌ Error'}
                    </p>
                    <p className={`text-sm mt-1 ${importResult.success ? 'text-green-800' : 'text-red-800'}`}>
                      {importResult.message}
                    </p>
                  </div>
                )}

                {/* Duplicates Resolution */}
                {duplicates.length > 0 && (
                  <div className="space-y-4 mt-6">
                    <h3 className="font-bold text-[#000000] text-lg border-b-2 border-[#c87a3e] pb-2">
                      Resolve Duplicates ({duplicates.length})
                    </h3>

                    {duplicates.map((dup, index) => (
                      <div key={index} className="border-2 border-[#5378a8] rounded-lg p-4 bg-[#d7e7fd]">
                        <p className="font-medium text-[#000000] mb-3">
                          Duplicate found: {dup.imported.publicCompanyName}
                          <span className="text-sm text-[#5378a8] ml-2">
                            (matched by {dup.matchType})
                          </span>
                        </p>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                          {/* Imported Data */}
                          <div className="bg-white p-3 rounded border-2 border-[#74a9de]">
                            <p className="text-xs font-semibold text-[#c87a3e] mb-2">NEW DATA (CSV)</p>
                            <div className="text-sm text-[#000000] space-y-1">
                              <p><strong>Name:</strong> {dup.imported.publicCompanyName}</p>
                              <p><strong>Phone:</strong> {dup.imported.publicCompanyPhone}</p>
                              <p><strong>Website:</strong> {dup.imported.publicWebAddress || 'N/A'}</p>
                              {dup.imported.dealerNo && <p><strong>Dealer #:</strong> {dup.imported.dealerNo}</p>}
                            </div>
                          </div>

                          {/* Existing Data */}
                          <div className="bg-white p-3 rounded border-2 border-[#74a9de]">
                            <p className="text-xs font-semibold text-[#5378a8] mb-2">EXISTING (Database)</p>
                            <div className="text-sm text-[#000000] space-y-1">
                              <p><strong>Name:</strong> {dup.existing.businessName}</p>
                              <p><strong>Phone:</strong> {dup.existing.phone}</p>
                              <p><strong>Website:</strong> {dup.existing.website || 'N/A'}</p>
                              {dup.existing.dealerNo && <p><strong>Dealer #:</strong> {dup.existing.dealerNo}</p>}
                            </div>
                          </div>
                        </div>

                        {/* Resolution Buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleResolveDuplicate(index, true)}
                            disabled={resolvingDuplicates}
                            className="flex-1 px-4 py-2 bg-[#c87a3e] text-white rounded hover:bg-[#b36a35] disabled:bg-gray-300 font-medium"
                          >
                            Keep New
                          </button>
                          <button
                            onClick={() => handleResolveDuplicate(index, false)}
                            disabled={resolvingDuplicates}
                            className="flex-1 px-4 py-2 bg-[#5378a8] text-white rounded hover:bg-[#4a6890] disabled:bg-gray-300 font-medium"
                          >
                            Keep Existing
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* CSV Format Help */}
                <div className="bg-[#d7e7fd] border-2 border-[#74a9de] rounded-lg p-4 mt-6">
                  <h3 className="font-medium text-[#000000] mb-2">Required CSV Columns:</h3>
                  <ul className="text-sm text-[#000000] space-y-1">
                    <li>• <strong>publicCompanyName</strong> - Business name</li>
                    <li>• <strong>publicCompanyPhone</strong> - Phone number</li>
                    <li>• <strong>logoShareUrl</strong> - Google Drive logo link</li>
                    <li>• <strong>contactFirstName</strong> - Contact name</li>
                    <li>• <strong>publicWebAddress</strong> - Website (optional)</li>
                    <li>• <strong>dealerNo</strong> - Dealer number (optional)</li>
                    <li>• <strong>contactEmail</strong> - Email (optional)</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Render Management */}
          <div>
            <div className="bg-white border-2 border-[#5378a8] rounded-lg shadow-lg overflow-hidden">
              <div className="bg-[#c87a3e] px-6 py-4 border-b-2 border-[#000000]">
                <h2 className="text-xl font-bold text-white">Batch Render</h2>
                <p className="text-sm text-white mt-1">Start video rendering for all dealers</p>
              </div>

              <div className="p-6 space-y-4">
                {/* Post Number */}
                <div>
                  <label className="block text-sm font-medium text-[#000000] mb-2">
                    Post Number
                  </label>
                  <input
                    type="number"
                    className="w-full p-3 border-2 border-[#5378a8] rounded-lg focus:border-[#c87a3e] focus:ring-2 focus:ring-[#c87a3e] outline-none"
                    value={postNumber}
                    onChange={(e) => setPostNumber(e.target.value)}
                    placeholder="700"
                  />
                  <p className="text-sm text-[#5378a8] mt-1">
                    The post number for this batch (e.g., 700, 701)
                  </p>
                </div>

                {/* Template ID */}
                <div>
                  <label className="block text-sm font-medium text-[#000000] mb-2">
                    Creatomate Template ID
                  </label>
                  <input
                    type="text"
                    className="w-full p-3 border-2 border-[#5378a8] rounded-lg font-mono text-sm focus:border-[#c87a3e] focus:ring-2 focus:ring-[#c87a3e] outline-none"
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                    placeholder="603f269d-8019-40b9-8cc5-b4e1829b05bd"
                  />
                  <p className="text-sm text-[#5378a8] mt-1">
                    From your Creatomate template URL
                  </p>
                </div>

                {/* Render Button */}
                <button
                  onClick={handleStartRender}
                  disabled={rendering || !postNumber || !templateId}
                  className="w-full px-6 py-3 bg-[#c87a3e] text-white rounded-lg hover:bg-[#b36a35] disabled:bg-gray-300 disabled:cursor-not-allowed font-semibold text-lg transition-colors border-2 border-[#000000]"
                >
                  {rendering ? 'Starting Render...' : 'Start Batch Render'}
                </button>

                {/* Render Result */}
                {renderResult && (
                  <div
                    className={`p-4 rounded-lg border-2 ${
                      renderResult.error
                        ? 'bg-red-50 border-red-500'
                        : 'bg-green-50 border-green-500'
                    }`}
                  >
                    {renderResult.error ? (
                      <>
                        <p className="font-medium text-red-900">❌ Error</p>
                        <p className="text-sm text-red-800 mt-1">{renderResult.error}</p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-green-900 mb-3">✅ Batch Started!</p>
                        <div className="text-sm text-green-800 space-y-1">
                          <p><strong>Batch ID:</strong> <code className="bg-green-100 px-2 py-1 rounded">{renderResult.batchId}</code></p>
                          <p><strong>Jobs Created:</strong> {renderResult.jobsCreated}</p>
                          <p><strong>Post Number:</strong> {renderResult.details?.postNumber}</p>
                          <p className="mt-3">{renderResult.message}</p>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Batch Status */}
                {batchId && (
                  <div className="border-2 border-[#5378a8] rounded-lg p-4 bg-[#d7e7fd]">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-[#000000]">Batch Status</h3>
                      <button
                        onClick={handleCheckStatus}
                        className="px-4 py-2 bg-[#5378a8] text-white rounded hover:bg-[#4a6890] font-medium"
                      >
                        Refresh Status
                      </button>
                    </div>

                    {batchStatus && !batchStatus.error && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-white p-3 rounded border-2 border-[#74a9de]">
                            <p className="text-sm font-medium text-[#000000]">Status</p>
                            <p className="text-lg font-semibold text-[#c87a3e] capitalize">{batchStatus.status}</p>
                          </div>
                          <div className="bg-white p-3 rounded border-2 border-[#74a9de]">
                            <p className="text-sm font-medium text-[#000000]">Progress</p>
                            <p className="text-lg font-semibold text-[#c87a3e]">{batchStatus.progress?.percentComplete}%</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-2">
                          <div className="bg-white p-3 rounded border-2 border-[#74a9de] text-center">
                            <p className="text-2xl font-bold text-[#5378a8]">{batchStatus.progress?.total}</p>
                            <p className="text-xs text-[#000000]">Total</p>
                          </div>
                          <div className="bg-white p-3 rounded border-2 border-green-500 text-center">
                            <p className="text-2xl font-bold text-green-600">{batchStatus.progress?.completed}</p>
                            <p className="text-xs text-green-800">Done</p>
                          </div>
                          <div className="bg-white p-3 rounded border-2 border-yellow-500 text-center">
                            <p className="text-2xl font-bold text-yellow-600">{batchStatus.progress?.pending + batchStatus.progress?.processing}</p>
                            <p className="text-xs text-yellow-800">Progress</p>
                          </div>
                          <div className="bg-white p-3 rounded border-2 border-red-500 text-center">
                            <p className="text-2xl font-bold text-red-600">{batchStatus.progress?.failed}</p>
                            <p className="text-xs text-red-800">Failed</p>
                          </div>
                        </div>

                        {batchStatus.recentCompletions && batchStatus.recentCompletions.length > 0 && (
                          <div className="bg-white p-3 rounded border-2 border-[#74a9de]">
                            <p className="font-medium text-[#000000] mb-2">Recent Completions:</p>
                            <ul className="text-sm space-y-1">
                              {batchStatus.recentCompletions.map((completion: any, i: number) => (
                                <li key={i} className="text-[#000000]">
                                  ✅ {completion.businessName} - <a href={completion.driveUrl} target="_blank" rel="noopener noreferrer" className="text-[#5378a8] hover:underline">View</a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
