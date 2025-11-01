import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Link2, Trash2 } from "lucide-react";
import { useState } from "react";

interface MindMapToolbarProps {
  onAddNode: (label: string) => void;
  onToggleConnectMode: () => void;
  onDeleteSelected: () => void;
  isConnectMode: boolean;
  selectedNodeId: string | null;
}

export function MindMapToolbar({
  onAddNode,
  onToggleConnectMode,
  onDeleteSelected,
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

  return (
    <div className="flex items-center gap-2 p-3 bg-card border-b">
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
        <Button onClick={onDeleteSelected} size="sm" variant="destructive">
          <Trash2 className="h-4 w-4 mr-1" />
          Delete
        </Button>
      )}
    </div>
  );
}
