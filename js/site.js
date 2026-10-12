(function () {
  var all = window.SECTORS || [];
  var PREVIEW = 3;
  var WATCH_KEY = 'mlf-watchlist';

  var TYPE_RULES = [
    [/四维|扫描/, '四维扫描'],
    [/二次筛选/, '二次筛选'],
    [/估值/, '行业估值'],
    [/筛选/, '标的筛选'],
    [/深度/, '个股深度']
  ];

  function reportType(r) {
    if (r.type) return r.type;
    for (var i = 0; i < TYPE_RULES.length; i++) {
      if (TYPE_RULES[i][0].test(r.title + r.file)) return TYPE_RULES[i][1];
    }
    return '研究报告';
  }

  function make(tag, className, text) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    if (text != null) e.textContent = text;
    return e;
  }

  // 入场动画错峰
  function stagger(container) {
    if (!container) return;
    var kids = container.children;
    for (var i = 0; i < kids.length; i++) {
      kids[i].style.animationDelay = (i * 0.045) + 's';
    }
  }

  // 首页 Hero 统计
  function renderHeroStats() {
    var el = document.getElementById('hero-stats');
    if (!el) return;
    var total = 0, stocks = 0;
    all.forEach(function (s) {
      var n = (s.reports || []).length;
      total += n;
      if (s.group === 'stock') stocks += n;
    });
    var chips = [[total, '份报告'], [all.length, '个板块'], [stocks, '份个股']];
    chips.forEach(function (c) {
      var span = make('span', 'stat');
      span.appendChild(make('b', null, String(c[0])));
      span.appendChild(make('span', null, c[1]));
      el.appendChild(span);
    });
  }

  function sectorUrl(s) {
    return 'sector.html?s=' + encodeURIComponent(s.name);
  }

  function findSectorName(r) {
    for (var i = 0; i < all.length; i++) {
      var reports = all[i].reports || [];
      for (var j = 0; j < reports.length; j++) {
        if (reports[j].file === r.file) return all[i].name;
      }
    }
    return '';
  }

  function reportItem(r, sectorName) {
    var li = make('li', 'report-item-wrap');

    var a = make('a', 'card report-item');
    a.href = encodeURI(r.file);
    a.target = '_blank';

    var head = make('div', 'report-head');
    head.appendChild(make('span', 'tag', reportType(r)));
    head.appendChild(make('time', 'muted', r.date));
    a.appendChild(head);
    a.appendChild(make('h3', null, r.title));
    if (r.summary) a.appendChild(make('p', 'muted', r.summary));

    li.appendChild(a);

    var addBtn = make('button', 'watch-add', '加入重点监控');
    addBtn.title = '加入每日重点监控';
    addBtn.setAttribute('data-kind', 'report');
    addBtn.setAttribute('data-title', r.title);
    addBtn.setAttribute('data-file', r.file);
    addBtn.setAttribute('data-date', r.date);
    addBtn.setAttribute('data-type', reportType(r));
    addBtn.setAttribute('data-sector', sectorName || findSectorName(r));
    li.appendChild(addBtn);

    return li;
  }

  function reportsOf(group) {
    var found = all.filter(function (s) { return s.group === group; });
    var reports = [];
    found.forEach(function (s) { reports = reports.concat(s.reports); });
    reports.sort(function (a, b) { return b.date.localeCompare(a.date); });
    return { sectors: found, reports: reports };
  }

  // 报告列表型区块：趋势 / 个股 / 其他
  function renderList(o) {
    var el = document.getElementById(o.list);
    if (!el) return;

    var res = reportsOf(o.group);
    var shown = o.preview ? res.reports.slice(0, o.preview) : res.reports;

    if (!shown.length) {
      el.appendChild(make('p', 'muted', o.empty || '暂无内容。'));
      return;
    }
    shown.forEach(function (r) { el.appendChild(reportItem(r, findSectorName(r))); });
    stagger(el);

    var more = o.more && document.getElementById(o.more);
    if (more && shown.length < res.reports.length && res.sectors.length === 1) {
      more.href = sectorUrl(res.sectors[0]);
      more.hidden = false;
    }
  }

  // 板块卡片型区块：板块
  function renderGrid(id, group) {
    var grid = document.getElementById(id);
    if (!grid) return;

    var sectors = all.filter(function (s) { return s.group === group; });
    sectors.forEach(function (s) {
      var card = make('div', 'card sector-card');

      var link = make('a', 'sector-link');
      link.href = sectorUrl(s);
      link.appendChild(make('h2', null, s.name));
      if (s.desc) link.appendChild(make('p', 'muted', s.desc));
      link.appendChild(make('div', 'meta',
        s.reports.length + ' 份报告 · 最近更新 ' + (s.latest || '—')));
      card.appendChild(link);

      var add = make('button', 'watch-add-sector', '加入监控');
      add.title = '加入每日重点监控';
      add.setAttribute('data-kind', 'sector');
      add.setAttribute('data-sector', s.name);
      add.setAttribute('data-desc', s.desc || '');
      add.setAttribute('data-latest', s.latest || '');
      card.appendChild(add);

      grid.appendChild(card);
    });
    stagger(grid);
    if (!sectors.length) {
      grid.appendChild(make('p', 'muted', '暂无板块报告，请运行 update-index 生成清单。'));
    }
  }

  // 每日重点监控
  function getWatch() {
    try { return JSON.parse(localStorage.getItem(WATCH_KEY) || '[]'); } catch (e) { return []; }
  }
  function setWatch(list) {
    localStorage.setItem(WATCH_KEY, JSON.stringify(list));
  }
  function watchId(item) {
    return item.kind === 'report' ? 'r:' + item.file : 's:' + item.sector;
  }
  function addWatchItem(item) {
    var list = getWatch();
    var id = watchId(item);
    if (list.some(function (x) { return x.id === id; })) return;
    item.id = id;
    item.addedAt = Date.now();
    list.unshift(item);
    setWatch(list);
    renderWatchlist();
  }
  function removeWatchItem(id) {
    var list = getWatch().filter(function (x) { return x.id !== id; });
    setWatch(list);
    renderWatchlist();
  }
  function clearWatch() {
    setWatch([]);
    renderWatchlist();
  }

  function renderWatchlist() {
    var el = document.getElementById('watch-list');
    if (!el) return;
    var empty = document.getElementById('watch-empty');
    var clear = document.getElementById('clear-watch');
    var list = getWatch();

    el.innerHTML = '';
    if (!list.length) {
      if (empty) empty.hidden = false;
      if (clear) clear.hidden = true;
      return;
    }
    if (empty) empty.hidden = true;
    if (clear) clear.hidden = false;

    list.forEach(function (item) {
      var li = make('li', 'watch-item');
      var link = make('a', 'watch-link');

      if (item.kind === 'report') {
        link.href = encodeURI(item.file);
        link.target = '_blank';
        link.appendChild(make('span', 'watch-title', item.title));
        link.appendChild(make('span', 'watch-meta',
          (item.sector || '报告') + ' · ' + item.date));
      } else {
        link.href = 'sector.html?s=' + encodeURIComponent(item.sector);
        link.appendChild(make('span', 'watch-title', item.sector));
        if (item.desc) link.appendChild(make('span', 'watch-meta', item.desc));
      }
      li.appendChild(link);

      var del = make('button', 'watch-del', '×');
      del.title = '移除';
      del.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        removeWatchItem(item.id);
      });
      li.appendChild(del);

      el.appendChild(li);
    });
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.watch-add, .watch-add-sector');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    var kind = btn.getAttribute('data-kind');
    if (kind === 'report') {
      addWatchItem({
        kind: 'report',
        title: btn.getAttribute('data-title'),
        file: btn.getAttribute('data-file'),
        date: btn.getAttribute('data-date'),
        type: btn.getAttribute('data-type'),
        sector: btn.getAttribute('data-sector')
      });
    } else if (kind === 'sector') {
      addWatchItem({
        kind: 'sector',
        sector: btn.getAttribute('data-sector'),
        desc: btn.getAttribute('data-desc'),
        latest: btn.getAttribute('data-latest')
      });
    }
  });

  var clearBtn = document.getElementById('clear-watch');
  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      if (confirm('确定清空每日重点监控列表？')) clearWatch();
    });
  }

  renderList({
    list: 'trend-list', more: 'trend-more', group: 'market',
    preview: PREVIEW, empty: '暂无趋势报告。'
  });
  renderGrid('sector-grid', 'sector');
  renderList({
    list: 'stock-list', more: 'stock-more', group: 'stock',
    preview: PREVIEW, empty: '暂无个股报告。'
  });
  renderList({
    list: 'other-list', more: 'other-more', group: 'other',
    preview: PREVIEW, empty: '暂无内容，后续补充。'
  });
  renderWatchlist();
  renderHeroStats();

  var list = document.getElementById('report-list');
  if (list) {
    var name = new URLSearchParams(location.search).get('s');
    var sector = all.filter(function (s) { return s.name === name; })[0];

    if (!sector) {
      document.getElementById('sector-name').textContent = '未找到该板块';
      return;
    }

    document.title = sector.name + ' - MLF 投研报告库';
    document.getElementById('sector-name').textContent = sector.name;
    document.getElementById('sector-desc').textContent = sector.desc || '';
    var countEl = document.getElementById('sector-count');
    if (countEl) countEl.textContent = sector.reports.length + ' 份报告';
    sector.reports.forEach(function (r) { list.appendChild(reportItem(r, sector.name)); });
    stagger(list);
  }
})();
