// Native loader for lottie-react-native. A sibling `lottieView.web.ts` shadows
// this on web so the (web-incompatible) lottie module never enters the web
// bundle — its web entry pulls an optional peer (@lottiefiles/dotlottie-react)
// that we don't ship. LottieHost falls back to a static poster on web anyway.
let cached: any;
let resolved = false;

export function getLottieView(): any {
  if (resolved) return cached;
  resolved = true;
  try {
    cached = require('lottie-react-native').default;
  } catch {
    cached = undefined;
  }
  return cached;
}
