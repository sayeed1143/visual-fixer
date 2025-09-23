import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'dist')));

// CORS middleware
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-openrouter-key');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Helper to get API key from header/body/env
const getOpenRouterKey = (req) => {
  const headerKey = req.headers['x-openrouter-key'];
  const bodyKey = req.body?.apiKey;
  return headerKey || bodyKey || process.env.OPENROUTER_API_KEY || '';
};

// Helper to safely extract an image (base64 or URL) from OpenRouter response
const extractImageFromResponse = (data) => {
  const choice = data?.choices?.[0]?.message?.content;
  if (!choice) return null;
  // If content is an array, look for image-like items
  if (Array.isArray(choice)) {
    for (const item of choice) {
      if (!item) continue;
      if (item.type === 'image' && item.data) return item.data; // base64
      if (item.type === 'image_url' && item.image_url?.url) return item.image_url.url; // URL
      if (item.type === 'output_image' && item.image_url) return item.image_url; // some models
      if (typeof item.text === 'string') {
        const m = item.text.match(/data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/=]+/);
        if (m) return m[0];
      }
    }
  }
  // If content is a string, try to parse base64 data url
  if (typeof choice === 'string') {
    const m = choice.match(/data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/=]+/);
    if (m) return m[0];
  }
  return null;
};

// Text detection endpoint
app.post('/api/detect-text', async (req, res) => {
  try {
    const { imageDataUrl } = req.body;
    if (!imageDataUrl) {
      return res.status(400).json({ error: 'Image data is required' });
    }

    const apiKey = getOpenRouterKey(req);
    if (!apiKey) {
      return res.status(400).json({ error: 'OpenRouter API key not configured', code: 'MISSING_API_KEY' });
    }

    const models = [
      'google/gemini-2.5-flash-preview',
      'openai/gpt-4o',
      'anthropic/claude-3.5-sonnet'
    ];

    const prompt = `Analyze this image and detect all text elements with high precision. Return a JSON array with each text element containing: text content, x/y coordinates (as percentages 0-100 from top-left), width/height (as percentages), and confidence (0-1). Be very accurate with positioning for text replacement. Format: [{"text":"example","x":10,"y":20,"width":15,"height":5,"confidence":0.95}]`;

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
                  { type: 'text', text: prompt },
                  { type: 'image_url', image_url: { url: imageDataUrl } }
                ]
              }
            ],
            max_tokens: 1500,
            temperature: 0.1
          }),
        });

        if (!response.ok) {
          continue;
        }

        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content;
        const textBlob = Array.isArray(content)
          ? content.map((c) => (typeof c?.text === 'string' ? c.text : '')).join('\n')
          : (typeof content === 'string' ? content : '');
        const jsonMatch = textBlob.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
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
        }
      } catch (error) {
        // try next model
        continue;
      }
    }

    return res.status(502).json({ error: 'All models failed to detect text' });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Image Editing Endpoint using multiple models
app.post('/api/edit-image', async (req, res) => {
  try {
    const { imageDataUrl, prompt } = req.body;
    if (!imageDataUrl || !prompt) {
      return res.status(400).json({ error: 'Image data and prompt are required' });
    }

    const apiKey = getOpenRouterKey(req);
    if (!apiKey) {
      return res.status(400).json({ error: 'OpenRouter API key not configured', code: 'MISSING_API_KEY' });
    }

    const models = [
      'black-forest-labs/flux-1.1-pro',
      'black-forest-labs/flux-1.1-schnell',
      'stability-ai/stable-diffusion'
    ];

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
        if (!response.ok) {
          continue;
        }
        const data = await response.json();
        const img = extractImageFromResponse(data);
        if (img) {
          return res.status(200).json({ success: true, editedImage: img, model });
        }
      } catch (e) {
        // try next model
        continue;
      }
    }

    return res.status(502).json({ error: 'All models failed to edit image' });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Text Replacement Endpoint (Specific use case)
app.post('/api/replace-text', async (req, res) => {
  try {
    const { imageDataUrl, originalText, newText, coordinates } = req.body;
    if (!imageDataUrl || !originalText || !newText) {
      return res.status(400).json({ error: 'Image data, original text, and new text are required' });
    }

    const apiKey = getOpenRouterKey(req);
    if (!apiKey) {
      return res.status(400).json({ error: 'OpenRouter API key not configured', code: 'MISSING_API_KEY' });
    }

    const models = [
      'black-forest-labs/flux-1.1-pro',
      'black-forest-labs/flux-1.1-schnell',
      'stability-ai/stable-diffusion'
    ];

    const prompt = coordinates
      ? `Replace the text at position x:${coordinates.x}%, y:${coordinates.y}% with text "${newText}". Maintain the same style, font, and background.`
      : `Replace the text "${originalText}" with "${newText}" in the image. Maintain the same style and appearance.`;

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
              { role: 'user', content: [ { type: 'text', text: prompt }, { type: 'image_url', image_url: { url: imageDataUrl } } ] }
            ],
            max_tokens: 1000,
            temperature: 0.3,
            modalities: ['image']
          }),
        });
        if (!response.ok) {
          continue;
        }
        const data = await response.json();
        const img = extractImageFromResponse(data);
        if (img) {
          return res.status(200).json({ success: true, editedImage: img, model });
        }
      } catch (e) {
        // try next model
        continue;
      }
    }

    return res.status(502).json({ error: 'All models failed to replace text' });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'API server is running' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
