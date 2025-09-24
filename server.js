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
      'google/gemini-2.5-flash',
      'anthropic/claude-3.5-sonnet',
      'openai/gpt-4o',
      'google/gemini-pro-1.5',
      'openai/gpt-4o-mini',
      'google/gemini-2.0-flash-001',
    ];

    const prompt = `You are a professional text detection AI. Analyze this image with extreme precision to detect ALL text elements for accurate replacement.

Provide a JSON array where each text element includes:
- text: exact text content (preserve case, punctuation, spacing)
- x, y: coordinates as percentages (0-100) from top-left corner
- width, height: dimensions as percentages of image size
- confidence: detection confidence (0-1)
- fontSize: estimated font size relative to image height (0-100)
- fontWeight: estimated weight (normal, bold, light)
- textColor: estimated hex color of the text
- backgroundColor: estimated hex color behind text

Be extremely precise with measurements for pixel-perfect replacement.
Format: [{"text":"example","x":10.5,"y":20.3,"width":15.2,"height":5.1,"confidence":0.95,"fontSize":12,"fontWeight":"bold","textColor":"#000000","backgroundColor":"#ffffff"}]`;

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
            fontSize: item.fontSize || null,
            fontWeight: item.fontWeight || null,
            textColor: item.textColor || null,
            backgroundColor: item.backgroundColor || null,
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
            modalities: ['text', 'image']
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
      'google/gemini-2.5-flash-image-preview'
    ];

    let prompt;
    if (fontStyle && colorAnalysis) {
      prompt = `You are a specialized AI model for PIXEL-PERFECT text replacement. Your expertise is in precisely matching all visual characteristics of existing text.

**CRITICAL MISSION:** Replace "${originalText}" with "${newText}" while maintaining PERFECT visual consistency.

**EXACT PARAMETERS:**
- **Location**: Target area is at (${coordinates.x.toFixed(2)}%, ${coordinates.y.toFixed(2)}%) with dimensions ${coordinates.width.toFixed(2)}% × ${coordinates.height.toFixed(2)}%
- **Text Color**: EXACTLY match '${colorAnalysis.textColor}' (analyzed from original)
- **Background**: Blend with '${colorAnalysis.averageColor}' background
- **Font Weight**: EXACTLY replicate '${fontStyle.fontWeight}' thickness
- **Font Size**: Scale PRECISELY to match the original text dimensions
- **Character Spacing**: Preserve original letter and word spacing

**FAILURE CONDITIONS:**
- ANY size difference visible to human eye
- ANY color variance from specified hex codes
- ANY thickness/weight difference
- ANY spacing irregularities
- ANY blurring or quality degradation

**SUCCESS CRITERIA:**
The replacement must be indistinguishable from the original text. A human observer should not be able to detect that any editing occurred.

Generate the image with "${newText}" replacing "${originalText}" using these exact specifications.`;
    } else {
      prompt = `You are a specialized AI model for PIXEL-PERFECT text replacement. Your expertise is in precisely matching all visual characteristics of existing text.

**CRITICAL MISSION:** Replace "${originalText}" with "${newText}" while maintaining PERFECT visual consistency.

**ANALYSIS REQUIRED:**
1. **Precise Color Analysis**: Measure the exact hex color of "${originalText}"
2. **Font Characteristics**: Determine exact font weight, style, and family
3. **Size Measurements**: Calculate precise font size relative to image dimensions
4. **Background Integration**: Analyze surrounding background colors and textures
5. **Effect Detection**: Identify any shadows, outlines, or special effects

**EXACT PARAMETERS:**
- **Location**: Target area is at (${coordinates.x.toFixed(2)}%, ${coordinates.y.toFixed(2)}%) with dimensions ${coordinates.width.toFixed(2)}% × ${coordinates.height.toFixed(2)}%
- **Font Size**: MUST match original text dimensions exactly
- **Character Spacing**: Preserve original letter and word spacing
- **Alignment**: Maintain exact positioning within the bounding box

**FAILURE CONDITIONS:**
- ANY size difference visible to human eye
- ANY color variance from the original
- ANY thickness/weight difference
- ANY spacing irregularities
- ANY blurring or quality degradation

**SUCCESS CRITERIA:**
The replacement must be indistinguishable from the original text. A human observer should not be able to detect that any editing occurred.

Generate the image with "${newText}" replacing "${originalText}" using these exact specifications.`;
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
            temperature: 0.1,
            modalities: ['text', 'image']
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
