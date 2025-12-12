import { ExtendedWebSocket } from "./types";
import { connectionManager } from "./manager";
import { validateTelemetry, validateStatus } from "./validate";
import { verifyDeviceToken } from "./auth";

export function handleDeviceConnection(ws: ExtendedWebSocket, req: any) {
  const url = req.url || "";
  console.log(`[Device] Full URL: ${url}`);

  // Parse URL manually to ensure compatibility
  let deviceId = "";
  let token = "";

  try {
    const urlObj = new URL(url, "http://localhost");
    deviceId = urlObj.searchParams.get("device_id") || "";
    token = urlObj.searchParams.get("token") || "";
  } catch (e) {
    // Fallback: manual parsing
    const deviceIdMatch = url.match(/[?&]device_id=([^&]+)/);
    const tokenMatch = url.match(/[?&]token=([^&]+)/);
    deviceId = deviceIdMatch ? deviceIdMatch[1] : "";
    token = tokenMatch ? tokenMatch[1] : "";
  }

  console.log(
    `[Device] Parsed - device_id: ${deviceId}`
  );

  // Authentication disabled - accept all connections
  console.log(`[Device] Authentication disabled, accepting connection`);

  if (!deviceId) {
    console.log("[Device] Missing device_id");
    ws.close(1008, "Missing device_id");
    return;
  }

  // Get client IP
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.socket.remoteAddress ||
    "unknown";

  // Register device
  ws.deviceId = deviceId;
  ws.isAlive = true;
  connectionManager.registerDevice(deviceId, ws, ip);

  // Notify dashboards
  connectionManager.broadcastStatus({
    type: "status",
    state: "IDLE",
    message: `Device ${deviceId} connected`,
  });

  // Handle messages from device
  ws.on("message", (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());

      // Update heartbeat
      connectionManager.updateDeviceHeartbeat(deviceId);

      // Handle telemetry
      if (message.type === "telemetry") {
        if (validateTelemetry(message)) {
          console.log(`[Device] Telemetry from ${deviceId}`);
          connectionManager.broadcastTelemetry(message);
        } else {
          console.warn(
            "[Device] Invalid telemetry format:",
            JSON.stringify(message)
          );
        }
      }

      // Handle status updates
      else if (message.type === "status") {
        if (validateStatus(message)) {
          console.log(`[Device] Status from ${deviceId}: ${message.state}`);
          connectionManager.broadcastStatus(message);
        }
      }

      // Handle ACK
      else if (message.type === "ack") {
        console.log(`[Device] ACK from ${deviceId}: ${message.message}`);
        connectionManager.broadcastStatus(message);
      }
    } catch (error) {
      console.error("[Device] Message parse error:", error);
    }
  });

  // Handle pong for heartbeat
  ws.on("pong", () => {
    ws.isAlive = true;
    connectionManager.updateDeviceHeartbeat(deviceId);
  });

  // Handle close
  ws.on("close", (code, reason) => {
    console.log(
      `[Device] Disconnected: ${deviceId} (code: ${code}, reason: ${reason.toString()})`
    );
    connectionManager.removeDevice(deviceId);
    connectionManager.broadcastStatus({
      type: "status",
      state: "IDLE",
      message: `Device ${deviceId} disconnected`,
    });
  });

  // Handle error
  ws.on("error", (error) => {
    console.error(`[Device] Error on ${deviceId}:`, error.message);
    // Safely close the connection on error
    try {
      if (ws.readyState === ws.OPEN || ws.readyState === ws.CONNECTING) {
        ws.terminate();
      }
    } catch (e) {
      console.error(`[Device] Failed to terminate connection:`, e);
    }
  });

  console.log(`[Device] Connected: ${deviceId} from ${ip}`);
}
