import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-transparent text-[17px] font-semibold whitespace-nowrap transition-[background-color,box-shadow,transform,filter] outline-none select-none active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        // The one main action on a screen. Coral appears nowhere else (tabs, toolbars and decoration stay black and white).
        default: "glass-prominent hover:brightness-95",
        outline: "border-border bg-card text-foreground hover:bg-muted aria-expanded:bg-muted",
        secondary: "bg-muted text-foreground hover:bg-[color-mix(in_oklch,var(--muted),black_6%)]",
        ghost: "text-foreground hover:bg-muted aria-expanded:bg-muted",
        destructive:
          "bg-destructive-soft text-destructive border-destructive/30 hover:bg-[color-mix(in_oklch,var(--destructive-soft),var(--destructive)_10%)]",
        link: "rounded-none text-foreground underline underline-offset-4 hover:no-underline",
        // Floating controls. glass sits on the warm page; glassArt sits on the trip art (white label on dark clear glass).
        glass: "glass text-foreground hover:brightness-[0.97]",
        glassArt: "glass-art hover:brightness-110",
      },
      size: {
        default: "h-11 px-5",
        xs: "h-8 px-3 text-sm [&_svg:not([class*='size-'])]:size-4",
        sm: "h-10 px-4 text-[15px] [&_svg:not([class*='size-'])]:size-4",
        lg: "h-[52px] px-6",
        icon: "size-11",
        "icon-xs": "size-8 [&_svg:not([class*='size-'])]:size-4",
        "icon-sm": "size-10",
        "icon-lg": "size-[52px]",
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
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
