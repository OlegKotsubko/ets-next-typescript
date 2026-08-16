import { gsap } from 'gsap'

export default function animationOut(root: HTMLElement) {
  return gsap.timeline().to(root, { y: -60, autoAlpha: 0, duration: 0.35, ease: 'power2.in' })
}
