import { NextResponse } from "next/server";
import { connectionManager } from "@/server/manager";

export async function GET() {
  const devices = connectionManager.getAllDevices();
  const dashboards = connectionManager.getAllDashboards();

  return NextResponse.json({
    devices: devices.map(d => ({
      id: d.id,
      ip: d.ip,
      connected: d.socket.readyState === 1,
      lastHeartbeat: d.lastHeartbeat,
      connectedAt: d.connectedAt,
    })),
    dashboards: dashboards.map(d => ({
      userId: d.userId,
      connected: d.socket.readyState === 1,
      connectedAt: d.connectedAt,
    })),
    stats: connectionManager.getStats(),
  });
}
