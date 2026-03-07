import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ref, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-[88px] w-full rounded-lg border border-input bg-transparent px-3 py-2.5 text-sm transition-[color,box-shadow,border-color] placeholder:text-muted-foreground/90 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
}

export { Textarea }
