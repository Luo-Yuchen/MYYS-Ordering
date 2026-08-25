const cloudbase = require("@cloudbase/node-sdk");
const crypto = require("crypto");

/** 当前云函数所在的 CloudBase 环境。 */
const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });

/** CloudBase 云数据库实例。 */
const db = app.database();

/** CloudBase 数据库指令集合。 */
const command = db.command;

/** 第一版允许配送的 3km 内区域。 */
const DELIVERY_AREAS = ["幸福小区", "阳光花园", "麦香公寓", "邻里写字楼"];

/** 配送订单最低商品金额。 */
const DELIVERY_MINIMUM = 15;

/** 固定配送费。 */
const DELIVERY_FEE = 3;

/** 免配送费的商品金额门槛。 */
const FREE_DELIVERY_THRESHOLD = 30;

/** 云端业务集合名称。 */
const COLLECTIONS = ["products", "orders", "store_settings", "payment_methods", "order_counters"];

/** 初次部署时写入云数据库的默认商品。 */
const DEFAULT_PRODUCTS = [
  { id: "plain", name: "老面白馒头", description: "自然醒发，麦香柔软", price: 2, unit: "个", category: "经典", stock: 60, badge: "招牌", tone: "wheat", available: true, sortOrder: 0 },
  { id: "corn", name: "玉米面馒头", description: "细腻清甜，粗粮好味", price: 2.5, unit: "个", category: "粗粮", stock: 38, badge: "人气", tone: "corn", available: true, sortOrder: 1 },
  { id: "purple", name: "紫薯开花馒头", description: "真紫薯泥，松软微甜", price: 3.5, unit: "个", category: "甜味", stock: 24, badge: "", tone: "purple", available: true, sortOrder: 2 },
  { id: "brown-sugar", name: "红糖馒头", description: "古法红糖，温润回甘", price: 3, unit: "个", category: "甜味", stock: 30, badge: "", tone: "brown", available: true, sortOrder: 3 },
  { id: "jujube", name: "红枣馒头", description: "枣肉看得见，香甜不腻", price: 4, unit: "个", category: "甜味", stock: 18, badge: "新品", tone: "jujube", available: true, sortOrder: 4 },
  { id: "wholegrain", name: "全麦杂粮馒头", description: "麦麸谷物，饱腹扎实", price: 3, unit: "个", category: "粗粮", stock: 26, badge: "", tone: "green", available: true, sortOrder: 5 },
];

/** 初次部署时写入云数据库的默认店铺设置。 */
const DEFAULT_STORE_SETTINGS = {
  brandMark: "馒",
  brandName: "馒有意思",
  brandTagline: "每日现蒸 · 预约不等",
  heroBadge: "老面慢发酵 · 不加改良剂",
  heroTitle: "每天现蒸，\n把柔软送到家",
  heroDescription: "清晨和面、自然醒发、按单现蒸。今晚预约，明早不排队，热乎乎的麦香刚刚好。",
  heroButtonText: "看看今日馒头",
  deliveryNote: "本店 3km 内配送 · 15元起送 · 配送费3元 · 满30元免配送费",
  heroBackgroundFileId: "",
};

/** 带公开状态码的业务错误。 */
class BusinessError extends Error {
  /** 创建一个可直接返回给两端的业务错误。 */
  constructor(message, statusCode = 400) {
    super(message);
    /** HTTP 访问服务使用的状态码。 */
    this.statusCode = statusCode;
  }
}

/** 判断集合已存在错误，首次初始化时可安全忽略。 */
function isCollectionExistsError(error) {
  const message = String(error && (error.message || error.errMsg || error));
  return /exist|already|DATABASE_COLLECTION_EXIST/i.test(message);
}

/** 创建业务集合；已经存在时不重复报错。 */
async function ensureCollection(name) {
  try {
    await db.createCollection(name);
  } catch (error) {
    if (!isCollectionExistsError(error)) throw error;
  }
}

/** 首次调用时创建集合并写入默认商品和店铺设置。 */
async function ensureSeedData() {
  await Promise.all(COLLECTIONS.map((name) => ensureCollection(name)));
  const productResult = await db.collection("products").limit(1).get();
  if (productResult.data.length === 0) {
    // 默认商品使用稳定文档编号，后续编辑不会破坏历史订单关联。
    await Promise.all(DEFAULT_PRODUCTS.map((product) => db.collection("products").doc(product.id).set({
      data: { ...product, imageFileId: "", createdAt: new Date(), updatedAt: new Date() },
    })));
  }
  const settingsResult = await db.collection("store_settings").doc("default").get().catch(() => ({ data: [] }));
  if (!settingsResult.data || settingsResult.data.length === 0) {
    await db.collection("store_settings").doc("default").set({ data: { ...DEFAULT_STORE_SETTINGS, updatedAt: new Date() } });
  }
}

/** 使用固定时长比较管理口令，降低响应时长泄露风险。 */
function isAdminKeyValid(value) {
  const expected = process.env.ADMIN_ACCESS_KEY || "";
  if (!value || !expected || expected.startsWith("请部署后") || value.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= value.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

/** 校验商家管理口令，不通过时终止管理动作。 */
function requireAdmin(payload) {
  if (!isAdminKeyValid(String(payload.adminKey || ""))) {
    throw new BusinessError("商家管理口令错误或尚未配置", 403);
  }
}

/** 将 CloudBase 日期或 ISO 字符串统一转换成前端可用时间。 */
function toIsoDate(value) {
  if (!value) return new Date().toISOString();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

/** 将 CloudBase 商品记录转换成网页与小程序共用结构。 */
function mapProduct(product, fileUrls) {
  return {
    id: product._id || product.id,
    name: product.name,
    description: product.description,
    price: Number(product.price),
    unit: product.unit,
    category: product.category,
    stock: Number(product.stock),
    badge: product.badge || undefined,
    imageUrl: fileUrls[product.imageFileId] || "",
    imageFileId: product.imageFileId || "",
    tone: product.tone || "wheat",
    available: product.available !== false,
  };
}

/** 为云存储文件编号生成临时 HTTPS 访问地址。 */
async function getFileUrlMap(fileIds) {
  const uniqueFileIds = [...new Set(fileIds.filter((fileId) => typeof fileId === "string" && fileId.startsWith("cloud://")))];
  if (uniqueFileIds.length === 0) return {};
  const result = await app.getTempFileURL({ fileList: uniqueFileIds });
  return Object.fromEntries((result.fileList || []).map((item) => [item.fileID, item.tempFileURL || item.download_url || ""]));
}

/** 读取商品、店铺设置和收款方式；商家可读取已下架商品及停用收款码。 */
async function getStore(payload) {
  const providedAdminKey = String(payload.adminKey || "");
  const isAdmin = isAdminKeyValid(providedAdminKey);
  if (providedAdminKey && !isAdmin) throw new BusinessError("商家管理口令错误", 403);
  const [productResult, settingsResult, paymentResult] = await Promise.all([
    db.collection("products").get(),
    db.collection("store_settings").doc("default").get(),
    db.collection("payment_methods").get(),
  ]);
  const settings = settingsResult.data && settingsResult.data[0] ? settingsResult.data[0] : DEFAULT_STORE_SETTINGS;
  const fileUrls = await getFileUrlMap([
    ...productResult.data.map((product) => product.imageFileId),
    settings.heroBackgroundFileId,
  ]);
  const products = productResult.data
    .filter((product) => isAdmin || product.available !== false)
    .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0))
    .map((product) => mapProduct(product, fileUrls));
  const paymentMethods = paymentResult.data
    .filter((method) => isAdmin || method.enabled !== false)
    .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0))
    .map((method) => ({
      id: method._id,
      name: method.name,
      payeeName: method.payeeName,
      qrCodeUrl: method.qrCodeUrl,
      note: method.note || "",
      enabled: method.enabled !== false,
    }));
  const primaryPayment = paymentMethods.find((method) => method.enabled) || paymentMethods[0];
  return {
    products,
    settings: {
      brandMark: settings.brandMark,
      brandName: settings.brandName,
      brandTagline: settings.brandTagline,
      heroBadge: settings.heroBadge,
      heroTitle: settings.heroTitle,
      heroDescription: settings.heroDescription,
      heroButtonText: settings.heroButtonText,
      deliveryNote: settings.deliveryNote,
      heroBackgroundImage: fileUrls[settings.heroBackgroundFileId] || "",
      heroBackgroundFileId: settings.heroBackgroundFileId || "",
    },
    paymentMethods,
    payment: {
      qrCodeUrl: primaryPayment ? primaryPayment.qrCodeUrl : "",
      payeeName: primaryPayment ? primaryPayment.payeeName : "商家",
      instructions: primaryPayment ? primaryPayment.note : "扫码付款时请备注订单号，付款后点击“我已付款”。",
    },
    miniProgram: { entryUrl: "", qrCodeUrl: "" },
  };
}

/** 将云数据库订单转换为两端共用结构。 */
function mapOrder(order, includeToken = true) {
  return {
    id: order._id,
    shortCode: order.shortCode,
    createdAt: toIsoDate(order.createdAt),
    items: Array.isArray(order.items) ? order.items : [],
    subtotal: Number(order.subtotal),
    deliveryFee: Number(order.deliveryFee),
    total: Number(order.total),
    fulfillment: order.orderType,
    customerName: order.customerName,
    phone: order.phone,
    address: order.address || "",
    deliveryArea: order.deliveryArea || "",
    doorNumber: order.doorNumber || "",
    pickupDay: order.pickupDay || "",
    pickupTime: order.pickupTime || "",
    deliveryTime: order.deliveryTime || "",
    note: order.remark || "",
    status: order.status || "pending",
    deliveryStatus: order.deliveryStatus || "waiting",
    paymentStatus: order.paymentStatus || "pending",
    paymentReference: order.paymentReference || "",
    paymentMethodId: order.paymentMethodId || "",
    accessToken: includeToken ? order.accessToken : undefined,
  };
}

/** 读取顾客令牌对应订单，或在管理口令通过时读取全部订单。 */
async function getOrders(payload) {
  const providedAdminKey = String(payload.adminKey || "");
  const isAdmin = isAdminKeyValid(providedAdminKey);
  if (providedAdminKey && !isAdmin) throw new BusinessError("商家管理口令错误", 403);
  const tokens = Array.isArray(payload.tokens)
    ? payload.tokens.map((token) => String(token)).filter((token) => /^[a-f0-9]{48}$/.test(token)).slice(0, 30)
    : [];
  if (!isAdmin && tokens.length === 0) return { orders: [] };
  let rows = [];
  if (isAdmin) {
    const result = await db.collection("orders").limit(200).get();
    rows = result.data;
  } else {
    // CloudBase in 查询按十个令牌分批执行，兼容同一设备保存较多历史订单。
    const chunks = [];
    for (let index = 0; index < tokens.length; index += 10) chunks.push(tokens.slice(index, index + 10));
    const results = await Promise.all(chunks.map((chunk) => db.collection("orders").where({ accessToken: command.in(chunk) }).limit(30).get()));
    rows = results.flatMap((result) => result.data);
  }
  rows.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  return { orders: rows.slice(0, isAdmin ? 200 : 30).map((order) => mapOrder(order, true)) };
}

/** 在事务内生成当天连续的 A/D 三位短订单号。 */
async function getNextShortCode(transaction, orderType, now) {
  const prefix = orderType === "delivery" ? "D" : "A";
  const dateKey = now.toISOString().slice(0, 10).replace(/-/g, "");
  const counterId = `${dateKey}-${prefix}`;
  const counterReference = transaction.collection("order_counters").doc(counterId);
  const counterResult = await counterReference.get().catch(() => ({ data: [] }));
  const current = counterResult.data && counterResult.data[0] ? Number(counterResult.data[0].value) : 0;
  const next = current >= 999 ? 1 : current + 1;
  await counterReference.set({ data: { value: next, updatedAt: now } });
  return prefix + String(next).padStart(3, "0");
}

/** 校验下单资料并在云数据库事务中扣减库存、生成订单。 */
async function createOrder(payload) {
  const requestedItems = Array.isArray(payload.items) ? payload.items : [];
  const items = requestedItems.filter((item) => (
    item && typeof item.productId === "string" && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 99
  ));
  const orderType = payload.orderType === "delivery" ? "delivery" : "pickup";
  const customerName = String(payload.customerName || "").trim().slice(0, 40);
  const phone = String(payload.phone || "").trim();
  const deliveryArea = String(payload.deliveryArea || "").trim();
  const doorNumber = String(payload.doorNumber || "").trim().slice(0, 120);
  const pickupDay = String(payload.pickupDay || "").trim().slice(0, 20);
  const pickupTime = String(payload.pickupTime || "").trim().slice(0, 30);
  const deliveryTime = String(payload.deliveryTime || "").trim().slice(0, 30);
  const remark = String(payload.remark || "").trim().slice(0, 200);
  if (items.length === 0 || new Set(items.map((item) => item.productId)).size !== items.length || !customerName || !/^1\d{10}$/.test(phone)) {
    throw new BusinessError("请检查商品、姓名和手机号");
  }
  if (orderType === "pickup" && !pickupTime) throw new BusinessError("请选择预计取餐时间");
  if (orderType === "delivery" && (!DELIVERY_AREAS.includes(deliveryArea) || !doorNumber || !deliveryTime)) {
    throw new BusinessError("请选择 3km 内配送区域，并填写门牌号和送达时间");
  }

  const now = new Date();
  const orderId = `order-${now.getTime()}-${crypto.randomBytes(4).toString("hex")}`;
  const accessToken = crypto.randomBytes(24).toString("hex");
  const createdOrder = await db.runTransaction(async (transaction) => {
    const productResults = await Promise.all(items.map((item) => transaction.collection("products").doc(item.productId).get()));
    const productMap = Object.fromEntries(productResults.flatMap((result) => result.data || []).map((product) => [product._id, product]));
    const orderItems = items.map((item) => {
      const product = productMap[item.productId];
      if (!product || product.available === false) throw new BusinessError("部分商品已下架，请重新选择");
      if (Number(product.stock) < item.quantity) throw new BusinessError(`${product.name} 库存不足`);
      return {
        productId: product._id,
        name: product.name,
        quantity: item.quantity,
        unit: product.unit,
        price: Number(product.price),
      };
    });
    const subtotal = Number(orderItems.reduce((total, item) => total + item.price * item.quantity, 0).toFixed(2));
    if (orderType === "delivery" && subtotal < DELIVERY_MINIMUM) throw new BusinessError("配送订单满15元起送");
    const deliveryFee = orderType === "delivery" && subtotal < FREE_DELIVERY_THRESHOLD ? DELIVERY_FEE : 0;
    const total = Number((subtotal + deliveryFee).toFixed(2));
    const shortCode = await getNextShortCode(transaction, orderType, now);
    // 库存与订单在同一事务写入，任一环节失败都会整体回滚。
    await Promise.all(orderItems.map((item) => transaction.collection("products").doc(item.productId).update({
      data: { stock: command.inc(-item.quantity), updatedAt: now },
    })));
    const order = {
      shortCode,
      accessToken,
      items: orderItems,
      subtotal,
      deliveryFee,
      total,
      orderType,
      customerName,
      phone,
      address: orderType === "delivery" ? `${deliveryArea} ${doorNumber}` : "",
      deliveryArea: orderType === "delivery" ? deliveryArea : "",
      doorNumber: orderType === "delivery" ? doorNumber : "",
      pickupDay,
      pickupTime: orderType === "pickup" ? pickupTime : "",
      deliveryTime: orderType === "delivery" ? deliveryTime : "",
      remark,
      status: "pending",
      deliveryStatus: "waiting",
      paymentStatus: "pending",
      paymentReference: "",
      paymentMethodId: "",
      createdAt: now,
      updatedAt: now,
    };
    await transaction.collection("orders").doc(orderId).set({ data: order });
    return { id: orderId, ...order };
  });
  return mapOrder({ _id: orderId, ...createdOrder }, true);
}

/** 更新订单制作、配送或付款核验状态。 */
async function updateOrder(payload) {
  const orderId = String(payload.orderId || "");
  if (!orderId) throw new BusinessError("订单编号无效");
  const isAdmin = isAdminKeyValid(String(payload.adminKey || ""));
  const accessToken = String(payload.accessToken || "");
  const patch = { updatedAt: new Date() };
  if (isAdmin) {
    if (["pending", "preparing", "ready", "completed", "cancelled"].includes(payload.status)) patch.status = payload.status;
    if (["waiting", "delivering", "delivered"].includes(payload.deliveryStatus)) {
      patch.deliveryStatus = payload.deliveryStatus;
      if (payload.deliveryStatus === "delivered") patch.status = "completed";
    }
    if (["confirmed", "rejected"].includes(payload.paymentStatus)) patch.paymentStatus = payload.paymentStatus;
  } else if (/^[a-f0-9]{48}$/.test(accessToken) && payload.paymentStatus === "submitted") {
    const paymentMethodId = String(payload.paymentMethodId || "").trim();
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(paymentMethodId)) throw new BusinessError("请选择有效的收款方式");
    const paymentResult = await db.collection("payment_methods").doc(paymentMethodId).get().catch(() => ({ data: [] }));
    if (!paymentResult.data[0] || paymentResult.data[0].enabled === false) throw new BusinessError("该收款方式已停用，请重新选择");
    patch.paymentStatus = "submitted";
    patch.paymentReference = String(payload.paymentReference || "").trim().slice(0, 80);
    patch.paymentMethodId = paymentMethodId;
  } else {
    throw new BusinessError("无权更新该订单", 403);
  }
  if (Object.keys(patch).length === 1) throw new BusinessError("没有可更新的内容");
  const orderResult = await db.collection("orders").doc(orderId).get().catch(() => ({ data: [] }));
  const order = orderResult.data[0];
  if (!order || (!isAdmin && order.accessToken !== accessToken)) throw new BusinessError("订单不存在或访问令牌已失效", 404);
  await db.collection("orders").doc(orderId).update({ data: patch });
  return { ok: true };
}

/** 校验并保存一个商品及库存、上下架状态。 */
async function saveProduct(payload) {
  requireAdmin(payload);
  const product = payload.product || {};
  const productId = String(product.id || `product-${Date.now()}`).trim();
  const price = Number(product.price);
  const stock = Number(product.stock);
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(productId) || !String(product.name || "").trim() || !Number.isFinite(price) || price <= 0 || !Number.isInteger(stock) || stock < 0) {
    throw new BusinessError("请检查商品名称、价格和库存");
  }
  const currentResult = await db.collection("products").doc(productId).get().catch(() => ({ data: [] }));
  const current = currentResult.data[0];
  const data = {
    name: String(product.name).trim().slice(0, 60),
    description: String(product.description || "").trim().slice(0, 160),
    price: Number(price.toFixed(2)),
    unit: String(product.unit || "个").trim().slice(0, 10),
    category: String(product.category || "经典").trim().slice(0, 20),
    stock,
    badge: String(product.badge || "").trim().slice(0, 20),
    imageFileId: String(product.imageFileId || "").startsWith("cloud://") ? String(product.imageFileId) : (current && current.imageFileId) || "",
    tone: String(product.tone || "wheat").trim().slice(0, 20),
    available: product.available !== false,
    sortOrder: Number.isInteger(product.sortOrder) ? product.sortOrder : (current && current.sortOrder) || Date.now(),
    updatedAt: new Date(),
    createdAt: current && current.createdAt ? current.createdAt : new Date(),
  };
  await db.collection("products").doc(productId).set({ data });
  const fileUrls = await getFileUrlMap([data.imageFileId]);
  return { product: mapProduct({ _id: productId, ...data }, fileUrls) };
}

/** 校验并覆盖保存店铺装修设置。 */
async function saveStoreSettings(payload) {
  requireAdmin(payload);
  const settings = payload.settings || {};
  if (!String(settings.brandName || "").trim() || !String(settings.heroTitle || "").trim()) {
    throw new BusinessError("请填写店铺名称和首页标题");
  }
  const currentResult = await db.collection("store_settings").doc("default").get().catch(() => ({ data: [] }));
  const current = currentResult.data[0] || {};
  const data = {
    brandMark: String(settings.brandMark || "馒").trim().slice(0, 2),
    brandName: String(settings.brandName).trim().slice(0, 40),
    brandTagline: String(settings.brandTagline || "").trim().slice(0, 80),
    heroBadge: String(settings.heroBadge || "").trim().slice(0, 80),
    heroTitle: String(settings.heroTitle).trim().slice(0, 120),
    heroDescription: String(settings.heroDescription || "").trim().slice(0, 300),
    heroButtonText: String(settings.heroButtonText || "看看今日馒头").trim().slice(0, 40),
    deliveryNote: String(settings.deliveryNote || "").trim().slice(0, 160),
    heroBackgroundFileId: String(settings.heroBackgroundFileId || "").startsWith("cloud://")
      ? String(settings.heroBackgroundFileId)
      : current.heroBackgroundFileId || "",
    updatedAt: new Date(),
  };
  await db.collection("store_settings").doc("default").set({ data });
  const fileUrls = await getFileUrlMap([data.heroBackgroundFileId]);
  return { settings: { ...data, heroBackgroundImage: fileUrls[data.heroBackgroundFileId] || "" } };
}

/** 校验二维码是否为可跨端访问的 HTTPS 地址。 */
function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/** 校验并覆盖保存最多十二个个人收款码。 */
async function savePaymentMethods(payload) {
  requireAdmin(payload);
  const methods = Array.isArray(payload.paymentMethods) ? payload.paymentMethods.slice(0, 12) : [];
  const normalized = methods.map((method, index) => ({
    id: String(method.id || "").trim(),
    name: String(method.name || "").trim().slice(0, 40),
    payeeName: String(method.payeeName || "").trim().slice(0, 40),
    qrCodeUrl: String(method.qrCodeUrl || "").trim().slice(0, 2000),
    note: String(method.note || "").trim().slice(0, 200),
    enabled: method.enabled !== false,
    sortOrder: index,
  }));
  if (normalized.some((method) => !/^[a-zA-Z0-9_-]{1,64}$/.test(method.id) || !method.name || !method.payeeName || !isHttpsUrl(method.qrCodeUrl))) {
    throw new BusinessError("请完整填写名称、收款人和 HTTPS 二维码地址");
  }
  if (new Set(normalized.map((method) => method.id)).size !== normalized.length) throw new BusinessError("收款方式编号不能重复");
  const oldResult = await db.collection("payment_methods").get();
  // 先写入完整新列表，再删除不在列表内的旧记录，避免中途失败造成配置丢失。
  await Promise.all(normalized.map((method) => db.collection("payment_methods").doc(method.id).set({
    data: { name: method.name, payeeName: method.payeeName, qrCodeUrl: method.qrCodeUrl, note: method.note, enabled: method.enabled, sortOrder: method.sortOrder, updatedAt: new Date() },
  })));
  await Promise.all(oldResult.data.filter((method) => !normalized.some((item) => item.id === method._id)).map((method) => db.collection("payment_methods").doc(method._id).remove()));
  return { paymentMethods: normalized.map(({ sortOrder, ...method }) => method) };
}

/** 将网页压缩后的图片写入 CloudBase 云存储。 */
async function uploadImage(payload) {
  requireAdmin(payload);
  const dataUrl = String(payload.dataUrl || "");
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new BusinessError("图片格式仅支持 JPG、PNG 或 WebP");
  const fileContent = Buffer.from(match[2], "base64");
  if (fileContent.length === 0 || fileContent.length > 5 * 1024 * 1024) throw new BusinessError("压缩后的图片不能超过 5MB");
  const extensionMap = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
  const scene = payload.scene === "store" ? "store" : "products";
  const cloudPath = `ordering/${scene}/${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${extensionMap[match[1]]}`;
  const uploadResult = await app.uploadFile({ cloudPath, fileContent });
  const fileId = uploadResult.fileID;
  const fileUrls = await getFileUrlMap([fileId]);
  return { fileId, url: fileUrls[fileId] || "" };
}

/** 根据 action 分派所有公开与商家业务动作。 */
async function handleAction(payload) {
  await ensureSeedData();
  switch (payload.action) {
    case "getStore": return getStore(payload);
    case "getOrders": return getOrders(payload);
    case "createOrder": return createOrder(payload);
    case "updateOrder": return updateOrder(payload);
    case "saveProduct": return saveProduct(payload);
    case "saveStoreSettings": return saveStoreSettings(payload);
    case "savePaymentMethods": return savePaymentMethods(payload);
    case "uploadImage": return uploadImage(payload);
    default: throw new BusinessError("未知的业务动作", 404);
  }
}

/** 判断当前调用是否来自 CloudBase HTTP 访问服务。 */
function isHttpEvent(event) {
  return Boolean(event && (event.httpMethod || event.requestContext || event.headers));
}

/** 将 HTTP 访问服务事件转换成与 SDK 调用相同的业务参数。 */
function parseHttpPayload(event) {
  let body = event.body || {};
  if (event.isBase64Encoded && typeof body === "string") body = Buffer.from(body, "base64").toString("utf8");
  if (typeof body === "string") {
    try { body = body ? JSON.parse(body) : {}; } catch { throw new BusinessError("请求 JSON 格式错误"); }
  }
  return { ...event.queryStringParameters, ...body };
}

/** 生成支持 GitHub Pages 跨域访问的 HTTP 响应。 */
function createHttpResponse(statusCode, result) {
  return {
    statusCode,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type,x-admin-key,x-order-token",
      "access-control-allow-methods": "POST,OPTIONS",
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(result),
  };
}

/** CloudBase 云函数入口，同时支持 SDK 调用和 HTTP 访问服务。 */
exports.main = async (event = {}) => {
  const httpEvent = isHttpEvent(event);
  if (httpEvent && String(event.httpMethod || "").toUpperCase() === "OPTIONS") {
    return createHttpResponse(204, {});
  }
  try {
    const payload = httpEvent ? parseHttpPayload(event) : event;
    const data = await handleAction(payload);
    const result = { ok: true, data };
    return httpEvent ? createHttpResponse(200, result) : result;
  } catch (error) {
    console.error("ordering-api failed", error);
    const statusCode = error instanceof BusinessError ? error.statusCode : 500;
    const message = error instanceof BusinessError ? error.message : "店铺云服务暂时不可用，请稍后重试";
    const result = { ok: false, message };
    return httpEvent ? createHttpResponse(statusCode, result) : result;
  }
};
