import { gsap } from 'gsap'

export default function animationOut(root: HTMLElement) {
  return gsap.timeline().to(root, { scale: 0.9, autoAlpha: 0, duration: 0.35, ease: 'power2.in' })
}
