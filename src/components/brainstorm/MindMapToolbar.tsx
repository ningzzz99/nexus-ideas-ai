import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Link2, Trash2, Palette, Strikethrough, Type } from "lucide-react";
import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface MindMapToolbarProps {
  onAddNode: (label: string) => void;
  onToggleConnectMode: () => void;
  onDeleteSelected: () => void;
  onHighlightNode: (color: string) => void;
  onToggleStrikethrough: () => void;
  isConnectMode: boolean;
  selectedNodeId: string | null;
}

export function MindMapToolbar({
  onAddNode,
  onToggleConnectMode,
  onDeleteSelected,
  onHighlightNode,
  onToggleStrikethrough,
  isConnectMode,
  selectedNodeId,
}: MindMapToolbarProps) {
  const [newNodeText, setNewNodeText] = useState("");

  const handleAddNode = () => {
    if (newNodeText.trim()) {
      onAddNode(newNodeText.trim());
      setNewNodeText("");
    }
  };

  const highlightColors = [
    { name: "Yellow", value: "#FFE66D" },
    { name: "Green", value: "#95E1D3" },
    { name: "Blue", value: "#4ECDC4" },
    { name: "Pink", value: "#FF6B6B" },
    { name: "Purple", value: "#B19CD9" },
    { name: "None", value: "" },
  ];

  return (
    <div className="flex items-center gap-2 p-3 bg-card border-b flex-wrap">
      <Input
        placeholder="Add new node..."
        value={newNodeText}
        onChange={(e) => setNewNodeText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleAddNode()}
        className="max-w-xs"
      />
      <Button onClick={handleAddNode} size="sm" variant="secondary">
        <Plus className="h-4 w-4 mr-1" />
        Add Node
      </Button>
      <Button
        onClick={onToggleConnectMode}
        size="sm"
        variant={isConnectMode ? "default" : "outline"}
      >
        <Link2 className="h-4 w-4 mr-1" />
        {isConnectMode ? "Connecting..." : "Connect"}
      </Button>
      {selectedNodeId && (
        <>
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline">
                <Palette className="h-4 w-4 mr-1" />
                Highlight
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2">
              <div className="flex gap-2 flex-wrap max-w-[200px]">
                {highlightColors.map((color) => (
                  <Button
                    key={color.value}
                    size="sm"
                    variant="outline"
                    className="h-8 w-16"
                    style={{ backgroundColor: color.value || "transparent" }}
                    onClick={() => onHighlightNode(color.value)}
                  >
                    {color.name}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <Button onClick={onToggleStrikethrough} size="sm" variant="outline">
            <Strikethrough className="h-4 w-4 mr-1" />
            Cancel
          </Button>
          <Button onClick={onDeleteSelected} size="sm" variant="destructive">
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
        </>
      )}
    </div>
  );
}
