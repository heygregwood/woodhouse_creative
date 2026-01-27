'use client';

import { useState, useEffect } from 'react';

interface Template {
  id: string;
  name: string;
  description: string;
  variables: string[];
  lastModified?: string;
  content?: string;
}

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  // Fetch templates list
  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/email-templates');
      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load specific template
  const loadTemplate = async (templateId: string) => {
    try {
      const response = await fetch(`/api/admin/email-templates?name=${templateId}`);
      const data = await response.json();
      setSelectedTemplate(data);
      setEditedContent(data.content || '');
      setSaveResult(null);
      setPreviewMode(false);
    } catch (error) {
      console.error('Failed to load template:', error);
    }
  };

  // Save template
  const handleSave = async () => {
    if (!selectedTemplate) return;

    try {
      setSaving(true);
      setSaveResult(null);

      const response = await fetch('/api/admin/email-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedTemplate.id,
          content: editedContent,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSaveResult({ success: true, message: 'Template saved successfully!' });
        fetchTemplates(); // Refresh list
      } else {
        setSaveResult({ success: false, message: data.error || 'Failed to save template' });
      }
    } catch (error) {
      setSaveResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to save template',
      });
    } finally {
      setSaving(false);
    }
  };

  // Preview with sample data
  const getPreviewHtml = () => {
    if (!editedContent) return '';

    const sampleData: Record<string, string> = {
      first_name: 'John',
      business_name: 'ABC Heating & Cooling',
      brand: 'Armstrong Air',
      distributor: 'Allied Air Enterprises',
      video_url: 'https://example.com/video',
      fb_admin_guide_url: 'https://example.com/guide.pdf',
      download_url: 'https://example.com/download',
    };

    let preview = editedContent;
    for (const [key, value] of Object.entries(sampleData)) {
      preview = preview.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }

    return preview;
  };

  return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Template List */}
          <div className="lg:col-span-1">
            <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h2 className="font-semibold text-text">Templates</h2>
              </div>

              <div className="divide-y divide-gray-200">
                {loading ? (
                  <div className="p-4 text-center text-gray-500">Loading...</div>
                ) : (
                  templates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => loadTemplate(template.id)}
                      className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                        selectedTemplate?.id === template.id ? 'bg-brand/5 border-l-4 border-brand' : ''
                      }`}
                    >
                      <p className="font-medium text-gray-900">{template.name}</p>
                      <p className="text-xs text-gray-500 mt-1">{template.description}</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Editor */}
          <div className="lg:col-span-3">
            {selectedTemplate ? (
              <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-border flex justify-between items-center">
                  <div>
                    <h2 className="text-lg font-semibold text-text">{selectedTemplate.name}</h2>
                    <p className="text-sm text-gray-500 mt-1">{selectedTemplate.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPreviewMode(!previewMode)}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        previewMode
                          ? 'bg-brand text-white'
                          : 'bg-brand/10 text-brand hover:bg-brand/20'
                      }`}
                    >
                      {previewMode ? 'Edit' : 'Preview'}
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400 font-medium transition-colors"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>

                {/* Variables hint */}
                <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Available variables:</span>{' '}
                    {selectedTemplate.variables.map((v) => (
                      <code key={v} className="mx-1 px-2 py-0.5 bg-gray-200 rounded text-xs">
                        {`{{${v}}}`}
                      </code>
                    ))}
                  </p>
                </div>

                {/* Save result */}
                {saveResult && (
                  <div
                    className={`px-6 py-3 ${
                      saveResult.success
                        ? 'bg-green-50 text-green-800 border-b border-green-200'
                        : 'bg-red-50 text-red-800 border-b border-red-200'
                    }`}
                  >
                    {saveResult.message}
                  </div>
                )}

                {/* Editor / Preview */}
                <div className="p-6">
                  {previewMode ? (
                    <div className="border border-gray-300 rounded-lg overflow-hidden">
                      <div className="bg-gray-100 px-4 py-2 border-b border-gray-300">
                        <p className="text-sm text-gray-600">Preview (with sample data)</p>
                      </div>
                      <iframe
                        srcDoc={getPreviewHtml()}
                        className="w-full h-[600px] bg-white"
                        title="Email Preview"
                      />
                    </div>
                  ) : (
                    <textarea
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      className="w-full h-[600px] p-4 font-mono text-sm border border-gray-300 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none resize-none"
                      placeholder="Enter HTML template..."
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white border border-border rounded-lg p-12 text-center text-gray-500">
                <p className="text-lg">Select a template to edit</p>
                <p className="text-sm mt-2">Choose from the list on the left</p>
              </div>
            )}
          </div>
        </div>
      </div>
  );
}
