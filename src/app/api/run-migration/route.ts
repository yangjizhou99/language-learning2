import { NextResponse } from "next/server";
import { runMigration } from "@/lib/runMigration";

export async function GET() {
  try {
    const success = await runMigration();
    return NextResponse.json({ 
      success,
      message: success ? "Migration completed successfully" : "Migration failed"
    });
  } catch (error) {
    return NextResponse.json({ 
      success: false,
      message: error instanceof Error ? error.message : "Unknown error occurred"
    }, { status: 500 });
  }
}
