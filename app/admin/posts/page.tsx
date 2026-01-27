'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';

interface ExistingPost {
  postNumber: number;
  templateId: string;
  baseCopy: string;
  createdAt: string | null;
}

interface PostThumbnail {
  thumbnailUrl: string | null;
  videoName: string | null;
  webViewLink: string | null;
  fileId: string | null;
  loading: boolean;
  error: string | null;
}

// Creatomate project ID - all templates are in this project
const CREATOMATE_PROJECT_ID = 'bbd96437-00cd-4022-94b1-8be6a95faefa';

export default function PostsPage() {
  // View Posts state
  const [existingPosts, setExistingPosts] = useState<ExistingPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [postSearchQuery, setPostSearchQuery] = useState('');
  const [expandedPosts, setExpandedPosts] = useState<Set<number>>(new Set());
  const [showViewPosts, setShowViewPosts] = useState(true);
  const [postThumbnails, setPostThumbnails] = useState<Record<number, PostThumbnail>>({});
  const [failedThumbnails, setFailedThumbnails] = useState<Set<number>>(new Set());

  // Create New Post State
  const [newPostNumber, setNewPostNumber] = useState('');
  const [newPostTemplateId, setNewPostTemplateId] = useState('');
  const [newPostBaseCopy, setNewPostBaseCopy] = useState('');
  const [creatingPost, setCreatingPost] = useState(false);
  const [createPostResult, setCreatePostResult] = useState<{
    success?: boolean;
    error?: string;
    postNumber?: number;
    spreadsheet?: { row: number; dealersPopulated: number };
    render?: { batchId: string; jobsCreated: number; estimatedMinutes: number };
    message?: string;
  } | null>(null);

  // PDF Generation state
  const [pdfStartPost, setPdfStartPost] = useState('');
  const [pdfEndPost, setPdfEndPost] = useState('');
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Fetch existing posts from Firestore
  const fetchExistingPosts = useCallback(async () => {
    try {
      setLoadingPosts(true);
      setPostsError(null);
      const response = await fetch('/api/admin/posts/list');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch posts');
      setExistingPosts(data.posts || []);
    } catch (error: unknown) {
      setPostsError(error instanceof Error ? error.message : 'Failed to fetch posts');
    } finally {
      setLoadingPosts(false);
    }
  }, []);

  // Fetch existing posts on mount
  useEffect(() => {
    fetchExistingPosts();
  }, [fetchExistingPosts]);

  // Filter posts based on search query
  const filteredPosts = existingPosts.filter(post => {
    if (!postSearchQuery) return true;
    const query = postSearchQuery.toLowerCase();
    return (
      post.postNumber.toString().includes(query) ||
      post.templateId.toLowerCase().includes(query) ||
      post.baseCopy.toLowerCase().includes(query)
    );
  });

  // Toggle expanded state for a post
  const togglePostExpanded = (postNumber: number) => {
    setExpandedPosts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(postNumber)) newSet.delete(postNumber);
      else newSet.add(postNumber);
      return newSet;
    });
  };

  // Fetch post thumbnail from Google Drive
  const fetchPostThumbnail = async (postNumber: number) => {
    if (postThumbnails[postNumber]?.loading || postThumbnails[postNumber]?.thumbnailUrl) return;

    setPostThumbnails(prev => ({
      ...prev,
      [postNumber]: { thumbnailUrl: null, videoName: null, webViewLink: null, fileId: null, loading: true, error: null },
    }));

    try {
      const response = await fetch(`/api/admin/post-thumbnail?postNumber=${postNumber}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch thumbnail');

      if (data.found && data.video && data.video.id) {
        setPostThumbnails(prev => ({
          ...prev,
          [postNumber]: {
            thumbnailUrl: null,
            videoName: data.video.name,
            webViewLink: data.video.webViewLink,
            fileId: data.video.id,
            loading: false,
            error: null,
          },
        }));
      } else {
        setPostThumbnails(prev => ({
          ...prev,
          [postNumber]: { thumbnailUrl: null, videoName: null, webViewLink: null, fileId: null, loading: false, error: 'No video found' },
        }));
      }
    } catch (error: unknown) {
      setPostThumbnails(prev => ({
        ...prev,
        [postNumber]: { thumbnailUrl: null, videoName: null, webViewLink: null, fileId: null, loading: false, error: error instanceof Error ? error.message : 'Failed to load thumbnail' },
      }));
    }
  };

  // Insert variable at cursor position for new post form
  const insertNewPostVariable = (variable: string) => {
    const textarea = document.getElementById('newPostBaseCopyTextarea') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText = newPostBaseCopy.substring(0, start) + variable + newPostBaseCopy.substring(end);
      setNewPostBaseCopy(newText);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    } else {
      setNewPostBaseCopy(newPostBaseCopy + variable);
    }
  };

  // Handle create new post
  const handleCreatePost = async () => {
    if (!newPostNumber || !newPostTemplateId || !newPostBaseCopy) {
      setCreatePostResult({ error: 'Post number, template ID, and base copy are required' });
      return;
    }

    try {
      setCreatingPost(true);
      setCreatePostResult(null);

      const response = await fetch('/api/admin/create-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postNumber: newPostNumber,
          templateId: newPostTemplateId,
          baseCopy: newPostBaseCopy,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setCreatePostResult({
          success: true,
          postNumber: data.postNumber,
          spreadsheet: data.spreadsheet,
          render: data.render,
          message: data.message,
        });
        setNewPostNumber('');
        setNewPostTemplateId('');
        setNewPostBaseCopy('');
        fetchExistingPosts(); // Refresh the list
      } else {
        setCreatePostResult({ error: data.error || 'Failed to create post' });
      }
    } catch (error) {
      setCreatePostResult({ error: error instanceof Error ? error.message : 'Failed to create post' });
    } finally {
      setCreatingPost(false);
    }
  };

  return (
      <div className="max-w-7xl mx-auto p-8">
        {/* Create New Post Section */}
        <div className="mb-8">
          <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-semibold text-text">Create New Post</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Add post to Firestore, populate spreadsheet, and create render jobs - all in one step
                  </p>
                </div>
                <a
                  href="https://docs.google.com/spreadsheets/d/1KuyojiujcaxmyJeBIxExG87W2AwM3LM1awqWO9u44PY"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-3 py-1.5 text-brand hover:text-brand-dark transition-colors"
                >
                  Open Spreadsheet
                </a>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Post Number and Template ID */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Post Number</label>
                  <input
                    type="number"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none"
                    value={newPostNumber}
                    onChange={(e) => setNewPostNumber(e.target.value)}
                    placeholder="673"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Creatomate Template ID</label>
                  <input
                    type="text"
                    className="w-full p-2 border border-gray-300 rounded-lg font-mono text-sm focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none"
                    value={newPostTemplateId}
                    onChange={(e) => setNewPostTemplateId(e.target.value)}
                    placeholder="abc123-def456-..."
                  />
                </div>
              </div>

              {/* Base Copy Textarea */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-gray-700">Base Post Copy</label>
                  <div className="flex gap-1">
                    <span className="text-xs text-gray-500 mr-2">Insert:</span>
                    <button type="button" onClick={() => insertNewPostVariable('{name}')} className="px-2 py-1 text-xs bg-brand/10 text-brand rounded hover:bg-brand/20 transition-colors font-medium">Name</button>
                    <button type="button" onClick={() => insertNewPostVariable('{phone}')} className="px-2 py-1 text-xs bg-brand/10 text-brand rounded hover:bg-brand/20 transition-colors font-medium">Phone</button>
                    <button type="button" onClick={() => insertNewPostVariable('{website}')} className="px-2 py-1 text-xs bg-brand/10 text-brand rounded hover:bg-brand/20 transition-colors font-medium">Website</button>
                  </div>
                </div>
                <textarea
                  id="newPostBaseCopyTextarea"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none resize-none"
                  rows={4}
                  value={newPostBaseCopy}
                  onChange={(e) => setNewPostBaseCopy(e.target.value)}
                  placeholder="Enter post copy here. Use the buttons above to insert variables like {name}, {phone}, or {website}."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Variables: <code className="bg-brand/10 px-1 rounded">{'{name}'}</code> = Display Name, <code className="bg-brand/10 px-1 rounded">{'{phone}'}</code> = Phone, <code className="bg-brand/10 px-1 rounded">{'{website}'}</code> = Website
                </p>
              </div>

              {/* Create Button */}
              <button
                onClick={handleCreatePost}
                disabled={creatingPost || !newPostNumber || !newPostTemplateId || !newPostBaseCopy}
                className="w-full px-6 py-3 bg-brand text-white rounded-lg hover:bg-brand-dark disabled:bg-gray-300 disabled:cursor-not-allowed font-semibold transition-colors"
              >
                {creatingPost ? 'Creating Post...' : 'Create Post & Start Renders'}
              </button>

              {/* Result */}
              {createPostResult && (
                <div className={`p-4 rounded-lg ${createPostResult.error ? 'bg-red-50 border border-red-500 text-red-800' : 'bg-green-50 border border-green-500 text-green-800'}`}>
                  {createPostResult.error ? (
                    <><p className="font-medium">Error</p><p className="text-sm mt-1">{createPostResult.error}</p></>
                  ) : (
                    <>
                      <p className="font-medium text-green-800 mb-2">Post {createPostResult.postNumber} Created Successfully!</p>
                      <div className="text-sm space-y-1">
                        <p>• Spreadsheet: Row {createPostResult.spreadsheet?.row}, {createPostResult.spreadsheet?.dealersPopulated} dealers populated</p>
                        <p>• Renders: {createPostResult.render?.jobsCreated} jobs queued (Batch: {createPostResult.render?.batchId?.slice(0, 8)}...)</p>
                        <p className="text-green-600 mt-2">Estimated completion: ~{createPostResult.render?.estimatedMinutes} minutes</p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* View Existing Posts Section */}
        <div className="mb-8">
          <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
            <div
              className="px-6 py-4 border-b border-border flex justify-between items-center cursor-pointer"
              onClick={() => setShowViewPosts(!showViewPosts)}
            >
              <div>
                <h2 className="text-lg font-semibold text-text">View Existing Posts</h2>
                <p className="text-sm text-gray-500 mt-1">{existingPosts.length} posts in database</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={(e) => { e.stopPropagation(); fetchExistingPosts(); }}
                  disabled={loadingPosts}
                  className="px-4 py-2 bg-brand/10 text-brand rounded-lg hover:bg-brand/20 disabled:bg-gray-200 font-medium transition-colors"
                >
                  {loadingPosts ? 'Loading...' : 'Refresh'}
                </button>
                <span className="text-text text-2xl">{showViewPosts ? '▼' : '▶'}</span>
              </div>
            </div>

            {showViewPosts && (
              <div className="p-6">
                {/* Search Bar and Find Videos */}
                <div className="mb-4 flex gap-3">
                  <input
                    type="text"
                    placeholder="Search by post number, template ID, or copy..."
                    className="flex-1 p-3 border border-gray-300 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none"
                    value={postSearchQuery}
                    onChange={(e) => setPostSearchQuery(e.target.value)}
                  />
                  <button
                    onClick={() => {
                      filteredPosts.slice(0, 10).forEach(post => {
                        if (!postThumbnails[post.postNumber]) fetchPostThumbnail(post.postNumber);
                      });
                    }}
                    className="px-4 py-2 bg-brand/10 text-brand rounded-lg hover:bg-brand/20 transition-colors whitespace-nowrap"
                  >
                    Find Videos
                  </button>
                </div>

                {postsError && (
                  <div className="p-4 bg-red-50 text-red-800 border border-red-200 rounded-lg mb-4">Error: {postsError}</div>
                )}

                {loadingPosts && existingPosts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">Loading posts...</div>
                ) : filteredPosts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">{postSearchQuery ? 'No posts match your search' : 'No posts found'}</div>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto">
                    {filteredPosts.map((post) => (
                      <div key={post.postNumber} className="border border-border rounded-lg overflow-hidden hover:border-brand transition-colors">
                        {/* Post Header - Always visible */}
                        <div className="bg-gray-50 px-4 py-3 flex items-center justify-between cursor-pointer" onClick={() => togglePostExpanded(post.postNumber)}>
                          <div className="flex items-center gap-4">
                            {/* Video Thumbnail - 9:16 aspect ratio for mobile videos */}
                            <div className="w-14 h-[100px] bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden border border-gray-200" title={postThumbnails[post.postNumber]?.videoName || 'Click to check for video'}>
                              {postThumbnails[post.postNumber]?.loading ? (
                                <span className="text-xs text-gray-500 animate-pulse">...</span>
                              ) : postThumbnails[post.postNumber]?.fileId ? (
                                <a href={postThumbnails[post.postNumber].webViewLink!} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="relative block w-full h-full" title={`View: ${postThumbnails[post.postNumber].videoName}`}>
                                  {failedThumbnails.has(post.postNumber) ? (
                                    <div className="flex flex-col items-center justify-center w-full h-full">
                                      <span className="text-xl">🎬</span>
                                      <span className="text-[9px] text-gray-500">View</span>
                                    </div>
                                  ) : (
                                    <Image
                                      src={`/api/admin/post-thumbnail-image?fileId=${postThumbnails[post.postNumber].fileId}`}
                                      alt={`Post ${post.postNumber} thumbnail`}
                                      className="object-cover"
                                      fill
                                      unoptimized
                                      onError={() => {
                                        setFailedThumbnails(prev => new Set(prev).add(post.postNumber));
                                      }}
                                    />
                                  )}
                                </a>
                              ) : postThumbnails[post.postNumber]?.error === 'No video found' ? (
                                <span className="text-lg text-gray-400" title="No video found">📭</span>
                              ) : postThumbnails[post.postNumber] ? (
                                <span className="text-lg">🎬</span>
                              ) : (
                                <button onClick={(e) => { e.stopPropagation(); fetchPostThumbnail(post.postNumber); }} className="flex flex-col items-center justify-center w-full h-full hover:bg-gray-200 transition-colors text-gray-500">
                                  <span className="text-lg">🎬</span>
                                  <span className="text-[9px]">Load</span>
                                </button>
                              )}
                            </div>
                            <div>
                              <h3 className="font-bold text-lg text-gray-900">Post {post.postNumber}</h3>
                              <p className="text-xs text-gray-500 font-mono">{post.templateId ? post.templateId.substring(0, 8) + '...' : 'No template ID'}</p>
                              {post.createdAt && <p className="text-xs text-gray-400">Created: {new Date(post.createdAt).toLocaleDateString()}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <a href={`https://creatomate.com/projects/${CREATOMATE_PROJECT_ID}/templates/${post.templateId}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="px-3 py-1.5 text-sm bg-brand/10 text-brand rounded-lg hover:bg-brand/20 transition-colors">Open in Creatomate</a>
                            <span className="text-gray-400 text-xl">{expandedPosts.has(post.postNumber) ? '▼' : '▶'}</span>
                          </div>
                        </div>

                        {/* Expanded Content */}
                        {expandedPosts.has(post.postNumber) && (
                          <div className="p-4 border-t border-gray-200 bg-white">
                            <div className="mb-3">
                              <label className="block text-sm font-medium text-gray-600 mb-1">Template ID</label>
                              <code className="block p-2 bg-gray-100 rounded text-sm font-mono text-gray-800 break-all">{post.templateId || 'N/A'}</code>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-600 mb-1">Base Copy</label>
                              <div className="p-3 bg-gray-100 rounded text-sm text-gray-800 whitespace-pre-wrap">{post.baseCopy || 'No copy available'}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Generate Copy Deck PDF Section */}
        <div className="mb-8">
          <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold text-text">Generate Copy Deck PDF</h2>
              <p className="text-sm text-gray-500 mt-1">Create PDF with thumbnails and post copy for content dealers</p>
            </div>

            <div className="p-6">
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Post</label>
                  <input type="number" className="w-24 p-3 border border-gray-300 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none" value={pdfStartPost} onChange={(e) => setPdfStartPost(e.target.value)} placeholder="666" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Post</label>
                  <input type="number" className="w-24 p-3 border border-gray-300 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none" value={pdfEndPost} onChange={(e) => setPdfEndPost(e.target.value)} placeholder="682" />
                </div>
                <button
                  onClick={async () => {
                    if (!pdfStartPost || !pdfEndPost) { setPdfError('Please enter start and end post numbers'); return; }
                    const start = parseInt(pdfStartPost);
                    const end = parseInt(pdfEndPost);
                    if (start > end) { setPdfError('Start post must be less than or equal to end post'); return; }
                    if (end - start > 50) { setPdfError('Maximum 50 posts per PDF'); return; }

                    setGeneratingPdf(true);
                    setPdfError(null);

                    try {
                      const response = await fetch(`/api/admin/generate-copy-deck?startPost=${start}&endPost=${end}`);
                      if (!response.ok) {
                        const data = await response.json();
                        throw new Error(data.error || 'Failed to generate PDF');
                      }
                      const blob = await response.blob();
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `Turnkey_SM_Copy_Deck_Posts_${start}-${end}.pdf`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      window.URL.revokeObjectURL(url);
                    } catch (error: unknown) {
                      setPdfError(error instanceof Error ? error.message : 'Failed to generate PDF');
                    } finally {
                      setGeneratingPdf(false);
                    }
                  }}
                  disabled={generatingPdf || !pdfStartPost || !pdfEndPost}
                  className="px-6 py-3 bg-brand text-white font-medium rounded-lg hover:bg-brand-dark disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {generatingPdf ? 'Generating...' : 'Download PDF'}
                </button>
              </div>

              {pdfError && (
                <div className="mt-4 p-3 bg-red-50 text-red-800 border border-red-200 rounded-lg text-sm">{pdfError}</div>
              )}

              <p className="mt-4 text-sm text-gray-500">
                Generates a branded PDF with video thumbnails and post copy. Max 50 posts per PDF.
              </p>
            </div>
          </div>
        </div>
      </div>
  );
}
