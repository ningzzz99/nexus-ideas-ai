import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MessageSquare, Send } from "lucide-react";

interface DMDialogProps {
  onSendDM: (content: string) => void;
  disabled?: boolean;
}

export const DMDialog = ({ onSendDM, disabled }: DMDialogProps) => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled && !sending) {
      setSending(true);
      await onSendDM(message.trim());
      setMessage("");
      setSending(false);
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <MessageSquare className="h-4 w-4 mr-2" />
          DM Facilitator
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Anonymous Idea</DialogTitle>
          <DialogDescription>
            Share your idea privately with the Facilitator, who will post it anonymously to the group chat.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your idea here..."
            className="min-h-[120px] resize-none"
            disabled={sending}
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={sending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!message.trim() || sending}>
              <Send className="h-4 w-4 mr-2" />
              Send Anonymously
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
