/**
 * 智能决策向导 — 参考 ICC Incoterms® 2020 Checklist 流程图
 * 引导用户通过 5-6 步问答，推荐最合适的 Incoterms 规则
 */

const wizardQuestions = [
  {
    id: "role",
    text: "您是贸易中的哪一方？",
    textEN: "Which party are you in the trade?",
    options: [
      { value: "seller", label: "我是卖方 / 出口商", labelEN: "I am the Seller / Exporter" },
      { value: "buyer", label: "我是买方 / 进口商", labelEN: "I am the Buyer / Importer" }
    ]
  },
  {
    id: "carriage",
    text: "谁负责安排并支付主运输（国际运输）？",
    textEN: "Who will arrange and pay for the main (international) carriage?",
    options: [
      { value: "seller", label: "卖方安排并支付运费", labelEN: "Seller arranges and pays freight" },
      { value: "buyer", label: "买方安排并支付运费", labelEN: "Buyer arranges and pays freight" }
    ]
  },
  {
    id: "risk",
    text: "您希望运输风险在哪个阶段转移？",
    textEN: "At which stage do you want transport risk to transfer?",
    description: "装运时转移 = 风险在卖方国家转移给买方；到达时转移 = 卖方承担全程运输风险",
    descriptionEN: "Shipment = risk transfers in seller's country; Arrival = seller bears risk throughout",
    options: [
      { value: "shipment", label: "装运时转移（卖方国家）", labelEN: "On shipment (in seller's country)" },
      { value: "arrival", label: "到达目的地后转移", labelEN: "On arrival at destination" }
    ]
  },
  {
    id: "container",
    text: "货物是否使用集装箱运输？",
    textEN: "Are the goods shipped in containers?",
    options: [
      { value: "yes", label: "是，集装箱运输", labelEN: "Yes, containerized" },
      { value: "no", label: "否，散货/件杂货", labelEN: "No, bulk / break-bulk" }
    ]
  },
  {
    id: "transportMode",
    text: "货物运输方式是什么？",
    textEN: "What is the mode of transport?",
    options: [
      { value: "sea", label: "纯海运（或内河水运）", labelEN: "Sea or inland waterway only" },
      { value: "multimodal", label: "多种运输方式（含陆运、空运、铁路等）", labelEN: "Multiple modes (road, rail, air, etc.)" }
    ]
  },
  {
    id: "insurance",
    text: "是否需要卖方办理运输保险并包含在报价中？",
    textEN: "Should the seller include transport insurance in the price?",
    options: [
      { value: "yes", label: "是，卖方办理保险", labelEN: "Yes, seller provides insurance" },
      { value: "no", label: "否，买方自行决定", labelEN: "No, buyer's own concern" }
    ]
  }
];

// 额外问题（仅卖方或特定场景）
const extraQuestions = {
  importClearance: {
    id: "importClearance",
    text: "卖方是否能在目的国办理进口清关？",
    textEN: "Can the seller handle import clearance in the destination country?",
    options: [
      { value: "yes", label: "是，卖方可以办理进口清关", labelEN: "Yes, seller can handle import clearance" },
      { value: "no", label: "否，卖方无法办理进口清关", labelEN: "No, seller cannot handle import clearance" }
    ]
  },
  unload: {
    id: "unload",
    text: "卖方是否需要在目的地将货物从运输工具上卸下？",
    textEN: "Does the seller need to unload goods at destination?",
    options: [
      { value: "yes", label: "是，卖方负责卸货", labelEN: "Yes, seller will unload" },
      { value: "no", label: "否，买方负责卸货", labelEN: "No, buyer will unload" }
    ]
  },
  exportClearance: {
    id: "exportClearance",
    text: "卖方是否愿意/能够办理出口清关？",
    textEN: "Is the seller willing/able to handle export clearance?",
    options: [
      { value: "yes", label: "是，卖方办理出口清关", labelEN: "Yes, seller handles export clearance" },
      { value: "no", label: "否，卖方不办理出口清关", labelEN: "No, seller does not handle export clearance" }
    ]
  }
};

/**
 * 核心决策引擎
 * @param {Object} answers — { role, carriage, risk, container, transportMode, insurance, importClearance?, unload?, exportClearance? }
 * @returns {string[]} 推荐规则代码数组（按优先级排序）
 */
function runWizard(answers) {
  const { role, carriage, risk, container, transportMode, insurance, importClearance, unload, exportClearance } = answers;

  // 卖方视角
  if (role === "seller") {
    // E 组：卖方不做出口清关 → EXW
    if (carriage === "buyer" && exportClearance === "no") {
      return ["EXW"];
    }

    // F 组：买方安排主运输，装运时转移风险
    if (carriage === "buyer" && risk === "shipment") {
      if (container === "yes" || transportMode === "multimodal") {
        return ["FCA"];
      }
      if (transportMode === "sea") {
        return ["FAS", "FOB"];
      }
      return ["FCA"];
    }

    // C 组：卖方安排主运输，装运时转移风险
    if (carriage === "seller" && risk === "shipment") {
      if (container === "yes" || transportMode === "multimodal") {
        if (insurance === "yes") return ["CIP"];
        return ["CPT"];
      }
      if (transportMode === "sea") {
        if (insurance === "yes") return ["CIF"];
        return ["CFR"];
      }
      // 默认多式
      if (insurance === "yes") return ["CIP"];
      return ["CPT"];
    }

    // D 组：卖方安排主运输，到达时转移风险
    if (carriage === "seller" && risk === "arrival") {
      if (importClearance === "yes") return ["DDP"];
      if (unload === "yes") return ["DPU"];
      return ["DAP"];
    }
  }

  // 买方视角
  if (role === "buyer") {
    // E 组：买方承担全部 → EXW
    if (carriage === "buyer" && risk === "shipment" && exportClearance === "yes") {
      return ["EXW"];
    }

    // F 组：买方安排主运输，装运时转移风险
    if (carriage === "buyer" && risk === "shipment") {
      if (container === "yes" || transportMode === "multimodal") {
        return ["FCA"];
      }
      if (transportMode === "sea") {
        return ["FAS", "FOB"];
      }
      return ["FCA"];
    }

    // C 组：卖方安排主运输，装运时转移风险
    if (carriage === "seller" && risk === "shipment") {
      if (container === "yes" || transportMode === "multimodal") {
        if (insurance === "yes") return ["CIP"];
        return ["CPT"];
      }
      if (transportMode === "sea") {
        if (insurance === "yes") return ["CIF"];
        return ["CFR"];
      }
      if (insurance === "yes") return ["CIP"];
      return ["CPT"];
    }

    // D 组：卖方安排主运输，到达后转移
    if (carriage === "seller" && risk === "arrival") {
      if (importClearance === "yes") return ["DDP"];
      if (unload === "yes") return ["DPU"];
      return ["DAP"];
    }
  }

  // Fallback: 无确切匹配，返回常见规则
  return ["FCA", "CIP"];
}

/**
 * 根据答案返回需要追问的额外问题
 */
function getFollowUpQuestions(answers) {
  const extra = [];
  const { role, carriage, risk, container, transportMode } = answers;

  if (role === "seller") {
    // 卖方 + 买方安排运输 → 问出口清关（区分 EXW vs FCA）
    if (carriage === "buyer" && risk === "shipment" && container === "no" && transportMode !== "sea") {
      extra.push("exportClearance");
    }

    // 卖方 + 自己安排运输 + 装运时转移 → 问保险
    if (carriage === "seller" && risk === "shipment") {
      extra.push("insurance");
      return extra; // 保险是最后的问题
    }

    // 到达时转移 → 问进口清关和卸货
    if (carriage === "seller" && risk === "arrival") {
      extra.push("importClearance");
      extra.push("unload");
    }
  }

  if (role === "buyer") {
    // 买家视角同样逻辑
    if (carriage === "buyer" && risk === "shipment") {
      // 买方承担一切 → 是否也承担出口清关 → EXW
      extra.push("exportClearance");
    }
    if (carriage === "seller" && risk === "shipment") {
      extra.push("insurance");
      return extra;
    }
    if (carriage === "seller" && risk === "arrival") {
      extra.push("importClearance");
      extra.push("unload");
    }
  }

  return extra;
}

// 导出到全局
window.wizardQuestions = wizardQuestions;
window.extraQuestions = extraQuestions;
window.runWizard = runWizard;
window.getFollowUpQuestions = getFollowUpQuestions;
