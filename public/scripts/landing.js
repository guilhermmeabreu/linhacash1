const THEME_KEY='theme';
const html=document.documentElement;
const themeBtn=document.getElementById('theme');

function icon(isLight){
  return isLight
  ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>'
  : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3c0 0-1.21 5.79 2.79 8.79 4 3 7 1 7 1z"></path></svg>';
}

function applyTheme(light){
  html.classList.toggle('light', light);
  html.classList.toggle('dark', !light);
  themeBtn.innerHTML = icon(light);
  themeBtn.setAttribute('aria-label', light ? 'Ativar tema escuro' : 'Ativar tema claro');
  try { localStorage.setItem(THEME_KEY, light ? 'light' : 'dark'); } catch {}
}

const startLight = html.classList.contains('light');
applyTheme(startLight);

themeBtn.addEventListener('click', function(){
  applyTheme(!html.classList.contains('light'));
});

function setupTracking(){
  var planos = document.getElementById('planos');
  var viewed = false;

  if (planos && 'IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if (!viewed && entry.isIntersecting) {
          viewed = true;
          track('pricing_section_viewed', { section: 'planos' });
          observer.disconnect();
        }
      });
    }, { threshold: 0.35 });
    observer.observe(planos);
  }

  document.querySelectorAll('a.btn.primary').forEach(function(btn){
    btn.addEventListener('click', function(){
      var text = (btn.textContent || '').trim();
      var isUpgrade = /assinar|pro/i.test(text);
      if (isUpgrade) {
        track('upgrade_button_clicked', { source: 'landing', label: text });
      }
    });
  });
}

setupTracking();

(function normalizeAuthRedirect(){
  const q = new URLSearchParams(window.location.search);
  const h = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const hasAuthPayload = Boolean(
    h.get('access_token') ||
    q.get('access_token') ||
    q.get('code') ||
    q.get('token_hash') ||
    h.get('error') ||
    q.get('error') ||
    h.get('error_code') ||
    q.get('error_code') ||
    h.get('type') === 'recovery' ||
    q.get('type') === 'recovery' ||
    q.get('auth_flow') === 'recovery' ||
    q.get('auth_flow') === 'email_change'
  );
  if (!hasAuthPayload) return;
  const target = `/app.html${window.location.search || ''}${window.location.hash || ''}`;
  window.location.replace(target);
})();

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.22 });
  document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));
}
