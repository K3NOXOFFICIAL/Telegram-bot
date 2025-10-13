/**
 * Vercel Serverless Function: Telegram Webhook (Optional)
 * Endpoint: /api/webhook
 * Empfängt Updates von Telegram (falls Webhook-Modus gewünscht)
 */

import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Nur POST-Anfragen erlauben
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const update = req.body;

    console.log('Telegram Update empfangen:', JSON.stringify(update, null, 2));

    // Hier könnte man auf Telegram-Befehle reagieren, z.B.:
    // - /sync - Manuelle Synchronisierung starten
    // - /status - Status anzeigen
    // - /topics - Alle Topics auflisten

    if (update.message?.text) {
      const text = update.message.text;
      const chatId = update.message.chat.id;

      if (text === '/start') {
        // Willkommensnachricht
        // Hier könnte man eine Antwort senden
      } else if (text === '/sync') {
        // Synchronisierung starten
        // Könnte einen Background-Job triggern
      }
    }

    // Bestätige Empfang
    return res.status(200).json({ ok: true });

  } catch (error: any) {
    console.error('❌ Fehler im Webhook-Endpoint:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
