// ===== LATENCY MEASUREMENT HOOK =====
// Hook to measure Socket.IO round-trip time (RTT) latency
import { useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";

export const useLatencyMeasurement = (socket: Socket | null, enabled: boolean = true) => {
  const [latency, setLatency] = useState<number | null>(null);
  const [avgLatency, setAvgLatency] = useState<number | null>(null);
  const [minLatency, setMinLatency] = useState<number | null>(null);
  const [maxLatency, setMaxLatency] = useState<number | null>(null);
  const latencySamples = useRef<number[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!socket || !enabled) return;

    // Setup pong listener
    const handlePong = (timestamp: number) => {
      const now = Date.now();
      const rtt = now - timestamp;
      
      setLatency(rtt);
      latencySamples.current.push(rtt);
      
      // Keep last 100 samples
      if (latencySamples.current.length > 100) {
        latencySamples.current.shift();
      }

      // Calculate statistics
      const samples = latencySamples.current;
      const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
      const min = Math.min(...samples);
      const max = Math.max(...samples);

      setAvgLatency(avg);
      setMinLatency(min);
      setMaxLatency(max);

      // Log to console for metric verification
      console.log(`📊 Socket.IO Latency: ${rtt}ms | Avg: ${avg.toFixed(2)}ms | Min: ${min}ms | Max: ${max}ms`);
    };

    socket.on("latency_pong", handlePong);

    // Send ping every 2 seconds
    intervalRef.current = setInterval(() => {
      socket.emit("latency_ping", Date.now());
    }, 2000);

    return () => {
      socket.off("latency_pong", handlePong);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [socket, enabled]);

  return {
    latency,
    avgLatency,
    minLatency,
    maxLatency,
    samples: latencySamples.current.length,
  };
};
