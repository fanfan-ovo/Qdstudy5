/* ============================================================
   数据看板 · 逻辑脚本
   - 6 张卡片由 CARD_DATA 数组循环渲染（不手写 6 份重复 HTML）
   - 主题切换（深色 / 浅色）
   - “刷新数据”随机更新数值，配合 tabular-nums 数字不抖动
   ============================================================ */
'use strict';

/* ---------- 图标库（内联 SVG，stroke/currentColor 继承文字颜色） ---------- */
var ICONS = {
  currency: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>',
  users: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
  orders: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>',
  conversion: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>',
  aov: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>',
  refund: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>',
};

/* ---------- 卡片数据（6 张，唯一数据来源） ---------- */
var CARD_DATA = [
  { id: 'revenue',    label: '总营收',   icon: 'currency',   accent: 1, value: 1284300, prefix: '¥', suffix: '',  decimals: 0, delta: 12.4, goodWhenUp: true,  trend: [42, 45, 44, 48, 52, 50, 55, 58, 57, 62, 66, 70] },
  { id: 'users',      label: '活跃用户', icon: 'users',      accent: 2, value: 48230,   prefix: '',  suffix: '',  decimals: 0, delta: 8.1,  goodWhenUp: true,  trend: [30, 32, 31, 35, 38, 37, 40, 43, 42, 45, 48, 52] },
  { id: 'orders',     label: '订单量',   icon: 'orders',     accent: 3, value: 12940,   prefix: '',  suffix: '',  decimals: 0, delta: -3.6, goodWhenUp: true,  trend: [55, 53, 54, 50, 48, 49, 46, 44, 45, 42, 40, 38] },
  { id: 'conversion', label: '转化率',   icon: 'conversion', accent: 4, value: 3.82,    prefix: '',  suffix: '%', decimals: 2, delta: 0.4,  goodWhenUp: true,  trend: [20, 21, 20, 22, 23, 22, 24, 25, 24, 26, 27, 28] },
  { id: 'aov',        label: '客单价',   icon: 'aov',        accent: 5, value: 99.2,    prefix: '¥', suffix: '',  decimals: 1, delta: 2.3,  goodWhenUp: true,  trend: [40, 39, 41, 42, 41, 43, 44, 43, 45, 46, 45, 47] },
  { id: 'refund',     label: '退款率',   icon: 'refund',     accent: 6, value: 1.45,    prefix: '',  suffix: '%', decimals: 2, delta: -0.2, goodWhenUp: false, trend: [35, 33, 34, 32, 31, 32, 30, 29, 30, 28, 27, 26] },
];

var grid = document.getElementById('cardsGrid');
var cardEls = []; /* 保存每张卡的 DOM 引用，便于原地更新数值 */

/* ---------- 工具函数 ---------- */

/* 数字格式化：千分位 + 前后缀 + 小数位 */
function formatValue(d) {
  var opts = d.decimals > 0
    ? { minimumFractionDigits: d.decimals, maximumFractionDigits: d.decimals }
    : { maximumFractionDigits: 0 };
  return (d.prefix || '') + d.value.toLocaleString('zh-CN', opts) + (d.suffix || '');
}

/* 涨跌信息：方向（箭头）与颜色（方向 × 是否“涨为好”）相互独立 */
function deltaInfo(d) {
  var up = d.delta >= 0;
  var isGood = up ? d.goodWhenUp : !d.goodWhenUp;
  return { isGood: isGood, isDown: !up, text: (up ? '+' : '') + d.delta.toFixed(1) + '%' };
}

/* 12 点迷你趋势图（内联 SVG，currentColor 继承强调色） */
function sparkline(points) {
  var w = 120, h = 36, pad = 3;
  var min = Math.min.apply(null, points);
  var max = Math.max.apply(null, points);
  var range = (max - min) || 1;
  var coords = points.map(function (p, i) {
    var x = pad + (i / (points.length - 1)) * (w - pad * 2);
    var y = pad + (1 - (p - min) / range) * (h - pad * 2);
    return x.toFixed(2) + ',' + y.toFixed(2);
  });
  var last = coords[coords.length - 1].split(',');
  return '<svg class="card__spark" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true">'
    + '<polyline points="' + coords.join(' ') + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline>'
    + '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="2.5" fill="currentColor"></circle>'
    + '</svg>';
}

/* ---------- 渲染 ---------- */

/* 依据单条数据生成一张卡片，并返回各元素的引用 */
function buildCard(d) {
  var card = document.createElement('article');
  card.className = 'card';
  card.style.setProperty('--accent', 'var(--accent-' + d.accent + ')');

  var info = deltaInfo(d);

  card.innerHTML =
    '<div class="card__top">'
    + '<span class="card__icon" aria-hidden="true">' + ICONS[d.icon] + '</span>'
    + '<span class="card__delta ' + (info.isGood ? 'is-good' : 'is-bad') + (info.isDown ? ' is-down' : '') + '">'
    +   '<svg class="card__delta-arrow" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 2.5 10 9.5 H2 Z" fill="currentColor"></path></svg>'
    +   '<span class="card__delta-num">' + info.text + '</span>'
    + '</span>'
    + '</div>'
    + '<h3 class="card__label">' + d.label + '</h3>'
    + '<p class="card__value">' + formatValue(d) + '</p>'
    + '<div class="card__trend" aria-hidden="true">' + sparkline(d.trend) + '</div>';

  return {
    el: card,
    data: d,
    valueEl: card.querySelector('.card__value'),
    deltaEl: card.querySelector('.card__delta'),
    deltaNumEl: card.querySelector('.card__delta-num'),
    trendEl: card.querySelector('.card__trend'),
  };
}

/* 原地更新数值 / 涨跌 / 趋势，不重建整张卡片 */
function updateCard(c) {
  c.valueEl.textContent = formatValue(c.data);
  var info = deltaInfo(c.data);
  c.deltaNumEl.textContent = info.text;
  c.deltaEl.className = 'card__delta ' + (info.isGood ? 'is-good' : 'is-bad') + (info.isDown ? ' is-down' : '');
  c.trendEl.innerHTML = sparkline(c.data.trend);
}

function renderCards() {
  grid.innerHTML = '';
  cardEls.length = 0;
  CARD_DATA.forEach(function (d) {
    var c = buildCard(d);
    grid.appendChild(c.el);
    cardEls.push(c);
  });
}

/* ---------- 刷新数据 ---------- */
function roundTo(n, d) {
  var p = Math.pow(10, d);
  return Math.round(n * p) / p;
}

function refreshData() {
  CARD_DATA.forEach(function (d) {
    d.value = roundTo(d.value * (0.9 + Math.random() * 0.2), d.decimals);
    d.delta = Math.round((d.delta + (Math.random() * 6 - 3)) * 10) / 10;
    d.trend = d.trend.map(function (p) { return Math.round(p * (0.9 + Math.random() * 0.2)); });
  });
  cardEls.forEach(updateCard);
}

/* ---------- 主题切换 ---------- */
var themeToggle = document.getElementById('themeToggle');
var root = document.documentElement;

themeToggle.addEventListener('click', function () {
  var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  try { localStorage.setItem('theme', next); } catch (e) { /* ignore */ }
});

/* ---------- 手机端菜单展开 / 收起 ---------- */
var menuBtn = document.getElementById('menuBtn');
var sidebar = document.getElementById('sidebar');

menuBtn.addEventListener('click', function () {
  var open = sidebar.classList.toggle('is-open');
  menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
});

/* 点击导航链接后收起菜单（手机端） */
sidebar.querySelectorAll('.sidebar__nav a').forEach(function (a) {
  a.addEventListener('click', function () {
    sidebar.classList.remove('is-open');
    menuBtn.setAttribute('aria-expanded', 'false');
  });
});

/* ---------- 刷新按钮 & 初始化 ---------- */
document.getElementById('refreshBtn').addEventListener('click', refreshData);

renderCards();
