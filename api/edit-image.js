export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-openrouter-key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageDataUrl, prompt } = req.body || {};
  if (!imageDataUrl || !prompt) {
    return res.status(400).json({ error: 'Image data and prompt are required' });
  }

  const headerKey = req.headers['x-openrouter-key'];
  const apiKey = headerKey || process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(400).json({ error: 'OpenRouter API key not configured', code: 'MISSING_API_KEY' });
  }

  const models = [
    'google/gemini-2.0-flash-exp',
    'google/gemini-2.5-flash-preview',
    'openai/gpt-4o',
    'anthropic/claude-3.5-sonnet'
  ];

  const extractImageFromResponse = (data) => {
    const choice = data?.choices?.[0]?.message?.content;
    if (!choice) return null;
    if (Array.isArray(choice)) {
      for (const item of choice) {
        if (!item) continue;
        if (item.type === 'image' && item.data) return item.data;
        if (item.type === 'image_url' && item.image_url?.url) return item.image_url.url;
        if (item.type === 'output_image' && item.image_url) return item.image_url;
        if (typeof item.text === 'string') {
          const m = item.text.match(/data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/=]+/);
          if (m) return m[0];
        }
      }
    }
    if (typeof choice === 'string') {
      const m = choice.match(/data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/=]+/);
      if (m) return m[0];
    }
    return null;
  };

  for (const model of models) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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
                { type: 'text', text: `Edit this image according to the following instruction: ${prompt}. Return the edited image.` },
                { type: 'image_url', image_url: { url: imageDataUrl } }
              ]
            }
          ],
          max_tokens: 1000,
          temperature: 0.7,
          modalities: ['image']
        }),
      });
      if (!response.ok) continue;
      const data = await response.json();
      const img = extractImageFromResponse(data);
      if (img) return res.status(200).json({ success: true, editedImage: img, model });
    } catch (e) {
      continue;
    }
  }

  return res.status(502).json({ error: 'All models failed to edit image' });
}
