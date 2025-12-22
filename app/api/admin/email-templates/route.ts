/**
 * GET /api/admin/email-templates - List all email templates
 * GET /api/admin/email-templates?name=welcome - Get specific template
 * POST /api/admin/email-templates - Save a template
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const TEMPLATES_DIR = path.join(process.cwd(), 'templates', 'emails');

// Template metadata
const TEMPLATE_INFO: Record<string, { name: string; description: string; variables: string[] }> = {
  welcome: {
    name: 'Welcome Email',
    description: 'Sent to new dealers when they are added to the program',
    variables: ['first_name', 'business_name', 'brand', 'distributor', 'video_url', 'fb_admin_guide_url'],
  },
  post_scheduled: {
    name: 'Post Scheduled',
    description: 'Sent when a post has been scheduled for a dealer',
    variables: ['first_name', 'business_name'],
  },
  first_post_scheduled: {
    name: 'First Post Scheduled',
    description: 'Sent when the first post is scheduled for a new dealer',
    variables: ['first_name', 'business_name'],
  },
  content_ready: {
    name: 'Content Ready',
    description: 'Sent to CONTENT dealers when their content is ready to download',
    variables: ['first_name', 'business_name', 'download_url'],
  },
  fb_admin_accepted: {
    name: 'FB Admin Accepted',
    description: 'Sent when dealer grants Facebook admin access',
    variables: ['first_name', 'business_name'],
  },
  holiday: {
    name: 'Holiday',
    description: 'Holiday greeting email',
    variables: ['first_name', 'business_name'],
  },
};

export async function GET(request: NextRequest) {
  const templateName = request.nextUrl.searchParams.get('name');

  try {
    if (templateName) {
      // Get specific template
      const filePath = path.join(TEMPLATES_DIR, `${templateName}.html`);
      const content = await fs.readFile(filePath, 'utf-8');
      const info = TEMPLATE_INFO[templateName] || {
        name: templateName,
        description: '',
        variables: [],
      };

      return NextResponse.json({
        id: templateName,
        ...info,
        content,
      });
    } else {
      // List all templates
      const files = await fs.readdir(TEMPLATES_DIR);
      const templates = [];

      for (const file of files) {
        if (file.endsWith('.html')) {
          const id = file.replace('.html', '');
          const filePath = path.join(TEMPLATES_DIR, file);
          const stats = await fs.stat(filePath);
          const info = TEMPLATE_INFO[id] || {
            name: id,
            description: '',
            variables: [],
          };

          templates.push({
            id,
            ...info,
            lastModified: stats.mtime.toISOString(),
          });
        }
      }

      return NextResponse.json({ templates });
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to read template' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, content } = body;

    if (!id || !content) {
      return NextResponse.json({ error: 'id and content are required' }, { status: 400 });
    }

    // Validate template name (prevent path traversal)
    if (!/^[a-z_]+$/.test(id)) {
      return NextResponse.json({ error: 'Invalid template name' }, { status: 400 });
    }

    const filePath = path.join(TEMPLATES_DIR, `${id}.html`);
    await fs.writeFile(filePath, content, 'utf-8');

    return NextResponse.json({
      success: true,
      message: `Template "${id}" saved successfully`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save template' },
      { status: 500 }
    );
  }
}
