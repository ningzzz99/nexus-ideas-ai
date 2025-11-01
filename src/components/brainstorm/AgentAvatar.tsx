import { Bot, Lightbulb, Search, Target, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type AgentType = 'spark' | 'probe' | 'facilitator' | 'anchor' | 'user';

const AGENT_CONFIG = {
  spark: {
    icon: Lightbulb,
    color: "bg-spark",
    name: "Spark",
  },
  probe: {
    icon: Search,
    color: "bg-probe",
    name: "Probe",
  },
  facilitator: {
    icon: Bot,
    color: "bg-facilitator",
    name: "Facilitator",
  },
  anchor: {
    icon: Target,
    color: "bg-anchor",
    name: "Anchor",
  },
  user: {
    icon: User,
    color: "bg-primary",
    name: "User",
  },
};

interface AgentAvatarProps {
  type: AgentType;
  size?: "sm" | "md" | "lg";
}

export const AgentAvatar = ({ type, size = "md" }: AgentAvatarProps) => {
  const config = AGENT_CONFIG[type];
  const Icon = config.icon;
  
  const sizeClass = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
  }[size];

  const iconSize = {
    sm: 16,
    md: 20,
    lg: 24,
  }[size];

  return (
    <Avatar className={sizeClass}>
      <AvatarFallback className={`${config.color} text-white`}>
        <Icon size={iconSize} />
      </AvatarFallback>
    </Avatar>
  );
};
