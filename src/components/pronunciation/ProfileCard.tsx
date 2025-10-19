import { ReactNode } from 'react';

interface ProfileCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: ReactNode;
  color: 'blue' | 'green' | 'purple' | 'red' | 'yellow';
}

const colorClasses = {
  blue: {
    bg: 'bg-blue-50',
    icon: 'text-blue-600',
    value: 'text-blue-900',
  },
  green: {
    bg: 'bg-green-50',
    icon: 'text-green-600',
    value: 'text-green-900',
  },
  purple: {
    bg: 'bg-purple-50',
    icon: 'text-purple-600',
    value: 'text-purple-900',
  },
  red: {
    bg: 'bg-red-50',
    icon: 'text-red-600',
    value: 'text-red-900',
  },
  yellow: {
    bg: 'bg-yellow-50',
    icon: 'text-yellow-600',
    value: 'text-yellow-900',
  },
};

export default function ProfileCard({
  title,
  value,
  subtitle,
  icon,
  color,
}: ProfileCardProps) {
  const colors = colorClasses[color];

  return (
    <div className={`${colors.bg} rounded-xl p-6 border border-${color}-100`}>
      <div className="flex items-start justify-between mb-4">
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <div className={colors.icon}>{icon}</div>
      </div>
      <p className={`text-2xl font-bold ${colors.value} mb-1`}>{value}</p>
      <p className="text-xs text-gray-500">{subtitle}</p>
    </div>
  );
}

