// GET /api/admin/dealers - Fetch dealers from SQLite
import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'sqlite', 'creative.db');

export async function GET(request: NextRequest) {
  const filter = request.nextUrl.searchParams.get('filter') || 'not-ready';

  try {
    const db = new Database(DB_PATH, { readonly: true });

    let query = `
      SELECT dealer_no, display_name, creatomate_website, creatomate_logo, ready_for_automate
      FROM dealers
      WHERE program_status = 'FULL'
    `;

    if (filter === 'not-ready') {
      query += ` AND (ready_for_automate IS NULL OR ready_for_automate != 'yes')`;
    } else if (filter === 'no-logo') {
      query += ` AND (creatomate_logo IS NULL OR creatomate_logo = '')`;
    }

    query += ` ORDER BY display_name`;

    const dealers = db.prepare(query).all();
    db.close();

    return NextResponse.json({ dealers });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dealers' },
      { status: 500 }
    );
  }
}
