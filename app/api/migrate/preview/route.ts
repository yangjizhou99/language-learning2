import { NextRequest, NextResponse } from 'next/server';
import { getLocal, qTable } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const table = searchParams.get('table')!;
  const limit = Number(searchParams.get('limit') || 100);
  const where = searchParams.get('where') || '';

  const lc = getLocal(); await lc.connect();
  try {
    const sql = `select * from ${qTable(table)} ${where ? ' where '+where : ''} limit $1`;
    const rows = (await lc.query(sql, [limit])).rows;
    const count = (await lc.query(
      `select count(*)::int as c from ${qTable(table)} ${where ? ' where '+where : ''}`)).rows[0].c;
    return NextResponse.json({ count, sample: rows });
  } finally { await lc.end(); }
}
