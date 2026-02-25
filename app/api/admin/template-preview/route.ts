/**
 * GET /api/admin/template-preview?templateId={id}
 *
 * Fetches template details from Creatomate API including preview/snapshot URL
 */

import { NextRequest, NextResponse } from 'next/server';

const CREATOMATE_API_BASE = 'https://api.creatomate.com/v1';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('templateId');

    if (!templateId) {
      return NextResponse.json(
        { error: 'templateId is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.CREATOMATE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Creatomate API key not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(`${CREATOMATE_API_BASE}/templates/${templateId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Template not found' },
          { status: 404 }
        );
      }
      const errorText = await response.text();
      throw new Error(`Creatomate API error (${response.status}): ${errorText}`);
    }

    const template = await response.json();

    // Log what we get from Creatomate for debugging
    console.log('[template-preview] Creatomate response:', JSON.stringify(template, null, 2));

    return NextResponse.json({
      success: true,
      template: {
        id: template.id,
        name: template.name,
        projectId: template.project_id || null,
        previewUrl: template.snapshot_url || template.preview_url || template.thumbnail_url || null,
        width: template.width,
        height: template.height,
        duration: template.duration,
      },
    });
  } catch (error: unknown) {
    console.error('[template-preview] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch template' },
      { status: 500 }
    );
  }
}
