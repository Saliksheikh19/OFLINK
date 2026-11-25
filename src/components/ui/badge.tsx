import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils.ts';

const badgeVariants = cva(
  'inline-flex items-center rounded-lg border px-2 py-0.5 text-[10px] font-mono font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-sky-500 text-slate-950 shadow-sm',
        secondary:
          'border-slate-800 bg-slate-900 text-slate-300',
        destructive:
          'border-red-800 bg-red-950/90 text-red-300',
        success:
          'border-emerald-800 bg-emerald-950/90 text-emerald-300',
        warning:
          'border-amber-800 bg-amber-950/90 text-amber-300',
        outline: 'border-slate-700 text-slate-300',
        pta: 'border-emerald-700/60 bg-emerald-950/90 text-emerald-300 shadow-xs',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
