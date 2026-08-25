/** 本地数据使用的存储键。 */
const STORAGE_KEYS = {
  /** 商品列表存储键。 */
  products: "manyouyisi-mini-products-v1",
  /** 订单列表存储键。 */
  orders: "manyouyisi-mini-orders-v1",
  /** 店铺装修存储键。 */
  settings: "manyouyisi-mini-settings-v1",
  /** 多收款方式存储键。 */
  paymentMethods: "manyouyisi-mini-payment-methods-v1",
  /** 购物车存储键。 */
  cart: "manyouyisi-mini-cart-v1",
};

/** 首次体验时展示的默认商品。 */
const DEFAULT_PRODUCTS = [
  {
    /** 商品唯一标识。 */
    id: "plain",
    /** 商品名称。 */
    name: "老面白馒头",
    /** 商品描述。 */
    description: "自然醒发，麦香柔软",
    /** 商品单价。 */
    price: 2,
    /** 商品计价单位。 */
    unit: "个",
    /** 商品分类。 */
    category: "经典",
    /** 当前库存。 */
    stock: 60,
    /** 商品角标。 */
    badge: "招牌",
    /** 是否在顾客端展示。 */
    available: true,
    /** 默认插画色调。 */
    tone: "wheat",
    /** 商家选择的本地商品图片。 */
    imagePath: "",
  },
  {
    /** 商品唯一标识。 */
    id: "corn",
    /** 商品名称。 */
    name: "玉米面馒头",
    /** 商品描述。 */
    description: "细腻清甜，粗粮好味",
    /** 商品单价。 */
    price: 2.5,
    /** 商品计价单位。 */
    unit: "个",
    /** 商品分类。 */
    category: "粗粮",
    /** 当前库存。 */
    stock: 38,
    /** 商品角标。 */
    badge: "人气",
    /** 是否在顾客端展示。 */
    available: true,
    /** 默认插画色调。 */
    tone: "corn",
    /** 商家选择的本地商品图片。 */
    imagePath: "",
  },
  {
    /** 商品唯一标识。 */
    id: "purple",
    /** 商品名称。 */
    name: "紫薯开花馒头",
    /** 商品描述。 */
    description: "真紫薯泥，松软微甜",
    /** 商品单价。 */
    price: 3.5,
    /** 商品计价单位。 */
    unit: "个",
    /** 商品分类。 */
    category: "甜味",
    /** 当前库存。 */
    stock: 24,
    /** 商品角标。 */
    badge: "",
    /** 是否在顾客端展示。 */
    available: true,
    /** 默认插画色调。 */
    tone: "purple",
    /** 商家选择的本地商品图片。 */
    imagePath: "",
  },
  {
    /** 商品唯一标识。 */
    id: "brown-sugar",
    /** 商品名称。 */
    name: "红糖馒头",
    /** 商品描述。 */
    description: "古法红糖，温润回甜",
    /** 商品单价。 */
    price: 3,
    /** 商品计价单位。 */
    unit: "个",
    /** 商品分类。 */
    category: "甜味",
    /** 当前库存。 */
    stock: 30,
    /** 商品角标。 */
    badge: "",
    /** 是否在顾客端展示。 */
    available: true,
    /** 默认插画色调。 */
    tone: "brown",
    /** 商家选择的本地商品图片。 */
    imagePath: "",
  },
];

/** 首次体验时展示的默认店铺装修。 */
const DEFAULT_SETTINGS = {
  /** 顶部圆形标记文字。 */
  brandMark: "馒",
  /** 店铺名称。 */
  brandName: "馒有意思",
  /** 店铺名称下方说明。 */
  brandTagline: "每日现蒸 · 预约不等",
  /** 主视觉小标签。 */
  heroBadge: "老面慢发酵 · 不加改良剂",
  /** 主视觉大标题。 */
  heroTitle: "每天现蒸，\n把柔软送到家",
  /** 主视觉介绍。 */
  heroDescription: "清晨和面、自然醒发、按单现蒸。今晚预约，明早不排队，热乎乎的麦香刚刚好。",
  /** 主视觉按钮文字。 */
  heroButtonText: "看看今日馒头",
  /** 配送与优惠提示。 */
  deliveryNote: "本店 3km 内配送 · 15元起送 · 配送费3元 · 满30元免配送费",
  /** 商家选择的本地主视觉背景。 */
  heroBackgroundPath: "",
};

/** 首次体验时使用的收款方式列表，默认留空避免展示无效二维码。 */
const DEFAULT_PAYMENT_METHODS = [];

/** 深拷贝可序列化的本地演示数据。 */
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/** 在首次打开时写入默认数据，避免覆盖用户已经修改的内容。 */
function ensureSeedData() {
  if (!wx.getStorageSync(STORAGE_KEYS.products)) {
    wx.setStorageSync(STORAGE_KEYS.products, clone(DEFAULT_PRODUCTS));
  }
  if (!wx.getStorageSync(STORAGE_KEYS.orders)) {
    wx.setStorageSync(STORAGE_KEYS.orders, []);
  }
  if (!wx.getStorageSync(STORAGE_KEYS.settings)) {
    wx.setStorageSync(STORAGE_KEYS.settings, clone(DEFAULT_SETTINGS));
  }
  if (!wx.getStorageSync(STORAGE_KEYS.paymentMethods)) {
    wx.setStorageSync(STORAGE_KEYS.paymentMethods, clone(DEFAULT_PAYMENT_METHODS));
  }
  if (!wx.getStorageSync(STORAGE_KEYS.cart)) {
    wx.setStorageSync(STORAGE_KEYS.cart, {});
  }
}

/** 读取本地商品列表。 */
function getProducts() {
  return clone(wx.getStorageSync(STORAGE_KEYS.products) || DEFAULT_PRODUCTS);
}

/** 保存本地商品列表。 */
function saveProducts(products) {
  wx.setStorageSync(STORAGE_KEYS.products, clone(products));
}

/** 读取指定商品。 */
function getProductById(productId) {
  return getProducts().find((product) => product.id === productId) || null;
}

/** 新增或更新一件商品。 */
function upsertProduct(product) {
  const products = getProducts();
  const index = products.findIndex((item) => item.id === product.id);
  if (index >= 0) {
    products[index] = clone(product);
  } else {
    products.unshift(clone(product));
  }
  saveProducts(products);
}

/** 将历史订单补齐为短号、金额明细和双状态结构。 */
function normalizeOrder(order) {
  const legacyStatus = order.status || "new";
  const statusMap = {
    /** 历史新订单映射为待接单。 */
    new: "pending",
    /** 制作中保持不变。 */
    preparing: "preparing",
    /** 待取货保持不变。 */
    ready: "ready",
    /** 历史配送中订单的制作状态映射为待配送。 */
    delivering: "ready",
    /** 历史完成订单映射为已完成。 */
    done: "completed",
    /** 新制作状态保持不变。 */
    pending: "pending",
    /** 新完成状态保持不变。 */
    completed: "completed",
    /** 新取消状态保持不变。 */
    cancelled: "cancelled",
  };
  const fulfillment = order.fulfillment || order.orderType || "pickup";
  const deliveryFee = Number(order.deliveryFee ?? (fulfillment === "delivery" ? 3 : 0));
  return {
    ...order,
    /** A/D 三位短订单号。 */
    shortCode: order.shortCode || (fulfillment === "delivery" ? "D" : "A") + String(order.id).slice(-3).padStart(3, "0"),
    /** 商品金额。 */
    subtotal: Number(order.subtotal ?? Math.max(0, Number(order.total) - deliveryFee)),
    /** 配送费。 */
    deliveryFee,
    /** 统一取餐方式字段。 */
    fulfillment,
    /** 可配送区域。 */
    deliveryArea: order.deliveryArea || "",
    /** 楼栋和门牌号。 */
    doorNumber: order.doorNumber || order.address || "",
    /** 预计送达时间。 */
    deliveryTime: order.deliveryTime || (fulfillment === "delivery" ? order.pickupTime || "" : ""),
    /** 新制作状态。 */
    status: statusMap[legacyStatus] || "pending",
    /** 新配送进度。 */
    deliveryStatus: order.deliveryStatus || (legacyStatus === "delivering" ? "delivering" : legacyStatus === "done" ? "delivered" : "waiting"),
  };
}

/** 读取并兼容升级本地订单列表。 */
function getOrders() {
  return clone(wx.getStorageSync(STORAGE_KEYS.orders) || []).map(normalizeOrder);
}

/** 保存本地订单列表。 */
function saveOrders(orders) {
  wx.setStorageSync(STORAGE_KEYS.orders, clone(orders));
}

/** 读取店铺装修设置，并只迁移历史默认配送提示。 */
function getSettings() {
  const settings = clone(wx.getStorageSync(STORAGE_KEYS.settings) || DEFAULT_SETTINGS);
  if (settings.deliveryNote === "满 20 元可配送 · 配送费 3 元") {
    settings.deliveryNote = DEFAULT_SETTINGS.deliveryNote;
  }
  return settings;
}

/** 保存店铺装修设置。 */
function saveSettings(settings) {
  wx.setStorageSync(STORAGE_KEYS.settings, clone(settings));
}

/** 读取本机保存的多收款方式列表。 */
function getPaymentMethods() {
  return clone(wx.getStorageSync(STORAGE_KEYS.paymentMethods) || DEFAULT_PAYMENT_METHODS);
}

/** 保存本机多收款方式列表。 */
function savePaymentMethods(paymentMethods) {
  wx.setStorageSync(STORAGE_KEYS.paymentMethods, clone(paymentMethods));
}

/** 读取本地购物车。 */
function getCart() {
  return clone(wx.getStorageSync(STORAGE_KEYS.cart) || {});
}

/** 保存本地购物车。 */
function saveCart(cart) {
  wx.setStorageSync(STORAGE_KEYS.cart, clone(cart));
}

/** 恢复默认商品、订单、店铺装修、收款方式和购物车。 */
function resetDemoData() {
  wx.setStorageSync(STORAGE_KEYS.products, clone(DEFAULT_PRODUCTS));
  wx.setStorageSync(STORAGE_KEYS.orders, []);
  wx.setStorageSync(STORAGE_KEYS.settings, clone(DEFAULT_SETTINGS));
  wx.setStorageSync(STORAGE_KEYS.paymentMethods, clone(DEFAULT_PAYMENT_METHODS));
  wx.setStorageSync(STORAGE_KEYS.cart, {});
}

/** 生成便于演示和人工识别的短订单编号。 */
function createOrderId() {
  const now = new Date();
  const parts = [
    now.getMonth() + 1,
    now.getDate(),
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
  ];
  return parts.map((value) => String(value).padStart(2, "0")).join("");
}

/** 将金额格式化为人民币展示文本。 */
function formatMoney(value) {
  const number = Number(value) || 0;
  return `¥${number % 1 === 0 ? number.toFixed(0) : number.toFixed(1)}`;
}

/** 将日期时间格式化为简洁的中文展示文本。 */
function formatDateTime(value) {
  const date = new Date(value);
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 根据商品分类返回默认插画色调。 */
function getToneForCategory(category) {
  if (category === "粗粮") return "green";
  if (category === "甜味") return "brown";
  return "wheat";
}

module.exports = {
  DEFAULT_PAYMENT_METHODS,
  DEFAULT_PRODUCTS,
  DEFAULT_SETTINGS,
  createOrderId,
  ensureSeedData,
  formatDateTime,
  formatMoney,
  getCart,
  getOrders,
  getPaymentMethods,
  getProductById,
  getProducts,
  getSettings,
  getToneForCategory,
  resetDemoData,
  saveCart,
  saveOrders,
  savePaymentMethods,
  saveProducts,
  saveSettings,
  upsertProduct,
};
