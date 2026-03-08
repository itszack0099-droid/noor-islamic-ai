import { Wifi, Signal, Battery } from "lucide-react";

const StatusBar = () => {
  return (
    <div className="relative w-full" style={{ height: 59, background: "transparent" }}>
      {/* Status bar content */}
      <div className="flex items-center justify-between px-6" style={{ paddingTop: 14 }}>
        <span className="text-foreground text-sm font-semibold" style={{ fontSize: 15 }}>9:41</span>
        <div className="flex items-center gap-1">
          <Signal className="text-foreground" size={15} />
          <Wifi className="text-foreground" size={15} />
          <Battery className="text-foreground" size={18} />
        </div>
      </div>
      {/* Dynamic Island */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          top: 8,
          width: 126,
          height: 36,
          borderRadius: 20,
          background: "#000",
        }}
      />
    </div>
  );
};

export default StatusBar;
