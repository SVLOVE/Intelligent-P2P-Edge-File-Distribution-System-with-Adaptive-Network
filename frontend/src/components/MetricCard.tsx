import React from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  trend?: {
    text: string;
    positive?: boolean;
    neutral?: boolean;
  };
  icon?: React.ReactNode;
  badge?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subValue,
  trend,
  icon,
  badge,
}) => {
  return (
    <div className="metric-card">
      <div className="metric-header">
        <span className="metric-label">{label}</span>
        {icon && <div className="metric-icon">{icon}</div>}
      </div>

      <div className="metric-value-row">
        <span className="metric-value">{value}</span>
        {badge && <span className="metric-badge">{badge}</span>}
      </div>

      {(subValue || trend) && (
        <div className="metric-footer">
          {trend && (
            <span
              className={`metric-trend ${
                trend.neutral
                  ? 'trend-neutral'
                  : trend.positive
                  ? 'trend-up'
                  : 'trend-down'
              }`}
            >
              {trend.text}
            </span>
          )}
          {subValue && <span className="metric-subvalue">{subValue}</span>}
        </div>
      )}
    </div>
  );
};
