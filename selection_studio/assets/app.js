/* 1688 选品库 · 独立工作台
 * 数据契约：{ keyword, summary, queries:[{name,count,items}], finalItems:[...] }
 * 不再依赖 Dify 渲染内联脚本 —— 所有交互在这里原生实现。
 */

(function () {
  "use strict";

  // ---------------- state ----------------
  const state = {
    keyword: "",
    summary: "",
    followups: [],
    items: [],          // finalItems 或 平铺 queries[*].items
    selected: new Set(), // 已选商品 id（跨页保留）
    view: "card",       // "card" | "list"
    page: 1,
    pageSize: 20,
    sort: "sales30d_desc",
    filters: { price: "", sales: "", rating: "", listed: "" }
  };

  // ---------------- dom ----------------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const ui = {
    askInput: $("#ask-input"),
    askSend: $("#ask-send"),
    askExamples: $("#ask-examples"),
    planner: $("#planner"),
    result: $("#result"),
    summaryTitle: $("#r-summary-title"),
    summaryText: $("#r-summary-text"),
    followups: $("#r-followups"),
    btnLike: $("#btn-feedback-like"),
    btnDislike: $("#btn-feedback-dislike"),
    btnExport: $("#btn-export-csv"),
    grid: $("#grid"),
    table: $("#table"),
    tBody: $("#t-body"),
    tHeadCk: $("#t-head-ck"),
    total: $("#c-total"),
    selected: $("#c-selected"),
    allCurrent: $("#c-all-current"),
    pPrev: $("#p-prev"),
    pNext: $("#p-next"),
    pInfo: $("#p-info"),
    pSize: $("#p-size"),
    fPrice: $("#f-price"),
    fSales: $("#f-sales"),
    fRating: $("#f-rating"),
    fListed: $("#f-listed"),
    fClear: $("#f-clear"),
    sKey: $("#s-key"),
    toast: $("#toast"),
    jsonPanel: $("#json-panel"),
    jsonInput: $("#json-input"),
    jsonLoad: $("#json-load"),
    jsonSample: $("#json-sample")
  };

  // ---------------- example suggestions ----------------
  const EXAMPLES = [
    "近30天上架的万圣节产品",
    "邂逅花园系列",
    "毛绒玩具",
    "大码连衣裙",
    "男士休闲外套"
  ];
  function renderExamples() {
    ui.askExamples.innerHTML = "";
    EXAMPLES.forEach((q) => {
      const b = document.createElement("button");
      b.className = "ask-example";
      b.textContent = q;
      b.addEventListener("click", () => {
        ui.askInput.innerText = q;
        submit();
      });
      ui.askExamples.appendChild(b);
    });
  }

  // ---------------- submit / planner ----------------
  async function submit() {
    const text = (ui.askInput.innerText || "").trim();
    if (!text) { toast("请输入搜索词"); return; }
    state.keyword = text;
    state.selected = new Set();
    state.page = 1;
    showPlanner(true);
    runPlannerAnim();
    const payload = { keyword: text };
    try {
      // 真实接入：POST 到你的 Dify WebApp /workflows/run
      // 这里为了本地可演示，先用样例数据。
      const data = await loadData(payload);
      if (!data || (!data.finalItems && !(data.queries||[]).length)) {
        showJsonPanel(true);
        runPlannerAnim(false);
        toast("未取到数据，请粘贴 Dify 工作流 JSON");
        return;
      }
      renderResult(data);
    } catch (e) {
      toast("出错了：" + (e.message || e));
      showJsonPanel(true);
      runPlannerAnim(false);
    }
  }

  function showPlanner(yes) { ui.planner.classList.toggle("hidden", !yes); }
  function showJsonPanel(yes) { if (ui.jsonPanel) ui.jsonPanel.classList.toggle("hidden", !yes); }

  function runPlannerAnim(start) {
    if (start === false) {
      const steps = $$(".planner-steps li");
      steps.forEach((s) => s.classList.remove("active"));
      return;
    }
    const steps = $$(".planner-steps li");
    steps.forEach((s) => s.classList.remove("active", "done"));
    let i = 0;
    const tick = () => {
      if (i >= steps.length) return;
      steps.forEach((s, idx) => {
        s.classList.remove("active");
        if (idx < i) s.classList.add("done");
      });
      if (i < steps.length) steps[i].classList.add("active");
      i++;
      setTimeout(tick, 600);
    };
    tick();
  }

  // ---------------- data ----------------
  async function loadData(payload) {
    // 真实接入 Dify 工作流（方式 A —— 后端代理）：
    // const res = await fetch("/api/run", {
    //   method:"POST", headers:{"Content-Type":"application/json"},
    //   body: JSON.stringify(payload)
    // });
    // const j = await res.json();
    // return j.result || j;

    // 真实接入 Dify 工作流（方式 B —— 直接拿最新一次运行的输出 JSON）：
    //   Dify 没有稳定的“查询运行结果”接口，所以推荐方式 A；
    //   这里默认走本地样例，方便你离线验证。
    // 单文件模式（双击 HTML 打开时）：样例 JSON 已经内联在 window.__SAMPLE
    if (window.__SAMPLE) return JSON.parse(JSON.stringify(window.__SAMPLE));
    // 多文件模式（http server 提供）：从 sample_data.json 读取
    try {
      const res = await fetch("sample_data.json", { cache: "no-store" });
      if (res.ok) return await res.json();
    } catch (e) {}
    // 兜底
    return { keyword: payload?.keyword || "", summary: "", followups: [], queries: [], finalItems: [] };
  }

  function renderResult(data) {
    // 兼容 Dify 节点直接输出 payload 或包成 {result: payload}
    const payload = (data && data.result) ? data.result : data;
    data = payload;
    state.keyword = data.keyword || state.keyword;
    state.summary = data.summary || "";
    state.followups = data.followups || [];
    state.items = (data.finalItems && data.finalItems.length ? data.finalItems : flattenQueries(data.queries))
      .map(normalizeItem);
    showPlanner(false);
    ui.result.classList.remove("hidden");
    ui.summaryTitle.textContent = `选品推荐 · ${state.keyword}`;
    ui.summaryText.textContent = state.summary;
    renderFollowups();
    renderAll();
    window.scrollTo({ top: ui.result.offsetTop - 20, behavior: "smooth" });
  }

  function flattenQueries(queries) {
    if (!queries || !queries.length) return [];
    return queries.flatMap((q) => (q.items || []).map((it) => ({ ...it, _query: q.name })));
  }

  function normalizeItem(it) {
    return {
      id: String(it.id || it.itemId || it.item_id || it.url || it.title || Math.random()),
      title: it.title || it.subject || "",
      image: it.image || it.pic || it.img || "",
      price: Number(it.price) || 0,
      sales: Number(it.sales || it.salesTotal || it.monthSales) || 0,
      sales30d: Number(it.sales30d || it.orderCount30d || it.sales_30d) || 0,
      rating: Number(it.rating || it.score) || 0,
      listedAt: it.listedAt || it.publishTime || it.addTime || it.listed_at || "",
      category: it.category || it.catName || "",
      url: it.url || it.detailUrl || it.link || "",
      shop: it.shop || it.shopName || "",
      query: it._query || it.query || ""
    };
  }

  function renderFollowups() {
    ui.followups.innerHTML = "";
    state.followups.forEach((q) => {
      const c = document.createElement("span");
      c.className = "chip";
      c.textContent = q;
      c.addEventListener("click", () => { ui.askInput.innerText = q; submit(); });
      ui.followups.appendChild(c);
    });
  }

  // ---------------- filter / sort ----------------
  function getFilteredSortedItems() {
    let arr = state.items.slice();
    const f = state.filters;

    if (f.price) {
      const [a, b] = f.price.split("-").map((v) => v === "" ? null : Number(v));
      arr = arr.filter((x) => b == null ? x.price >= a : (x.price >= a && x.price <= b));
    }
    if (f.sales) {
      const [a, b] = f.sales.split("-").map((v) => v === "" ? null : Number(v));
      arr = arr.filter((x) => b == null ? x.sales >= a : (x.sales >= a && x.sales <= b));
    }
    if (f.rating) { arr = arr.filter((x) => x.rating >= Number(f.rating)); }
    if (f.listed) {
      const days = Number(f.listed);
      const cutoff = Date.now() - days * 86400e3;
      arr = arr.filter((x) => x.listedAt && new Date(x.listedAt).getTime() >= cutoff);
    }

    const cmp = {
      sales30d_desc: (a, b) => b.sales30d - a.sales30d,
      sales_desc: (a, b) => b.sales - a.sales,
      price_asc: (a, b) => a.price - b.price,
      price_desc: (a, b) => b.price - a.price,
      listed_desc: (a, b) => new Date(b.listedAt || 0) - new Date(a.listedAt || 0),
      rating_desc: (a, b) => b.rating - a.rating
    }[state.sort] || ((a, b) => b.sales30d - a.sales30d);

    return arr.sort(cmp);
  }

  // ---------------- render ----------------
  function renderAll() {
    const all = getFilteredSortedItems();
    ui.total.textContent = `共 ${all.length} 条结果`;
    ui.selected.textContent = `已选 ${state.selected.size} 条`;
    renderGrid(all);
    renderTable(all);
    renderPager(all.length);
    syncAllCurrentCheckbox(all);
  }

  function paginate(items) {
    const start = (state.page - 1) * state.pageSize;
    return items.slice(start, start + state.pageSize);
  }

  function renderGrid(all) {
    const page = paginate(all);
    ui.grid.innerHTML = "";
    page.forEach((it, idx) => {
      const card = document.createElement("div");
      card.className = "product-card";
      card.innerHTML = `
        <div class="thumb"><img loading="lazy" src="${escapeAttr(it.image)}" onerror="this.style.opacity=0" alt=""></div>
        <div class="body">
          <div class="title">${escapeHTML(it.title)}</div>
          <div class="stats">
            <span class="price">¥${fmtPrice(it.price)}</span>
            <span>30天销量 ${it.sales30d}</span>
          </div>
          <div class="meta">
            <span>评分 ${it.rating || "-"}</span>
            <span>·</span>
            <span>${escapeHTML(it.listedAt || "上架时间未知")}</span>
          </div>
        </div>
        <label class="check-row">
          <input type="checkbox" data-id="${escapeAttr(it.id)}" class="ck-item" ${state.selected.has(it.id) ? "checked" : ""}/>
          选入导出
        </label>`;
      ui.grid.appendChild(card);
    });
    bindCardChecks();
  }

  function bindCardChecks() {
    $$(".grid .ck-item").forEach((ck) => {
      ck.addEventListener("change", (e) => {
        const id = e.target.getAttribute("data-id");
        if (e.target.checked) state.selected.add(id);
        else state.selected.delete(id);
        ui.selected.textContent = `已选 ${state.selected.size} 条`;
      });
    });
  }

  function renderTable(all) {
    const page = paginate(all);
    ui.tBody.innerHTML = "";
    page.forEach((it, idx) => {
      const tr = document.createElement("tr");
      tr.setAttribute("data-id", it.id);
      tr.className = state.selected.has(it.id) ? "checked" : "";
      tr.innerHTML = `
        <td class="ck"><input type="checkbox" class="ck-row" ${state.selected.has(it.id) ? "checked" : ""}/></td>
        <td>${(state.page - 1) * state.pageSize + idx + 1}</td>
        <td class="img"><img loading="lazy" src="${escapeAttr(it.image)}" onerror="this.style.opacity=0" alt=""></td>
        <td>${escapeHTML(it.title)}</td>
        <td>¥${fmtPrice(it.price)}</td>
        <td>${it.sales}</td>
        <td>${it.sales30d}</td>
        <td>${it.rating || "-"}</td>
        <td>${escapeHTML(it.listedAt || "-")}</td>
        <td>${escapeHTML(it.category || "-")}</td>
        <td><a href="${escapeAttr(it.url)}" target="_blank" rel="noopener">打开</a></td>`;
      ui.tBody.appendChild(tr);
    });
    $$(".data-table .ck-row").forEach((ck) => {
      ck.addEventListener("change", (e) => {
        const tr = e.target.closest("tr");
        const id = tr.getAttribute("data-id");
        if (e.target.checked) state.selected.add(id);
        else state.selected.delete(id);
        tr.classList.toggle("checked", e.target.checked);
        ui.selected.textContent = `已选 ${state.selected.size} 条`;
        syncAllCurrentCheckbox(all);
      });
    });
  }

  function renderPager(total) {
    const pages = Math.max(1, Math.ceil(total / state.pageSize));
    if (state.page > pages) state.page = pages;
    ui.pInfo.textContent = `第 ${state.page} / ${pages} 页`;
    ui.pPrev.disabled = state.page <= 1;
    ui.pNext.disabled = state.page >= pages;
  }

  function syncAllCurrentCheckbox(all) {
    const page = paginate(all);
    const allChecked = page.length > 0 && page.every((it) => state.selected.has(it.id));
    ui.allCurrent.checked = allChecked;
    ui.tHeadCk.checked = allChecked;
  }

  // ---------------- view toggle ----------------
  function bindViewToggle() {
    $$(".view-toggle .seg").forEach((b) => {
      b.addEventListener("click", () => {
        $$(".view-toggle .seg").forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        state.view = b.getAttribute("data-view");
        ui.grid.classList.toggle("hidden", state.view !== "card");
        ui.table.classList.toggle("hidden", state.view !== "list");
      });
    });
    ui.grid.classList.toggle("hidden", state.view !== "card");
    ui.table.classList.toggle("hidden", state.view !== "list");
  }

  // ---------------- filters / sort / pager ----------------
  function bindToolbar() {
    ui.fPrice.addEventListener("change", () => { state.filters.price = ui.fPrice.value; state.page = 1; renderAll(); });
    ui.fSales.addEventListener("change", () => { state.filters.sales = ui.fSales.value; state.page = 1; renderAll(); });
    ui.fRating.addEventListener("change", () => { state.filters.rating = ui.fRating.value; state.page = 1; renderAll(); });
    ui.fListed.addEventListener("change", () => { state.filters.listed = ui.fListed.value; state.page = 1; renderAll(); });
    ui.fClear.addEventListener("click", () => {
      state.filters = { price: "", sales: "", rating: "", listed: "" };
      ui.fPrice.value = ""; ui.fSales.value = ""; ui.fRating.value = ""; ui.fListed.value = "";
      state.page = 1; renderAll();
    });
    ui.sKey.addEventListener("change", () => { state.sort = ui.sKey.value; renderAll(); });
    ui.pSize.addEventListener("change", () => { state.pageSize = Number(ui.pSize.value); state.page = 1; renderAll(); });
    ui.pPrev.addEventListener("click", () => { state.page = Math.max(1, state.page - 1); renderAll(); });
    ui.pNext.addEventListener("click", () => { state.page = state.page + 1; renderAll(); });
  }

  function bindAllCurrent() {
    ui.allCurrent.addEventListener("change", (e) => {
      const all = getFilteredSortedItems();
      const page = paginate(all);
      page.forEach((it) => {
        if (e.target.checked) state.selected.add(it.id);
        else state.selected.delete(it.id);
      });
      renderAll();
    });
    ui.tHeadCk.addEventListener("change", (e) => ui.allCurrent.checked = e.target.checked, ui.allCurrent.dispatchEvent(new Event("change")));
  }

  // ---------------- export CSV ----------------
  function bindExport() {
    ui.btnExport.addEventListener("click", () => {
      const ids = state.selected;
      if (ids.size === 0) { toast("请先勾选要导出的商品"); return; }
      const rows = state.items.filter((it) => ids.has(it.id));
      const csv = rowsToCsv(rows);
      downloadCsv(csv, "1688_selection_export.csv");
      toast(`已导出 ${rows.length} 条`);
    });
    ui.btnLike.addEventListener("click", () => toast("已记录喜欢反馈"));
    ui.btnDislike.addEventListener("click", () => toast("已记录不喜欢反馈"));
  }

  function rowsToCsv(rows) {
    const headers = ["序号", "标题", "价格(元)", "月销量", "30天销量", "评分", "上架时间", "类目", "店铺", "链接"];
    const lines = [headers.join(",")];
    rows.forEach((it, i) => {
      const row = [
        i + 1,
        it.title,
        it.price,
        it.sales,
        it.sales30d,
        it.rating,
        it.listedAt,
        it.category,
        it.shop,
        it.url
      ].map(csvCell);
      lines.push(row.join(","));
    });
    // UTF-8 BOM
    return "﻿" + lines.join("\r\n");
  }

  function csvCell(v) {
    if (v == null) return "";
    const s = String(v);
    if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function downloadCsv(content, filename) {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  // ---------------- utils ----------------
  function escapeHTML(s) { return String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;"})[c]); }
  function escapeAttr(s) { return escapeHTML(s).replace(/"/g, "&quot;"); }
  function fmtPrice(n) { return Number(n).toFixed(2); }
  function toast(msg) {
    ui.toast.textContent = msg;
    ui.toast.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => ui.toast.classList.remove("show"), 1800);
  }

  // ---------------- boot ----------------
  function bindAsk() {
    ui.askSend.addEventListener("click", submit);
    ui.askInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
    });
  }

  function bindJsonPanel() {
    if (!ui.jsonLoad) return;
    ui.jsonLoad.addEventListener("click", () => {
      const txt = (ui.jsonInput.value || "").trim();
      if (!txt) { toast("请粘贴 JSON"); return; }
      try {
        const data = JSON.parse(txt);
        showJsonPanel(false);
        renderResult(data);
      } catch (e) {
        toast("JSON 解析失败：" + e.message);
      }
    });
    ui.jsonSample.addEventListener("click", () => {
      if (window.__SAMPLE) {
        ui.jsonInput.value = JSON.stringify(window.__SAMPLE, null, 2);
        toast("已载入示例数据");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderExamples();
    bindAsk();
    bindJsonPanel();
    bindViewToggle();
    bindToolbar();
    bindAllCurrent();
    bindExport();
  });

  // 暴露给 console 用，方便手工调试
  window.__studio = { state, submit, renderAll };
})();