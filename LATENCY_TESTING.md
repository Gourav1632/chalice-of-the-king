# Latency Metrics Measurement

This document explains how to test and verify the latency metrics for your resume bullet points.

## 📊 Metrics Being Measured

### 1. Socket.IO Multiplayer Latency (Bullet Point 1)
**Target:** Sub-100ms latency for real-time multiplayer synchronization

**What's measured:** Round-trip time (RTT) between client and server
- Current latency
- Average latency over time
- Min/Max latency
- Sample count

### 2. WebRTC Voice Chat Latency (Bullet Point 3)
**Target:** Low-latency voice communication for 4 concurrent users

**What's measured:** WebRTC peer-to-peer RTT and estimated one-way latency
- Round-trip time (RTT) between peers
- Estimated one-way latency (RTT/2)
- Per-peer statistics

---

## 🚀 How to Test

### Quick Start (Visual Display)

Add the `<LatencyMetrics />` component to any multiplayer screen:

```tsx
import { LatencyMetrics } from "../components/LatencyMetrics";

export const YourMultiplayerComponent = () => {
  return (
    <div>
      <LatencyMetrics />
      {/* Your existing component code */}
    </div>
  );
};
```

**Recommended locations:**
- `MultiPlayerLobby.tsx` - To measure lobby/room latency
- `MultiPlayerMode.tsx` - To measure in-game latency
- `Tutorial.tsx` - For testing

### Console Monitoring

All metrics are automatically logged to the browser console:

**Socket.IO Latency:**
```
📊 Socket.IO Latency: 45ms | Avg: 47.23ms | Min: 42ms | Max: 58ms
```

**WebRTC Voice Latency:**
```
🎙️ WebRTC Stats [user-id]: RTT=48.50ms, Latency=24.25ms
```

---

## 🔧 Implementation Details

### Backend Changes
**File:** `backend/src/socketHandlers.ts`
- Added `latency_ping` and `latency_pong` event handlers
- Minimal code (~4 lines)
- No impact on existing functionality

### Frontend Changes

1. **Latency Measurement Hook**
   - **File:** `frontend/src/hooks/useLatencyMeasurement.ts`
   - Measures Socket.IO RTT every 2 seconds
   - Maintains running statistics (avg, min, max)
   - Keeps last 100 samples

2. **WebRTC Stats Collection**
   - **File:** `frontend/src/hooks/useVoiceChat.tsx`
   - Collects WebRTC stats every 3 seconds
   - Uses built-in `RTCPeerConnection.getStats()` API
   - Measures RTT from candidate-pair reports
   - Estimates one-way latency as RTT/2

3. **Display Component**
   - **File:** `frontend/src/components/LatencyMetrics.tsx`
   - Optional visual overlay showing real-time metrics
   - Color-coded (green if <100ms, orange if ≥100ms)

---

## 📝 Testing Checklist

### Socket.IO Latency (Bullet 1)
- [ ] Join a multiplayer room
- [ ] Observe metrics appearing in top-right corner (if using LatencyMetrics component)
- [ ] Check console for detailed logs every 2 seconds
- [ ] Verify average latency is <100ms under normal conditions
- [ ] Test with 2-4 players to verify scaling

### WebRTC Voice Latency (Bullet 3)
- [ ] Create/join a room with voice chat enabled
- [ ] Have 2-4 users join with microphones enabled
- [ ] Check browser console for WebRTC stats logs every 3 seconds
- [ ] Verify RTT values (typically 20-80ms for peer-to-peer)
- [ ] Verify one-way latency estimates (typically 10-40ms)

---

## 🎯 Expected Results

### Socket.IO (4-player sessions)
- **LAN/Local:** 1-10ms
- **Same city:** 10-30ms
- **Same region:** 30-60ms
- **Cross-region:** 60-150ms
- **Target:** <100ms for good experience

### WebRTC Voice (P2P mesh)
- **LAN/Local:** 1-5ms
- **Same city:** 5-20ms
- **Same region:** 20-50ms
- **Cross-region:** 50-120ms
- **Target:** <50ms for natural conversation

---

## 🧹 Cleanup (Optional)

All measurement code is clearly marked with comments:
```
===== LATENCY MEASUREMENT =====
===== WEBRTC LATENCY MEASUREMENT =====
===== WEBRTC STATS COLLECTION =====
```

To remove:
1. Backend: Remove the `latency_ping`/`latency_pong` handler block
2. Frontend: Delete `useLatencyMeasurement.ts` and `LatencyMetrics.tsx`
3. Frontend: Remove WebRTC stats collection block from `useVoiceChat.tsx`

---

## 💡 Tips

1. **Network conditions matter:** Test on realistic network conditions, not localhost
2. **Multiple samples:** Let it run for 30-60 seconds to get stable averages
3. **Browser console:** Keep DevTools console open to see all metrics
4. **4-player test:** The resume claims 4-player support, so test with 4 users
5. **WebRTC variations:** P2P latency varies significantly based on peer locations

---

## 📸 Data Collection for Resume

Take screenshots showing:
1. Console logs with <100ms Socket.IO latency
2. Console logs with WebRTC RTT values
3. LatencyMetrics component showing green (sub-100ms) values
4. Multiple user sessions active simultaneously (4 players)

You can cite these statistics:
- "Achieved XX ms average latency across N samples"
- "Maintained sub-100ms synchronization with XX% of connections"
- "WebRTC peer-to-peer latency of XX ms for voice communication"
