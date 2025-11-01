import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SessionSummary {
  id: string;
  summary_text: string;
  key_insights: string[];
  main_ideas: string[];
  action_items: string[];
  mindmap_image_url: string | null;
  created_at: string;
}

interface SessionSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  sessionTitle: string;
}

export function SessionSummaryDialog({
  open,
  onOpenChange,
  sessionId,
  sessionTitle,
}: SessionSummaryDialogProps) {
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  // Load summary when dialog opens
  useEffect(() => {
    if (open && sessionId) {
      loadSummary();
    }
  }, [open, sessionId]);

  const loadSummary = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('session_summaries')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No summary found - that's ok
          setSummary(null);
        } else {
          throw error;
        }
      } else {
        setSummary(data);
      }
    } catch (error) {
      console.error('Error loading summary:', error);
      toast({
        title: 'Error',
        description: 'Failed to load session summary',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!summary) return;

    try {
      setDeleting(true);
      const { error } = await supabase
        .from('session_summaries')
        .delete()
        .eq('id', summary.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Summary deleted successfully',
      });
      
      setSummary(null);
      onOpenChange(false);
    } catch (error) {
      console.error('Error deleting summary:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete summary',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Session Summary: {sessionTitle}</DialogTitle>
          <DialogDescription>
            AI-generated insights and action items from this brainstorming session
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : summary ? (
          <ScrollArea className="h-[70vh] pr-4">
            <div className="space-y-6">
              {/* Mindmap Image */}
              {summary.mindmap_image_url && (
                <div className="border rounded-lg overflow-hidden">
                  <img
                    src={summary.mindmap_image_url}
                    alt="Session Mind Map"
                    className="w-full h-auto"
                  />
                </div>
              )}

              {/* Summary Text */}
              <div>
                <h3 className="text-lg font-semibold mb-2">Summary</h3>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {summary.summary_text}
                </p>
              </div>

              {/* Key Insights */}
              <div>
                <h3 className="text-lg font-semibold mb-2">Key Insights</h3>
                <ul className="list-disc pl-5 space-y-1">
                  {summary.key_insights.map((insight, idx) => (
                    <li key={idx} className="text-muted-foreground">
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Main Ideas */}
              <div>
                <h3 className="text-lg font-semibold mb-2">Main Ideas</h3>
                <ul className="list-disc pl-5 space-y-1">
                  {summary.main_ideas.map((idea, idx) => (
                    <li key={idx} className="text-muted-foreground">
                      {idea}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action Items */}
              <div>
                <h3 className="text-lg font-semibold mb-2">Action Items</h3>
                <ul className="list-disc pl-5 space-y-1">
                  {summary.action_items.map((action, idx) => (
                    <li key={idx} className="text-muted-foreground">
                      {action}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Delete Button */}
              <div className="pt-4 border-t">
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Summary
                    </>
                  )}
                </Button>
              </div>
            </div>
          </ScrollArea>
        ) : (
          <div className="py-12 text-center text-muted-foreground">
            <p>No summary available for this session yet.</p>
            <p className="text-sm mt-2">End the session to generate a summary.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}