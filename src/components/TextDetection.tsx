import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Eye, Zap } from "lucide-react";
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
}

export const TextDetection = ({ onTextDetected, imageDataUrl }: TextDetectionProps) => {
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

  return (
    <Card className="p-4 bg-gradient-secondary border-primary/30 shadow-glow">
      <h3 className="font-semibold mb-3 text-foreground flex items-center">
        <Eye className="mr-2 h-4 w-4 text-primary animate-pulse-glow" />
        🧠 Neural Text Detection
      </h3>
      
      <div className="space-y-4">
        <div className="bg-muted/50 p-3 rounded-lg">
          <p className="text-xs text-muted-foreground">
            🧠 Advanced AI models with fallback system: Gemini 2.5 Flash → GPT-4o → Claude 3.5 Sonnet for maximum accuracy and seamless text replacement.
          </p>
        </div>

        <div className="space-y-2">
          <Button 
            onClick={detectTextWithOpenRouter}
            disabled={isDetecting}
            className="w-full bg-gradient-primary hover:shadow-glow-primary transition-all duration-300"
          >
            <Zap className="mr-2 h-4 w-4" />
            {isDetecting ? "🧠 Analyzing..." : "🚀 AI Neural Detection"}
          </Button>
          
          <Button 
            onClick={detectTextWithTesseract}
            disabled={isDetecting}
            variant="outline" 
            className="w-full border-primary/30 hover:bg-primary/10"
          >
            <Eye className="mr-2 h-4 w-4" />
            {isDetecting ? "⚡ Processing..." : "🔍 OCR Detection"}
          </Button>
        </div>
      </div>
    </Card>
  );
};
