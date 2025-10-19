'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Play } from 'lucide-react';
import type { UnitStats } from '@/types/pronunciation';

interface WeakUnitsTableProps {
  units: UnitStats[];
}

export default function WeakUnitsTable({ units }: WeakUnitsTableProps) {
  const router = useRouter();

  const handleStartVerification = (unitId: number) => {
    // 先进行二次验证，确认是否真的薄弱
    router.push(`/practice/pronunciation/verify/${unitId}`);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
              排名
            </th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
              音节
            </th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
              平均分
            </th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
              置信区间
            </th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
              样本数
            </th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
              等级
            </th>
            <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
              操作
            </th>
          </tr>
        </thead>
        <tbody>
          {units.map((unit, idx) => (
            <tr
              key={unit.unit_id}
              className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
            >
              <td className="py-3 px-4">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                    idx < 3
                      ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {idx + 1}
                </div>
              </td>
              <td className="py-3 px-4">
                <span className="font-mono font-semibold text-gray-900">
                  {unit.symbol}
                </span>
              </td>
              <td className="py-3 px-4">
                <span className="text-lg font-semibold text-gray-900">
                  {unit.mean.toFixed(1)}
                </span>
              </td>
              <td className="py-3 px-4">
                {unit.ci_low !== undefined && unit.ci_high !== undefined ? (
                  <span className="text-sm text-gray-600">
                    [{unit.ci_low.toFixed(1)}, {unit.ci_high.toFixed(1)}]
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">-</span>
                )}
              </td>
              <td className="py-3 px-4">
                <span className="text-sm text-gray-600">{unit.n}</span>
              </td>
              <td className="py-3 px-4">
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                    unit.grade === 'A'
                      ? 'bg-green-100 text-green-700'
                      : unit.grade === 'B'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {unit.grade}
                </span>
              </td>
              <td className="py-3 px-4 text-right">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleStartVerification(unit.unit_id)}
                  className="flex items-center gap-1"
                >
                  <Play className="w-3 h-3" />
                  开始验证
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {units.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p>暂无薄弱音节</p>
          <p className="text-sm mt-1">继续保持！</p>
        </div>
      )}
    </div>
  );
}

