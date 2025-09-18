// server-only helpers
import { Client } from 'pg';

export const getLocal = () => new Client({ connectionString: process.env.LOCAL_DB_URL });
export const getProd = () => new Client({ connectionString: process.env.PROD_DB_URL });

// 安全转义表名/列名（仅允许 public.<name>）
export function qIdent(name: string) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) throw new Error('bad ident');
  return `"${name}"`;
}
export function qTable(table: string, schema = 'public') {
  return `${qIdent(schema)}.${qIdent(table)}`;
}
