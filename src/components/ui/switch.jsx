"use client"

import * as React from "react"
import { cn } from "cn"
import { Switch as SwitchPrimitive } from "radix-ui"

/**
 * An on/off control for a single setting that saves as soon as it is used.
 *
 * Checkbox is the wrong primitive for this: a checkbox belongs to a form that
 * is submitted later, and this one commits on change. The track carries the
 * state in position as well as colour, so the setting is readable without
 * relying on hue alone.
 *
 * @param {import("radix-ui").SwitchProps} props
 * @returns {JSX.Element}
 */
function Switch({ className, ...props }) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-transparent transition-colors",
        "bg-input data-[state=checked]:bg-primary",
        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-5 rounded-full bg-background shadow-sm ring-0 transition-transform",
          "motion-reduce:transition-none",
          "translate-x-0.5 data-[state=checked]:translate-x-[1.375rem]"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
