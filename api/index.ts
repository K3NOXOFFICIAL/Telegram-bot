/**
 * Vercel Serverless Function: Dashboard
 * Endpoint: /api/index
 * Liefert die Management UI
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { readFileSync } from 'fs';
import { join } from 'path';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    // Lese die HTML-Datei mit verschiedenen möglichen Pfaden
    let html: string;
    try {
      // Versuche 1: Relativer Pfad vom Root
      html = readFileSync(join(process.cwd(), 'public', 'index.html'), 'utf-8');
    } catch {
      try {
        // Versuche 2: Relativer Pfad vom api Ordner
        html = readFileSync(join(__dirname, '..', 'public', 'index.html'), 'utf-8');
      } catch {
        // Versuche 3: Direkt im public Ordner (Vercel build)
        html = readFileSync(join('/var/task', 'public', 'index.html'), 'utf-8');
      }
    }

    // Sende HTML
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.status(200).send(html);

  } catch (error: any) {
    console.error('Error loading dashboard:', error);
    console.error('CWD:', process.cwd());
    console.error('__dirname:', __dirname);
    
    return res.status(500).send(`
      <html>
        <body>
          <h1>Error loading dashboard</h1>
          <pre>${error.message}</pre>
          <p>CWD: ${process.cwd()}</p>
          <p>Dirname: ${__dirname}</p>
        </body>
      </html>
    `);
  }
}
