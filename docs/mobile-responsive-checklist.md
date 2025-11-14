## Mobile Responsiveness Checklist

Use this checklist before shipping any UI changes. The goal is to keep both the layout structure and the interaction model resilient on extremely small screens (≤320px).

### 1. Layout Structure

- [ ] **No fixed width/height containers.**  
  Replace values such as `w-[1200px]`, `h-[800px]` with relative classes (`w-full`, `max-w-6xl`, `min-h-[calc(100vh-…)]`, etc.).
- [ ] **Avoid manual offsets (`ml-[260px]`, `top-[120px]`, etc.).**  
  Restructure the layout with flex/grid + gap; only use `absolute`/`fixed` when the element must overlay.
- [ ] **Flex parents can wrap.**  
  If children may overflow horizontally, ensure `flex-wrap` is enabled or add `overflow-x-auto`.

### 2. Text & Content

- [ ] **Long text is allowed to wrap.**  
  Add `break-words`, `whitespace-pre-wrap`, or `overflow-x-auto` for code/URLs.
- [ ] **Font size scales.**  
  Use responsive typography (`text-sm sm:text-base …`) or clamp when necessary.

### 3. Scroll & Interaction

- [ ] **One scroll container per view.**  
  Identify the actual element that scrolls; expose it via a `data-scroll-container` or a ref so scripts do not bind to stale elements.
- [ ] **Touch-specific styles.**  
  Set `touch-action: pan-y`, `-webkit-overflow-scrolling: touch`, and minimum touch targets (`min-w-[44px] min-h-[44px]`) for interactive elements.
- [ ] **Persistent overlays.**  
  Verify sidebars, modals, and drawers use responsive widths (`w-[85vw] max-w-xs`) and z-index layers that make sense on small screens.

### 4. Visual QA

- [ ] Test with DevTools > Toggle Device Toolbar > iPhone 12/SE + Galaxy Fold.  
  Confirm: (a) sidebar/drawer behaviour, (b) scroll bounce, (c) message width, (d) fixed headers/footers.
- [ ] Send a very long message (mixed languages, long URLs) and confirm it wraps without horizontal scrolling.
- [ ] Verify streaming responses do not auto-scroll when the user has manually scrolled upward.

### 5. Automation / Tooling

- [ ] Grep the diff for suspicious utility classes before merging. Example pattern: `/w-\[[0-9]+(px)?\]/`.
- [ ] Add regression tests or Storybook stories when possible for critical layouts.

Use this file as part of code review: any unchecked item requires a follow-up issue or fix before deployment.

