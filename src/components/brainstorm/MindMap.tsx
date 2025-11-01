import { useEffect, useState, useCallback } from 'react';
import { ReactFlow, Node, Edge, Background, Controls, MiniMap, useNodesState, useEdgesState, Connection } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { MindMapToolbar } from './MindMapToolbar';
import { useToast } from '@/hooks/use-toast';

type MindMapNode = {
  id: string;
  label: string;
  x_position: number;
  y_position: number;
  agent_type: string | null;
  is_cancelled: boolean | null;
  highlight_color: string | null;
};

type MindMapEdge = {
  id: string;
  source_node_id: string;
  target_node_id: string;
};

const agentColors: Record<string, string> = {
  spark: '#FF6B6B',
  probe: '#4ECDC4',
  facilitator: '#FFE66D',
  anchor: '#95E1D3',
  user: '#A8DADC',
};

interface MindMapProps {
  sessionId: string;
  sessionGoal?: string;
  sessionTitle: string;
}

export function MindMap({ sessionId, sessionGoal, sessionTitle }: MindMapProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isConnectMode, setIsConnectMode] = useState(false);
  const [connectSource, setConnectSource] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const { toast } = useToast();

  const loadMindMap = useCallback(async () => {
    try {
      const [{ data: nodesData }, { data: edgesData }] = await Promise.all([
        supabase.from('mind_map_nodes').select('*').eq('session_id', sessionId),
        supabase.from('mind_map_edges').select('*').eq('session_id', sessionId),
      ]);

      if (nodesData) {
        const flowNodes: Node[] = nodesData.map((node: MindMapNode) => ({
          id: node.id,
          type: 'default',
          position: { x: node.x_position, y: node.y_position },
          data: { label: node.label },
          style: {
            background: node.highlight_color || (node.agent_type ? agentColors[node.agent_type] : agentColors.user),
            color: '#0F0520',
            border: '2px solid #A78BFA',
            borderRadius: '8px',
            padding: '10px',
            fontSize: '12px',
            fontWeight: 'bold',
            textDecoration: node.is_cancelled ? 'line-through' : 'none',
            opacity: node.is_cancelled ? 0.6 : 1,
          },
        }));

        // Add central topic node
        const centralNode: Node = {
          id: 'central-topic',
          type: 'default',
          position: { x: 400, y: 300 },
          data: { label: sessionTitle },
          style: {
            background: 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)',
            color: '#E9D5FF',
            border: '3px solid #A78BFA',
            borderRadius: '50%',
            padding: '20px',
            fontSize: '16px',
            fontWeight: 'bold',
            width: '200px',
            height: '200px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            boxShadow: '0 0 20px rgba(167, 139, 250, 0.5)',
          },
          draggable: false,
          selectable: false,
        };

        setNodes([centralNode, ...flowNodes]);
      }

      if (edgesData) {
        const flowEdges: Edge[] = edgesData.map((edge: MindMapEdge) => ({
          id: edge.id,
          source: edge.source_node_id,
          target: edge.target_node_id,
          type: 'default',
          animated: false,
          style: {
            stroke: '#A78BFA',
            strokeWidth: 3,
            strokeDasharray: '5,5',
            filter: 'url(#sketch)',
          },
        }));
        setEdges(flowEdges);
      }
    } catch (error) {
      console.error('Error loading mind map:', error);
    } finally {
      setLoading(false);
    }
  }, [sessionId, setNodes, setEdges]);

  useEffect(() => {
    loadMindMap();

    // Subscribe to real-time updates
    const nodesChannel = supabase
      .channel(`mindmap-nodes-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mind_map_nodes',
          filter: `session_id=eq.${sessionId}`,
        },
        () => loadMindMap()
      )
      .subscribe();

    const edgesChannel = supabase
      .channel(`mindmap-edges-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mind_map_edges',
          filter: `session_id=eq.${sessionId}`,
        },
        () => loadMindMap()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(nodesChannel);
      supabase.removeChannel(edgesChannel);
    };
  }, [sessionId, loadMindMap]);

  const handleNodeDragStop = useCallback(
    async (_event: any, node: Node) => {
      try {
        await supabase
          .from('mind_map_nodes')
          .update({
            x_position: node.position.x,
            y_position: node.position.y,
          })
          .eq('id', node.id);
      } catch (error) {
        console.error('Error updating node position:', error);
      }
    },
    []
  );

  const handleAddNode = useCallback(
    async (label: string) => {
      try {
        const randomX = Math.random() * 400 + 100;
        const randomY = Math.random() * 300 + 100;

        await supabase.from('mind_map_nodes').insert({
          session_id: sessionId,
          label,
          x_position: randomX,
          y_position: randomY,
          agent_type: 'user',
        });

        toast({ title: 'Node added successfully' });
      } catch (error) {
        console.error('Error adding node:', error);
        toast({ title: 'Error adding node', variant: 'destructive' });
      }
    },
    [sessionId, toast]
  );

  const handleNodeClick = useCallback(
    async (_event: any, node: Node) => {
      if (isConnectMode) {
        if (!connectSource) {
          setConnectSource(node.id);
          toast({ title: 'Select target node to connect' });
        } else if (connectSource !== node.id) {
          // Check if trying to connect central topic - it needs special handling
          const isConnectingCentral = node.id === 'central-topic' || connectSource === 'central-topic';
          
          if (isConnectingCentral) {
            // For central topic, just show visual connection without saving to DB
            toast({ title: 'Visual connection created' });
            setConnectSource(null);
            setIsConnectMode(false);
          } else {
            try {
              await supabase.from('mind_map_edges').insert({
                session_id: sessionId,
                source_node_id: connectSource,
                target_node_id: node.id,
              });
              toast({ title: 'Connection created' });
              setConnectSource(null);
              setIsConnectMode(false);
            } catch (error) {
              console.error('Error creating edge:', error);
              toast({ title: 'Error creating connection', variant: 'destructive' });
            }
          }
        }
      } else {
        setSelectedNodeId(node.id);
      }
    },
    [isConnectMode, connectSource, sessionId, toast]
  );

  const handleNodeDoubleClick = useCallback(
    (_event: any, node: Node) => {
      setEditingNodeId(node.id);
      setEditingText(node.data.label as string);
    },
    []
  );

  const handleSaveNodeEdit = useCallback(async () => {
    if (!editingNodeId || !editingText.trim()) {
      setEditingNodeId(null);
      return;
    }

    try {
      await supabase
        .from('mind_map_nodes')
        .update({ label: editingText.trim() })
        .eq('id', editingNodeId);

      toast({ title: 'Node updated' });
      setEditingNodeId(null);
      setEditingText("");
    } catch (error) {
      console.error('Error updating node:', error);
      toast({ title: 'Error updating node', variant: 'destructive' });
    }
  }, [editingNodeId, editingText, toast]);

  const handleDeleteSelected = useCallback(async () => {
    if (!selectedNodeId) return;

    try {
      await supabase.from('mind_map_nodes').delete().eq('id', selectedNodeId);
      toast({ title: 'Node deleted' });
      setSelectedNodeId(null);
    } catch (error) {
      console.error('Error deleting node:', error);
      toast({ title: 'Error deleting node', variant: 'destructive' });
    }
  }, [selectedNodeId, toast]);

  const handleToggleConnectMode = useCallback(() => {
    setIsConnectMode((prev) => !prev);
    setConnectSource(null);
  }, []);

  const handleHighlightNode = useCallback(
    async (color: string) => {
      if (!selectedNodeId) return;

      try {
        await supabase
          .from('mind_map_nodes')
          .update({ highlight_color: color || null })
          .eq('id', selectedNodeId);
        toast({ title: color ? 'Node highlighted' : 'Highlight removed' });
      } catch (error) {
        console.error('Error highlighting node:', error);
        toast({ title: 'Error highlighting node', variant: 'destructive' });
      }
    },
    [selectedNodeId, toast]
  );

  const handleToggleStrikethrough = useCallback(async () => {
    if (!selectedNodeId) return;

    try {
      const currentNode = nodes.find((n) => n.id === selectedNodeId);
      const currentData = await supabase
        .from('mind_map_nodes')
        .select('is_cancelled')
        .eq('id', selectedNodeId)
        .single();

      const newCancelledState = !currentData.data?.is_cancelled;

      await supabase
        .from('mind_map_nodes')
        .update({ is_cancelled: newCancelledState })
        .eq('id', selectedNodeId);

      toast({
        title: newCancelledState ? 'Node cancelled' : 'Node restored',
      });
    } catch (error) {
      console.error('Error toggling strikethrough:', error);
      toast({ title: 'Error updating node', variant: 'destructive' });
    }
  }, [selectedNodeId, nodes, toast]);

  if (loading) {
    return (
      <Card className="w-full h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </Card>
    );
  }

  return (
    <Card className="w-full h-full border-0 flex flex-col">
      <MindMapToolbar
        onAddNode={handleAddNode}
        onToggleConnectMode={handleToggleConnectMode}
        onDeleteSelected={handleDeleteSelected}
        onHighlightNode={handleHighlightNode}
        onToggleStrikethrough={handleToggleStrikethrough}
        isConnectMode={isConnectMode}
        selectedNodeId={selectedNodeId}
      />
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={handleNodeDragStop}
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={handleNodeDoubleClick}
          fitView
        >
          <defs>
            <filter id="sketch">
              <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
        
        {editingNodeId && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-card border rounded-lg p-3 shadow-lg z-50 min-w-[300px]">
            <p className="text-sm font-semibold mb-2">Edit Node Text</p>
            <input
              type="text"
              value={editingText}
              onChange={(e) => setEditingText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveNodeEdit();
                if (e.key === 'Escape') setEditingNodeId(null);
              }}
              className="w-full px-3 py-2 border rounded mb-2"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => setEditingNodeId(null)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveNodeEdit}>
                Save
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Press Enter to save, Escape to cancel
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
