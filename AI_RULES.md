# AI_RULES.md

## Tech Stack Overview

- **React** with **TypeScript** for all UI and logic
- **React Router** for client-side routing (routes defined in `src/App.tsx`)
- **shadcn/ui** for all UI components (use prebuilt components whenever possible)
- **Tailwind CSS** for all styling (use utility classes for layout, spacing, colors, etc.)
- **lucide-react** for icons (use for all iconography)
- **Radix UI** (already included via shadcn/ui) for accessible primitives
- **Pages** are located in `src/pages/`
- **Components** are located in `src/components/`
- **Main page** is `src/pages/Index.tsx` (always update this to showcase new components)

## Library Usage Rules

1. **UI Components:**
   - Always use **shadcn/ui** components for UI elements (buttons, dialogs, forms, etc.).
   - If customization is needed, create a new component in `src/components/` rather than editing shadcn/ui source files.

2. **Styling:**
   - Use **Tailwind CSS** utility classes for all styling and layout.
   - Do not use plain CSS, CSS modules, or styled-components.

3. **Icons:**
   - Use **lucide-react** for all icons. Import only the icons you need.

4. **Routing:**
   - Define all routes in `src/App.tsx` using **React Router**.
   - Place page components in `src/pages/`.

5. **File Structure:**
   - Keep all source code in the `src/` directory.
   - Place reusable UI components in `src/components/`.
   - Place page-level components in `src/pages/`.

6. **TypeScript:**
   - All code must be written in **TypeScript**.
   - Use type annotations and interfaces for props and state.

7. **No Overengineering:**
   - Keep implementations simple and focused on user requirements.
   - Avoid unnecessary abstractions or complex patterns.

8. **No Direct DOM Manipulation:**
   - Use React state and props for UI updates, not direct DOM APIs.

9. **No Unapproved Libraries:**
   - Only use the libraries listed above. Do not add new dependencies without explicit approval.

10. **Documentation:**
    - Update this file if tech stack or rules change.

---

*Follow these rules to ensure consistency, maintainability, and best practices throughout the codebase.*
