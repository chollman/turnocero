import { createPortal } from 'react-dom'

/**
 * Renders children into document.body via React Portal so the modal escapes
 * any parent stacking context (e.g., the `position: relative; zIndex: 1`
 * wrapper in App.jsx that traps z-index below the decorative .appFrame).
 *
 * Use for any full-screen modal/lightbox that needs to render above the
 * fixed app frame and the floating FAB widgets.
 */
export default function ModalPortal({ children }) {
  if (typeof document === 'undefined') return null
  return createPortal(children, document.body)
}
