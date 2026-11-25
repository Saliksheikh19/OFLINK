import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils.ts';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:pointer-events-none disabled:opacity-50 select-none active:scale-[0.98]',
  {
    variants: {
      variant: {
        default:
          'bg-sky-500 text-slate-950 font-bold hover:bg-sky-400 shadow-md shadow-sky-950/40',
        destructive:
          'bg-red-600 text-white font-bold hover:bg-red-500 shadow-md shadow-red-950/50 border border-red-500',
        outline:
          'border border-slate-800 bg-slate-900/80 text-slate-200 hover:bg-slate-800 hover:text-white',
        secondary:
          'bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-700/60',
        ghost:
          'text-slate-300 hover:bg-slate-800/80 hover:text-white',
        link: 'text-sky-400 underline-offset-4 hover:underline',
        tactical:
          'bg-gradient-to-r from-sky-600 to-cyan-600 text-white font-bold border border-sky-400/30 hover:from-sky-500 hover:to-cyan-500 shadow-lg shadow-sky-950/60',
        sos:
          'bg-gradient-to-r from-red-600 to-rose-600 text-white font-black uppercase tracking-wider border border-red-400/80 hover:from-red-500 hover:to-rose-500 shadow-lg shadow-red-950/80',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-lg px-3 text-xs',
        lg: 'h-12 rounded-2xl px-6 text-base',
        icon: 'h-9 w-9 rounded-xl',
        beacon: 'h-14 px-6 text-base rounded-2xl',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
