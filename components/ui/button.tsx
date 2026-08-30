import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-semibold whitespace-nowrap transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-[#00284d] text-white hover:bg-[#003c74] hover:shadow-md hover:ring-2 hover:ring-[#00284d]/25 active:bg-[#001f3b] active:scale-[0.98]",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 hover:shadow-md active:scale-[0.98]",
        outline:
          "border-2 border-slate-300 bg-white text-slate-800 shadow-xs hover:border-teal-600 hover:bg-teal-50/80 hover:text-teal-950 hover:shadow-sm active:scale-[0.98]",
        secondary:
          "bg-slate-100 text-slate-900 border border-slate-200 hover:bg-slate-200 hover:border-slate-300 hover:shadow-xs active:scale-[0.98]",
        ghost:
          "text-slate-700 hover:bg-teal-50 hover:text-teal-900 hover:shadow-xs active:scale-[0.98]",
        link:
          "text-teal-800 underline-offset-4 hover:underline hover:text-teal-950",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
