import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export const Header = () => {
  return (
    <header className="bg-background/80 border-b border-white/10 sticky top-0 z-50 backdrop-blur-xl animate-fade-in-down">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg">
            <Sparkles className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-pink-400">SnapEdit</h1>
            <p className="text-xs text-muted-foreground">AI Powered Image Editor</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <Button variant="ghost">
            Docs
          </Button>
          <Button className="bg-gradient-to-r from-primary to-pink-500 text-white font-semibold hover:scale-105 transition-transform duration-200 hover:shadow-glow">
            Get Pro
          </Button>
        </div>
      </div>
    </header>
  );
};
