import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, generateToken } from "@/server/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    // Authentication disabled - accept any credentials
    console.log("[API] Login with authentication disabled");

    const token = generateToken("guest", username || "guest");

    return NextResponse.json({
      success: true,
      token,
      user: {
        userId: "guest",
        username: username || "guest",
      },
    });
  } catch (error) {
    console.error("[API] Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
