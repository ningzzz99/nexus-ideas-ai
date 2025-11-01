import { useEffect, useState, useCallback } from 'react';
import { ReactFlow, Node, Edge, Background, Controls, MiniMap, useNodesState, useEdgesState, Connection } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { MindMapToolbar } from './MindMapToolbar';
import { useToast } from '@/hooks/use-toast';

type MindMapNode = {
  id: string;
  label: string;
  x_position: number;
  y_position: number;
  agent_type: string | null;
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
}

export function MindMap({ sessionId }: MindMapProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isConnectMode, setIsConnectMode] = useState(false);
  const [connectSource, setConnectSource] = useState<string | null>(null);
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
            background: node.agent_type ? agentColors[node.agent_type] : agentColors.user,
            color: '#000',
            border: '2px solid #222',
            borderRadius: '8px',
            padding: '10px',
            fontSize: '12px',
            fontWeight: 'bold',
          },
        }));
        setNodes(flowNodes);
      }

      if (edgesData) {
        const flowEdges: Edge[] = edgesData.map((edge: MindMapEdge) => ({
          id: edge.id,
          source: edge.source_node_id,
          target: edge.target_node_id,
          type: 'smoothstep',
          animated: true,
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
      } else {
        setSelectedNodeId(node.id);
      }
    },
    [isConnectMode, connectSource, sessionId, toast]
  );

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
        isConnectMode={isConnectMode}
        selectedNodeId={selectedNodeId}
      />
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={handleNodeDragStop}
          onNodeClick={handleNodeClick}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
    </Card>
  );
}
