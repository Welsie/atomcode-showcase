/**
 * 主应用逻辑 — UI 渲染、交互处理、双语切换
 */
const app = {
  lang: "zh",
  activeTab: "overview",
  compareSet: [],
  selectedRule: null,

  /** 从 i18n 字典获取 UI 翻译 */
  T(key, ...args) { return T(this.lang, key, ...args); },

  /** 从规则数据获取多语言字段 */
  RF(rule, fieldBase) { return ruleField(rule, fieldBase, this.lang); },

  /** 从向导问题数据获取多语言字段 (text/textEN 模式) */
  WQ(q, field) {
    if (this.lang === "zh") return q[field] || "";
    if (this.lang === "en") return q[field + "EN"] || q[field] || "";
    return q[field + "EN"] || q[field] || "";
  },

  init() {
    this.bindTabs();
    this.renderAll();
    this.bindLangSelect();
    this.updateFooter();
  },

  // ======================== 标签切换 ========================
  bindTabs() {
    document.querySelectorAll(".nav-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".nav-tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        this.activeTab = tab.dataset.tab;
        document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
        document.getElementById("section-" + this.activeTab).classList.add("active");

        if (this.activeTab === "transport") this.renderTransportChain();
        if (this.activeTab === "compare") this.renderCompareSection();
      });
    });
  },

  bindLangSelect() {
    const sel = document.getElementById("lang-select");
    if (!sel) return;
    sel.value = this.lang;
    sel.addEventListener("change", () => {
      this.lang = sel.value;
      this.renderAll();
      this.updateFooter();
    });
  },

  updateFooter() {
    const srcEl = document.getElementById("footer-source");
    const discEl = document.getElementById("footer-disclaimer");
    if (srcEl) srcEl.textContent = this.T("footer_source");
    if (discEl) discEl.textContent = this.T("footer_disclaimer");
  },

  renderAll() {
    // 导航栏文字切换
    document.querySelectorAll(".nav-tab").forEach(tab => {
      const key = tab.dataset.tab;
      tab.textContent = this.T("nav_" + key);
    });

    // 语言选择器同步
    const sel = document.getElementById("lang-select");
    if (sel) sel.value = this.lang;

    this.renderOverview();
    this.renderWizard();
    this.renderCompareSection();
    this.renderTransportChain();
    if (this.selectedRule) this.showDetail(this.selectedRule);
  },

  // ======================== 1. 全览仪表板 ========================
  renderOverview() {
    const container = document.getElementById("overview-grid");
    if (!container) return;
    container.innerHTML = "";

    const groups = [
      { key: "any", title: this.T("overview_any_title"), subtitle: this.T("overview_any_sub") },
      { key: "sea", title: this.T("overview_sea_title"), subtitle: this.T("overview_sea_sub") }
    ];

    groups.forEach(group => {
      const groupDiv = document.createElement("div");
      groupDiv.className = "rule-group";

      const header = document.createElement("div");
      header.className = "group-header";
      header.innerHTML = `<h3>${group.title}</h3><span class="group-subtitle">${group.subtitle}</span>`;
      groupDiv.appendChild(header);

      const grid = document.createElement("div");
      grid.className = "card-grid";

      const rules = group.key === "any" ? anyModeRules : seaModeRules;
      rules.forEach(rule => {
        const card = this.createCard(rule);
        grid.appendChild(card);
      });

      groupDiv.appendChild(grid);
      container.appendChild(groupDiv);
    });

    // Legend
    const legend = document.createElement("div");
    legend.className = "card-legend";
    legend.innerHTML = `
      <span class="legend-item"><span class="dot seller"></span> ${this.T("legend_seller")}</span>
      <span class="legend-item"><span class="dot buyer"></span> ${this.T("legend_buyer")}</span>
      <span class="legend-item"><span class="dot shared"></span> ${this.T("legend_shared")}</span>
    `;
    container.appendChild(legend);
  },

  createCard(rule) {
    const card = document.createElement("div");
    card.className = "rule-card";
    card.dataset.code = rule.code;

    // 分组颜色
    const groupColor = rule.oldGroup === "E" ? "var(--color-e)" :
                       rule.oldGroup === "F" ? "var(--color-f)" :
                       rule.oldGroup === "C" ? "var(--color-c)" : "var(--color-d)";

    // 费用和风险摘要
    const costLabel = this.T("card_costs");
    const riskLabel = this.T("card_risk");
    const insuranceInfo = rule.sellerInsurance
      ? this.T("card_insure_seller")
      : this.T("card_insure_buyer");

    // 运输安排方
    const carriageLabel = rule.sellerCarriage
      ? this.T("card_carriage_seller")
      : this.T("card_carriage_buyer");

    // 清关方
    const exportClr = rule.exportClearance === "seller"
      ? this.T("card_export_seller")
      : this.T("card_export_buyer");
    const importClr = rule.importClearance === "seller"
      ? this.T("card_import_seller")
      : this.T("card_import_buyer");

    card.innerHTML = `
      <div class="card-header" style="background: ${groupColor}">
        <span class="card-code">${rule.code}</span>
        <span class="card-old-group">${rule.oldGroup}</span>
      </div>
      <div class="card-body">
        <h4 class="card-name">${this.RF(rule, "name")}</h4>
        <p class="card-summary">${this.RF(rule, "summary")}</p>
        <div class="card-tags">
          <span class="tag carriage">${carriageLabel}</span>
          <span class="tag insurance">${insuranceInfo}</span>
        </div>
        <div class="card-clearance">
          <span class="clr-item">${exportClr}</span>
          <span class="clr-arrow">→</span>
          <span class="clr-item">${importClr}</span>
        </div>
        <div class="card-risk">
          <span class="risk-icon">⚠</span>
          <span class="risk-text">${this.RF(rule, "riskPoint")}</span>
        </div>
      </div>
      <div class="card-footer">
        <button class="btn-detail" data-code="${rule.code}">${this.T("card_detail")}</button>
        <button class="btn-compare-add" data-code="${rule.code}">
          ${this.compareSet.includes(rule.code)
            ? this.T("card_added")
            : this.T("card_add")}
        </button>
      </div>
    `;

    // 事件绑定
    card.querySelector(".btn-detail").addEventListener("click", (e) => {
      e.stopPropagation();
      this.showDetail(rule.code);
    });
    card.querySelector(".btn-compare-add").addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleCompare(rule.code);
    });
    card.addEventListener("click", () => this.showDetail(rule.code));

    return card;
  },

  // ======================== 2. 规则详情面板 ========================
  showDetail(code) {
    const rule = incotermsData.find(r => r.code === code);
    if (!rule) return;
    this.selectedRule = code;

    const panel = document.getElementById("detail-panel");
    const content = document.getElementById("detail-content");
    if (!panel || !content) return;

    const groupColor = rule.oldGroup === "E" ? "var(--color-e)" :
                       rule.oldGroup === "F" ? "var(--color-f)" :
                       rule.oldGroup === "C" ? "var(--color-c)" : "var(--color-d)";

    // 运输方式
    const modeLabel = rule.group === "any"
      ? this.T("mode_any")
      : this.T("mode_sea");

    // 十大义务表
    const articleLabels = {
      A1: this.T("art_A1"), B1: this.T("art_B1"),
      A2: this.T("art_A2"), B2: this.T("art_B2"),
      A3: this.T("art_A3"), B3: this.T("art_B3"),
      A4: this.T("art_A4"), B4: this.T("art_B4"),
      A5: this.T("art_A5"), B5: this.T("art_B5"),
      A6: this.T("art_A6"), B6: this.T("art_B6"),
      A7: this.T("art_A7"), B7: this.T("art_B7"),
      A8: this.T("art_A8"), B8: this.T("art_B8"),
      A9: this.T("art_A9"), B9: this.T("art_B9"),
      A10: this.T("art_A10"), B10: this.T("art_B10")
    };

    let articlesHTML = "";
    const articleNums = ["1","2","3","4","5","6","7","8","9","10"];
    articleNums.forEach(n => {
      const aKey = "A" + n;
      const bKey = "B" + n;
      articlesHTML += `
        <div class="article-row">
          <div class="article-cell seller-cell">
            <span class="article-label">A${n}</span>
            <span class="article-text">${rule.articles[aKey] || "-"}</span>
          </div>
          <div class="article-num">${n}</div>
          <div class="article-cell buyer-cell">
            <span class="article-label">B${n}</span>
            <span class="article-text">${rule.articles[bKey] || "-"}</span>
          </div>
        </div>
      `;
    });

    // 费用清单
    const sellerCostsHTML = rule.sellerCosts.map(c => `<li>${c}</li>`).join("");
    const buyerCostsHTML = rule.buyerCosts.map(c => `<li>${c}</li>`).join("");

    content.innerHTML = `
      <div class="detail-header" style="border-left: 6px solid ${groupColor}">
        <div class="detail-title-row">
          <span class="detail-code">${rule.code}</span>
          <span class="detail-group-badge" style="background: ${groupColor}">${rule.oldGroup}</span>
          <span class="detail-mode">${modeLabel}</span>
        </div>
        <h3>${this.RF(rule, "name")}</h3>
        <p class="detail-summary">${this.RF(rule, "summary")}</p>
      </div>

      <div class="detail-grid-4">
        <div class="detail-box">
          <h4>${this.T("detail_risk")}</h4>
          <p>${this.RF(rule, "riskPoint")}</p>
        </div>
        <div class="detail-box">
          <h4>${this.T("detail_carriage")}</h4>
          <p>${rule.sellerCarriage ? this.T("detail_carriage_seller_full") : this.T("detail_carriage_buyer_full")}</p>
        </div>
        <div class="detail-box">
          <h4>${this.T("detail_insurance")}</h4>
          <p>${rule.sellerInsurance ? this.T("detail_insure_seller_provides") + rule.insuranceNote : this.T("detail_insure_buyer_own")}</p>
        </div>
        <div class="detail-box">
          <h4>${this.T("detail_clearance")}</h4>
          <p>${this.T("detail_export")}: ${rule.exportClearance === "seller" ? this.T("detail_seller") : this.T("detail_buyer")} | ${this.T("detail_import")}: ${rule.importClearance === "seller" ? this.T("detail_seller") : this.T("detail_buyer")}</p>
        </div>
      </div>

      <div class="detail-costs">
        <div class="costs-col">
          <h4>${this.T("detail_seller_costs")}</h4>
          <ul>${sellerCostsHTML}</ul>
        </div>
        <div class="costs-col">
          <h4>${this.T("detail_buyer_costs")}</h4>
          <ul>${buyerCostsHTML}</ul>
        </div>
      </div>

      <div class="detail-articles">
        <h4>${this.T("detail_articles")}</h4>
        <div class="articles-table">${articlesHTML}</div>
      </div>

      <div class="detail-caution">
        <h4>${this.T("detail_caution")}</h4>
        <p>${this.RF(rule, "caution")}</p>
      </div>

      <div class="detail-suitable">
        <h4>${this.T("detail_suitable")}</h4>
        <p>${this.RF(rule, "suitableFor")}</p>
      </div>
    `;

    panel.classList.add("visible");
    panel.scrollIntoView({ behavior: "smooth" });
  },

  closeDetail() {
    const panel = document.getElementById("detail-panel");
    if (panel) panel.classList.remove("visible");
    this.selectedRule = null;
  },

  // ======================== 3. 对比功能 ========================
  toggleCompare(code) {
    const idx = this.compareSet.indexOf(code);
    if (idx >= 0) {
      this.compareSet.splice(idx, 1);
    } else {
      if (this.compareSet.length >= 3) {
        alert(this.T("compare_max"));
        return;
      }
      this.compareSet.push(code);
    }
    this.renderOverview(); // 更新卡片上的按钮文字
    this.renderCompareSection();
  },

  renderCompareSection() {
    const container = document.getElementById("compare-content");
    if (!container) return;

    if (this.compareSet.length === 0) {
      container.innerHTML = `
        <div class="compare-empty">
          <p>${this.T("compare_empty")}</p>
        </div>`;
      return;
    }

    const rules = this.compareSet.map(code => incotermsData.find(r => r.code === code)).filter(Boolean);

    const fields = [
      { label: this.T("compare_name_cn"), key: "nameCN" },
      { label: this.T("compare_name_en"), key: "name" },
      { label: this.T("compare_group"), key: "oldGroup" },
      { label: this.T("compare_mode"), key: "group", fmt: v => v === "any" ? this.T("compare_mode_any") : this.T("compare_mode_sea") },
      { label: this.T("compare_risk"), key: "riskPointCN" },
      { label: this.T("compare_carriage"), key: "sellerCarriage", fmt: v => v ? "✅" : "❌" },
      { label: this.T("compare_insurance"), key: "sellerInsurance", fmt: v => v ? "✅" : "❌" },
      { label: this.T("compare_export"), key: "exportClearance", fmt: v => v === "seller" ? this.T("detail_seller") : this.T("detail_buyer") },
      { label: this.T("compare_import"), key: "importClearance", fmt: v => v === "seller" ? this.T("detail_seller") : this.T("detail_buyer") },
      { label: this.T("compare_loading"), key: "loading", fmt: v => v === "seller" ? this.T("detail_seller") : this.T("detail_buyer") },
      { label: this.T("compare_unloading"), key: "unloading", fmt: v => v === "seller" ? this.T("detail_seller") : this.T("detail_buyer") },
    ];

    let tableHTML = `<table class="compare-table"><thead><tr><th>${this.T("compare_item")}</th>`;
    rules.forEach(r => {
      const color = r.oldGroup === "E" ? "var(--color-e)" : r.oldGroup === "F" ? "var(--color-f)" : r.oldGroup === "C" ? "var(--color-c)" : "var(--color-d)";
      tableHTML += `<th style="background:${color};color:#fff">${r.code}</th>`;
    });
    tableHTML += `<th>${this.T("compare_action")}</th></tr></thead><tbody>`;

    fields.forEach(f => {
      tableHTML += "<tr>";
      tableHTML += `<td class="field-label">${f.label}</td>`;
      rules.forEach(r => {
        let val = r[f.key];
        if (f.fmt) val = f.fmt(val);
        tableHTML += `<td>${val}</td>`;
      });
      tableHTML += `<td></td></tr>`;
    });

    // remove buttons row
    tableHTML += `<tr><td></td>`;
    rules.forEach(r => {
      tableHTML += `<td><button class="btn-remove-compare" data-code="${r.code}">${this.T("compare_remove")}</button></td>`;
    });
    tableHTML += `<td></td></tr>`;
    tableHTML += "</tbody></table>";

    container.innerHTML = tableHTML;

    // bind remove buttons
    container.querySelectorAll(".btn-remove-compare").forEach(btn => {
      btn.addEventListener("click", (e) => {
        this.toggleCompare(btn.dataset.code);
      });
    });
  },

  // ======================== 4. 决策向导 ========================
  wizardState: {
    step: 0,
    answers: {},
    questions: [],
    followUps: []
  },

  renderWizard() {
    const container = document.getElementById("wizard-content");
    if (!container) return;
    this.wizardState = { step: 0, answers: {}, questions: [], followUps: [] };

    container.innerHTML = `
      <div class="wizard-intro">
        <p>${this.T("wizard_intro")}</p>
        <button class="btn-start-wizard">${this.T("wizard_start")}</button>
      </div>
    `;

    container.querySelector(".btn-start-wizard").addEventListener("click", () => {
      this.startWizard();
    });
  },

  startWizard() {
    // 构建问题列表：前两个问题先问角色和运输
    this.wizardState.questions = ["role", "carriage"];
    this.wizardState.step = 0;
    this.wizardState.answers = {};
    this.wizardState.followUps = [];
    this.renderWizardStep();
  },

  renderWizardStep() {
    const container = document.getElementById("wizard-content");
    const state = this.wizardState;

    // 所有问题问完了？
    const allQuestions = [...state.questions];
    if (state.step >= allQuestions.length) {
      this.showWizardResult();
      return;
    }

    const qId = allQuestions[state.step];
    // 先从基础问题找，找不到再从额外问题找
    let q = wizardQuestions.find(q => q.id === qId);
    if (!q) q = extraQuestions[qId];
    if (!q) { this.showWizardResult(); return; }

    container.innerHTML = `
      <div class="wizard-progress">
        <div class="wizard-progress-bar">
          <div class="wizard-progress-fill" style="width:${((state.step) / (allQuestions.length)) * 100}%"></div>
        </div>
        <span class="wizard-step-text">${state.step + 1} / ${allQuestions.length}</span>
      </div>
      <div class="wizard-question">
        <h3>${this.WQ(q, "text")}</h3>
        ${q.description ? `<p class="wizard-desc">${this.WQ(q, "description")}</p>` : ""}
        <div class="wizard-options">
          ${q.options.map(opt => `
            <button class="wizard-option" data-value="${opt.value}">
              ${this.WQ(opt, "label")}
            </button>
          `).join("")}
        </div>
        ${state.step > 0 ? `<button class="btn-wizard-back">${this.T("wizard_back")}</button>` : ""}
      </div>
    `;

    container.querySelectorAll(".wizard-option").forEach(btn => {
      btn.addEventListener("click", () => {
        const value = btn.dataset.value;
        state.answers[qId] = value;

        // 每次选择后动态决定后续问题
        this.determineNextQuestions();

        // 如果有追问，插入到当前问题之后
        const nextQId = state.questions[state.step + 1];
        if (nextQId) {
          state.step++;
          this.renderWizardStep();
        } else {
          this.showWizardResult();
        }
      });
    });

    const backBtn = container.querySelector(".btn-wizard-back");
    if (backBtn) {
      backBtn.addEventListener("click", () => {
        if (state.step > 0) {
          state.step--;
          this.renderWizardStep();
        }
      });
    }
  },

  determineNextQuestions() {
    const state = this.wizardState;
    const answers = state.answers;
    const currentQuestions = [...state.questions];

    // 根据已选答案动态添加后续问题
    // 基础流程：role → carriage → risk → container → transportMode → insurance
    if (answers.role && !currentQuestions.includes("risk")) {
      currentQuestions.push("risk");
    }

    if (answers.risk === "shipment" && !currentQuestions.includes("container")) {
      currentQuestions.push("container");
    }

    if (answers.container && !currentQuestions.includes("transportMode") && answers.container === "no") {
      currentQuestions.push("transportMode");
    }

    // 当卖方安排运输 + 装运合同 → 问保险
    if (answers.carriage === "seller" && answers.risk === "shipment" && !currentQuestions.includes("insurance") && (answers.container || answers.transportMode)) {
      currentQuestions.push("insurance");
    }

    // 到达合同 → 问进口清关和卸货
    if (answers.carriage === "seller" && answers.risk === "arrival") {
      if (!currentQuestions.includes("importClearance")) currentQuestions.push("importClearance");
      if (answers.importClearance === "no" && !currentQuestions.includes("unload")) currentQuestions.push("unload");
    }

    // 买方安排运输 + 装运 → 问出口清关（区分 EXW vs FCA）
    if (answers.carriage === "buyer" && answers.risk === "shipment") {
      if (!currentQuestions.includes("exportClearance")) {
        currentQuestions.push("exportClearance");
      }
    }

    state.questions = currentQuestions;
  },

  showWizardResult() {
    const container = document.getElementById("wizard-content");
    const answers = this.wizardState.answers;

    // 补充默认值
    if (!answers.container) answers.container = "yes";
    if (!answers.transportMode) answers.transportMode = "multimodal";
    if (!answers.insurance) answers.insurance = "no";
    if (!answers.importClearance) answers.importClearance = "no";
    if (!answers.unload) answers.unload = "no";
    if (!answers.exportClearance) answers.exportClearance = "yes";

    const results = runWizard(answers);
    const rules = results.map(code => incotermsData.find(r => r.code === code)).filter(Boolean);

    container.innerHTML = `
      <div class="wizard-result">
        <h3>${this.T("wizard_result")}</h3>
        ${rules.length === 1 ? `<p>${this.T("wizard_result_single")}</p>` : `<p>${this.T("wizard_result_multi")}</p>`}
        <div class="wizard-result-cards">
          ${rules.map((r, i) => {
            const color = r.oldGroup === "E" ? "var(--color-e)" : r.oldGroup === "F" ? "var(--color-f)" : r.oldGroup === "C" ? "var(--color-c)" : "var(--color-d)";
            return `
              <div class="wizard-result-card" style="border-left: 6px solid ${color}" data-code="${r.code}">
                <span class="result-rank">${i + 1}</span>
                <div class="result-info">
                  <strong>${r.code}</strong> — ${this.RF(r, "name")}
                  <p>${this.RF(r, "summary")}</p>
                  <p class="result-risk">⚠ ${this.RF(r, "riskPoint")}</p>
                </div>
              </div>
            `;
          }).join("")}
        </div>
        <div class="wizard-result-actions">
          <button class="btn-wizard-restart">${this.T("wizard_restart")}</button>
        </div>
      </div>
    `;

    // 点击结果卡片查看详情
    container.querySelectorAll(".wizard-result-card").forEach(card => {
      card.addEventListener("click", () => {
        this.showDetail(card.dataset.code);
        document.querySelector('[data-tab="overview"]').click();
      });
    });

    container.querySelector(".btn-wizard-restart").addEventListener("click", () => {
      this.renderWizard();
    });
  },

  // ======================== 5. 运输链路 SVG 可视化 ========================
  transportSelected: ["EXW", "FCA", "FOB", "CIF", "DDP"], // 默认显示5条代表性规则

  renderTransportChain() {
    const container = document.getElementById("transport-content");
    if (!container) return;

    container.innerHTML = "";

    // 多选芯片组
    const chipBar = document.createElement("div");
    chipBar.className = "transport-chip-bar";

    const label = document.createElement("label");
    label.textContent = this.T("transport_label");
    chipBar.appendChild(label);

    const chipGroup = document.createElement("div");
    chipGroup.className = "transport-chip-group";

    const toggleAll = document.createElement("button");
    toggleAll.className = "transport-chip chip-toggle";
    toggleAll.textContent = this.T("transport_all");
    toggleAll.addEventListener("click", () => {
      // 如果已全选则清空，否则全选
      if (this.transportSelected.length === incotermsData.length) {
        this.transportSelected = [];
      } else {
        this.transportSelected = incotermsData.map(r => r.code);
      }
      this.renderTransportChain();
    });
    chipGroup.appendChild(toggleAll);

    incotermsData.forEach(r => {
      const chip = document.createElement("button");
      chip.className = "transport-chip";
      if (this.transportSelected.includes(r.code)) {
        chip.classList.add("active");
        const color = r.oldGroup === "E" ? "var(--color-e)" : r.oldGroup === "F" ? "var(--color-f)" : r.oldGroup === "C" ? "var(--color-c)" : "var(--color-d)";
        chip.style.borderColor = color;
        chip.style.background = color;
        chip.style.color = "#fff";
      }
      chip.textContent = r.code;
      chip.title = this.RF(r, "name");
      chip.addEventListener("click", () => {
        const idx = this.transportSelected.indexOf(r.code);
        if (idx >= 0) {
          this.transportSelected.splice(idx, 1);
        } else {
          this.transportSelected.push(r.code);
        }
        this.renderTransportChain();
      });
      chipGroup.appendChild(chip);
    });

    chipBar.appendChild(chipGroup);
    container.appendChild(chipBar);

    // SVG 画布
    const svgWrapper = document.createElement("div");
    svgWrapper.className = "transport-svg-wrapper";
    const selectedCodes = this.transportSelected.length > 0 ? this.transportSelected : ["EXW"]; // 至少保留一条
    svgWrapper.innerHTML = this.buildTransportSVG(selectedCodes);
    container.appendChild(svgWrapper);

    // 图例
    const legend = document.createElement("div");
    legend.className = "transport-legend";
    legend.innerHTML = `
      <span class="legend-item"><span class="legend-line seller-line"></span> ${this.T("transport_legend_seller")}</span>
      <span class="legend-item"><span class="legend-line buyer-line"></span> ${this.T("transport_legend_buyer")}</span>
      <span class="legend-item"><span class="legend-dot risk-dot"></span> ${this.T("transport_legend_risk")}</span>
      <span class="legend-item"><span class="legend-hatch"></span> ${this.T("transport_legend_split")}</span>
      <span class="legend-item" style="font-size:11px;margin-left:8px;opacity:0.7;">${this.T("transport_selected") + " " + selectedCodes.length + "/11"}</span>
    `;
    container.appendChild(legend);
  },

  buildTransportSVG(selectedCodes) {
    const nodes = [
      { id: "factory", label: this.T("transport_node_factory"), x: 50 },
      { id: "exportTerminal", label: this.T("transport_node_export"), x: 210 },
      { id: "portLoad", label: this.T("transport_node_load"), x: 370 },
      { id: "ship", label: this.T("transport_node_ship"), x: 530 },
      { id: "portDischarge", label: this.T("transport_node_discharge"), x: 690 },
      { id: "importTerminal", label: this.T("transport_node_import"), x: 850 },
      { id: "buyerWarehouse", label: this.T("transport_node_warehouse"), x: 1010 }
    ];

    const yTop = 80;

    // 每个规则的风险转移节点（映射到上面的 node id）
    const riskMap = {
      EXW: "factory",
      FCA: "exportTerminal",
      FAS: "portLoad",
      FOB: "portLoad",
      CFR: "portLoad",
      CIF: "portLoad",
      CPT: "exportTerminal",
      CIP: "exportTerminal",
      DAP: "buyerWarehouse",
      DPU: "buyerWarehouse",
      DDP: "buyerWarehouse"
    };

    // 每个规则的卖方费用终点（卖方承担运费至此节点）
    // C 组术语：风险与费用分离——卖方付运费到目的地，但风险在装运地已转移
    const costMap = {
      EXW: "factory",
      FCA: "exportTerminal",
      FAS: "portLoad",
      FOB: "portLoad",
      CFR: "portDischarge",
      CIF: "portDischarge",
      CPT: "importTerminal",
      CIP: "importTerminal",
      DAP: "buyerWarehouse",
      DPU: "buyerWarehouse",
      DDP: "buyerWarehouse"
    };

    const rules = selectedCodes.map(code => incotermsData.find(r => r.code === code)).filter(Boolean);
    const ruleHeight = Math.max(26, Math.min(38, 300 / rules.length));
    const yBottom = yTop + rules.length * ruleHeight + 50;
    const yMid = (yTop + yBottom) / 2;

    let svg = `<svg viewBox="0 0 1100 ${yBottom + 50}" class="transport-svg" xmlns="http://www.w3.org/2000/svg">`;

    // 定义：C 组术语的"卖方付运费但买方承担风险"区域斜线图案
    svg += `<defs>
      <pattern id="splitHatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="8" stroke="#c0392b" stroke-width="1.2" opacity="0.5"/>
      </pattern>
    </defs>`;

    // 背景
    svg += `<rect width="1100" height="${yBottom + 50}" fill="#f8f9fa" rx="8"/>`;

    // 运输线路（水平线）
    svg += `<line x1="50" y1="${yMid}" x2="1050" y2="${yMid}" stroke="#adb5bd" stroke-width="3" stroke-dasharray="8,4"/>`;

    // 节点圆点
    nodes.forEach(n => {
      svg += `<circle cx="${n.x}" cy="${yMid}" r="8" fill="#495057" stroke="#fff" stroke-width="2"/>`;
    });

    // 节点标签
    nodes.forEach(n => {
      const lines = n.label.split("\n");
      lines.forEach((line, i) => {
        svg += `<text x="${n.x}" y="${yMid + 22 + i * 14}" text-anchor="middle" font-size="11" fill="#495057">${line}</text>`;
      });
    });

    // 规则费用分段和风险转移点
    rules.forEach((rule, ruleIdx) => {
      const riskNodeId = riskMap[rule.code];
      const costNodeId = costMap[rule.code];
      const riskNode = nodes.find(n => n.id === riskNodeId);
      const costNode = nodes.find(n => n.id === costNodeId);
      const ruleY = yTop + ruleIdx * ruleHeight + 10;
      const color = rule.oldGroup === "E" ? "#e74c3c" : rule.oldGroup === "F" ? "#e67e22" : rule.oldGroup === "C" ? "#3498db" : "#27ae60";
      const riskX = riskNode ? riskNode.x : 50;
      const costX = costNode ? costNode.x : 50;

      // 卖方承担费用段（从起点到费用终点）
      svg += `<rect x="48" y="${ruleY}" width="${costX - 48}" height="${ruleHeight - 4}" fill="${color}" opacity="0.35" rx="3"/>`;

      // 买方承担费用段（从费用终点到终点）
      svg += `<rect x="${costX}" y="${ruleY}" width="${1050 - costX}" height="${ruleHeight - 4}" fill="#bdc3c7" opacity="0.35" rx="3"/>`;

      // C 组术语：风险在装运地转移，但卖方继续付运费至目的地
      // 斜线区 = "卖方承担运费，但买方承担风险"
      if (costX > riskX) {
        svg += `<rect x="${riskX}" y="${ruleY}" width="${costX - riskX}" height="${ruleHeight - 4}" fill="url(#splitHatch)" rx="2"/>`;
      }

      // 风险转移标记
      svg += `<line x1="${riskX}" y1="${ruleY - 3}" x2="${riskX}" y2="${ruleY + ruleHeight - 1}" stroke="#c0392b" stroke-width="2"/>`;
      svg += `<circle cx="${riskX}" cy="${ruleY + (ruleHeight - 4) / 2}" r="4" fill="#c0392b"/>`;

      // 规则名称
      svg += `<text x="42" y="${ruleY + (ruleHeight - 4) / 2 + 4}" text-anchor="end" font-size="10" font-weight="bold" fill="${color}">${rule.code}</text>`;
    });

    // 海运/主运输区域高亮
    const shipStart = nodes.find(n => n.id === "portLoad").x;
    const shipEnd = nodes.find(n => n.id === "portDischarge").x;
    svg += `<rect x="${shipStart}" y="${yMid - 3}" width="${shipEnd - shipStart}" height="6" fill="#3498db" opacity="0.2" rx="2"/>`;

    svg += "</svg>";
    return svg;
  }
};

// 初始化
document.addEventListener("DOMContentLoaded", () => {
  app.init();

  // 关闭详情
  const closeBtn = document.getElementById("detail-close");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => app.closeDetail());
  }
});
