import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const path = url.searchParams.get('path');
    const bucket = url.searchParams.get('bucket');
    
    return NextResponse.json({
      url: req.url,
      path,
      bucket,
      allParams: Object.fromEntries(url.searchParams.entries())
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
