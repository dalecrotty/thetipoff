/* Google Analytics 4. GA4_ID is the measurement id ("G-XXXXXXXXXX");
   left empty, nothing is loaded and nothing is sent. The Search Console
   verification tag sits in each page's head (google-site-verification).
   Events: sign_up (the email form), with the page it was sent from. */
const GA4_ID = "G-S1Y6K7F01F";   // Drop Coverage property (15 Oct 2026)

window.dcEvent = (name, params) => {
  if (typeof window.gtag === "function") window.gtag("event", name, params || {});
};

// Automated browsers (Playwright, Puppeteer, Selenium set navigator.webdriver)
// are not readers: screenshot and check runs stay out of the counts.
const automated = !!(navigator && navigator.webdriver);

if (GA4_ID && !automated) {
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", GA4_ID, { anonymize_ip: true, send_page_view: true });
}
