import { ReactNode } from "react";

// 练习区暂时对未登录用户开放访问
export default function PracticeLayout({ children }: { children: ReactNode }) {
  return children as any;
}


