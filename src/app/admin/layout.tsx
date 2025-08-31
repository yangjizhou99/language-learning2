import { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  // 暂时移除所有认证检查，允许所有用户访问
  // TODO: 后续可以重新启用认证检查
  return <>{children}</>;
}
