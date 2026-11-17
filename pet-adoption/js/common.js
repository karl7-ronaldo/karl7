/* =====================================================================
 * 宠物领养管理系统 · 公共脚本（js/common.js）
 * 顶部导航、页脚、提示、弹窗、卡片等公共组件
 * ===================================================================== */

function $(sel, root) { return (root || document).querySelector(sel); }
function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmtAge(months) {
  var m = Number(months) || 0;
  if (m < 12) return m + '个月';
  var y = Math.floor(m / 12), r = m % 12;
  return r ? y + '岁' + r + '个月' : y + '岁';
}

function imgFallback(img) {
  var box = img.parentNode;
  if (!box) return;
  box.classList.add('img-empty');
  box.setAttribute('data-emoji', '🐾');
  img.style.display = 'none';
}

function toast(msg, type) {
  var box = $('#toastBox');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toastBox';
    box.className = 'toast-box';
    document.body.appendChild(box);
  }
  var item = document.createElement('div');
  item.className = 'toast ' + (type || 'ok');
  item.textContent = msg;
  box.appendChild(item);
  setTimeout(function () { item.classList.add('out'); }, 2000);
  setTimeout(function () { if (item.parentNode) box.removeChild(item); }, 2500);
}

/* 通用弹窗 */
function openModal(title, bodyHtml, footHtml, onMount) {
  closeModal();
  var wrap = document.createElement('div');
  wrap.className = 'modal-mask';
  wrap.id = 'modalMask';
  wrap.innerHTML =
    '<div class="modal">' +
      '<div class="modal-hd"><h3>' + esc(title) + '</h3>' +
        '<button class="modal-x" type="button" aria-label="关闭">×</button></div>' +
      '<div class="modal-bd">' + bodyHtml + '</div>' +
      (footHtml ? '<div class="modal-ft">' + footHtml + '</div>' : '') +
    '</div>';
  document.body.appendChild(wrap);
  document.body.style.overflow = 'hidden';
  wrap.addEventListener('click', function (e) { if (e.target === wrap) closeModal(); });
  $('.modal-x', wrap).addEventListener('click', closeModal);
  document.addEventListener('keydown', onEsc);
  if (onMount) onMount(wrap);
}

function onEsc(e) { if (e.key === 'Escape') closeModal(); }

function closeModal() {
  var m = $('#modalMask');
  if (m) m.parentNode.removeChild(m);
  document.body.style.overflow = '';
  document.removeEventListener('keydown', onEsc);
}

/* 顶部导航 + 页脚 */
function renderLayout(active) {
  var s = DB.settings();
  var user = DB.currentUser();
  var nav = [
    { key: 'home', text: '首页', href: 'index.html' },
    { key: 'list', text: '宠物领养', href: 'list.html' },
    { key: 'notice', text: '公告资讯', href: 'index.html#notices' },
    { key: 'center', text: '个人中心', href: 'center.html' }
  ];
  if (user) {
    nav.push({ key: 'shelter', text: '送养工作台', href: 'shelter.html' });
  }
  if (user && user.role === '03') {
    nav.push({ key: 'admin', text: '管理后台', href: 'admin.html' });
  }

  var navHtml = nav.map(function (n) {
    return '<a href="' + n.href + '" class="' + (n.key === active ? 'active' : '') + '">' + n.text + '</a>';
  }).join('');

  var userHtml = user
    ? '<div class="hd-user-in">' +
        '<a class="avatar" href="center.html">' + esc(user.name.charAt(0)) + '</a>' +
        '<div class="hd-user-txt"><b>' + esc(user.name) + '</b>' +
          '<span>' + DICT.role[user.role] + ' · ' + esc(user.id) + '</span></div>' +
        '<button class="btn btn-line btn-sm" id="btnLogout" type="button">退出</button>' +
      '</div>'
    : '<a class="btn btn-primary btn-sm" href="login.html">登录 / 注册</a>';

  var header = document.createElement('header');
  header.className = 'hd';
  header.innerHTML =
    '<div class="wrap hd-in">' +
      '<a class="brand" href="index.html"><span class="brand-ico">🐾</span>' +
        '<span class="brand-txt"><b>' + esc(s.siteName.slice(0, 2)) + '</b>' + esc(s.siteName.slice(2)) + '</span></a>' +
      '<button class="nav-toggle" id="navToggle" type="button">☰</button>' +
      '<nav class="nav" id="navBox">' + navHtml + '</nav>' +
      '<div class="hd-user">' + userHtml + '</div>' +
    '</div>';
  document.body.insertBefore(header, document.body.firstChild);

  var footer = document.createElement('footer');
  footer.className = 'ft';
  footer.innerHTML =
    '<div class="wrap ft-in">' +
      '<div><h4>' + esc(s.siteName) + '</h4>' +
        '<p>地址：' + esc(s.address) + '</p>' +
        '<p>领养热线：' + esc(s.hotline) + '</p>' +
        '<p>服务时间：' + esc(s.workTime) + '</p></div>' +
      '<div><h4>领养服务</h4><p><a href="list.html">宠物浏览</a></p>' +
        '<p><a href="center.html">申请进度查询</a></p>' +
        '<p><a href="index.html#notices">公告资讯</a></p></div>' +
      '<div><h4>领养理念</h4><p>领养代替购买，绝育终止流浪。</p>' +
        '<p>每一份申请都会经过材料审核与家访核实。</p>' +
        '<p>领养不是结束，回访让爱有始有终。</p></div>' +
    '</div>' +
    '<div class="ft-copy">© 2026 ' + esc(s.siteName) + ' · 管理信息系统实训作品（纯前端演示系统）</div>';
  document.body.appendChild(footer);

  var toggle = $('#navToggle');
  if (toggle) {
    toggle.addEventListener('click', function () { $('#navBox').classList.toggle('open'); });
  }
  var lo = $('#btnLogout');
  if (lo) {
    lo.addEventListener('click', function () {
      DB.logout();
      toast('已退出登录');
      setTimeout(function () { location.href = 'index.html'; }, 500);
    });
  }
}

/* 登录校验：roles 为空表示仅需登录 */
function requireUser(roles) {
  var user = DB.currentUser();
  if (!user) {
    location.href = 'login.html?redirect=' + encodeURIComponent(location.pathname.split('/').pop() + location.search);
    return null;
  }
  if (roles && roles.indexOf(user.role) < 0) {
    toast('当前账号无权访问该页面', 'warn');
    setTimeout(function () { location.href = 'index.html'; }, 900);
    return null;
  }
  return user;
}

function badge(map, code) {
  var text = map[code] || '—';
  var cls = 'b-' + code;
  return '<span class="badge ' + cls + '">' + esc(text) + '</span>';
}

function petCard(p) {
  var isDog = p.type === '01';
  return '<a class="pet-card" href="detail.html?id=' + encodeURIComponent(p.id) + '">' +
    '<div class="pet-thumb">' +
      '<img src="' + p.photo + '" alt="' + esc(p.name) + '" loading="lazy" onerror="imgFallback(this)">' +
      '<span class="pet-status ' + (p.status === '20' ? 'ok' : 'gray') + '">' + DICT.petStatus[p.status] + '</span>' +
      (isDog ? '<span class="pet-type">🐕 犬</span>' : p.type === '02' ? '<span class="pet-type">🐈 猫</span>' : '') +
    '</div>' +
    '<div class="pet-body">' +
      '<div class="pet-title"><b>' + esc(p.name) + '</b><span>' + esc(p.breed) + '</span></div>' +
      '<div class="pet-meta">' + DICT.gender[p.gender] + ' · ' + fmtAge(p.age) + ' · ' + p.weight + 'kg · ' + DICT.health[p.health] + '</div>' +
      '<div class="pet-id">编号 ' + esc(p.id) + '</div>' +
    '</div>' +
  '</a>';
}

function emptyState(text) {
  return '<div class="empty"><div class="empty-ico">🐾</div><p>' + esc(text) + '</p></div>';
}

function todayStr() { return new Date().toISOString().slice(0, 10); }
