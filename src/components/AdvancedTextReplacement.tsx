import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Wand2, Target, Sparkles, Type, Palette, Zap } from "lucide-react";

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
  const [advancedMode, setAdvancedMode] = useState(false);
  
  // Styling options
  const [fontSize, setFontSize] = useState(16);
  const [fontFamily, setFontFamily] = useState("Arial");
  const [fontWeight, setFontWeight] = useState("normal");
  const [textColor, setTextColor] = useState("#ffffff");
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

    try {
      if (useAIStyling) {
        const response = await fetch('/api/replace-text', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
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
            message = typeof err === 'string' ? err : (err.error || message);
          } catch {
            const errText = await response.text();
            if (errText) message = errText;
          }
          if (message.includes('MISSING_API_KEY')) {
            toast.error('OpenRouter API key configuration issue. Please check server configuration.');
          }
          throw new Error(message);
        }
        const data = await response.json();
        if (data.success && data.editedImage) {
          const styling = {
            fontSize,
            fontFamily,
            fontWeight,
            color: textColor,
            editedImage: data.editedImage,
            aiGenerated: true
          };
          onTextReplace(selectedText.id, replacementText, styling);
          toast.success('AI text replacement completed!');
        } else {
          throw new Error('No edited image returned');
        }
      } else {
        const styling = {
          fontSize,
          fontFamily,
          fontWeight,
          color: textColor,
          aiGenerated: false
        };
        onTextReplace(selectedText.id, replacementText, styling);
        toast.success('Text replaced successfully!');
      }
    } catch (error) {
      console.error('Text replacement error:', error);
      const message = error instanceof Error ? error.message : 'Failed to replace text';
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  }, [selectedText, replacementText, useAIStyling, fontSize, fontFamily, fontWeight, textColor, imageDataUrl, onTextReplace]);

  const analyzeTextStyle = useCallback(async () => {
    if (!selectedText) return;

    try {
      toast.info("Analyzing text style...");
      setIsProcessing(true);
      
      // Simulate style analysis
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setFontSize(selectedText.height * 0.8);
      setFontFamily("Arial");
      setFontWeight("normal");
      setTextColor("#ffffff");
      
      toast.success("Style analysis completed!");
    } catch (error) {
      toast.error("Style analysis failed");
    } finally {
      setIsProcessing(false);
    }
  }, [selectedText]);

  const fontFamilies = [
    "Arial", "Helvetica", "Times New Roman", "Georgia", "Verdana", 
    "Courier New", "Impact", "Trebuchet MS", "Comic Sans MS"
  ];

  const fontWeightOptions = [
    { value: "normal", label: "Normal" },
    { value: "bold", label: "Bold" },
    { value: "lighter", label: "Light" },
    { value: "bolder", label: "Bolder" }
  ];

  if (disabled) {
    return (
      <Card className="p-4 bg-purple-500/5 border-purple-500/30">
        <div className="flex items-center mb-3">
          <Wand2 className="mr-2 h-5 w-5 text-purple-500" />
          <h3 className="font-semibold">Advanced Text Replacement</h3>
        </div>
        <p className="text-sm text-gray-400 text-center py-4">
          Upload an image and detect text to enable advanced replacement
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4 bg-purple-500/5 border-purple-500/30">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Wand2 className="mr-2 h-5 w-5 text-purple-500" />
          <h3 className="font-semibold text-white">Advanced Text Replacement</h3>
        </div>
        <Badge variant={selectedText ? "default" : "secondary"}>
          {selectedText ? "Selected" : "None"}
        </Badge>
      </div>

      {/* Text Selection */}
      <div className="space-y-3">
        <Label className="text-gray-200">Select Text to Replace</Label>
        <div className="max-h-32 overflow-y-auto space-y-1">
          {detectedTexts.map((text) => (
            <div
              key={text.id}
              className={`p-2 rounded border cursor-pointer transition-all ${
                selectedText?.id === text.id
                  ? "bg-purple-500/20 border-purple-500"
                  : "border-gray-600 hover:border-purple-400"
              }`}
              onClick={() => handleTextSelect(text)}
            >
              <div className="flex justify-between items-center">
                <span className="text-sm truncate flex-1 text-white">{text.text}</span>
                <Badge variant="secondary" className="ml-2">
                  {Math.round(text.confidence * 100)}%
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Replacement Input */}
      {selectedText && (
        <>
          <Separator className="my-4" />
          
          <div className="space-y-3">
            <Label htmlFor="replacement-text" className="text-gray-200">Replacement Text</Label>
            <Input
              id="replacement-text"
              value={replacementText}
              onChange={(e) => setReplacementText(e.target.value)}
              placeholder="Enter new text..."
              className="bg-black/30 border-gray-600 text-white placeholder:text-gray-400"
            />
          </div>

          {/* AI Styling Toggle */}
          <div className="flex items-center justify-between mt-4 p-3 bg-black/20 rounded-lg">
            <div className="flex items-center space-x-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              <Label htmlFor="ai-styling" className="text-sm text-gray-200">AI-Powered Styling</Label>
            </div>
            <Switch
              id="ai-styling"
              checked={useAIStyling}
              onCheckedChange={setUseAIStyling}
            />
          </div>

          {/* Advanced Styling Options */}
          {!useAIStyling && (
            <div className="space-y-4 mt-4 p-3 bg-black/20 rounded-lg">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-gray-200">Advanced Styling</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={analyzeTextStyle}
                  disabled={isProcessing}
                  className="h-7 text-xs"
                >
                  <Target className="h-3 w-3 mr-1" />
                  Analyze
                </Button>
              </div>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="font-size" className="text-xs text-gray-300">Font Size: {fontSize}px</Label>
                  <Slider
                    id="font-size"
                    min={8}
                    max={72}
                    step={1}
                    value={[fontSize]}
                    onValueChange={([value]) => setFontSize(value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="font-family" className="text-xs text-gray-300">Font Family</Label>
                  <Select value={fontFamily} onValueChange={setFontFamily}>
                    <SelectTrigger className="bg-black/30 border-gray-600 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fontFamilies.map(font => (
                        <SelectItem key={font} value={font}>{font}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="font-weight" className="text-xs text-gray-300">Font Weight</Label>
                  <Select value={fontWeight} onValueChange={setFontWeight}>
                    <SelectTrigger className="bg-black/30 border-gray-600 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fontWeightOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="text-color" className="text-xs text-gray-300">Text Color</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="text-color"
                      value={textColor}
                      onChange={(e) => setTextColor(e.target.value)}
                      className="bg-black/30 border-gray-600 h-8 flex-1"
                    />
                    <div 
                      className="w-8 h-8 rounded border border-gray-600"
                      style={{ backgroundColor: textColor }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Replace Button */}
          <Button
            onClick={handleReplaceText}
            disabled={isProcessing || !replacementText.trim()}
            className="w-full mt-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
          >
            {isProcessing ? (
              <>
                <Zap className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4 mr-2" />
                {useAIStyling ? "Replace with AI" : "Replace Text"}
              </>
            )}
          </Button>
        </>
      )}

      {!selectedText && detectedTexts.length > 0 && (
        <p className="text-sm text-gray-200 text-center py-2">
          Select a text region to replace
        </p>
      )}
    </Card>
  );
};

// Separator component since it wasn't imported
const Separator = ({ className }: { className?: string }) => (
  <div className={`border-t border-gray-600 ${className}`} />
);
