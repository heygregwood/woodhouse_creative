/**
 * POST /api/admin/send-welcome-email
 *
 * Sends a welcome email to a new dealer.
 * Body: { dealerNo: string, dryRun?: boolean }
 */

import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

const SCRIPT_PATH = path.join(process.cwd(), 'scripts', 'email_sender', 'send_email.py');

interface EmailResult {
  success: boolean;
  output: string;
  error?: string;
}

function runEmailScript(dealerNo: string, dryRun: boolean): Promise<EmailResult> {
  return new Promise((resolve) => {
    const args = ['welcome', dealerNo];
    if (dryRun) {
      args.push('--dry-run');
    }

    const python = spawn('python3', [SCRIPT_PATH, ...args], {
      cwd: process.cwd(),
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    python.on('close', (code) => {
      if (code !== 0) {
        resolve({
          success: false,
          output: stdout,
          error: stderr || `Script exited with code ${code}`,
        });
        return;
      }

      resolve({
        success: true,
        output: stdout,
      });
    });

    python.on('error', (err) => {
      resolve({
        success: false,
        output: '',
        error: `Failed to run script: ${err.message}`,
      });
    });
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dealerNo, dryRun = false } = body;

    if (!dealerNo) {
      return NextResponse.json(
        { success: false, error: 'dealerNo is required' },
        { status: 400 }
      );
    }

    const result = await runEmailScript(dealerNo, dryRun);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to send email' },
      { status: 500 }
    );
  }
}
