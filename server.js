import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Text detection endpoint (your existing code - works fine)
app.post('/api/detect-text', async (req, res) => {
  try {
    const { imageDataUrl } = req.body;
    
    if (!imageDataUrl) {
      return res.status(400).json({ error: 'Image data is required' });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'OpenRouter API key not configured' });
    }

    const models = [
      'openai/gpt-4o',
      'openai/gpt-4o-mini',
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
                  {
                    type: 'text',
                    text: prompt
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: imageDataUrl
                    }
                  }
                ]
              }
            ],
            max_tokens: 1500,
            temperature: 0.1
          }),
        });

        if (!response.ok) {
          console.error(`${model} failed:`, response.status);
          continue;
        }

        const data = await response.json();
        const textContent = data.choices[0]?.message?.content || '';
        
        const jsonMatch = textContent.match(/\[.*\]/s);
        if (jsonMatch) {
          const detectedTexts = JSON.parse(jsonMatch[0]).map((item, index) => ({
            id: `text-${index}`,
            text: item.text,
            x: item.x,
            y: item.y,
            width: item.width,
            height: item.height,
            confidence: item.confidence || 0.8,
            model: model
          }));
          
          return res.status(200).json({ 
            success: true, 
            detectedTexts,
            model: model 
          });
        }
      } catch (error) {
        console.error(`Error with ${model}:`, error);
        continue;
      }
    }

    // As a final fallback, attempt local OCR using Tesseract.js
    try {
      const Tesseract = await import('tesseract.js');
      const result = await Tesseract.recognize(imageDataUrl, 'eng');
      const data = result.data;
      if (data && Array.isArray(data.words) && data.words.length > 0) {
        const detectedTexts = data.words
          .filter((w) => (w.confidence ?? 0) > 50 && (w.text ?? '').trim().length > 0)
          .map((word, index) => ({
            id: `ocr-${index}`,
            text: word.text,
            x: word.bbox.x0,
            y: word.bbox.y0,
            width: Math.max(1, word.bbox.x1 - word.bbox.x0),
            height: Math.max(1, word.bbox.y1 - word.bbox.y0),
            confidence: (word.confidence ?? 50) / 100,
          }));
        if (detectedTexts.length > 0) {
          return res.status(200).json({ success: true, detectedTexts, model: 'tesseract.js' });
        }
      }
    } catch (fallbackErr) {
      console.error('Tesseract fallback failed:', fallbackErr);
    }

    return res.status(500).json({ error: 'All models failed to detect text' });
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// NEW: Image Editing Endpoint using FLUX model
app.post('/api/edit-image', async (req, res) => {
  try {
    const { imageDataUrl, prompt, editType = 'inpainting' } = req.body;
    
    if (!imageDataUrl || !prompt) {
      return res.status(400).json({ error: 'Image data and prompt are required' });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'OpenRouter API key not configured' });
    }

    // Use FLUX model for image editing
    const model = 'black-forest-labs/flux-1.1-pro';
    
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
                {
                  type: 'text',
                  text: `Edit this image according to the following instruction: ${prompt}. Return the edited image.`
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: imageDataUrl
                  }
                }
              ]
            }
          ],
          max_tokens: 1000,
          temperature: 0.7,
          // Important: Specify we want image response
          modalities: ["image"]
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('FLUX model failed:', response.status, errorText);
        return res.status(500).json({ error: `Model failed: ${response.status}` });
      }

      const data = await response.json();
      
      // FLUX returns image data in the response
      const imageContent = data.choices[0]?.message?.content;
      if (imageContent && imageContent.type === 'image') {
        return res.status(200).json({ 
          success: true,
          editedImage: imageContent.data, // Base64 image data
          model: model
        });
      } else {
        return res.status(500).json({ error: 'No image data returned from model' });
      }
      
    } catch (error) {
      console.error('Error with FLUX model:', error);
      return res.status(500).json({ error: 'Image editing failed' });
    }

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// NEW: Text Replacement Endpoint (Specific use case)
app.post('/api/replace-text', async (req, res) => {
  try {
    const { imageDataUrl, originalText, newText, coordinates } = req.body;
    
    if (!imageDataUrl || !originalText || !newText) {
      return res.status(400).json({ error: 'Image data, original text, and new text are required' });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'OpenRouter API key not configured' });
    }

    const model = 'black-forest-labs/flux-1.1-pro';
    
    // Create a precise prompt for text replacement
    const prompt = coordinates 
      ? `Replace the text at position x:${coordinates.x}%, y:${coordinates.y}% with text "${newText}". Maintain the same style, font, and background.`
      : `Replace the text "${originalText}" with "${newText}" in the image. Maintain the same style and appearance.`;

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
                {
                  type: 'text',
                  text: prompt
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: imageDataUrl
                  }
                }
              ]
            }
          ],
          max_tokens: 1000,
          temperature: 0.3, // Lower temperature for more consistent results
          modalities: ["image"]
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('FLUX model failed:', response.status, errorText);
        return res.status(500).json({ error: `Model failed: ${response.status}` });
      }

      const data = await response.json();
      const imageContent = data.choices[0]?.message?.content;
      
      if (imageContent && imageContent.type === 'image') {
        return res.status(200).json({ 
          success: true,
          editedImage: imageContent.data,
          model: model
        });
      } else {
        return res.status(500).json({ error: 'No image data returned' });
      }
      
    } catch (error) {
      console.error('Error with FLUX model:', error);
      return res.status(500).json({ error: 'Text replacement failed' });
    }

  } catch (error) {
    console.error('Server error:', error);
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
