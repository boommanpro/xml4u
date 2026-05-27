import React, { useEffect, useState } from "react";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { useStatusStore } from "@/stores/statusStore";
import { X } from "lucide-react";
import { useShallow } from "zustand/shallow";

export default function ModePanel() {
  const [open, setOpen] = useState(false);
  const { leftPanelWidth, commandMode } = useStatusStore(
    useShallow((state) => ({
      leftPanelWidth: state.leftPanelWidth,
      commandMode: state.commandMode,
    })),
  );

  useEffect(() => {
    setOpen(!!commandMode);
  }, [commandMode]);

  return (
    <Collapsible className="relative" defaultOpen={false} open={open} onOpenChange={setOpen}>
      <CollapsibleContent id="cmd-panel" className="min-w-80 max-w-xl" style={{ width: leftPanelWidth }}>
        <CloseButton />
      </CollapsibleContent>
    </Collapsible>
  );
}

function CloseButton() {
  const setCommandMode = useStatusStore((state) => state.setCommandMode);

  return (
    <button
      className="ml-1 px-1 hover:bg-accent hover:text-accent-foreground"
      onClick={() => setCommandMode(undefined)}
    >
      <X style={{ width: 12, height: 12, color: "#47474780" }} />
    </button>
  );
}
