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

  const detectTextWithOpenRouter = async () => {
    if (!imageDataUrl) {
      toast("Please upload an image first");
      return;
    }

    if (!apiKey.trim()) {
      toast("Please enter your OpenRouter API key");
      return;
    }

    setIsDetecting(true);
    
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-pro-vision',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Analyze this image and detect all text elements. Return a JSON array with each text element containing: text content, x/y coordinates (as percentages 0-100), width/height (as percentages), and confidence (0-1). Format: [{"text":"example","x":10,"y":20,"width":15,"height":5,"confidence":0.95}]'
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
          temperature: 0.1
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to detect text with OpenRouter API');
      }

      const data = await response.json();
      const textContent = data.choices[0]?.message?.content || '';
      
      // Parse the JSON response
      const jsonMatch = textContent.match(/\[.*\]/s);
      if (jsonMatch) {
        const detectedTexts: DetectedText[] = JSON.parse(jsonMatch[0]).map((item: any, index: number) => ({
          id: `text-${index}`,
          text: item.text,
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
          confidence: item.confidence || 0.8
        }));
        
        onTextDetected(detectedTexts);
        toast(`Detected ${detectedTexts.length} text elements!`);
      } else {
        throw new Error('No text detected in image');
      }
    } catch (error) {
      console.error('Text detection error:', error);
      toast("Failed to detect text. Please check your API key.");
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
    <Card className="p-4">
      <h3 className="font-semibold mb-3 text-foreground flex items-center">
        <Eye className="mr-2 h-4 w-4" />
        Auto Text Detection
      </h3>
      
      <div className="space-y-4">
        <div>
          <Label htmlFor="api-key" className="text-sm">OpenRouter API Key (Optional)</Label>
          <Input
            id="api-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-or-..."
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">
            For advanced AI text detection. Get your key from openrouter.ai
          </p>
        </div>

        <div className="space-y-2">
          <Button 
            onClick={detectTextWithOpenRouter}
            disabled={isDetecting || !apiKey.trim()}
            className="w-full"
          >
            <Zap className="mr-2 h-4 w-4" />
            {isDetecting ? "Detecting..." : "AI Text Detection"}
          </Button>
          
          <Button 
            onClick={detectTextWithTesseract}
            disabled={isDetecting}
            variant="outline" 
            className="w-full"
          >
            <Eye className="mr-2 h-4 w-4" />
            {isDetecting ? "Detecting..." : "OCR Text Detection"}
          </Button>
        </div>
      </div>
    </Card>
  );
};