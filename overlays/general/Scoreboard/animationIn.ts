import { gsap } from 'gsap'

export default function animationIn(root: HTMLElement) {
  return gsap.timeline().from(root, { y: -60, autoAlpha: 0, duration: 0.5, ease: 'power3.out' })
}
