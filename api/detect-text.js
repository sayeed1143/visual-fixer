export default async function handler(req, res) {
  // Enable CORS for development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageDataUrl } = req.body;
  if (!imageDataUrl) {
    return res.status(400).json({ error: 'Image data is required' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OpenRouter API key not configured' });
  }

  const prompt = `Analyze this image and detect all text elements with high precision. Return a JSON array with each text element containing: text content, x/y coordinates (as percentages 0-100 from top-left), width/height (as percentages), and confidence (0-1). Be very accurate with positioning for text replacement. Format: [{"text":"example","x":10,"y":20,"width":15,"height":5,"confidence":0.95}]`;

  const fetchWithTimeout = async (url, options = {}, timeoutMs = 30000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res2 = await fetch(url, { ...options, signal: controller.signal });
      return res2;
    } finally {
      clearTimeout(id);
    }
  };

  const listModels = async () => {
    try {
      const r = await fetchWithTimeout('https://openrouter.ai/api/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      }, 15000);
      if (!r.ok) return [];
      const j = await r.json();
      const ids = Array.isArray(j.data) ? j.data.map(m => m.id) : [];
      return ids;
    } catch {
      return [];
    }
  };

  const preferred = [
    'openai/gpt-4o',
    'openai/gpt-4o-mini',
    'anthropic/claude-3.5-sonnet',
    'anthropic/claude-3.5-haiku',
    'google/gemini-2.0-flash',
    'google/gemini-1.5-flash',
  ];

  const available = await listModels();
  const chosen = preferred.filter(id => available.includes(id));
  // If none of the exact slugs match, attempt fuzzy picks from available
  if (chosen.length === 0 && available.length > 0) {
    const fuzzy = available.filter(id => /gpt-4o|claude-3\.5|gemini.*flash/i.test(id));
    chosen.push(...fuzzy.slice(0, 3));
  }

  const tried = [];
  for (const model of chosen) {
    tried.push(model);
    try {
      const response = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: imageDataUrl } }
              ]
            }
          ],
          max_tokens: 1500,
          temperature: 0.1
        }),
      }, 45000);

      if (!response.ok) {
        console.error(`${model} failed:`, response.status);
        continue;
      }

      const data = await response.json();
      let textContent = data.choices?.[0]?.message?.content ?? '';
      if (Array.isArray(textContent)) {
        textContent = textContent.map(part => (typeof part === 'string' ? part : part?.text || '')).join('\n');
      }

      const extractJsonArray = (txt) => {
        // Prefer fenced code blocks
        const code = txt.match(/```json\s*([\s\S]*?)```/i);
        if (code && code[1]) return code[1];
        // Direct JSON
        try { JSON.parse(txt); return txt; } catch {}
        // Scan for top-level []
        let depth = 0, start = -1;
        for (let i = 0; i < txt.length; i++) {
          const ch = txt[i];
          if (ch === '[') { if (depth === 0) start = i; depth++; }
          else if (ch === ']') { depth--; if (depth === 0 && start !== -1) return txt.slice(start, i + 1); }
        }
        return null;
      };

      const jsonStr = extractJsonArray(String(textContent));
      if (!jsonStr) {
        continue;
      }

      let parsed;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (e) {
        console.error('JSON parse failed for model', model, e);
        continue;
      }

      if (!Array.isArray(parsed)) {
        continue;
      }

      const detectedTexts = parsed.map((item, index) => ({
        id: `text-${index}`,
        text: item.text,
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        confidence: item.confidence || 0.8,
        model
      }));

      return res.status(200).json({ success: true, detectedTexts, model });
    } catch (error) {
      console.error(`Error with ${model}:`, error);
      continue;
    }
  }

  return res.status(502).json({ error: 'All models failed to detect text', tried });
}
