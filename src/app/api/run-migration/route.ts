import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Migration endpoint deprecated - migrations already run in Supabase console',
  });
}
