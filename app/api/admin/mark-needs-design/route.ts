// POST /api/admin/mark-needs-design - Mark a dealer as needing logo design
import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'sqlite', 'creative.db');

export async function POST(request: NextRequest) {
  try {
    const { dealerNo } = await request.json();

    if (!dealerNo) {
      return NextResponse.json({ error: 'Missing dealerNo' }, { status: 400 });
    }

    const db = new Database(DB_PATH);
    
    db.prepare(`
      UPDATE dealers 
      SET logo_needs_design = 1, updated_at = CURRENT_TIMESTAMP
      WHERE dealer_no = ?
    `).run(dealerNo);

    db.close();

    return NextResponse.json({ success: true, dealerNo });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to update dealer' },
      { status: 500 }
    );
  }
}

// GET /api/admin/mark-needs-design - Get all dealers needing design
export async function GET() {
  try {
    const db = new Database(DB_PATH, { readonly: true });
    
    const dealers = db.prepare(`
      SELECT dealer_no, display_name, creatomate_website, creatomate_logo
      FROM dealers 
      WHERE logo_needs_design = 1
      ORDER BY display_name
    `).all();

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
