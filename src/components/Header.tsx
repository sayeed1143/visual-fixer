import { Button } from "@/components/ui/button";
import { ImageIcon, Zap } from "lucide-react";

export const Header = () => {
  return (
    <header className="bg-black/80 border-b border-purple-500/30 sticky top-0 z-50 backdrop-blur">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-primary p-2 rounded-lg">
            <ImageIcon className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">SnapEdit</h1>
            <p className="text-xs text-gray-200">Professional Image Editor</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" className="text-white border-purple-400 hover:bg-purple-500/10">
            <Zap className="mr-2 h-4 w-4" />
            Pro Features
          </Button>
        </div>
      </div>
    </header>
  );
};
