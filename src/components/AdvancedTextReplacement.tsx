import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { 
  Wand2, 
  Palette, 
  Type, 
  Layers, 
  Target, 
  Sparkles,
  CheckCircle,
  AlertCircle,
  Copy,
  Undo,
  Redo
} from "lucide-react";
import { detectOptimalTextColor } from "@/utils/colorDetection";
import { matchFont, FontMetrics } from "@/utils/fontAnalysis";

interface DetectedText {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

interface ReplacementConfig {
  autoColorMatch: boolean;
  autoFontMatch: boolean;
  addTextShadow: boolean;
  blendMode: 'normal' | 'multiply' | 'overlay' | 'soft-light';
  enhanceContrast: boolean;
  preserveFormatting: boolean;
}

interface AdvancedTextReplacementProps {
  detectedTexts: DetectedText[];
  selectedText: DetectedText | null;
  imageDataUrl: string;
  onTextReplace: (
    textId: string, 
    newText: string, 
    styling: {
      color: string;
      fontSize: number;
      fontFamily: string;
      fontWeight: string;
      textShadow?: string;
      letterSpacing?: number;
    }
  ) => void;
  onTextSelect: (text: DetectedText) => void;
}

export const AdvancedTextReplacement = ({
  detectedTexts,
  selectedText,
  imageDataUrl,
  onTextReplace,
  onTextSelect
}: AdvancedTextReplacementProps) => {
  const [replacementText, setReplacementText] = useState("");
  const [config, setConfig] = useState<ReplacementConfig>({
    autoColorMatch: true,
    autoFontMatch: true,
    addTextShadow: false,
    blendMode: 'normal',
    enhanceContrast: true,
    preserveFormatting: true
  });
  const [processing, setProcessing] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [fontMetrics, setFontMetrics] = useState<FontMetrics | null>(null);
  const [colorAnalysis, setColorAnalysis] = useState<any>(null);
  const [batchMode, setBatchMode] = useState(false);
  const [batchReplacements, setBatchReplacements] = useState<{[key: string]: string}>({});

  const handleAnalyzeText = useCallback(async () => {
    if (!selectedText || !imageDataUrl) return;

    setProcessing(true);
    try {
      // Analyze colors
      if (config.autoColorMatch) {
        const colorData = await detectOptimalTextColor(imageDataUrl, {
          x: selectedText.x,
          y: selectedText.y,
          width: selectedText.width,
          height: selectedText.height
        });
        setColorAnalysis(colorData);
      }

      // Analyze font
      if (config.autoFontMatch) {
        const fontData = matchFont(
          selectedText.text,
          { width: selectedText.width, height: selectedText.height },
          'screenshot'
        );
        setFontMetrics(fontData);
      }

      toast("Text analysis complete!", {
        description: `Color confidence: ${colorAnalysis?.confidence || 0}%, Font confidence: ${fontMetrics?.confidence || 0}%`,
        icon: <Sparkles className="h-4 w-4" />
      });
    } catch (error) {
      toast("Analysis failed", { 
        description: "Could not analyze the selected text region",
        icon: <AlertCircle className="h-4 w-4" />
      });
    } finally {
      setProcessing(false);
    }
  }, [selectedText, imageDataUrl, config]);

  const handleSmartReplace = useCallback(async () => {
    if (!selectedText || !replacementText.trim()) {
      toast("Please select text and enter replacement");
      return;
    }

    setProcessing(true);
    
    try {
      let textColor = '#000000';
      let fontSize = 16;
      let fontFamily = 'Arial';
      let fontWeight = 'normal';
      let textShadow = undefined;
      let letterSpacing = undefined;

      // Use analyzed color if available
      if (colorAnalysis && config.autoColorMatch) {
        textColor = colorAnalysis.color;
        if (config.addTextShadow && colorAnalysis.shadowColor) {
          textShadow = `1px 1px 2px ${colorAnalysis.shadowColor}`;
        }
      }

      // Use analyzed font metrics if available
      if (fontMetrics && config.autoFontMatch) {
        fontSize = fontMetrics.fontSize;
        fontFamily = fontMetrics.fontFamily;
        fontWeight = fontMetrics.fontWeight;
        letterSpacing = fontMetrics.letterSpacing;
      }

      // Apply the replacement
      onTextReplace(selectedText.id, replacementText, {
        color: textColor,
        fontSize,
        fontFamily,
        fontWeight,
        textShadow,
        letterSpacing
      });

      toast("Text replaced seamlessly!", {
        description: "Replacement optimized for perfect blending",
        icon: <CheckCircle className="h-4 w-4" />
      });

      setReplacementText("");
    } catch (error) {
      toast("Replacement failed", {
        description: "Could not replace the selected text",
        icon: <AlertCircle className="h-4 w-4" />
      });
    } finally {
      setProcessing(false);
    }
  }, [selectedText, replacementText, colorAnalysis, fontMetrics, config, onTextReplace]);

  const handleBatchReplace = useCallback(async () => {
    if (Object.keys(batchReplacements).length === 0) {
      toast("No batch replacements configured");
      return;
    }

    setProcessing(true);
    
    for (const [textId, newText] of Object.entries(batchReplacements)) {
      if (newText.trim()) {
        const targetText = detectedTexts.find(t => t.id === textId);
        if (targetText) {
          // Analyze each text individually for optimal replacement
          const colorData = config.autoColorMatch ? 
            await detectOptimalTextColor(imageDataUrl, targetText) : null;
          const fontData = config.autoFontMatch ?
            matchFont(targetText.text, targetText, 'screenshot') : null;

          onTextReplace(textId, newText, {
            color: colorData?.color || '#000000',
            fontSize: fontData?.fontSize || 16,
            fontFamily: fontData?.fontFamily || 'Arial',
            fontWeight: fontData?.fontWeight || 'normal',
            textShadow: config.addTextShadow && colorData?.shadowColor ? 
              `1px 1px 2px ${colorData.shadowColor}` : undefined,
            letterSpacing: fontData?.letterSpacing
          });
        }
      }
    }

    toast(`Batch replaced ${Object.keys(batchReplacements).length} texts!`, {
      description: "All replacements optimized automatically",
      icon: <Sparkles className="h-4 w-4" />
    });

    setBatchReplacements({});
    setProcessing(false);
  }, [batchReplacements, detectedTexts, config, imageDataUrl, onTextReplace]);

  const ConfigSection = () => (
    <Card className="p-4 space-y-4">
      <h4 className="font-semibold flex items-center">
        <Wand2 className="mr-2 h-4 w-4" />
        Smart Replacement Settings
      </h4>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center space-x-2">
          <Switch
            id="auto-color"
            checked={config.autoColorMatch}
            onCheckedChange={(checked) => setConfig(prev => ({ ...prev, autoColorMatch: checked }))}
          />
          <Label htmlFor="auto-color" className="text-sm">Auto Color Match</Label>
        </div>
        
        <div className="flex items-center space-x-2">
          <Switch
            id="auto-font"
            checked={config.autoFontMatch}
            onCheckedChange={(checked) => setConfig(prev => ({ ...prev, autoFontMatch: checked }))}
          />
          <Label htmlFor="auto-font" className="text-sm">Auto Font Match</Label>
        </div>
        
        <div className="flex items-center space-x-2">
          <Switch
            id="text-shadow"
            checked={config.addTextShadow}
            onCheckedChange={(checked) => setConfig(prev => ({ ...prev, addTextShadow: checked }))}
          />
          <Label htmlFor="text-shadow" className="text-sm">Text Shadow</Label>
        </div>
        
        <div className="flex items-center space-x-2">
          <Switch
            id="enhance-contrast"
            checked={config.enhanceContrast}
            onCheckedChange={(checked) => setConfig(prev => ({ ...prev, enhanceContrast: checked }))}
          />
          <Label htmlFor="enhance-contrast" className="text-sm">Enhance Contrast</Label>
        </div>
      </div>
    </Card>
  );

  const AnalysisResults = () => (
    colorAnalysis || fontMetrics ? (
      <Card className="p-4 space-y-3">
        <h4 className="font-semibold flex items-center">
          <Target className="mr-2 h-4 w-4" />
          Analysis Results
        </h4>
        
        {colorAnalysis && (
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Palette className="h-4 w-4" />
              <span className="text-sm">Detected Color:</span>
              <div 
                className="w-6 h-6 rounded border-2 border-border"
                style={{ backgroundColor: colorAnalysis.color }}
              />
              <Badge variant="secondary" className="text-xs">
                {Math.round(colorAnalysis.confidence * 100)}% confidence
              </Badge>
            </div>
          </div>
        )}
        
        {fontMetrics && (
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Type className="h-4 w-4" />
              <span className="text-sm">Font:</span>
              <Badge variant="outline" className="text-xs">
                {fontMetrics.fontFamily} {fontMetrics.fontSize}px
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {Math.round(fontMetrics.confidence * 100)}% match
              </Badge>
            </div>
          </div>
        )}
      </Card>
    ) : null
  );

  const BatchModeSection = () => (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold flex items-center">
          <Layers className="mr-2 h-4 w-4" />
          Batch Processing
        </h4>
        <Switch
          checked={batchMode}
          onCheckedChange={setBatchMode}
        />
      </div>
      
      {batchMode && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Configure replacements for multiple text elements at once
          </p>
          
          {detectedTexts.map((text) => (
            <div key={text.id} className="flex items-center space-x-2">
              <Badge variant="outline" className="text-xs min-w-20">
                {text.text.substring(0, 10)}...
              </Badge>
              <Input
                placeholder="Replacement text"
                value={batchReplacements[text.id] || ""}
                onChange={(e) => setBatchReplacements(prev => ({
                  ...prev,
                  [text.id]: e.target.value
                }))}
                className="flex-1"
              />
            </div>
          ))}
          
          <Button
            onClick={handleBatchReplace}
            disabled={processing || Object.keys(batchReplacements).length === 0}
            className="w-full"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {processing ? "Processing..." : "Apply Batch Replacements"}
          </Button>
        </div>
      )}
    </Card>
  );

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <h3 className="font-semibold mb-4 text-foreground flex items-center">
          <Wand2 className="mr-2 h-4 w-4 text-primary" />
          Advanced Text Replacement
        </h3>

        {selectedText ? (
          <div className="space-y-4">
            <div className="bg-muted/50 p-3 rounded-lg">
              <p className="text-sm font-medium">Selected Text:</p>
              <p className="text-lg font-mono bg-background p-2 rounded mt-1">
                "{selectedText.text}"
              </p>
              <div className="flex items-center space-x-2 mt-2">
                <Badge variant="secondary" className="text-xs">
                  {Math.round(selectedText.confidence * 100)}% confidence
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {Math.round(selectedText.width)}×{Math.round(selectedText.height)}px
                </Badge>
              </div>
            </div>

            <div className="space-y-3">
              <Input
                placeholder="Enter replacement text..."
                value={replacementText}
                onChange={(e) => setReplacementText(e.target.value)}
                className="w-full"
              />
              
              <div className="flex space-x-2">
                <Button
                  onClick={handleAnalyzeText}
                  disabled={processing}
                  variant="outline"
                  className="flex-1"
                >
                  <Target className="mr-2 h-4 w-4" />
                  {processing ? "Analyzing..." : "Analyze"}
                </Button>
                
                <Button
                  onClick={handleSmartReplace}
                  disabled={processing || !replacementText.trim()}
                  className="flex-1"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  {processing ? "Replacing..." : "Smart Replace"}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Target className="mx-auto h-12 w-12 mb-3 opacity-50" />
            <p>Select a detected text element to begin advanced replacement</p>
          </div>
        )}
      </Card>

      <ConfigSection />
      <AnalysisResults />
      <BatchModeSection />
    </div>
  );
};