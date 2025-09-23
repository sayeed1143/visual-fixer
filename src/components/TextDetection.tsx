import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Eye, Zap, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface DetectedText {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

interface TextDetectionProps {
  onTextDetected: (detectedTexts: DetectedText[]) => void;
  imageDataUrl?: string;
  disabled?: boolean;
}

export const TextDetection = ({ onTextDetected, imageDataUrl, disabled = false }: TextDetectionProps) => {
  const [apiKey, setApiKey] = useState("");
  const [isDetecting, setIsDetecting] = useState(false);

  // Downscale and compress data URL to fit serverless limits (~4.5MB on Vercel)
  const compressDataUrl = async (dataUrl: string, maxDim = 1600, quality = 0.85): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        const scale = Math.min(1, maxDim / Math.max(width, height));
        width = Math.max(1, Math.round(width * scale));
        height = Math.max(1, Math.round(height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas context not available'));
        ctx.drawImage(img, 0, 0, width, height);
        // Prefer JPEG for better compression on photos/screenshots
        const out = canvas.toDataURL('image/jpeg', quality);
        resolve(out);
      };
      img.onerror = () => reject(new Error('Failed to load image for compression'));
      img.src = dataUrl;
    });
  };

  const detectTextWithOpenRouter = async () => {
    if (!imageDataUrl) {
      toast("Please upload an image first");
      return;
    }

    setIsDetecting(true);

    try {
      const originalSizeKB = Math.round((imageDataUrl.length * 3) / 4 / 1024);
      const compressed = await compressDataUrl(imageDataUrl);
      const compressedSizeKB = Math.round((compressed.length * 3) / 4 / 1024);
      if (compressedSizeKB < originalSizeKB) {
        toast(`Optimized image: ${compressedSizeKB}KB (was ${originalSizeKB}KB)`);
      }

      const response = await fetch('/api/detect-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageDataUrl: compressed
        }),
      });

      if (!response.ok) {
        if (response.status === 413) {
          throw new Error('Image too large for serverless function');
        }
        const text = await response.text();
        throw new Error(text || 'Failed to detect text with AI models');
      }

      const data = await response.json();

      if (data.success && data.detectedTexts) {
        const detectedTexts: DetectedText[] = data.detectedTexts.map((item: any) => ({
          id: item.id,
          text: item.text,
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
          confidence: item.confidence
        }));

        onTextDetected(detectedTexts);
        toast(`Detected ${detectedTexts.length} text elements using ${data.model}!`);
      } else {
        throw new Error('No text detected in image');
      }
    } catch (error) {
      console.error('Text detection error:', error);
      const message = error instanceof Error ? error.message : 'Failed to detect text with AI models';
      if (message.includes('too large')) {
        toast('Image too large. Try a smaller screenshot or use OCR Detection.');
      } else {
        toast(message);
      }
    } finally {
      setIsDetecting(false);
    }
  };

  // NEW: FLUX Model Text Replacement
  const replaceTextWithFLUX = async (originalText: string, newText: string, coordinates: any) => {
    if (!imageDataUrl) {
      toast("Please upload an image first");
      return;
    }

    setIsDetecting(true);

    try {
      const response = await fetch('/api/replace-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageDataUrl,
          originalText,
          newText,
          coordinates
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to replace text with FLUX model');
      }

      const data = await response.json();

      if (data.success && data.editedImage) {
        toast(`Text replaced successfully using FLUX model!`);
        return data.editedImage; // Return the new image data
      } else {
        throw new Error('Text replacement failed');
      }
    } catch (error) {
      console.error('FLUX replacement error:', error);
      toast("Failed to replace text with AI model");
      throw error;
    } finally {
      setIsDetecting(false);
    }
  };

  // NEW: General Image Editing with FLUX
  const editImageWithFLUX = async (prompt: string) => {
    if (!imageDataUrl) {
      toast("Please upload an image first");
      return;
    }

    setIsDetecting(true);

    try {
      const response = await fetch('/api/edit-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageDataUrl,
          prompt
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to edit image with FLUX model');
      }

      const data = await response.json();

      if (data.success && data.editedImage) {
        toast(`Image edited successfully using FLUX model!`);
        return data.editedImage;
      } else {
        throw new Error('Image editing failed');
      }
    } catch (error) {
      console.error('FLUX editing error:', error);
      toast("Failed to edit image with AI model");
      throw error;
    } finally {
      setIsDetecting(false);
    }
  };

  const detectTextWithTesseract = async () => {
    if (!imageDataUrl) {
      toast("Please upload an image first");
      return;
    }

    setIsDetecting(true);
    
    try {
      const Tesseract = await import('tesseract.js');
      
      const result = await Tesseract.recognize(imageDataUrl, 'eng', {
        logger: m => console.log(m)
      });

      const data = result.data as any;

      if (!data || !data.words) {
        throw new Error('No words detected in image');
      }

      const imageRect = { width: data.width || 800, height: data.height || 600 };
      
      const detectedTexts: DetectedText[] = data.words.map((word: any, index: number) => ({
        id: `word-${index}`,
        text: word.text,
        x: (word.bbox.x0 / imageRect.width) * 100,
        y: (word.bbox.y0 / imageRect.height) * 100,
        width: ((word.bbox.x1 - word.bbox.x0) / imageRect.width) * 100,
        height: ((word.bbox.y1 - word.bbox.y0) / imageRect.height) * 100,
        confidence: word.confidence / 100
      })).filter(text => text.confidence > 0.5);

      onTextDetected(detectedTexts);
      toast(`Detected ${detectedTexts.length} text elements!`);
    } catch (error) {
      console.error('Tesseract detection error:', error);
      toast("Failed to detect text with OCR");
    } finally {
      setIsDetecting(false);
    }
  };

  // Render UI for text detection
  if (typeof disabled !== 'undefined' && disabled) {
    return (
      <Card className="p-4 bg-purple-500/5 border-purple-500/30">
        <div className="flex items-center mb-3">
          <Sparkles className="mr-2 h-5 w-5 text-purple-500" />
          <h3 className="font-semibold">Text Detection</h3>
        </div>
        <p className="text-sm text-gray-400 text-center py-4">Upload an image to enable text detection tools</p>
      </Card>
    );
  }

  return (
    <Card className="p-4 bg-purple-500/5 border-purple-500/30">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Sparkles className="mr-2 h-5 w-5 text-purple-500" />
          <h3 className="font-semibold">Text Detection</h3>
        </div>
        <div className="text-sm text-gray-400">{isDetecting ? 'Detecting...' : 'Ready'}</div>
      </div>

      <div className="space-y-3">
        <Label htmlFor="api-key" className="text-sm">API Key (optional)</Label>
        <Input
          id="api-key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Enter API key for hosted models"
          className="bg-black/30 border-gray-600"
        />

        <div className="grid grid-cols-1 gap-2">
          <Button
            onClick={detectTextWithOpenRouter}
            disabled={isDetecting}
            className="w-full mt-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
          >
            {isDetecting ? (
              <>
                <Zap className="h-4 w-4 mr-2 animate-spin" />
                Detecting...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Detect with AI
              </>
            )}
          </Button>

          <Button
            onClick={detectTextWithTesseract}
            disabled={isDetecting}
            variant="outline"
            className="w-full mt-1 border-purple-500/30 hover:bg-purple-500/10"
          >
            <Eye className="h-4 w-4 mr-2" />
            Detect with OCR
          </Button>
        </div>

        <p className="text-xs text-gray-500 mt-2">
          Use AI detection for higher accuracy on complex scenes. OCR works offline in the browser but may be slower.
        </p>
      </div>
    </Card>
  );
};
