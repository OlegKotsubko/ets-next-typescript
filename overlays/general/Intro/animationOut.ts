import { gsap } from 'gsap'

export default function animationOut(root: HTMLElement) {
  return gsap.timeline().to(root, { autoAlpha: 0, duration: 0.4, ease: 'power2.in' })
}
