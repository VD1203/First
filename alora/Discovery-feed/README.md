# Alora — Discovery Feed

Interactive prototype of the Alora discovery flow, built to the Figma
source (`Internal Design File - Alora`, Discovery Feed section).

**Live:** https://vd1203.github.io/First/alora/Discovery-feed/

## The flow

Orbit (profiles oscillating on ellipses) → pinch or tap a profile → card
carousel → swipe up for the photo → scratch to reveal → full profile page
→ swipe Send Interest → confirmation. Plus the kebab branch: not
interested / don't show again.

## How to drive it

| | |
|---|---|
| Zoom into a profile | pinch on a trackpad, or ctrl/⌘ + scroll. Plain scrolling is ignored on purpose |
| Open a profile | tap an avatar, or View Full Profile on the card |
| Reveal a photo | swipe up on the card, then rub the blur away |
| Send interest | swipe the arrow left → right |

Single self-contained file — no build step, no dependencies, works offline.

## Photo credits and a caveat

The seven portraits are from [Unsplash](https://unsplash.com/license),
embedded as base64.

**These are stock photographs of real people used as design placeholders.
The names, ages and biographies are invented. They are not real dating
profiles and do not represent the people pictured.**
