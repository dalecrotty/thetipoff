/* Google Analytics 4. GA4_ID is the measurement id ("G-XXXXXXXXXX");
   left empty, nothing is loaded and nothing is sent. The Search Console
   verification tag sits in each page's head (google-site-verification).
   Events: sign_up (the email form, once it has gone through), with the
   page it was sent from (source_page). Wrapped so nothing here meets
   app.js's names in the shared global scope. */
(() => {
const GA4_ID = "G-S1Y6K7F01F";   // Drop Coverage property (15 Oct 2026)

/* The owner's own browsers (10 Nov 2026: "Exclude my own traffic from now
   on"): any page opened with ?internal=1 flags this browser, and a flagged
   browser loads no GA4 and sends nothing, on every page, until ?internal=0
   clears it. The flag lives in localStorage and a cookie, so clearing one
   of them doesn't lose it. ?ga_debug=1 sends this one page load to GA4's
   DebugView even from a flagged browser, to check an event by hand. */
const INTERNAL_KEY = "dc.internal";

function readInternal() {
  try { if (localStorage.getItem(INTERNAL_KEY) === "1") return true; } catch (e) {}
  return /(?:^|;\s*)dc_internal=1(?:;|$)/.test(document.cookie || "");
}

function writeInternal(on) {
  try { on ? localStorage.setItem(INTERNAL_KEY, "1") : localStorage.removeItem(INTERNAL_KEY); } catch (e) {}
  document.cookie = on
    ? "dc_internal=1; max-age=157680000; path=/; SameSite=Lax; Secure"
    : "dc_internal=; max-age=0; path=/; SameSite=Lax; Secure";
}

const params = new URLSearchParams(location.search);
if (params.has("internal")) {
  writeInternal(params.get("internal") !== "0");
  // keep the address clean: the flag isn't part of the page
  params.delete("internal");
  const q = params.toString();
  try { history.replaceState(null, "", location.pathname + (q ? "?" + q : "") + location.hash); } catch (e) {}
}
const internal = readInternal();
const debug = params.get("ga_debug") === "1";

window.dcEvent = (name, args) => {
  if (typeof window.gtag === "function") window.gtag("event", name, args || {});
};

// Automated browsers (Playwright, Puppeteer, Selenium set navigator.webdriver)
// are not readers: screenshot and check runs stay out of the counts.
const automated = !!(navigator && navigator.webdriver);

if (GA4_ID && !automated && (!internal || debug)) {
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  const cfg = { anonymize_ip: true, send_page_view: true };
  if (debug) cfg.debug_mode = true;
  window.gtag("config", GA4_ID, cfg);
}

// A flagged browser says so, small, bottom-left, so the owner can see the
// flag took (and that this browser isn't being counted).
if (internal) {
  addEventListener("DOMContentLoaded", () => {
    const b = document.createElement("div");
    b.className = "dc-internal";
    b.textContent = debug ? "Internal browser · GA4 debug on this page" : "Internal browser · not counted";
    b.title = "Set by ?internal=1. Open any page with ?internal=0 to count this browser again.";
    b.setAttribute("style", "position:fixed;left:8px;bottom:8px;z-index:9999;font:11px/1.4 'DM Mono',monospace;"
      + "padding:3px 6px;background:rgba(0,0,0,.65);color:#fff;pointer-events:none");
    document.body.appendChild(b);
  });
}
})();
