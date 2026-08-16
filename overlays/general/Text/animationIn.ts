import { gsap } from 'gsap'

export default function animationIn(root: HTMLElement) {
  return gsap.timeline().from(root, { y: 40, autoAlpha: 0, duration: 0.5, ease: 'power2.out' })
}
