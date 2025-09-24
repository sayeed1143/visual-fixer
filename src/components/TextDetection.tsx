import { useState } from "react";
import { Button } from "@/components/ui/button";
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
  const [isDetecting, setIsDetecting] = useState(false);

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
        const out = canvas.toDataURL('image/jpeg', quality);
        resolve(out);
      };
      img.onerror = () => reject(new Error('Failed to load image for compression'));
      img.src = dataUrl;
    });
  };

  const detectTextWithOpenRouter = async () => {
    if (!imageDataUrl) {
      toast.error("Please upload an image first");
      return;
    }

    setIsDetecting(true);
    toast.loading("AI is analyzing the image...");

    try {
      const compressed = await compressDataUrl(imageDataUrl);
      
      const response = await fetch('/api/detect-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUrl: compressed }),
      });

      if (!response.ok) {
        const text = await response.text();
        if (response.status === 400 && text.includes('MISSING_API_KEY')) {
          throw new Error('OpenRouter API key not configured.');
        }
        throw new Error(text || 'Failed to detect text with AI models');
      }

      const data = await response.json();

      if (data.success && data.detectedTexts) {
        onTextDetected(data.detectedTexts);
        toast.success(`Detected ${data.detectedTexts.length} text elements using ${data.model}!`);
      } else {
        throw new Error('No text detected in image');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to detect text with AI models';
      toast.error(message);
    } finally {
      setIsDetecting(false);
    }
  };

  if (disabled) {
    return (
      <Card className="p-4 bg-white/5 border-white/10 shadow-lg">
        <div className="flex items-center mb-3">
          <Sparkles className="mr-2 h-5 w-5 text-primary" />
          <h3 className="font-semibold">Text Detection</h3>
        </div>
        <p className="text-sm text-muted-foreground text-center py-4">Upload an image to enable text detection</p>
      </Card>
    );
  }

  return (
    <Card className="p-4 bg-white/5 border-white/10 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Sparkles className="mr-2 h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Text Detection</h3>
        </div>
        <div className="text-sm text-muted-foreground">{isDetecting ? 'Detecting...' : 'Ready'}</div>
      </div>

      <div className="space-y-3">
        <Button
          onClick={detectTextWithOpenRouter}
          disabled={isDetecting}
          className="w-full bg-gradient-to-r from-primary to-pink-500 text-white font-semibold hover:scale-105 transition-transform duration-200 hover:shadow-glow"
        >
          {isDetecting ? (
            <><Zap className="h-4 w-4 mr-2 animate-spin" /> Detecting...</>
          ) : (
            <><Zap className="h-4 w-4 mr-2" /> Detect with AI</>
          )}
        </Button>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          AI detection for higher accuracy on complex images.
        </p>
      </div>
    </Card>
  );
};
