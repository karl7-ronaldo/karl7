/* =====================================================================
 * 宠物领养管理系统 · 前端数据层（js/store.js）
 * 本系统为纯前端实现，业务数据统一保存在浏览器 localStorage 中，
 * 编码规则与实验报告 3.5 代码设计完全一致：
 *   宠物编号 PET-YYYY-NNNN   用户 U000001（历史送养编号 S001 保留）   管理员 A001
 *   申请单号 AP+YYYYMMDD+NNN 协议编号 AD+YYYYMMDD+NNN+校验位
 *   回访单号 VS+YYYYMMDD+NN   公告编号 NC+YYYYMMDD+NN
 * ===================================================================== */

var DB_KEY = 'pet_adoption_db_v2';
var SESSION_KEY = 'pet_adoption_session_v1';

/* 状态码字典（对应报告表3-2） */
var DICT = {
  role:       { '01': '用户', '03': '管理员' },
  ptype:      { '01': '犬', '02': '猫', '03': '其他' },
  gender:     { 'M': '公', 'F': '母' },
  health:     { '01': '健康', '02': '观察中', '03': '治疗中', '04': '康复中' },
  petStatus:  { '10': '待审核', '20': '待领养', '30': '申请中', '40': '已领养', '50': '已下架' },
  applyStatus:{ '01': '待审核', '02': '初审通过', '03': '家访核实', '04': '领养成功', '05': '已驳回', '06': '已撤回' },
  visitStatus:{ '01': '待回访', '02': '回访正常', '03': '异常待处理' },
  account:    { '01': '正常', '02': '已冻结' }
};

var ROLE = { USER: '01', ADMIN: '03' };

/* ---------------------- 编号生成模块 ---------------------- */
function pad(n, len) {
  var s = String(n);
  while (s.length < len) s = '0' + s;
  return s;
}

function datePart(d) {
  d = d || new Date();
  return String(d.getFullYear()) + pad(d.getMonth() + 1, 2) + pad(d.getDate(), 2);
}

function nowStr() {
  var d = new Date();
  return d.getFullYear() + '-' + pad(d.getMonth() + 1, 2) + '-' + pad(d.getDate(), 2) +
    ' ' + pad(d.getHours(), 2) + ':' + pad(d.getMinutes(), 2);
}

var CodeGen = {
  /* 加权模10校验位：权数 2,3,4,5,6,7 循环 */
  checkDigit: function (digits) {
    var sum = 0;
    for (var i = 0; i < digits.length; i++) {
      sum += Number(digits.charAt(i)) * (2 + (i % 6));
    }
    return (10 - (sum % 10)) % 10;
  },

  /* 序号：在给定集合中按前缀取最大值+1 */
  nextSeq: function (list, prefix, len) {
    var max = 0;
    list.forEach(function (item) {
      var id = item.id || '';
      if (id.indexOf(prefix) !== 0) return;
      var n = parseInt(id.slice(prefix.length), 10);
      if (!isNaN(n) && n > max) max = n;
    });
    return pad(max + 1, len);
  },

  /* 宠物编号 PET-YYYY-NNNN */
  pet: function (pets) {
    var y = new Date().getFullYear();
    return 'PET-' + y + '-' + this.nextSeq(pets, 'PET-' + y + '-', 4);
  },

  /* 用户编号 U000001 / A001（历史送养编号 S001 保留，不再新发） */
  user: function (users, role) {
    var map = { '01': ['U', 6], '03': ['A', 3] };
    var conf = map[role] || ['U', 6];
    return conf[0] + this.nextSeq(users, conf[0], conf[1]);
  },

  /* 领养申请单号 AP+YYYYMMDD+NNN */
  application: function (apps) {
    var prefix = 'AP' + datePart();
    return prefix + this.nextSeq(apps, prefix, 3);
  },

  /* 领养协议编号 AD+YYYYMMDD+NNN+校验位 */
  agreement: function (apps) {
    var prefix = 'AD' + datePart();
    var body = prefix + this.nextSeq(apps, prefix, 3);
    return body + this.checkDigit(body.slice(2));
  },

  /* 回访单号 VS+YYYYMMDD+NN */
  visit: function (visits) {
    var prefix = 'VS' + datePart();
    return prefix + this.nextSeq(visits, prefix, 2);
  },

  /* 公告编号 NC+YYYYMMDD+NN */
  notice: function (notices) {
    var prefix = 'NC' + datePart();
    return prefix + this.nextSeq(notices, prefix, 2);
  }
};

/* ---------------------- 宠物照片（本地示例图） ---------------------- */
var DEFAULT_PHOTO = 'assets/pets/default.jpg';

/* ---------------------- 初始演示数据 ---------------------- */
function seedData() {
  return {
    users: [
      { id: 'U000001', role: '01', name: '张小雨', phone: '13800000001', idCard: '510102199905201234',
        address: '成都市高新区天府大道中段 1 号', password: '123456', status: '01', createdAt: '2026-09-02' },
      { id: 'U000002', role: '01', name: '李明', phone: '13800000002', idCard: '510103199710123456',
        address: '成都市武侯区人民南路四段 12 号', password: '123456', status: '01', createdAt: '2026-10-11' },
      { id: 'U000003', role: '01', name: '王雪', phone: '13800000003', idCard: '510104200001011234',
        address: '成都市锦江区春熙路 8 号', password: '123456', status: '02', createdAt: '2026-10-20' },
      /* 合并前遗留的送养账号：角色已并入普通用户 01，编号沿用 S001 */
      { id: 'S001', role: '01', name: '陈芳', phone: '13900000001', idCard: '', address: '暖爪宠物领养中心（天府店）',
        password: '123456', status: '01', createdAt: '2026-08-01' },
      { id: 'A001', role: '03', name: '刘洋', phone: '13700000001', idCard: '', address: '暖爪宠物领养中心（总部）',
        password: '123456', status: '01', createdAt: '2026-08-01' }
    ],

    pets: [
      { id: 'PET-2026-0001', name: '豆豆', type: '01', breed: '柯基', gender: 'M', age: 18, weight: 11.5,
        health: '01', status: '20', station: 'ST001', createdBy: 'S001', createdAt: '2026-09-05',
        vaccined: true, sterilized: true,
        photo: 'assets/pets/corgi.jpg',
        desc: '豆豆是 2026 年夏天被救助的柯基，性格亲人，会握手和坐下，喜欢跟着人走。已完成两针疫苗和绝育，适合有耐心、每天能保证遛狗时间的家庭。' },
      { id: 'PET-2026-0002', name: '团团', type: '02', breed: '英国短毛猫', gender: 'F', age: 8, weight: 3.2,
        health: '01', status: '20', station: 'ST001', createdBy: 'S001', createdAt: '2026-09-18',
        vaccined: true, sterilized: false,
        photo: 'assets/pets/british.jpg',
        desc: '团团性格安静，会用猫砂盆，喜欢晒太阳和逗猫棒。因为原主人搬家无法继续饲养而送养，希望找到愿意室内科学喂养的领养人。' },
      { id: 'PET-2026-0003', name: '花花', type: '02', breed: '中华田园猫', gender: 'F', age: 24, weight: 4.0,
        health: '02', status: '20', station: 'ST002', createdBy: 'S001', createdAt: '2026-10-02',
        vaccined: true, sterilized: true,
        photo: 'assets/pets/calico.jpg',
        desc: '花花是从校园流浪猫群中救助的三花猫，目前处于观察期，每周复查一次。性格独立但会主动蹭人，已绝育，适合安静的家庭环境。' },
      { id: 'PET-2026-0004', name: '阿黄', type: '01', breed: '中华田园犬', gender: 'M', age: 36, weight: 16,
        health: '04', status: '20', station: 'ST002', createdBy: 'S001', createdAt: '2026-10-08',
        vaccined: true, sterilized: true,
        photo: 'assets/pets/mongrel.jpg',
        desc: '阿黄此前腿部受过伤，现已康复，走路略有一点跛，不影响日常活动。性格稳重、不拆家，适合有院子的家庭或有陪伴需求的独居者。' },
      { id: 'PET-2026-0005', name: '雪球', type: '02', breed: '布偶猫', gender: 'M', age: 12, weight: 4.6,
        health: '01', status: '30', station: 'ST001', createdBy: 'S001', createdAt: '2026-10-12',
        vaccined: true, sterilized: true,
        photo: 'assets/pets/ragdoll.jpg',
        desc: '雪球是救助站里最黏人的布偶，喜欢被人抱。已完成疫苗和绝育，目前有领养人正在申请审核中。' },
      { id: 'PET-2026-0006', name: '小七', type: '01', breed: '边境牧羊犬', gender: 'F', age: 6, weight: 7.8,
        health: '01', status: '10', station: 'ST001', createdBy: 'S001', createdAt: '2026-11-14',
        vaccined: true, sterilized: false,
        photo: 'assets/pets/bordercollie.jpg',
        desc: '小七是刚满半岁的边牧幼犬，精力旺盛、学习能力强，需要每天较大的运动量和训练时间，暂未通过管理员审核。' },
      { id: 'PET-2025-0009', name: '可乐', type: '01', breed: '泰迪', gender: 'M', age: 30, weight: 5.2,
        health: '01', status: '40', station: 'ST001', createdBy: 'S001', createdAt: '2025-11-20',
        vaccined: true, sterilized: true,
        photo: 'assets/pets/poodle.jpg',
        desc: '可乐于 2026 年 8 月完成领养，目前处于回访跟踪阶段。' }
    ],

    favorites: [
      { userId: 'U000001', petId: 'PET-2026-0001', createdAt: '2026-11-10 19:22' },
      { userId: 'U000001', petId: 'PET-2026-0005', createdAt: '2026-11-12 21:05' }
    ],

    applications: [
      { id: 'AP20261012001', petId: 'PET-2026-0005', userId: 'U000002',
        reason: '家里有 90 平方米的自有住房，家人均同意养猫，希望给雪球一个稳定的家。',
        experience: '有', houseType: '自有住房', familyAgree: '是', phone: '13800000002',
        status: '02', reviewNote: '材料齐全、收入稳定，同意进入家访核实环节',
        agreementId: '', createdAt: '2026-10-12 10:20', updatedAt: '2026-10-13 09:40' },
      { id: 'AP20261108002', petId: 'PET-2026-0004', userId: 'U000001',
        reason: '喜欢安静的狗狗，家里有独立小院，能保证每天两次遛狗。',
        experience: '有', houseType: '租房', familyAgree: '是', phone: '13800000001',
        status: '05', reviewNote: '租房未提供房东同意养宠的书面证明，材料不齐，本次驳回',
        agreementId: '', createdAt: '2026-11-08 09:12', updatedAt: '2026-11-09 15:30' },
      { id: 'AP20261115003', petId: 'PET-2026-0002', userId: 'U000001',
        reason: '独居上班族，作息规律，希望领养一只安静的猫咪陪伴。',
        experience: '无', houseType: '租房', familyAgree: '是', phone: '13800000001',
        status: '01', reviewNote: '', agreementId: '',
        createdAt: '2026-11-15 20:05', updatedAt: '2026-11-15 20:05' },
      { id: 'AP20260801004', petId: 'PET-2025-0009', userId: 'U000001',
        reason: '家中有养宠经验，希望领养可乐。',
        experience: '有', houseType: '自有住房', familyAgree: '是', phone: '13800000001',
        status: '04', reviewNote: '家访通过，已完成协议签订',
        agreementId: 'AD202608080012', createdAt: '2026-08-01 14:30', updatedAt: '2026-08-08 16:00' }
    ],

    visits: [
      { id: 'VS2026081501', applicationId: 'AP20260801004', petId: 'PET-2025-0009', userId: 'U000001',
        planDate: '2026-08-15', actualDate: '2026-08-15', result: '02',
        note: '首次回访：可乐适应良好，饮食正常，体重稳定。', visitor: '刘洋', status: '02' },
      { id: 'VS2026112001', applicationId: 'AP20260801004', petId: 'PET-2025-0009', userId: 'U000001',
        planDate: '2026-11-20', actualDate: '', result: '', note: '',
        visitor: '刘洋', status: '01' }
    ],

    notices: [
      { id: 'NC2026110101', title: '冬季领养须知：新宠入户前请先做这三件事', type: '领养须知', top: true,
        createdAt: '2026-11-01',
        content: '一、入户前完成一次全面体检，确认疫苗与驱虫记录；二、为宠物准备独立的休息空间，前 7 天减少外出与陌生人接触；三、与救助站约定首次回访时间，如实反馈宠物适应情况。' },
      { id: 'NC2026110502', title: '11 月流浪动物免费绝育公益活动开始报名', type: '公益活动', top: false,
        createdAt: '2026-11-05',
        content: '本月联合三家宠物医院开展免费绝育公益名额 50 个，优先面向救助站登记的流浪猫犬。报名请携带宠物免疫证明到门店前台登记，名额按登记顺序安排。' },
      { id: 'NC2026111203', title: '领养回访制度说明：领养不等于结束', type: '制度说明', top: false,
        createdAt: '2026-11-12',
        content: '为保证动物福利，领养成功后第 7 天、第 30 天、第 90 天各安排一次回访。回访方式为电话或上门，内容包括饮食、健康、行为适应情况。连续两次失联将记入领养信用记录。' }
    ],

    settings: {
      siteName: '暖爪宠物领养中心',
      hotline: '028-8888 6666',
      address: '成都市高新区天府三街 88 号',
      workTime: '09:00 - 18:00（周一至周日）',
      visitDays: 7,
      rules: '1. 领养人须年满 18 周岁，具有完全民事行为能力；\n' +
             '2. 有稳定住所与收入，租房者需提供房东同意养宠的证明；\n' +
             '3. 家庭成员均同意领养，承诺不因搬家、怀孕、宠物生病等原因遗弃；\n' +
             '4. 接受救助站第 7 天、第 30 天、第 90 天的回访；\n' +
             '5. 按要求办理免疫、绝育与养犬登记，科学喂养。'
    }
  };
}

/* ---------------------- 数据访问层 ---------------------- */
var DB = {
  data: null,

  load: function () {
    if (this.data) return this.data;
    var raw = localStorage.getItem(DB_KEY);
    if (raw) {
      try { this.data = JSON.parse(raw); } catch (e) { this.data = null; }
    }
    if (!this.data) { this.data = seedData(); this.save(); }
    /* 旧数据迁移：送养人（02）与原领养人合并为统一用户角色（01） */
    var changed = false;
    this.data.users.forEach(function (u) {
      if (u.role === '02') { u.role = '01'; changed = true; }
    });
    if (changed) this.save();
    return this.data;
  },

  save: function () {
    localStorage.setItem(DB_KEY, JSON.stringify(this.data));
  },

  reset: function () {
    this.data = seedData();
    this.save();
  },

  /* ---------- 用户 ---------- */
  users: function () { return this.load().users; },

  user: function (id) {
    var arr = this.users().filter(function (u) { return u.id === id; });
    return arr.length ? arr[0] : null;
  },

  login: function (account, password) {
    var acc = String(account || '').trim();
    var u = this.users().filter(function (x) {
      return (x.id === acc || x.phone === acc) && x.password === password;
    })[0];
    if (!u) return { ok: false, msg: '账号或密码不正确，请重新输入' };
    if (u.status === '02') return { ok: false, msg: '该账号已被冻结，请联系管理员' };
    localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: u.id, role: u.role }));
    return { ok: true, user: u };
  },

  logout: function () { localStorage.removeItem(SESSION_KEY); },

  session: function () {
    var raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  },

  currentUser: function () {
    var s = this.session();
    return s ? this.user(s.userId) : null;
  },

  register: function (form) {
    var self = this;
    var exists = this.users().filter(function (u) { return u.phone === form.phone; });
    if (exists.length) return { ok: false, msg: '该手机号已注册，请直接登录' };
    if (!/^1\d{10}$/.test(form.phone)) return { ok: false, msg: '请输入 11 位手机号码' };
    if (!/^\d{17}[\dXx]$/.test(form.idCard || '')) return { ok: false, msg: '请填写 18 位身份证号' };
    /* 注册不再区分领养人 / 送养人，统一为用户角色，领养与送养能力由同一账号承载 */
    var user = {
      id: CodeGen.user(this.users(), '01'),
      role: '01', name: form.name, phone: form.phone,
      idCard: form.idCard || '', address: form.address || '',
      password: form.password, status: '01',
      createdAt: new Date().toISOString().slice(0, 10)
    };
    self.data.users.push(user);
    self.save();
    localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: user.id, role: user.role }));
    return { ok: true, user: user };
  },

  updateUser: function (id, patch) {
    var u = this.user(id);
    if (!u) return null;
    Object.keys(patch).forEach(function (k) { u[k] = patch[k]; });
    this.save();
    return u;
  },

  toggleUserStatus: function (id) {
    var u = this.user(id);
    if (!u) return;
    u.status = u.status === '01' ? '02' : '01';
    this.save();
  },

  /* ---------- 宠物 ---------- */
  pets: function () { return this.load().pets; },

  pet: function (id) {
    var arr = this.pets().filter(function (p) { return p.id === id; });
    return arr.length ? arr[0] : null;
  },

  addPet: function (form, creator) {
    var pet = {
      id: CodeGen.pet(this.pets()),
      name: form.name, type: form.type, breed: form.breed,
      gender: form.gender, age: Number(form.age), weight: Number(form.weight),
      health: form.health, status: '10',
      station: 'ST001', createdBy: creator,
      createdAt: new Date().toISOString().slice(0, 10),
      vaccined: !!form.vaccined, sterilized: !!form.sterilized,
      photo: form.photo || DEFAULT_PHOTO,
      desc: form.desc || ''
    };
    this.data.pets.push(pet);
    this.save();
    return pet;
  },

  updatePet: function (id, patch) {
    var p = this.pet(id);
    if (!p) return null;
    Object.keys(patch).forEach(function (k) { p[k] = patch[k]; });
    this.save();
    return p;
  },

  deletePet: function (id) {
    this.data.pets = this.pets().filter(function (p) { return p.id !== id; });
    this.data.favorites = this.data.favorites.filter(function (f) { return f.petId !== id; });
    this.save();
  },

  /* ---------- 收藏 ---------- */
  isFavorite: function (userId, petId) {
    return this.load().favorites.some(function (f) { return f.userId === userId && f.petId === petId; });
  },

  toggleFavorite: function (userId, petId) {
    var list = this.data.favorites;
    var idx = -1;
    list.forEach(function (f, i) { if (f.userId === userId && f.petId === petId) idx = i; });
    if (idx >= 0) { list.splice(idx, 1); this.save(); return false; }
    list.push({ userId: userId, petId: petId, createdAt: nowStr() });
    this.save();
    return true;
  },

  favoritesOf: function (userId) {
    var self = this;
    return this.load().favorites
      .filter(function (f) { return f.userId === userId; })
      .map(function (f) { return self.pet(f.petId); })
      .filter(Boolean);
  },

  /* ---------- 领养申请 ---------- */
  applications: function () { return this.load().applications; },

  applicationsOf: function (userId) {
    return this.applications().filter(function (a) { return a.userId === userId; })
      .sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
  },

  submitApplication: function (form, user) {
    var pet = this.pet(form.petId);
    if (!pet) return { ok: false, msg: '宠物信息不存在' };
    if (pet.createdBy === user.id) return { ok: false, msg: '不能申请自己发布的宠物' };
    if (pet.status !== '20') return { ok: false, msg: '该宠物当前不可申请领养' };
    var dup = this.applications().some(function (a) {
      return a.petId === form.petId && a.userId === user.id && (a.status === '01' || a.status === '02' || a.status === '03');
    });
    if (dup) return { ok: false, msg: '你已提交过该宠物的申请，请在个人中心查看进度' };
    var app = {
      id: CodeGen.application(this.applications()),
      petId: form.petId, userId: user.id,
      reason: form.reason, experience: form.experience,
      houseType: form.houseType, familyAgree: form.familyAgree,
      phone: form.phone || user.phone,
      status: '01', reviewNote: '', agreementId: '',
      createdAt: nowStr(), updatedAt: nowStr()
    };
    this.data.applications.push(app);
    pet.status = '30';                 /* 宠物状态：申请中 */
    this.save();
    return { ok: true, app: app };
  },

  withdrawApplication: function (appId) {
    var app = this.applications().filter(function (a) { return a.id === appId; })[0];
    if (!app || app.status !== '01') return { ok: false, msg: '仅待审核的申请可以撤回' };
    app.status = '06'; app.updatedAt = nowStr();
    var pet = this.pet(app.petId);
    if (pet && pet.status === '30') pet.status = '20';
    this.save();
    return { ok: true };
  },

  /* 审核：action = pass(初审通过) / reject(驳回) / visit(转家访) / success(领养成功) */
  reviewApplication: function (appId, action, note) {
    var app = this.applications().filter(function (a) { return a.id === appId; })[0];
    if (!app) return { ok: false, msg: '申请不存在' };
    var pet = this.pet(app.petId);
    if (action === 'pass') { app.status = '02'; }
    else if (action === 'reject') {
      app.status = '05';
      if (pet && pet.status === '30') pet.status = '20';
    }
    else if (action === 'visit') { app.status = '03'; }
    else if (action === 'success') {
      app.status = '04';
      app.agreementId = CodeGen.agreement(this.applications());
      if (pet) pet.status = '40';
      /* 签订协议后自动生成首次回访任务 */
      var days = Number(this.load().settings.visitDays) || 7;
      var d = new Date();
      d.setDate(d.getDate() + days);
      this.data.visits.push({
        id: CodeGen.visit(this.load().visits),
        applicationId: app.id, petId: app.petId, userId: app.userId,
        planDate: d.toISOString().slice(0, 10), actualDate: '', result: '',
        note: '', visitor: (this.currentUser() || {}).name || '管理员', status: '01'
      });
    }
    if (note !== undefined) app.reviewNote = note;
    app.updatedAt = nowStr();
    this.save();
    return { ok: true, app: app };
  },

  /* ---------- 回访 ---------- */
  visits: function () { return this.load().visits; },

  visitsOf: function (userId) {
    return this.visits().filter(function (v) { return v.userId === userId; })
      .sort(function (a, b) { return a.planDate < b.planDate ? 1 : -1; });
  },

  finishVisit: function (visitId, form) {
    var v = this.visits().filter(function (x) { return x.id === visitId; })[0];
    if (!v) return { ok: false, msg: '回访记录不存在' };
    v.actualDate = new Date().toISOString().slice(0, 10);
    v.result = form.result;
    v.note = form.note;
    v.status = form.result;
    this.save();
    return { ok: true };
  },

  addVisitPlan: function (form) {
    var app = this.applications().filter(function (a) { return a.id === form.applicationId; })[0];
    if (!app) return { ok: false, msg: '领养记录不存在' };
    this.data.visits.push({
      id: CodeGen.visit(this.load().visits),
      applicationId: app.id, petId: app.petId, userId: app.userId,
      planDate: form.planDate, actualDate: '', result: '', note: '',
      visitor: form.visitor || (this.currentUser() || {}).name || '管理员', status: '01'
    });
    this.save();
    return { ok: true };
  },

  /* ---------- 公告 ---------- */
  notices: function () {
    return this.load().notices.slice().sort(function (a, b) {
      if (a.top !== b.top) return a.top ? -1 : 1;
      return a.createdAt < b.createdAt ? 1 : -1;
    });
  },

  saveNotice: function (form) {
    if (form.id) {
      var n = this.load().notices.filter(function (x) { return x.id === form.id; })[0];
      if (!n) return { ok: false, msg: '公告不存在' };
      n.title = form.title; n.content = form.content; n.type = form.type; n.top = !!form.top;
      this.save();
      return { ok: true, notice: n };
    }
    var item = {
      id: CodeGen.notice(this.load().notices),
      title: form.title, content: form.content, type: form.type,
      top: !!form.top, createdAt: new Date().toISOString().slice(0, 10)
    };
    this.data.notices.push(item);
    this.save();
    return { ok: true, notice: item };
  },

  deleteNotice: function (id) {
    this.data.notices = this.load().notices.filter(function (n) { return n.id !== id; });
    this.save();
  },

  /* ---------- 设置 ---------- */
  settings: function () { return this.load().settings; },

  saveSettings: function (form) {
    var s = this.load().settings;
    Object.keys(form).forEach(function (k) { s[k] = form[k]; });
    this.save();
  }
};
