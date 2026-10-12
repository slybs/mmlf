(function () {
  var all = window.SECTORS || [];
  var PREVIEW = 3;

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

  function sectorUrl(s) {
    return 'sector.html?s=' + encodeURIComponent(s.name);
  }

  function reportItem(r) {
    var li = make('li');
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
    shown.forEach(function (r) { el.appendChild(reportItem(r)); });

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
      var card = make('a', 'card sector-card');
      card.href = sectorUrl(s);
      card.appendChild(make('h2', null, s.name));
      if (s.desc) card.appendChild(make('p', 'muted', s.desc));
      card.appendChild(make('div', 'meta',
        s.reports.length + ' 份报告 · 最近更新 ' + (s.latest || '—')));
      grid.appendChild(card);
    });
    if (!sectors.length) {
      grid.appendChild(make('p', 'muted', '暂无板块报告，请运行 update-index 生成清单。'));
    }
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
    sector.reports.forEach(function (r) { list.appendChild(reportItem(r)); });
  }
})();
