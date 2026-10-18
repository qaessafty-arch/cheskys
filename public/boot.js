// Runs before the app bundle. Kept as a same-origin file because the page's
// Content-Security-Policy does not allow inline scripts.

// Single Page Apps for GitHub Pages: restore the URL that 404.html encoded.
(function (l) {
  if (l.search && l.search[1] === '/') {
    var decoded = l.search.slice(1).split('&').map(function (s) {
      return s.replace(/~and~/g, '&');
    }).join('?');
    window.history.replaceState(null, null, l.pathname.slice(0, -1) + decoded + l.hash);
  }
}(window.location));

// If the app fails before it renders, replace the loading screen with the error and a reload button.
window.addEventListener('error', function (e) {
  var fallback = document.getElementById('app-loading-fallback');
  if (!fallback) return;
  var box = document.createElement('div');
  box.style.cssText = 'max-width:440px;padding:24px;border:1px solid rgba(239,68,68,0.3);border-radius:16px;background:rgba(15,23,42,0.95);text-align:center;';
  var icon = document.createElement('div');
  icon.style.cssText = 'font-size:28px;margin-bottom:12px;';
  icon.textContent = '☀️';
  var title = document.createElement('div');
  title.style.cssText = 'color:#ef4444;font-weight:700;font-size:14px;margin-bottom:8px;';
  title.textContent = 'Interface Notice';
  var message = document.createElement('div');
  message.style.cssText = 'color:#cbd5e1;font-size:12px;font-family:monospace;word-break:break-all;';
  message.textContent = e.message || 'Loading error';
  var reload = document.createElement('button');
  reload.style.cssText = 'margin-top:16px;padding:8px 16px;background:#f59e0b;color:#000;border:none;border-radius:8px;font-weight:700;font-size:12px;cursor:pointer;';
  reload.textContent = 'Reload';
  reload.addEventListener('click', function () { window.location.reload(); });
  box.append(icon, title, message, reload);
  fallback.replaceChildren(box);
});
