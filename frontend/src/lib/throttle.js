/** Calls `fn` at most once per `ms`, always delivering the latest arguments. */
export function throttle(fn, ms) {
  let last = 0;
  let timer = null;
  let pending = null;

  const run = () => {
    last = Date.now();
    timer = null;
    const args = pending;
    pending = null;
    fn(...args);
  };

  const throttled = (...args) => {
    pending = args;
    if (timer) return;
    const wait = ms - (Date.now() - last);
    if (wait <= 0) run();
    else timer = setTimeout(run, wait);
  };
  throttled.flush = () => {
    if (timer) {
      clearTimeout(timer);
      run();
    }
  };
  throttled.cancel = () => {
    clearTimeout(timer);
    timer = null;
    pending = null;
  };
  return throttled;
}
