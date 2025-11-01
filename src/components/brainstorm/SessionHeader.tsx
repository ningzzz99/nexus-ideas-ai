import { Button } from "@/components/ui/button";
import { Copy, LogOut, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DMDialog } from "./DMDialog";

interface SessionHeaderProps {
  title: string;
  goal?: string;
  sessionUrl: string;
  onEndSession: () => void;
  participantCount: number;
  onSendDM: (content: string) => void;
  dmDisabled?: boolean;
}

export const SessionHeader = ({
  title,
  goal,
  sessionUrl,
  onEndSession,
  participantCount,
  onSendDM,
  dmDisabled,
}: SessionHeaderProps) => {
  const { toast } = useToast();

  const copySessionLink = () => {
    const fullUrl = `${window.location.origin}/session/${sessionUrl}`;
    navigator.clipboard.writeText(fullUrl);
    toast({ title: "Link copied!", description: "Share this link to invite others" });
  };

  return (
    <div className="border-b bg-card p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{title}</h1>
          {goal && <p className="text-sm text-muted-foreground mt-1">{goal}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={copySessionLink}>
            <Copy className="h-4 w-4 mr-2" />
            Invite
          </Button>
          <DMDialog onSendDM={onSendDM} disabled={dmDisabled} />
          <Button variant="outline" size="sm" onClick={onEndSession}>
            <LogOut className="h-4 w-4 mr-2" />
            End Session
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Users className="h-4 w-4" />
        <span>{participantCount} participant{participantCount !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );
};
