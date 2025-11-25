"use client"

import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

interface SwitchProps extends React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> {
  className?: string
  disabled?: boolean
}

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  SwitchProps
>((propsWithRef, ref) => {
  const { className, ...props } = propsWithRef
  return (
  // @ts-expect-error - Radix UI v1.2.6 has restrictive types that don't allow className
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
      // Enhanced ON state - Green with border
      "data-[state=checked]:bg-green-500 data-[state=checked]:border-green-600",
      // Enhanced OFF state - Gray with border
      "data-[state=unchecked]:bg-gray-300 data-[state=unchecked]:border-gray-400",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      // @ts-expect-error - Radix UI v1.2.6 has restrictive types that don't allow className
      className={cn(
        "pointer-events-none block h-5 w-5 rounded-full shadow-lg ring-0 transition-all",
        // White thumb with better shadow
        "bg-white",
        // Transform with smooth animation
        "data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
        // Add subtle scale effect
        "data-[state=checked]:scale-100 data-[state=unchecked]:scale-95"
      )}
    />
  </SwitchPrimitives.Root>
  )
})
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
