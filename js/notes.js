(function () {
  var KEY = 'mlf-notes';        // localStorage 缓存（降级 / 离线镜像）
  var IDB_NAME = 'mlf-notes-fs'; // IndexedDB：存文件句柄，实现"连接一次，以后自动读写"
  var editingId = null;
  var apiMode = false;          // 本地服务已连接（双击 start-server 启动后自动生效）
  var fileHandle = null;        // 已连接的本地文件（建议 mmlf/data/notes.js）
  var pendingRestore = null;    // 句柄在、但浏览器要求重新授权

  var formTitle = document.getElementById('form-title');
  var inputTitle = document.getElementById('note-title');
  var inputContent = document.getElementById('note-content');
  var selectSector = document.getElementById('note-sector');
  var saveBtn = document.getElementById('save-btn');
  var cancelBtn = document.getElementById('cancel-btn');
  var exportBtn = document.getElementById('export-btn');
  var searchInput = document.getElementById('search-input');
  var listEl = document.getElementById('notes-list');
  var fileBtn = document.getElementById('file-btn');
  var fileStatus = document.getElementById('file-status');

  /* ---------- 数据源：localStorage + data/notes.js（script 加载） ---------- */

  function readLocal() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY));
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }

  // 按 id 并集合并，同 id 保留 updatedAt 较新的一条
  function mergeLists(a, b) {
    if (!a.length) return b;
    if (!b.length) return a;
    var map = {};
    a.concat(b).forEach(function (n) {
      var cur = map[n.id];
      if (!cur || (n.updatedAt || 0) > (cur.updatedAt || 0)) map[n.id] = n;
    });
    return Object.keys(map).map(function (k) { return map[k]; });
  }

  function load() {
    return mergeLists(readLocal(), Array.isArray(window.NOTES) ? window.NOTES : []);
  }

  function persist(list) {
    window.NOTES = list; // 与文件内容保持一致，避免旧数据在 merge 时复活
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
    if (apiMode) postNotes(list);
    else if (fileHandle) writeToFile(list);
    render();
  }

  /* ---------- 本地服务模式（start-server 启动后优先） ---------- */

  async function probeApi() {
    try {
      var res = await fetch('api/notes');
      if (!res.ok) return;
      var data = await res.json();
      if (!data || !data.ok) return;
      apiMode = true;
      var list = mergeLists(load(), Array.isArray(data.notes) ? data.notes : []);
      window.NOTES = list;
      try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
      renderStatus();
      render();
    } catch (e) { /* file:// 静态模式：fetch 不可用，忽略 */ }
  }

  async function postNotes(list) {
    try {
      var res = await fetch('api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: list })
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      fileStatus.textContent = '\u2713 本地服务：保存即写入 data/notes.js';
    } catch (e) {
      apiMode = false;
      renderStatus();
    }
  }

  /* ---------- 本地文件直写（File System Access API） ---------- */

  function supportsFs() { return typeof window.showSaveFilePicker === 'function'; }

  function idb(mode, fn) {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = function () { req.result.createObjectStore('handles'); };
      req.onerror = function () { reject(req.error); };
      req.onsuccess = function () {
        var db = req.result;
        try {
          var r = fn(db.transaction('handles', mode).objectStore('handles'));
          r.onsuccess = function () { resolve(r.result); };
          r.onerror = function () { reject(r.error); };
        } catch (e) { reject(e); }
      };
    });
  }

  function notesToJs(list) {
    return 'window.NOTES = ' + JSON.stringify(list, null, 2) + ';\n';
  }

  function parseNotesJs(text) {
    var m = /window\.NOTES\s*=\s*([\s\S]*?)\s*;\s*$/.exec(text);
    if (!m) return [];
    try {
      var v = JSON.parse(m[1]);
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }

  async function writeToFile(list) {
    if (!fileHandle) return;
    try {
      var w = await fileHandle.createWritable();
      await w.write(notesToJs(list));
      await w.close();
      fileStatus.textContent = '\u2713 已同步到本地文件（data/notes.js）';
    } catch (e) {
      fileHandle = null;
      renderStatus();
      alert('写入本地文件失败（' + (e && e.message || e) + '）。\n记录仍已保存到浏览器 localStorage，请重新连接文件。');
    }
  }

  async function connectFile() {
    if (!supportsFs()) {
      alert('当前浏览器不支持直接写本地文件（需要 Chrome 或 Edge）。\n记录仍会保存在浏览器 localStorage，可用「导出备份」手动下载文件。');
      return;
    }
    var handle;
    try {
      handle = await window.showSaveFilePicker({
        suggestedName: 'notes.js',
        types: [{ description: 'JS 数据文件', accept: { 'text/javascript': ['.js'] } }]
      });
    } catch (e) { return; } // 用户取消
    try {
      await idb('readwrite', function (st) { return st.put(handle, 'file'); });
      fileHandle = handle;
      await writeToFile(load());
      renderStatus();
      alert('已连接本地文件。以后每次保存都会自动写入。\n\n请确认保存位置是 mmlf/data/notes.js（若选到别处，记录仍能用，只是不随项目目录走）。');
    } catch (e) {
      alert('连接失败：' + (e && e.message || e));
    }
  }

  async function tryRestore() {
    if (!supportsFs() || apiMode) return;
    try {
      var h = await idb('readonly', function (st) { return st.get('file'); });
      if (!h) return;
      var perm = await h.queryPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        fileHandle = h;
        var text = await (await h.getFile()).text();
        var list = mergeLists(load(), parseNotesJs(text));
        window.NOTES = list;
        try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
        renderStatus();
        render();
      } else {
        pendingRestore = h;
        renderStatus();
      }
    } catch (e) { /* 句柄失效，忽略 */ }
  }

  async function restoreFile() {
    if (!pendingRestore) return;
    try {
      var perm = await pendingRestore.requestPermission({ mode: 'readwrite' });
      if (perm !== 'granted') return;
      fileHandle = pendingRestore;
      pendingRestore = null;
      var text = await (await fileHandle.getFile()).text();
      var list = mergeLists(load(), parseNotesJs(text));
      window.NOTES = list;
      try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
      await writeToFile(list);
      renderStatus();
      render();
    } catch (e) { /* 用户拒绝或句柄失效 */ }
  }

  function renderStatus() {
    if (apiMode) {
      fileStatus.textContent = '\u2713 本地服务：保存即写入 data/notes.js';
      fileBtn.hidden = true;
    } else if (fileHandle) {
      fileStatus.textContent = '\u2713 已同步到本地文件（data/notes.js）';
      fileBtn.hidden = true;
    } else if (pendingRestore) {
      fileStatus.textContent = '本地文件需要重新授权';
      fileBtn.hidden = false;
      fileBtn.textContent = '恢复文件连接';
    } else if (supportsFs()) {
      fileStatus.textContent = '未连接文件：仅存浏览器 localStorage';
      fileBtn.hidden = false;
      fileBtn.textContent = '保存到 mmlf 文件夹';
    } else {
      fileStatus.textContent = '此浏览器不支持文件直写（建议 Chrome / Edge），已存 localStorage';
      fileBtn.hidden = true;
    }
  }

  /* ---------- CRUD ---------- */

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function fmt(ts) {
    var d = new Date(ts);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function make(tag, className, text) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    if (text != null) e.textContent = text;
    return e;
  }

  function fillSectorSelect() {
    selectSector.appendChild(make('option', null, '不关联板块'));
    (window.SECTORS || []).forEach(function (s) {
      selectSector.appendChild(make('option', null, s.name));
    });
  }

  function resetForm() {
    editingId = null;
    formTitle.textContent = '记一条';
    saveBtn.textContent = '保存';
    cancelBtn.hidden = true;
    inputTitle.value = '';
    inputContent.value = '';
    selectSector.selectedIndex = 0;
  }

  function startEdit(id) {
    var n = load().filter(function (x) { return x.id === id; })[0];
    if (!n) return;
    editingId = id;
    formTitle.textContent = '编辑记录';
    saveBtn.textContent = '更新';
    cancelBtn.hidden = false;
    inputTitle.value = n.title;
    inputContent.value = n.content;
    for (var i = 0; i < selectSector.options.length; i++) {
      if (selectSector.options[i].textContent === n.sector) {
        selectSector.selectedIndex = i;
        break;
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    inputContent.focus();
  }

  function removeNote(id) {
    var n = load().filter(function (x) { return x.id === id; })[0];
    var label = n ? (n.title || '这条记录') : '这条记录';
    if (!confirm('删除「' + label + '」？不可恢复。')) return;
    persist(load().filter(function (x) { return x.id !== id; }));
    if (editingId === id) resetForm();
  }

  function saveNote() {
    var content = inputContent.value.trim();
    if (!content) {
      inputContent.focus();
      inputContent.placeholder = '正文不能为空';
      return;
    }
    var title = inputTitle.value.trim();
    if (!title) title = content.split('\n')[0].slice(0, 30);
    var now = Date.now();
    var list = load();

    if (editingId) {
      list = list.map(function (n) {
        if (n.id !== editingId) return n;
        return {
          id: n.id, title: title, content: content,
          sector: selectSector.value === '不关联板块' ? '' : selectSector.value,
          createdAt: n.createdAt, updatedAt: now
        };
      });
    } else {
      list.push({
        id: 'n' + now + Math.floor(Math.random() * 1e4),
        title: title, content: content,
        sector: selectSector.value === '不关联板块' ? '' : selectSector.value,
        createdAt: now, updatedAt: now
      });
    }
    persist(list);
    resetForm();
  }

  function exportJson() {
    var list = load();
    var blob = new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    var d = new Date();
    a.href = URL.createObjectURL(blob);
    a.download = 'mlf-notes-backup-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  /* ---------- 渲染 ---------- */

  function render() {
    var list = load().slice().sort(function (a, b) { return b.createdAt - a.createdAt; });
    var q = searchInput.value.trim().toLowerCase();
    if (q) {
      list = list.filter(function (n) {
        return (n.title + '\n' + n.content + '\n' + (n.sector || '')).toLowerCase().indexOf(q) >= 0;
      });
    }

    listEl.innerHTML = '';
    if (!list.length) {
      var empty = make('p', 'muted',
        q ? '没有匹配「' + q + '」的记录。' :
        (load().length ? '没有匹配的记录。' : '还没有记录。在上方写下第一条吧。'));
      listEl.appendChild(empty);
      return;
    }

    list.forEach(function (n) {
      var card = make('div', 'card note-item');

      var head = make('div', 'note-head');
      head.appendChild(make('span', 'tag', n.sector || '未分类'));
      var time = make('span', 'note-time', fmt(n.createdAt));
      if (n.updatedAt && n.updatedAt !== n.createdAt) {
        time.textContent += ' · 编辑于 ' + fmt(n.updatedAt);
      }
      head.appendChild(time);

      var actions = make('div', 'note-actions');
      var editBtn = make('button', null, '编辑');
      editBtn.addEventListener('click', function () { startEdit(n.id); });
      var delBtn = make('button', null, '删除');
      delBtn.addEventListener('click', function () { removeNote(n.id); });
      actions.appendChild(editBtn);
      actions.appendChild(delBtn);
      head.appendChild(actions);

      card.appendChild(head);
      card.appendChild(make('h3', null, n.title));
      card.appendChild(make('p', 'note-content', n.content));
      listEl.appendChild(card);
    });

    // 超过 3 行的正文折叠，点击展开 / 收起
    // 先套上限高再测量：未限高时 scrollHeight 恒等于 offsetHeight，检测不到溢出
    Array.prototype.forEach.call(
      listEl.querySelectorAll('.note-content'),
      function (p) {
        p.classList.add('clamp');
        if (p.scrollHeight <= p.clientHeight + 2) {
          p.classList.remove('clamp');
          return;
        }
        var toggle = make('button', 'note-toggle', '展开 ▾');
        toggle.addEventListener('click', function () {
          var collapsed = p.classList.toggle('clamp');
          toggle.textContent = collapsed ? '展开 ▾' : '收起 ▴';
        });
        p.insertAdjacentElement('afterend', toggle);
      }
    );
  }

  /* ---------- 初始化 ---------- */

  fillSectorSelect();
  saveBtn.addEventListener('click', saveNote);
  cancelBtn.addEventListener('click', resetForm);
  exportBtn.addEventListener('click', exportJson);
  searchInput.addEventListener('input', render);
  fileBtn.addEventListener('click', function () {
    if (pendingRestore) restoreFile(); else connectFile();
  });
  inputContent.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') saveNote();
  });
  render();
  renderStatus();
  probeApi().then(tryRestore);
})();
