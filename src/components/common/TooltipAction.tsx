import type { ReactNode } from 'react';
import { ActionIcon, Tooltip } from '@mantine/core';

interface TooltipActionProps {
  label: string;
  icon: ReactNode;
  disabled?: boolean;
  color?: string;
  onClick: () => void;
}

export function TooltipAction({ label, icon, disabled, color, onClick }: TooltipActionProps) {
  return (
    <Tooltip label={label} withArrow openDelay={350}>
      <ActionIcon
        size="lg"
        variant="light"
        color={color}
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
      >
        {icon}
      </ActionIcon>
    </Tooltip>
  );
}
