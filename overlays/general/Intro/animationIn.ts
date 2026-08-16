import { gsap } from 'gsap'

export default function animationIn(root: HTMLElement) {
  return gsap.timeline().from(root, { autoAlpha: 0, duration: 0.6, ease: 'power2.out' })
}
