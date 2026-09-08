import { extractWithGemini } from './gemini.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const text = typeof req.body === 'string' ? JSON.parse(req.body).text : req.body?.text;
  if (!text || typeof text !== 'string') return res.status(400).json({ error: 'Syllabus text is required' });
  try {
    return res.status(200).json(await extractWithGemini(text, process.env.GEMINI_API_KEY, process.env.GEMINI_MODEL));
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : 'Gemini extraction failed' });
  }
}
