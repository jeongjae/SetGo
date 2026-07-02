import { ChevronRight, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

type IOSPageHeaderProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
};

export function IOSPageHeader({ eyebrow, title, description, action }: IOSPageHeaderProps) {
  return (
    <header className="ios-page-header">
      <div className="min-w-0">
        {eyebrow ? <p className="ios-eyebrow">{eyebrow}</p> : null}
        <h1 className="ios-title truncate">{title}</h1>
        {description ? <p className="ios-subtext mt-1">{description}</p> : null}
      </div>
      {action}
    </header>
  );
}

type IOSListRowProps = {
  icon: LucideIcon;
  iconClassName?: string;
  title: ReactNode;
  detail?: ReactNode;
  onClick?: () => void;
};

export function IOSListRow({
  icon: Icon,
  iconClassName = 'bg-sg-tertiary-label',
  title,
  detail,
  onClick,
}: IOSListRowProps) {
  const content = (
    <>
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white ${iconClassName}`}>
        <Icon aria-hidden="true" size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-sg-label">{title}</span>
        {detail ? <span className="mt-0.5 block text-xs font-semibold text-sg-tertiary-label">{detail}</span> : null}
      </span>
      {onClick ? <ChevronRight aria-hidden="true" size={16} className="text-sg-quaternary-label" /> : null}
    </>
  );

  if (!onClick) {
    return <div className="ios-row flex w-full items-center gap-3 bg-sg-surface p-3.5 text-left">{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="ios-row flex w-full items-center gap-3 bg-sg-surface p-3.5 text-left transition-all active:bg-sg-fill"
    >
      {content}
    </button>
  );
}

type IOSSegmentedControlProps<T extends string> = {
  value: T;
  options: Array<{
    value: T;
    label: ReactNode;
    icon?: LucideIcon;
  }>;
  onChange: (value: T) => void;
  columns?: number;
};

export function IOSSegmentedControl<T extends string>({
  value,
  options,
  onChange,
  columns,
}: IOSSegmentedControlProps<T>) {
  return (
    <div
      className="ios-segmented"
      style={{ gridTemplateColumns: `repeat(${columns ?? options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const active = value === option.value;
        const Icon = option.icon;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            className={`ios-segment ${active ? 'ios-segment-active' : ''}`}
          >
            {Icon ? <Icon aria-hidden="true" size={14} /> : null}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
