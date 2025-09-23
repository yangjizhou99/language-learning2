// server-only helpers
import { Client } from 'pg';

export const getLocal = () => {
  const conn = process.env.LOCAL_DB_URL_FORCE || process.env.LOCAL_DB_URL;
  if (!conn) return new Client({ connectionString: conn as any });
  try {
    const url = new URL(conn);
    const hostname = url.hostname;
    const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || url.port === '54322';
    if (isLocalHost) {
      if (hostname === 'localhost' || hostname === '::1') url.hostname = '127.0.0.1';
      // 本地未显式指定端口时，固定默认 54322
      if (!url.port || url.port === '') url.port = '54322';
      url.searchParams.delete('sslmode');
      return new Client({ connectionString: url.toString(), ssl: false });
    }
  } catch {
    // fallthrough
  }
  return new Client({ connectionString: conn });
};
export const getProd = () => new Client({ connectionString: process.env.PROD_DB_URL });

// 安全转义表名/列名（仅允许 public.<name>）
export function qIdent(name: string) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) throw new Error('bad ident');
  return `"${name}"`;
}
export function qTable(table: string, schema = 'public') {
  return `${qIdent(schema)}.${qIdent(table)}`;
}
