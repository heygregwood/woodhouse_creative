'use client';

import { useState } from 'react';

export interface EditableDealer {
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
  // Editable fields
  edited_display_name: string;
  edited_phone: string;
  edited_website: string;
  edited_logo: string;
  edited_region: string;
}

export interface ApprovalResult {
  success: boolean;
  message?: string;
  dealer_no?: string;
  spreadsheet?: { success: boolean; column: string };
  postsPopulated?: number;
  postPopulateErrors?: { postNumber: number; error: string }[];
  renderBatches?: string[];
  renderBatchErrors?: { postNumber: number; error: string }[];
  email?: { success: boolean };
  oliviaEmail?: { success: boolean };
  warnings?: string[];
  estimatedCompletion?: string;
}

export interface SaveResult {
  success: boolean;
  message?: string;
}

interface DealerCardProps {
  dealer: EditableDealer;
  mode: 'review' | 'manage';
  onUpdateField: (dealerNo: string, field: string, value: string) => void;
  onAction: (dealer: EditableDealer) => void;
  actionLoading: boolean;
  actionResult: ApprovalResult | SaveResult | null;
  onOpenLogoFinder: (dealer: EditableDealer) => void;
  formatPhone: (phone: string | null) => string;
  formatWebsite: (url: string | null) => string;
}

const LOGOS_FOLDER_URL = 'https://drive.google.com/drive/folders/17TNIFS-5Nnrn3b-_knPPm5u-f1X_UUbR?usp=sharing';

export default function DealerCard({
  dealer,
  mode,
  onUpdateField,
  onAction,
  actionLoading,
  actionResult,
  onOpenLogoFinder,
  formatPhone,
  formatWebsite,
}: DealerCardProps) {
  const [expanded, setExpanded] = useState(mode === 'review');

  const isReview = mode === 'review';

  // For manage mode, detect if any fields changed from original values
  const hasChanges = !isReview && (
    dealer.edited_display_name !== (dealer.display_name || '') ||
    dealer.edited_phone !== (dealer.creatomate_phone || '') ||
    dealer.edited_website !== (dealer.creatomate_website || '') ||
    dealer.edited_logo !== (dealer.creatomate_logo || '')
  );

  // Check if this is an ApprovalResult (has spreadsheet field)
  const isApprovalResult = (result: ApprovalResult | SaveResult | null): result is ApprovalResult => {
    return result !== null && 'spreadsheet' in result;
  };

  // Compact view for manage mode (collapsed)
  if (!expanded && !isReview) {
    const hasLogo = !!dealer.edited_logo;
    return (
      <div
        className="bg-white border border-border rounded-lg shadow-sm overflow-hidden hover:border-brand/40 transition-colors cursor-pointer"
        onClick={() => setExpanded(true)}
      >
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-text truncate">
                {dealer.edited_display_name || dealer.dealer_name}
              </h3>
              <span className="text-xs text-gray-400 shrink-0">#{dealer.dealer_no}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
              <span>{dealer.edited_phone || 'No phone'}</span>
              <span className="text-gray-300">|</span>
              <span>{dealer.edited_website || 'No website'}</span>
              <span className="text-gray-300">|</span>
              <span className={hasLogo ? 'text-green-600' : 'text-red-500'}>
                {hasLogo ? 'Logo set' : 'No logo'}
              </span>
            </div>
          </div>
          <button
            className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-gray-600 shrink-0 ml-4"
          >
            Edit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-semibold text-text">{dealer.dealer_name}</h3>
            <p className="text-sm text-gray-500">
              #{dealer.dealer_no} | {dealer.distributor_name}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isReview ? (
              <span className="px-3 py-1 bg-yellow-400 text-yellow-900 rounded-full text-sm font-medium">
                Pending Review
              </span>
            ) : (
              <>
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                  FULL
                </span>
                <button
                  onClick={() => setExpanded(false)}
                  className="text-gray-400 hover:text-gray-600 text-lg ml-1"
                  title="Collapse"
                >
                  &times;
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Edit Form */}
      <div className="p-6 space-y-4">
        {/* Display Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Display Name <span className="text-gray-400">(for videos)</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={dealer.edited_display_name}
              onChange={(e) => onUpdateField(dealer.dealer_no, 'edited_display_name', e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand/20 focus:border-brand"
              placeholder="Ron's Heating and Cooling"
            />
            <span className="text-xs text-gray-500 self-center whitespace-nowrap">
              Raw: {dealer.dealer_name}
            </span>
          </div>
        </div>

        {/* Phone & Website */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone <span className="text-gray-400">(XXX-XXX-XXXX)</span>
            </label>
            <input
              type="text"
              value={dealer.edited_phone}
              onChange={(e) => onUpdateField(dealer.dealer_no, 'edited_phone', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand/20 focus:border-brand"
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
              onChange={(e) => onUpdateField(dealer.dealer_no, 'edited_website', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand/20 focus:border-brand"
              placeholder="example.com"
            />
            {dealer.dealer_web_address && dealer.edited_website !== formatWebsite(dealer.dealer_web_address) && (
              <p className="text-xs text-gray-500 mt-1">Raw: {dealer.dealer_web_address}</p>
            )}
          </div>
        </div>

        {/* Logo URL */}
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
              onChange={(e) => onUpdateField(dealer.dealer_no, 'edited_logo', e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand/20 focus:border-brand"
              placeholder="https://drive.google.com/file/d/..."
            />
            <button
              onClick={() => onOpenLogoFinder(dealer)}
              className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-dark transition-colors font-medium whitespace-nowrap"
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

        {/* Region (review mode only - manage mode dealers already have region set) */}
        {isReview && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Region <span className="text-gray-400">(optional - for scheduling)</span>
            </label>
            <select
              value={dealer.edited_region}
              onChange={(e) => onUpdateField(dealer.dealer_no, 'edited_region', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand/20 focus:border-brand"
            >
              <option value="">Select region...</option>
              <option value="North">North</option>
              <option value="South">South</option>
              <option value="Canada">Canada</option>
            </select>
          </div>
        )}

        {/* Contact Info (read-only) */}
        <div className="pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600">
            <span className="font-medium">Contact:</span> {dealer.contact_name || 'N/A'} ({dealer.contact_email || 'No email'})
          </p>
        </div>

        {/* Action Result */}
        {actionResult && (
          <div
            className={`p-4 rounded-lg ${
              actionResult.success
                ? 'bg-green-50 border border-green-400'
                : 'bg-red-50 border border-red-400'
            }`}
          >
            {actionResult.success && isApprovalResult(actionResult) && actionResult.spreadsheet ? (
              <>
                <p className="font-semibold text-green-800 mb-2">
                  Approved! Automation Complete
                </p>
                <div className="text-sm text-green-700 space-y-1">
                  <p>Spreadsheet: Added (column {actionResult.spreadsheet?.column})</p>
                  <p>Post copy: {actionResult.postsPopulated} post(s) populated</p>
                  <p>Render batches: {actionResult.renderBatches?.length || 0} created</p>
                  <p>Emails: Sent to dealer and Olivia</p>
                </div>
                <p className="text-sm text-green-600 mt-2">
                  Renders will complete in ~{actionResult.estimatedCompletion}
                </p>
                {actionResult.warnings && actionResult.warnings.length > 0 && (
                  <div className="mt-3 p-2 bg-yellow-50 border border-yellow-300 rounded">
                    <p className="text-xs font-medium text-yellow-800">Warnings:</p>
                    <ul className="text-xs text-yellow-700 ml-4 list-disc">
                      {actionResult.warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <p className={actionResult.success ? 'text-green-800' : 'text-red-800'}>
                {actionResult.success ? 'Saved successfully' : actionResult.message}
              </p>
            )}
          </div>
        )}

        {/* Action Button */}
        <div className="flex justify-end pt-2">
          {isReview ? (
            <button
              onClick={() => onAction(dealer)}
              disabled={actionLoading || !dealer.edited_logo}
              className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                !dealer.edited_logo
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : actionLoading
                  ? 'bg-gray-400 text-white cursor-wait'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {actionLoading ? 'Approving...' : 'Approve & Add to Spreadsheet'}
            </button>
          ) : (
            <button
              onClick={() => onAction(dealer)}
              disabled={actionLoading || !hasChanges}
              className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                !hasChanges
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : actionLoading
                  ? 'bg-gray-400 text-white cursor-wait'
                  : 'bg-brand text-white hover:bg-brand-dark'
              }`}
            >
              {actionLoading ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
