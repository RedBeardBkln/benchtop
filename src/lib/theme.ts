// Light, dark or auto (follow the device) appearance. A per-browser view preference like the % decimals:
// stored in localStorage and applied as data-theme="light" | "dark" on <html>, which globals.css keys
// the dark palette off. THEME_INIT_SCRIPT runs in <head> before the first paint so there is no flash.
export type ThemePref = 'light' | 'dark' | 'auto'
export const THEME_PREFS: ThemePref[] = ['light', 'dark', 'auto']
const KEY = 'theme'

export function readThemePref(): ThemePref {
  try {
    const v = window.localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark' || v === 'auto') return v
  } catch { /* storage unavailable */ }
  return 'light'
}

export function setThemePref(pref: ThemePref): void {
  try { window.localStorage.setItem(KEY, pref) } catch { /* storage unavailable */ }
  const dark = pref === 'dark' || (pref === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
}

// Applies the stored preference, then keeps "auto" in step with the device and every tab in step
// with a change made in another tab.
export const THEME_INIT_SCRIPT = `(function(){
  var mq = window.matchMedia('(prefers-color-scheme: dark)');
  function apply() {
    var p = 'light';
    try { p = localStorage.getItem('${KEY}') || 'light'; } catch (e) {}
    document.documentElement.dataset.theme = (p === 'dark' || (p === 'auto' && mq.matches)) ? 'dark' : 'light';
  }
  apply();
  if (mq.addEventListener) mq.addEventListener('change', apply);
  window.addEventListener('storage', function (e) { if (e.key === '${KEY}') apply(); });
})();`
