/**
 * Vercel Serverless Function: Dashboard
 * Endpoint: /api/index
 * Liefert die Management UI
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import * as fs from 'fs';
import * as path from 'path';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    // Lese die HTML-Datei
    const htmlPath = path.join(process.cwd(), 'public', 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf-8');

    // Sende HTML
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);

  } catch (error: any) {
    console.error('Error loading dashboard:', error);
    return res.status(500).json({
      error: 'Failed to load dashboard',
      message: error.message
    });
  }
}
