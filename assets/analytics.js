/* Google Analytics 4. GA4_ID is the measurement id ("G-XXXXXXXXXX");
   left empty, nothing is loaded and nothing is sent. The Search Console
   verification tag sits in each page's head (google-site-verification).
   Events: sign_up (the email form), with the page it was sent from. */
const GA4_ID = "G-F2E68CP62V";

window.tipoffEvent = (name, params) => {
  if (typeof window.gtag === "function") window.gtag("event", name, params || {});
};

if (GA4_ID) {
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", GA4_ID, { anonymize_ip: true, send_page_view: true });
}
