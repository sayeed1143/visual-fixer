import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Wand2, Sparkles, Zap } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface DetectedText {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

interface AdvancedTextReplacementProps {
  detectedTexts: DetectedText[];
  selectedText: DetectedText | null;
  imageDataUrl: string;
  onTextReplace: (textId: string, newText: string, styling: any) => void;
  onTextSelect: (text: DetectedText | null) => void;
  disabled?: boolean;
}

export const AdvancedTextReplacement = ({
  detectedTexts,
  selectedText,
  imageDataUrl,
  onTextReplace,
  onTextSelect,
  disabled = false
}: AdvancedTextReplacementProps) => {
  const [replacementText, setReplacementText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [useAIStyling, setUseAIStyling] = useState(true);

  const handleTextSelect = useCallback((text: DetectedText) => {
    onTextSelect(text);
    setReplacementText(text.text);
  }, [onTextSelect]);

  const handleReplaceText = useCallback(async () => {
    if (!selectedText || !replacementText.trim()) {
      toast.error("Please select text and enter replacement");
      return;
    }

    setIsProcessing(true);
    toast.loading("AI is replacing text...");

    try {
      const response = await fetch('/api/replace-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageDataUrl,
          originalText: selectedText.text,
          newText: replacementText,
          coordinates: { x: selectedText.x, y: selectedText.y, width: selectedText.width, height: selectedText.height }
        })
      });

      if (!response.ok) {
        let message = 'AI text replacement failed';
        try {
          const err = await response.json();
          message = err.error || message;
        } catch {
          // fallback to text
        }
        if (message.includes('MISSING_API_KEY')) {
          toast.error('OpenRouter API key not configured.');
        }
        throw new Error(message);
      }

      const data = await response.json();
      if (data.success && data.editedImage) {
        const styling = { editedImage: data.editedImage };
        onTextReplace(selectedText.id, replacementText, styling);
        toast.success('AI text replacement completed!');
      } else {
        throw new Error('No edited image returned from AI');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to replace text';
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  }, [selectedText, replacementText, imageDataUrl, onTextReplace]);

  if (disabled) {
    return (
      <Card className="p-4 bg-white/5 border-white/10 shadow-lg">
        <div className="flex items-center mb-3">
          <Wand2 className="mr-2 h-5 w-5 text-primary" />
          <h3 className="font-semibold">Advanced Text Replacement</h3>
        </div>
        <p className="text-sm text-muted-foreground text-center py-4">
          Detect text to enable replacement
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4 bg-white/5 border-white/10 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Wand2 className="mr-2 h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Advanced Text Replacement</h3>
        </div>
        <Badge variant={selectedText ? "default" : "secondary"}>
          {selectedText ? "Selected" : "None"}
        </Badge>
      </div>

      <div className="space-y-3">
        <Label className="text-muted-foreground">Select Text to Replace</Label>
        <div className="max-h-32 overflow-y-auto space-y-1 pr-2">
          {detectedTexts.map((text) => (
            <div
              key={text.id}
              className={`p-2 rounded-md border cursor-pointer transition-all ${
                selectedText?.id === text.id
                  ? "bg-primary/20 border-primary"
                  : "border-white/10 hover:border-primary/50"
              }`}
              onClick={() => handleTextSelect(text)}
            >
              <div className="flex justify-between items-center">
                <span className="text-sm truncate flex-1 text-foreground">{text.text}</span>
                <Badge variant="secondary" className="ml-2 text-xs">
                  {Math.round(text.confidence * 100)}%
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedText && (
        <>
          <Separator className="my-4 bg-white/10" />
          
          <div className="space-y-3">
            <Label htmlFor="replacement-text" className="text-muted-foreground">Replacement Text</Label>
            <Input
              id="replacement-text"
              value={replacementText}
              onChange={(e) => setReplacementText(e.target.value)}
              placeholder="Enter new text..."
              className="bg-background/50 border-white/20 text-foreground placeholder:text-muted-foreground focus:ring-primary"
            />
          </div>

          <Button
            onClick={handleReplaceText}
            disabled={isProcessing || !replacementText.trim()}
            className="w-full mt-4 bg-gradient-to-r from-primary to-pink-500 text-white font-semibold hover:scale-105 transition-transform duration-200 hover:shadow-glow"
          >
            {isProcessing ? (
              <><Zap className="h-4 w-4 mr-2 animate-spin" /> Processing...</>
            ) : (
              <><Wand2 className="h-4 w-4 mr-2" /> Replace with AI</>
            )}
          </Button>
        </>
      )}

      {!selectedText && detectedTexts.length > 0 && (
        <p className="text-sm text-muted-foreground text-center py-2">
          Select a text region above to replace
        </p>
      )}
    </Card>
  );
};
