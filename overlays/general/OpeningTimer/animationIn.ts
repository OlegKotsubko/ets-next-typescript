import { gsap } from 'gsap'

export default function animationIn(root: HTMLElement) {
  return gsap.timeline().from(root, { scale: 0.9, autoAlpha: 0, duration: 0.5, ease: 'back.out(1.6)' })
}
