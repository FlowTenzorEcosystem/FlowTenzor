import "server-only";
import { NextResponse } from "next/server";

export const notConfigured = () =>
  NextResponse.json(
    { error: "not_configured", message: "Practice storage is not configured on this site yet." },
    { status: 503 },
  );
