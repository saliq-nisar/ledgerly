export const THEME_STORAGE_KEY = "theme";

/**
 * Runs before first paint (inlined in <head>) so the saved theme is applied
 * without a flash. Falls back to the OS preference.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;
