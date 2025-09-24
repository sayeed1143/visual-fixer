import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Wand2, Sparkles, Zap, Palette, Type, Settings, ChevronDown } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FontAnalyzer, FontMetrics } from "@/utils/fontAnalysis";
import { AdvancedColorDetector, ColorAnalysis } from "@/utils/colorDetection";

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
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [analysis, setAnalysis] = useState<{ font: FontMetrics | null; color: ColorAnalysis | null } | null>(null);
  const [manualWeight, setManualWeight] = useState("normal");
  const [manualColor, setManualColor] = useState("#000000");

  const handleTextSelect = useCallback(async (text: DetectedText) => {
    onTextSelect(text);
    setReplacementText(text.text);
    setAnalysis(null);
    setIsAnalyzing(true);
    toast.loading("AI analyzing text style...");

    try {
      const fontAnalyzer = new FontAnalyzer();
      const colorDetector = new AdvancedColorDetector();

      const [fontResult, colorResult] = await Promise.all([
        fontAnalyzer.generateFontMetrics(text.text, { width: text.width, height: text.height }),
        colorDetector.analyzeTextRegion(imageDataUrl, text.x, text.y, text.width, text.height)
      ]);

      setAnalysis({ font: fontResult, color: colorResult });
      setManualWeight(fontResult.fontWeight);
      setManualColor(colorResult.textColor);
      toast.success("AI style analysis complete!");
    } catch (error) {
      toast.error("Failed to analyze text style.");
      console.error("Style analysis error:", error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [onTextSelect, imageDataUrl]);

  const handleReplaceText = useCallback(async () => {
    if (!selectedText || !replacementText.trim()) {
      toast.error("Please select text and enter replacement");
      return;
    }

    setIsProcessing(true);
    toast.loading("AI is replacing text...");

    const finalFontStyle = analysis?.font ? { ...analysis.font, fontWeight: manualWeight } : null;
    const finalColorAnalysis = analysis?.color ? { ...analysis.color, textColor: manualColor } : null;

    try {
      const response = await fetch('/api/replace-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageDataUrl,
          originalText: selectedText.text,
          newText: replacementText,
          coordinates: { x: selectedText.x, y: selectedText.y, width: selectedText.width, height: selectedText.height },
          fontStyle: finalFontStyle,
          colorAnalysis: finalColorAnalysis,
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'AI text replacement failed' }));
        if (err.code === 'MISSING_API_KEY') {
          toast.error('OpenRouter API key not configured.');
        }
        throw new Error(err.error || 'AI text replacement failed');
      }

      const data = await response.json();
      if (data.success && data.editedImage) {
        onTextReplace(selectedText.id, replacementText, { editedImage: data.editedImage });
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
  }, [selectedText, replacementText, imageDataUrl, onTextReplace, analysis, manualWeight, manualColor]);

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
    <>
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
          </>
        )}
      </Card>

      {selectedText && (
        <Card className="mt-4 p-4 bg-white/5 border-white/10 shadow-lg">
          <Collapsible>
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <div className="flex items-center">
                <Settings className="mr-2 h-5 w-5 text-primary" />
                <h3 className="font-semibold text-foreground">AI Text Tuning</h3>
              </div>
              <ChevronDown className="h-5 w-5 transition-transform [&[data-state=open]]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4 space-y-4">
              {isAnalyzing ? (
                <div className="text-sm text-muted-foreground flex items-center justify-center py-4">
                  <Zap className="h-4 w-4 mr-2 animate-spin" /> Analyzing style...
                </div>
              ) : analysis ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1">
                      <Label className="text-muted-foreground flex items-center"><Type className="h-4 w-4 mr-2" /> Font Weight</Label>
                      <Select value={manualWeight} onValueChange={setManualWeight}>
                        <SelectTrigger className="bg-background/50 border-white/20">
                          <SelectValue placeholder="Select weight" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="bold">Bold</SelectItem>
                          <SelectItem value="lighter">Lighter</SelectItem>
                          <SelectItem value="bolder">Bolder</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground flex items-center"><Palette className="h-4 w-4 mr-2" /> Text Color</Label>
                      <div className="flex items-center gap-2">
                        <Input type="color" value={manualColor} onChange={e => setManualColor(e.target.value)} className="w-10 h-10 p-1 bg-background/50 border-white/20" />
                        <Input value={manualColor} onChange={e => setManualColor(e.target.value)} className="bg-background/50 border-white/20" />
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">AI detected: <Badge variant="outline">{analysis.font?.fontFamily}</Badge>, avg background <Badge style={{ backgroundColor: analysis.color?.averageColor }} className="text-transparent">color</Badge></p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Select text to analyze style.</p>
              )}
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {selectedText && (
        <Button
          onClick={handleReplaceText}
          disabled={isProcessing || isAnalyzing || !replacementText.trim()}
          className="w-full mt-4 bg-gradient-to-r from-primary to-pink-500 text-white font-semibold hover:scale-105 transition-transform duration-200 hover:shadow-glow"
        >
          {isProcessing ? (
            <><Zap className="h-4 w-4 mr-2 animate-spin" /> Processing...</>
          ) : (
            <><Wand2 className="h-4 w-4 mr-2" /> Replace with AI</>
          )}
        </Button>
      )}
    </>
  );
};
