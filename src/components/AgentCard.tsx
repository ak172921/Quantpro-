import React from "react";
import { motion } from "motion/react";
import { cn } from "@/src/lib/utils";
import { CheckCircle2, Circle, Loader2, AlertCircle } from "lucide-react";

interface AgentCardProps {
  title: string;
  status: "idle" | "running" | "completed" | "error";
  description: string;
  output?: string;
  icon: React.ReactNode;
}

export const AgentCard: React.FC<AgentCardProps> = ({ title, status, description, output, icon }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "p-5 rounded-2xl transition-all duration-300 relative overflow-hidden",
        status === "running" ? "glass-panel neon-border-blue" : "glass-panel bg-white/5 border-white/5",
        status === "completed" && "border-green-500/30 bg-green-500/5",
        status === "error" && "border-red-500/30 bg-red-500/5"
      )}
    >
      {/* Decorative background glow for running state */}
      {status === "running" && (
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl" />
      )}

      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2.5 rounded-xl backdrop-blur-md",
            status === "running" ? "bg-blue-500/20 text-blue-400" : 
            status === "completed" ? "bg-green-500/20 text-green-400" :
            "bg-white/10 text-zinc-400"
          )}>
            {icon}
          </div>
          <div>
            <h3 className="font-bold text-zinc-100 font-[Space_Grotesk] tracking-tight">{title}</h3>
            <p className="text-xs text-zinc-400 font-medium">{description}</p>
          </div>
        </div>
        <div>
          {status === "idle" && <Circle className="w-5 h-5 text-zinc-600" />}
          {status === "running" && <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />}
          {status === "completed" && <CheckCircle2 className="w-5 h-5 text-green-400" />}
          {status === "error" && <AlertCircle className="w-5 h-5 text-red-400" />}
        </div>
      </div>
      
      {output && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-4 p-4 bg-black/40 rounded-xl border border-white/5 relative z-10"
        >
          <p className="text-sm text-zinc-300 whitespace-pre-wrap hide-scrollbar overflow-y-auto max-h-48 font-mono text-xs leading-relaxed">
            {output}
          </p>
        </motion.div>
      )}
    </motion.div>
  );
};
