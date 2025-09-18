import { NextRequest, NextResponse } from 'next/server';
import { getLocal, getProd, qTable, qIdent } from '@/lib/db';
import { z } from 'zod';
import * as CopyStreams from 'pg-copy-streams';
import { randomUUID } from 'crypto';

const bodySchema = z.object({
  table: z.string().min(1),
  columns: z.string().optional(),      // 逗号分隔: "id,name,created_at"
  where: z.string().optional(),        // 仅用于本地库筛选
  mode: z.enum(['insert','upsert']).default('insert'),
  conflictKeys: z.string().optional()  // 逗号分隔: "id" 或 "id,code"
});

export async function POST(req: NextRequest) {
  const body = bodySchema.parse(await req.json());
  const table = body.table.trim();
  const cols  = (body.columns?.trim() || '').split(',').map(s => s.trim()).filter(Boolean);
  const where = (body.where?.trim() || '');
  const mode  = body.mode;
  const conflictKeys = (body.conflictKeys?.trim() || '').split(',').map(s => s.trim()).filter(Boolean);

  const lc = getLocal(); const rc = getProd();
  await lc.connect(); await rc.connect();

  try {
    // 若未传 columns，则自动读取本地信息架构获取所有可选列（public.<table>）
    let columns = cols;
    if (columns.length === 0) {
      const { rows } = await lc.query(
        `select column_name from information_schema.columns
         where table_schema = 'public' and table_name = $1
         order by ordinal_position`, [table]);
      if (rows.length === 0) throw new Error('table not found in local');
      columns = rows.map(r => r.column_name);
    }
    const colList = columns.map(qIdent).join(',');

    // 1) 从"本地库"导出选中数据为 CSV 流
    const copyTo = (CopyStreams as any).to;
    const whereClause = where ? ` where ${where} ` : '';
    // 注意：where 是"本地查询条件"，仅供你自己在本地使用；线上请不要暴露
    const readStream = (lc as any).query(
      copyTo(`COPY (select ${colList} from ${qTable(table)} ${whereClause}) TO STDOUT WITH (FORMAT csv, HEADER true)`)
    );

    // 2) 写入"云端库"
    const copyFrom = (CopyStreams as any).from;

    if (mode === 'insert' || conflictKeys.length === 0) {
      const writeStream = (rc as any).query(
        copyFrom(`COPY ${qTable(table)}(${colList}) FROM STDIN WITH (FORMAT csv, HEADER true)`)
      );
      const done = new Promise<void>((resolve, reject) => {
        writeStream.on('finish', () => resolve());
        writeStream.on('error', reject);
      });
      readStream.pipe(writeStream);
      await done;
    } else {
      // UPSERT：先 COPY 到云端的临时表，再 ON CONFLICT 合并
      const temp = `tmp_${randomUUID().replace(/-/g,'')}`;
      await rc.query(`create temporary table ${qIdent(temp)} as table ${qTable(table)} with no data`);
      const tempWrite = (rc as any).query(
        copyFrom(`COPY ${qIdent(temp)}(${colList}) FROM STDIN WITH (FORMAT csv, HEADER true)`)
      );
      const doneCopy = new Promise<void>((resolve, reject) => {
        tempWrite.on('finish', resolve);
        tempWrite.on('error', reject);
      });
      readStream.pipe(tempWrite);
      await doneCopy;

      const conflict = conflictKeys.map(qIdent).join(',');
      // 除冲突键外，其他列全部更新为 EXCLUDED 值
      const setList = columns
        .filter(c => !conflictKeys.includes(c))
        .map(c => `${qIdent(c)} = EXCLUDED.${qIdent(c)}`).join(',');

      await rc.query(`insert into ${qTable(table)}(${colList})
                      select ${colList} from ${qIdent(temp)}
                      on conflict (${conflict}) do update set ${setList}`);
      // 临时表自动随会话销毁
    }

    return NextResponse.json({ ok: true });
  } catch (e:any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  } finally {
    await lc.end(); await rc.end();
  }
}
