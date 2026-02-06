import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { cn } from "@/lib/utils"

interface LazyTooltipProps {
  children: React.ReactNode
  content: React.ReactNode
  side?: "top" | "right" | "bottom" | "left"
  sideOffset?: number
  className?: string
  delayDuration?: number
}

/**
 * LazyTooltip - A performance-optimized tooltip that only renders content when open.
 *
 * Unlike the regular Tooltip which always mounts its content tree,
 * this component defers rendering until the user actually hovers.
 * This saves ~5-10ms per tooltip on initial render.
 *
 * Additionally, this tooltip closes on any keydown event to prevent
 * tooltips from getting stuck when keyboard shortcuts are used.
 */
export function LazyTooltip({
  children,
  content,
  side = "top",
  sideOffset = 4,
  className,
  delayDuration = 200,
}: LazyTooltipProps) {
  const [isOpen, setIsOpen] = React.useState(false)

  // Close tooltip on any keydown to prevent stuck tooltips
  // when keyboard shortcuts (like Enter to create new blocks) are used
  React.useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = () => {
      setIsOpen(false)
    }

    // Use capture phase to catch events before they're stopped by other handlers
    document.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true })
    }
  }, [isOpen])

  return (
    <TooltipPrimitive.Root
      delayDuration={delayDuration}
      open={isOpen}
      onOpenChange={setIsOpen}
    >
      <TooltipPrimitive.Trigger asChild>
        {children}
      </TooltipPrimitive.Trigger>
      {isOpen && (
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={sideOffset}
            className={cn(
              "z-[100] overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-tooltip-content-transform-origin]",
              className
            )}
          >
            {content}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      )}
    </TooltipPrimitive.Root>
  )
}
