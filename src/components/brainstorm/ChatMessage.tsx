import { AgentAvatar } from "./AgentAvatar";
import { formatDistanceToNow } from "date-fns";

type AgentType = 'spark' | 'probe' | 'facilitator' | 'anchor' | 'user';

interface ChatMessageProps {
  content: string;
  agentType: AgentType;
  timestamp: string;
  isAnonymous?: boolean;
}

const AGENT_NAMES = {
  spark: "Spark",
  probe: "Probe",
  facilitator: "Facilitator",
  anchor: "Anchor",
  user: "You",
};

const AGENT_COLORS = {
  spark: "bg-spark-light border-spark",
  probe: "bg-probe-light border-probe",
  facilitator: "bg-facilitator-light border-facilitator",
  anchor: "bg-anchor-light border-anchor",
  user: "bg-secondary border-border",
};

export const ChatMessage = ({
  content,
  agentType,
  timestamp,
  isAnonymous,
}: ChatMessageProps) => {
  const colorClass = AGENT_COLORS[agentType];
  const displayName = isAnonymous ? "Anonymous" : AGENT_NAMES[agentType];

  return (
    <div className="flex gap-3 animate-in slide-in-from-bottom-2 duration-300">
      <AgentAvatar type={agentType} size="md" />
      <div className="flex-1 space-y-1">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-sm">{displayName}</span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(timestamp), { addSuffix: true })}
          </span>
        </div>
        <div className={`rounded-lg border-2 p-3 ${colorClass}`}>
          <p className="text-sm whitespace-pre-wrap text-foreground">{content}</p>
        </div>
      </div>
    </div>
  );
};
