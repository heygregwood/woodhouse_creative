/**
 * GET /api/admin/posts/list
 *
 * Fetches all posts from Firestore posts collection
 * Returns post number, template ID, base copy, and created date
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';

export async function GET() {
  try {
    // Get all posts (don't use orderBy in case some docs are missing createdAt)
    const postsSnapshot = await db.collection('posts').get();

    const posts = postsSnapshot.docs.map(doc => ({
      postNumber: parseInt(doc.id),
      templateId: doc.data().templateId || '',
      baseCopy: doc.data().baseCopy || '',
      createdAt: doc.data().createdAt || null,
    }));

    // Sort by post number descending (newest posts have higher numbers)
    posts.sort((a, b) => b.postNumber - a.postNumber);

    return NextResponse.json({
      success: true,
      posts,
      total: posts.length,
    });
  } catch (error: unknown) {
    console.error('[posts/list] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch posts' },
      { status: 500 }
    );
  }
}
