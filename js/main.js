(function () {
  var THEME_KEY = 'mlf-theme';
  var root = document.documentElement;

  var saved = localStorage.getItem(THEME_KEY);
  if (saved) root.setAttribute('data-theme', saved);

  var toggle = document.getElementById('theme-toggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      localStorage.setItem(THEME_KEY, next);
    });
  }

  var current = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('[data-nav]').forEach(function (a) {
    if (a.getAttribute('href') === current) a.classList.add('active');
  });

  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();

/* ---- 受保护栏目密码门（每日复盘 / 产业研究） ---- */
(function () {
  var PASS = '1024';
  var KEY = 'mlf-gate-passed';

  function gateOk() {
    try { return sessionStorage.getItem(KEY) === '1'; } catch (e) { return false; }
  }

  function openGate(target) {
    var overlay = document.createElement('div');
    overlay.className = 'gate-overlay';

    var dialog = document.createElement('div');
    dialog.className = 'gate-dialog';

    var title = document.createElement('h3');
    title.textContent = '访问验证';

    var desc = document.createElement('p');
    desc.textContent = '该栏目受密码保护，请输入访问密码';

    var input = document.createElement('input');
    input.type = 'password';
    input.className = 'gate-input';
    input.placeholder = '请输入密码';
    input.autocomplete = 'off';

    var err = document.createElement('p');
    err.className = 'gate-err';

    var row = document.createElement('div');
    row.className = 'gate-actions';
    var cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'gate-btn';
    cancel.textContent = '取消';
    var ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'gate-btn gate-btn-ok';
    ok.textContent = '进入';
    row.appendChild(cancel);
    row.appendChild(ok);

    dialog.appendChild(title);
    dialog.appendChild(desc);
    dialog.appendChild(input);
    dialog.appendChild(err);
    dialog.appendChild(row);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    setTimeout(function () { input.focus(); }, 30);

    function close() {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
    }
    function submit() {
      if (input.value.trim() === PASS) {
        try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
        close();
        window.location.href = target;
      } else {
        err.textContent = '密码错误，请重试';
        dialog.classList.remove('shake');
        void dialog.offsetWidth;
        dialog.classList.add('shake');
        input.select();
      }
    }
    function onKey(e) { if (e.key === 'Escape') close(); }

    ok.addEventListener('click', submit);
    cancel.addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
    document.addEventListener('keydown', onKey);
  }

  function bindGates() {
    document.querySelectorAll('a.nav-hot[href*="s=每日复盘"], a.nav-research').forEach(function (a) {
      a.addEventListener('click', function (e) {
        if (gateOk()) return;
        e.preventDefault();
        openGate(a.getAttribute('href'));
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindGates);
  } else {
    bindGates();
  }
})();
