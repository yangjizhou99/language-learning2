-- 创建执行SQL的函数，用于备份恢复
CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
END;
$$;

-- 创建获取表列表的函数
CREATE OR REPLACE FUNCTION get_table_list()
RETURNS TABLE(table_name text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT t.table_name::text
  FROM information_schema.tables t
  WHERE t.table_schema = 'public'
    AND t.table_name != 'spatial_ref_sys'
    AND t.table_type = 'BASE TABLE'
  ORDER BY t.table_name;
END;
$$;

-- 创建获取表列信息的函数
CREATE OR REPLACE FUNCTION get_table_columns(table_name_param text)
RETURNS TABLE(
  column_name text,
  data_type text,
  is_nullable text,
  column_default text,
  ordinal_position integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.column_name::text,
    c.data_type::text,
    c.is_nullable::text,
    c.column_default::text,
    c.ordinal_position::integer
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = table_name_param
  ORDER BY c.ordinal_position;
END;
$$;

-- 授予服务角色执行权限
GRANT EXECUTE ON FUNCTION exec_sql(text) TO service_role;
GRANT EXECUTE ON FUNCTION get_table_list() TO service_role;
GRANT EXECUTE ON FUNCTION get_table_columns(text) TO service_role;
