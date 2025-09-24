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

// CORS middleware - restrict to localhost and replit domains for security
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:5000',
    'http://127.0.0.1:5000',
    /\.replit\.dev$/,
    /\.repl\.co$/
  ];
  
  if (allowedOrigins.some(allowed => {
    if (typeof allowed === 'string') return origin === allowed;
    return origin && allowed.test(origin);
  })) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
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
  // New OpenRouter format: check images field first
  const message = data?.choices?.[0]?.message;
  if (message?.images && message.images.length > 0) {
    const image = message.images[0];
    if (image?.image_url?.url) return image.image_url.url;
    if (image?.url) return image.url;
  }
  
  // Legacy format: check content field
  const choice = message?.content;
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
      'anthropic/claude-3.5-sonnet',
      'openai/gpt-4o',
      'google/gemini-pro-1.5',
      'google/gemini-2.5-pro',
      'google/gemini-2.5-flash',
      'openai/gpt-4o-mini',
      'google/gemini-2.0-flash-001',
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
          const errorText = await response.text();
          console.log(`Model ${model} failed with status ${response.status}:`, errorText);
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
        console.log(`Model ${model} failed:`, error.message);
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
      'black-forest-labs/flux-dev',
      'google/gemini-2.5-flash-image-preview'
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
                  { type: 'text', text: `Looking at this image, recreate it but with this modification: ${prompt}. Keep all other aspects as similar as possible.` },
                  { type: 'image_url', image_url: { url: imageDataUrl } }
                ]
              }
            ],
            max_tokens: 1000,
            temperature: 0.7,
            // modalities parameter removed as it can cause 400 errors
          }),
        });
        if (!response.ok) {
          const errorText = await response.text();
          console.log(`Model ${model} failed with status ${response.status}:`, errorText);
          continue;
        }
        const data = await response.json();
        
        // Extract image from the response using the existing helper function
        const img = extractImageFromResponse(data);
        if (img) {
          return res.status(200).json({ success: true, editedImage: img, model });
        } else {
          console.log(`Model ${model} returned no image. Response structure:`, JSON.stringify(data, null, 2));
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
    const { imageDataUrl, originalText, newText, coordinates, fontStyle, colorAnalysis } = req.body;
    if (!imageDataUrl || !originalText || !newText || !coordinates) {
      return res.status(400).json({ error: 'Image data, original text, new text, and coordinates are required' });
    }

    const apiKey = getOpenRouterKey(req);
    if (!apiKey) {
      return res.status(400).json({ error: 'OpenRouter API key not configured', code: 'MISSING_API_KEY' });
    }

    const models = [
      'black-forest-labs/flux-1.1-pro',
      'black-forest-labs/flux-dev',
      'google/gemini-2.5-flash-image-preview'
    ];

    let prompt;
    if (fontStyle && colorAnalysis) {
      prompt = `You are a specialized AI model for high-fidelity, pixel-perfect text inpainting. Your sole function is to replace text while flawlessly matching the original styling.

**Task:**
In the provided image, locate and replace the text "${originalText}" with "${newText}".

**Mandatory Directives (Non-negotiable):**
1.  **Exact Location:** The target text, "${originalText}", is within the bounding box: (x: ${coordinates.x.toFixed(2)}%, y: ${coordinates.y.toFixed(2)}%, width: ${coordinates.width.toFixed(2)}%, height: ${coordinates.height.toFixed(2)}%). Perform the replacement ONLY within this area.
2.  **Style Replication:** The new text, "${newText}", MUST be rendered with the IDENTICAL visual properties of the original text. This includes:
    *   **Size:** The font size must be an exact match.
    *   **Thickness (Font Weight):** The boldness or thinness of the characters must be replicated perfectly.
    *   **Color:** The exact color, including any gradients or subtle variations, must be matched.
    *   **Font Family:** Match the font style (serif, sans-serif, etc.) as closely as possible.
    *   **Blending:** The new text must blend seamlessly with the background texture, lighting, and any effects (shadows, glows) present on the original text.

**Frontend Analysis (Use as a primary guide):**
- **Color:** The detected text color is '${colorAnalysis.textColor}'. The background is '${colorAnalysis.averageColor}'.
- **Font Weight:** The estimated font weight is '${fontStyle.fontWeight}'.

**Final Output Rule:** The result must look like the text was never edited. Any deviation in size, thickness, or color from the original text is a failure.
`;
    } else {
      prompt = `You are a specialized AI model for high-fidelity, pixel-perfect text inpainting. Your sole function is to replace text while flawlessly matching the original styling.

**Task:**
In the provided image, locate and replace the text "${originalText}" with "${newText}".

**Mandatory Directives (Non-negotiable):**
1.  **Exact Location:** The target text, "${originalText}", is within the bounding box: (x: ${coordinates.x.toFixed(2)}%, y: ${coordinates.y.toFixed(2)}%, width: ${coordinates.width.toFixed(2)}%, height: ${coordinates.height.toFixed(2)}%). Perform the replacement ONLY within this area.
2.  **Style Replication:** The new text, "${newText}", MUST be rendered with the IDENTICAL visual properties of the original text. You must analyze the image yourself to determine these properties. This includes:
    *   **Size:** The font size must be an exact match.
    *   **Thickness (Font Weight):** The boldness or thinness of the characters must be replicated perfectly.
    *   **Color:** The exact color, including any gradients or subtle variations, must be matched.
    *   **Font Family:** Match the font style (serif, sans-serif, etc.) as closely as possible.
    *   **Blending:** The new text must blend seamlessly with the background texture, lighting, and any effects (shadows, glows) present on the original text.

**Final Output Rule:** The result must look like the text was never edited. Any deviation in size, thickness, or color from the original text is a failure.
`;
    }


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
          }),
        });
        if (!response.ok) {
          const errorText = await response.text();
          console.log(`Model ${model} failed with status ${response.status}:`, errorText);
          continue;
        }
        const data = await response.json();
        const img = extractImageFromResponse(data);
        if (img) {
          return res.status(200).json({ success: true, editedImage: img, model });
        } else {
          console.log(`Model ${model} returned no image. Response structure:`, JSON.stringify(data, null, 2));
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

app.listen(PORT, 'localhost', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
