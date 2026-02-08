// ===== LATENCY METRICS DISPLAY COMPONENT =====
// Simple component to display Socket.IO and WebRTC latency metrics
// Add this to any multiplayer screen to monitor latency in real-time
import { useSocket } from "../contexts/SocketContext";
import { useLatencyMeasurement } from "../hooks/useLatencyMeasurement";

export const LatencyMetrics = () => {
  const metricsEnabled = import.meta.env.VITE_METRICS_MODE === "true";
  const { socket } = useSocket();
  const { latency, avgLatency, minLatency, maxLatency, samples } = useLatencyMeasurement(
    socket,
    metricsEnabled
  );

  if (!metricsEnabled || !socket) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 10,
        right: 10,
        background: "rgba(0, 0, 0, 0.8)",
        color: "#00ff00",
        padding: "10px 15px",
        borderRadius: "8px",
        fontFamily: "monospace",
        fontSize: "12px",
        zIndex: 9999,
        minWidth: "250px",
      }}
    >
      <div style={{ fontWeight: "bold", marginBottom: "8px", color: "#ffff00" }}>
        📊 LATENCY METRICS
      </div>
      
      <div style={{ marginBottom: "4px" }}>
        <strong>Socket.IO RTT:</strong>
      </div>
      <div style={{ marginLeft: "10px", fontSize: "11px" }}>
        Current: <span style={{ color: latency && latency < 100 ? "#00ff00" : "#ff6600" }}>
          {latency !== null ? `${latency}ms` : "measuring..."}
        </span>
      </div>
      <div style={{ marginLeft: "10px", fontSize: "11px" }}>
        Average: {avgLatency !== null ? `${avgLatency.toFixed(2)}ms` : "N/A"}
      </div>
      <div style={{ marginLeft: "10px", fontSize: "11px" }}>
        Min: {minLatency !== null ? `${minLatency}ms` : "N/A"} | 
        Max: {maxLatency !== null ? `${maxLatency}ms` : "N/A"}
      </div>
      <div style={{ marginLeft: "10px", fontSize: "11px", color: "#888" }}>
        Samples: {samples}
      </div>
      
      <div style={{ marginTop: "8px", fontSize: "10px", color: "#888" }}>
        💡 WebRTC stats: Check browser console
      </div>
    </div>
  );
};
