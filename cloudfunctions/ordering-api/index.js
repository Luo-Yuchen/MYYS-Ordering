const cloudbase = require("@cloudbase/node-sdk");
const crypto = require("crypto");
const { promisify } = require("util");

/** 当前云函数所在的 CloudBase 环境。 */
const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });

/** 点单系统所在的 CloudBase 环境编号。 */
const CLOUDBASE_ENV_ID = process.env.CLOUDBASE_ENV_ID || "bun-order-d9gn0mjn09021bfbe";

/** CloudBase PostgreSQL REST 基础地址。 */
const PG_REST_BASE_URL = `https://${CLOUDBASE_ENV_ID}.api.tcloudbasegateway.com/v1/rdb/rest`;

/** 商家会话默认有效时长，单位毫秒。 */
const MERCHANT_SESSION_DURATION_MS = 12 * 60 * 60 * 1000;

/** 商家密码允许的最小长度。 */
const MERCHANT_PASSWORD_MIN_LENGTH = 10;

/** 单个运行实例保存的商家登录失败记录。 */
const merchantLoginAttempts = new Map();

/** 将 Node.js scrypt 转换成 Promise 调用。 */
const scryptAsync = promisify(crypto.scrypt);

/** 默认配送区域，仅用于数据库配置暂时不可用时的公开提示。 */
const DEFAULT_DELIVERY_AREAS = ["幸福小区", "阳光花园", "麦香公寓", "邻里写字楼"];

/** 数据库暂不可用时使用的默认店铺设置。 */
const DEFAULT_STORE_SETTINGS = {
  brandMark: "馒",
  brandName: "馒有意思",
  brandTagline: "每日现蒸  /  预约不等",
  heroBadge: "老面慢发酵  /  不加改良剂",
  heroTitle: "每天现蒸，\n把柔软送到家",
  heroDescription: "清晨和面、自然醒发、按单现蒸。今晚预约，明早不排队，热乎乎的麦香刚刚好。",
  heroButtonText: "看看今日馒头",
  deliveryNote: "本店 3km 内配送  /  15元起送  /  配送费3元  /  满30元免配送费",
  heroBackgroundFileId: "",
  deliveryAreas: DEFAULT_DELIVERY_AREAS,
  deliveryRangeKm: 3,
  deliveryMinimum: 15,
  deliveryFee: 3,
  freeDeliveryThreshold: 30,
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

/** 仅在云函数内部使用的 PostgreSQL 请求错误。 */
class PgRequestError extends Error {
  /** 保存 PostgreSQL REST 返回的非敏感错误摘要。 */
  constructor(message, code = "") {
    super(message);
    /** PostgreSQL REST 错误代码。 */
    this.code = code;
  }
}

/** 生成字符串的 SHA-256 十六进制摘要。 */
function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/** 将商家用户名标准化为稳定查询值。 */
function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

/** 使用 scrypt 和指定随机盐派生密码摘要。 */
async function derivePasswordHash(password, salt) {
  const result = await scryptAsync(String(password), salt, 64);
  return Buffer.from(result).toString("hex");
}

/** 使用恒定时长比较校验商家密码。 */
async function verifyPassword(account, password) {
  const salt = account && account.password_salt ? account.password_salt : "00000000000000000000000000000000";
  const expectedHex = account && account.password_hash ? account.password_hash : "0".repeat(128);
  const actualHex = await derivePasswordHash(password, salt);
  const actual = Buffer.from(actualHex, "hex");
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

/** 生成新密码使用的随机盐和 scrypt 摘要。 */
async function createPasswordRecord(password) {
  const passwordSalt = crypto.randomBytes(16).toString("hex");
  const passwordHash = await derivePasswordHash(password, passwordSalt);
  return { passwordHash, passwordSalt };
}

/** 读取服务端 API Key 并阻止未配置环境继续访问 PG。 */
function getCloudBaseApiKey() {
  const apiKey = String(process.env.CLOUDBASE_APIKEY || "");
  if (!apiKey) throw new BusinessError("CloudBase PG 服务端密钥尚未配置", 503);
  return apiKey;
}

/** 调用 CloudBase PG REST/RPC，并统一解析返回值。 */
async function pgRequest(path, options = {}) {
  const response = await fetch(`${PG_REST_BASE_URL}/${path}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${getCloudBaseApiKey()}`,
      Accept: "application/json",
      ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(options.prefer ? { Prefer: options.prefer } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const raw = await response.text();
  let data = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }
  }
  if (!response.ok) {
    const message = data && typeof data === "object" ? String(data.message || data.details || "PG_REQUEST_FAILED") : String(data || "PG_REQUEST_FAILED");
    const code = data && typeof data === "object" ? String(data.code || "") : "";
    throw new PgRequestError(message, code);
  }
  return data;
}

/** 对指定 PG 表执行主键冲突时合并的幂等写入。 */
async function pgUpsert(table, row) {
  const result = await pgRequest(`${table}?on_conflict=id`, {
    method: "POST",
    body: [row],
    prefer: "resolution=merge-duplicates,return=representation",
  });
  return Array.isArray(result) ? result[0] : result;
}

/** 将 CloudBase 日期或 ISO 字符串统一转换成前端可用时间。 */
function toIsoDate(value) {
  if (!value) return new Date().toISOString();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

/** 将 PG 商品记录转换成网页与小程序共用结构。 */
function mapProduct(product, fileUrls) {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: Number(product.price),
    unit: product.unit,
    category: product.category,
    stock: Number(product.stock),
    badge: product.badge || undefined,
    imageUrl: fileUrls[product.image_file_id] || "",
    imageFileId: product.image_file_id || "",
    tone: product.tone || "wheat",
    available: product.available !== false,
  };
}

/** 将 PG 收款方式记录转换成两端共用结构。 */
function mapPaymentMethod(method) {
  return {
    id: method.id,
    name: method.name,
    payeeName: method.payee_name,
    qrCodeUrl: method.qr_code_url,
    note: method.note || "",
    enabled: method.enabled !== false,
  };
}

/** 将 PG 店铺设置转换成两端共用结构。 */
function mapStoreSettings(settings, fileUrls) {
  return {
    brandMark: settings.brand_mark,
    brandName: settings.brand_name,
    brandTagline: settings.brand_tagline,
    heroBadge: settings.hero_badge,
    heroTitle: settings.hero_title,
    heroDescription: settings.hero_description,
    heroButtonText: settings.hero_button_text,
    deliveryNote: settings.delivery_note,
    heroBackgroundImage: fileUrls[settings.hero_background_file_id] || "",
    heroBackgroundFileId: settings.hero_background_file_id || "",
    deliveryAreas: Array.isArray(settings.delivery_areas) ? settings.delivery_areas : DEFAULT_DELIVERY_AREAS,
    deliveryRangeKm: Number(settings.delivery_range_km),
    deliveryMinimum: Number(settings.delivery_minimum),
    deliveryFee: Number(settings.delivery_fee),
    freeDeliveryThreshold: Number(settings.free_delivery_threshold),
  };
}

/** 将 PG 订单转换为两端共用结构。 */
function mapOrder(order, accessToken = "") {
  return {
    id: order.id,
    shortCode: order.short_code,
    createdAt: toIsoDate(order.created_at),
    items: Array.isArray(order.items) ? order.items : [],
    subtotal: Number(order.subtotal),
    deliveryFee: Number(order.delivery_fee),
    total: Number(order.total),
    fulfillment: order.order_type,
    customerName: order.customer_name,
    phone: order.phone,
    address: order.address || "",
    deliveryArea: order.delivery_area || "",
    doorNumber: order.door_number || "",
    pickupDay: order.pickup_day || "",
    pickupTime: order.pickup_time || "",
    deliveryTime: order.delivery_time || "",
    note: order.remark || "",
    status: order.status || "pending",
    deliveryStatus: order.delivery_status || "waiting",
    paymentStatus: order.payment_status || "pending",
    paymentReference: order.payment_reference || "",
    paymentMethodId: order.payment_method_id || "",
    accessToken: accessToken || undefined,
  };
}

/** 将商家账号转换成可安全返回给两端的公开结构。 */
function mapMerchant(account) {
  return {
    id: account.id,
    username: account.username_normalized,
    displayName: account.display_name,
    mustChangePassword: account.must_change_password === true,
  };
}

/** 为云存储文件编号生成临时 HTTPS 访问地址。 */
async function getFileUrlMap(fileIds) {
  const uniqueFileIds = [...new Set(fileIds.filter((fileId) => typeof fileId === "string" && fileId.startsWith("cloud://")))];
  if (uniqueFileIds.length === 0) return {};
  const result = await app.getTempFileURL({ fileList: uniqueFileIds });
  return Object.fromEntries((result.fileList || []).map((item) => [item.fileID, item.tempFileURL || item.download_url || ""]));
}

/** 记录一次失败登录，并在短时间连续失败时暂时锁定用户名。 */
function recordLoginFailure(username) {
  const now = Date.now();
  const current = merchantLoginAttempts.get(username);
  const attempts = current && current.expiresAt > now ? current.attempts + 1 : 1;
  merchantLoginAttempts.set(username, {
    attempts,
    expiresAt: now + 10 * 60 * 1000,
    lockedUntil: attempts >= 5 ? now + 5 * 60 * 1000 : 0,
  });
}

/** 检查当前运行实例中用户名是否处于短时登录锁定。 */
function assertLoginAllowed(username) {
  const current = merchantLoginAttempts.get(username);
  if (current && current.lockedUntil > Date.now()) {
    throw new BusinessError("登录失败次数过多，请稍后再试", 429);
  }
}

/** 根据随机令牌读取有效商家会话和启用账号。 */
async function readMerchantSession(sessionToken) {
  if (!/^[a-f0-9]{64}$/.test(sessionToken)) throw new BusinessError("商家登录已失效，请重新登录", 401);
  const tokenHash = sha256(sessionToken);
  const sessions = await pgRequest(`merchant_sessions?select=id,merchant_id,expires_at,revoked_at&token_hash=eq.${tokenHash}&limit=1`);
  const session = Array.isArray(sessions) ? sessions[0] : null;
  if (!session || session.revoked_at || new Date(session.expires_at).getTime() <= Date.now()) {
    throw new BusinessError("商家登录已失效，请重新登录", 401);
  }
  const accounts = await pgRequest(`merchant_accounts?select=*&id=eq.${encodeURIComponent(session.merchant_id)}&enabled=eq.true&limit=1`);
  const account = Array.isArray(accounts) ? accounts[0] : null;
  if (!account) throw new BusinessError("商家登录已失效，请重新登录", 401);
  await pgRequest(`merchant_sessions?id=eq.${encodeURIComponent(session.id)}`, {
    method: "PATCH",
    body: { last_used_at: new Date().toISOString() },
  });
  return { session, account };
}

/** 校验商家会话，并按首次改密状态限制管理动作。 */
async function requireMerchantSession(payload, options = {}) {
  const sessionToken = String(payload.merchantSessionToken || "");
  const result = await readMerchantSession(sessionToken);
  if (result.account.must_change_password === true && options.allowPasswordChange !== true) {
    throw new BusinessError("请先修改初始密码", 428);
  }
  return result;
}

/** 使用数据库账号密码登录商家端并签发 12 小时会话。 */
async function merchantLogin(payload) {
  const username = normalizeUsername(payload.username);
  const password = String(payload.password || "");
  if (!/^[a-z0-9_.-]{3,64}$/.test(username) || password.length < 1 || password.length > 128) {
    throw new BusinessError("用户名或密码错误", 401);
  }
  assertLoginAllowed(username);
  const accounts = await pgRequest(`merchant_accounts?select=*&username_normalized=eq.${encodeURIComponent(username)}&limit=1`);
  const account = Array.isArray(accounts) ? accounts[0] : null;
  const passwordValid = await verifyPassword(account, password);
  if (!account || account.enabled !== true || !passwordValid) {
    recordLoginFailure(username);
    throw new BusinessError("用户名或密码错误", 401);
  }
  merchantLoginAttempts.delete(username);
  const sessionToken = crypto.randomBytes(32).toString("hex");
  const sessionId = `session-${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
  const expiresAt = new Date(Date.now() + MERCHANT_SESSION_DURATION_MS).toISOString();
  await pgRequest("merchant_sessions", {
    method: "POST",
    body: {
      id: sessionId,
      merchant_id: account.id,
      token_hash: sha256(sessionToken),
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
      last_used_at: new Date().toISOString(),
    },
  });
  await pgRequest(`merchant_accounts?id=eq.${encodeURIComponent(account.id)}`, {
    method: "PATCH",
    body: { last_login_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  });
  return {
    merchant: mapMerchant(account),
    merchantSessionToken: sessionToken,
    expiresAt,
  };
}

/** 返回当前商家会话的公开账号信息。 */
async function getMerchantSession(payload) {
  const { session, account } = await requireMerchantSession(payload, { allowPasswordChange: true });
  return {
    merchant: mapMerchant(account),
    expiresAt: toIsoDate(session.expires_at),
  };
}

/** 撤销当前商家会话；重复退出按成功处理。 */
async function merchantLogout(payload) {
  const sessionToken = String(payload.merchantSessionToken || "");
  if (/^[a-f0-9]{64}$/.test(sessionToken)) {
    await pgRequest(`merchant_sessions?token_hash=eq.${sha256(sessionToken)}&revoked_at=is.null`, {
      method: "PATCH",
      body: { revoked_at: new Date().toISOString() },
    });
  }
  return { ok: true };
}

/** 修改商家密码并撤销该账号的全部旧会话。 */
async function changeMerchantPassword(payload) {
  const { account } = await requireMerchantSession(payload, { allowPasswordChange: true });
  const currentPassword = String(payload.currentPassword || "");
  const newPassword = String(payload.newPassword || "");
  if (!(await verifyPassword(account, currentPassword))) throw new BusinessError("当前密码错误", 403);
  if (newPassword.length < MERCHANT_PASSWORD_MIN_LENGTH || newPassword.length > 128) {
    throw new BusinessError("新密码至少需要 10 位，且不能超过 128 位");
  }
  if (newPassword === currentPassword) throw new BusinessError("新密码不能与当前密码相同");
  const passwordRecord = await createPasswordRecord(newPassword);
  const result = await pgRequest("rpc/ordering_change_merchant_password", {
    method: "POST",
    body: {
      p_merchant_id: account.id,
      p_password_hash: passwordRecord.passwordHash,
      p_password_salt: passwordRecord.passwordSalt,
    },
  });
  // 兼容 PG REST 对标量 RPC 返回布尔值、单元素数组或命名字段对象的三种格式。
  const passwordChanged = result === true
    || (Array.isArray(result) && result[0] === true)
    || Boolean(result && result.ordering_change_merchant_password === true);
  if (!passwordChanged) throw new BusinessError("密码修改失败，请稍后重试", 500);
  return { ok: true, reloginRequired: true };
}

/** 读取商品、店铺设置和收款方式；有效商家会话可读取停用数据。 */
async function getStore(payload) {
  let isMerchant = false;
  if (payload.merchantSessionToken) {
    await requireMerchantSession(payload);
    isMerchant = true;
  }
  const [products, settingsRows, paymentRows] = await Promise.all([
    pgRequest("products?select=*&order=sort_order.asc"),
    pgRequest("store_settings?select=*&id=eq.default&limit=1"),
    pgRequest("payment_methods?select=*&order=sort_order.asc"),
  ]);
  const settings = Array.isArray(settingsRows) && settingsRows[0] ? settingsRows[0] : {
    brand_mark: DEFAULT_STORE_SETTINGS.brandMark,
    brand_name: DEFAULT_STORE_SETTINGS.brandName,
    brand_tagline: DEFAULT_STORE_SETTINGS.brandTagline,
    hero_badge: DEFAULT_STORE_SETTINGS.heroBadge,
    hero_title: DEFAULT_STORE_SETTINGS.heroTitle,
    hero_description: DEFAULT_STORE_SETTINGS.heroDescription,
    hero_button_text: DEFAULT_STORE_SETTINGS.heroButtonText,
    delivery_note: DEFAULT_STORE_SETTINGS.deliveryNote,
    hero_background_file_id: "",
    delivery_areas: DEFAULT_STORE_SETTINGS.deliveryAreas,
    delivery_range_km: DEFAULT_STORE_SETTINGS.deliveryRangeKm,
    delivery_minimum: DEFAULT_STORE_SETTINGS.deliveryMinimum,
    delivery_fee: DEFAULT_STORE_SETTINGS.deliveryFee,
    free_delivery_threshold: DEFAULT_STORE_SETTINGS.freeDeliveryThreshold,
  };
  const visibleProducts = (Array.isArray(products) ? products : []).filter((product) => isMerchant || product.available !== false);
  const visiblePayments = (Array.isArray(paymentRows) ? paymentRows : []).filter((method) => isMerchant || method.enabled !== false);
  const fileUrls = await getFileUrlMap([
    ...visibleProducts.map((product) => product.image_file_id),
    settings.hero_background_file_id,
  ]);
  const paymentMethods = visiblePayments.map(mapPaymentMethod);
  const primaryPayment = paymentMethods.find((method) => method.enabled) || paymentMethods[0];
  return {
    products: visibleProducts.map((product) => mapProduct(product, fileUrls)),
    settings: mapStoreSettings(settings, fileUrls),
    paymentMethods,
    payment: {
      qrCodeUrl: primaryPayment ? primaryPayment.qrCodeUrl : "",
      payeeName: primaryPayment ? primaryPayment.payeeName : "商家",
      instructions: primaryPayment ? primaryPayment.note : "商家暂未启用收款码，请联系商家后再付款。",
    },
    miniProgram: { entryUrl: "", qrCodeUrl: "" },
  };
}

/** 读取顾客令牌对应订单，或在商家会话通过时读取全部订单。 */
async function getOrders(payload) {
  if (payload.merchantSessionToken) {
    await requireMerchantSession(payload);
    const rows = await pgRequest("orders?select=*&order=created_at.desc&limit=200");
    return { orders: (Array.isArray(rows) ? rows : []).map((order) => mapOrder(order)) };
  }
  const tokens = Array.isArray(payload.tokens)
    ? payload.tokens.map((token) => String(token)).filter((token) => /^[a-f0-9]{48}$/.test(token)).slice(0, 30)
    : [];
  if (tokens.length === 0) return { orders: [] };
  const tokenByHash = Object.fromEntries(tokens.map((token) => [sha256(token), token]));
  const hashes = Object.keys(tokenByHash);
  const rows = await pgRequest(`orders?select=*&access_token_hash=in.(${hashes.join(",")})&order=created_at.desc&limit=30`);
  return {
    orders: (Array.isArray(rows) ? rows : []).map((order) => mapOrder(order, tokenByHash[String(order.access_token_hash).trim()] || "")),
  };
}

/** 校验下单资料并调用 PG 事务函数扣减库存、生成订单。 */
async function createOrder(payload) {
  const requestedItems = Array.isArray(payload.items) ? payload.items : [];
  const items = requestedItems.filter((item) => (
    item && typeof item.productId === "string" && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 99
  ));
  const orderType = payload.orderType === "delivery" ? "delivery" : "pickup";
  const customerName = String(payload.customerName || "").trim().slice(0, 40);
  const phone = String(payload.phone || "").trim();
  const deliveryArea = String(payload.deliveryArea || "").trim().slice(0, 80);
  const doorNumber = String(payload.doorNumber || "").trim().slice(0, 120);
  const pickupDay = String(payload.pickupDay || "").trim().slice(0, 20);
  const pickupTime = String(payload.pickupTime || "").trim().slice(0, 30);
  const deliveryTime = String(payload.deliveryTime || "").trim().slice(0, 30);
  const remark = String(payload.remark || "").trim().slice(0, 200);
  if (items.length === 0 || new Set(items.map((item) => item.productId)).size !== items.length || !customerName || !/^1\d{10}$/.test(phone)) {
    throw new BusinessError("请检查商品、姓名和手机号");
  }
  if (orderType === "pickup" && !pickupTime) throw new BusinessError("请选择预计取餐时间");
  if (orderType === "delivery" && (!deliveryArea || !doorNumber || !deliveryTime)) {
    throw new BusinessError("请选择配送区域，并填写门牌号和送达时间");
  }
  const now = new Date();
  const orderId = `order-${now.getTime()}-${crypto.randomBytes(4).toString("hex")}`;
  const accessToken = crypto.randomBytes(24).toString("hex");
  try {
    const rows = await pgRequest("rpc/ordering_create_order", {
      method: "POST",
      body: {
        p_order_id: orderId,
        p_access_token_hash: sha256(accessToken),
        p_order_type: orderType,
        p_customer_name: customerName,
        p_phone: phone,
        p_delivery_area: deliveryArea,
        p_door_number: doorNumber,
        p_pickup_day: pickupDay,
        p_pickup_time: pickupTime,
        p_delivery_time: deliveryTime,
        p_remark: remark,
        p_items: items,
      },
    });
    const order = Array.isArray(rows) ? rows[0] : rows;
    if (!order) throw new PgRequestError("ORDER_NOT_CREATED");
    return mapOrder(order, accessToken);
  } catch (error) {
    const message = String(error && error.message);
    if (message.includes("PRODUCT_STOCK_NOT_ENOUGH")) throw new BusinessError("部分商品库存不足，请重新选择");
    if (message.includes("PRODUCT_NOT_AVAILABLE")) throw new BusinessError("部分商品已下架，请重新选择");
    if (message.includes("DELIVERY_MINIMUM_NOT_MET")) throw new BusinessError("配送订单未达到最低起送金额");
    if (message.includes("INVALID_DELIVERY_ADDRESS")) throw new BusinessError("请选择店铺可配送区域，并填写完整地址");
    throw error;
  }
}

/** 更新订单制作、配送或付款核验状态。 */
async function updateOrder(payload) {
  const orderId = String(payload.orderId || "");
  if (!orderId) throw new BusinessError("订单编号无效");
  const patch = { updated_at: new Date().toISOString() };
  let query = `orders?id=eq.${encodeURIComponent(orderId)}`;
  if (payload.merchantSessionToken) {
    await requireMerchantSession(payload);
    if (["pending", "preparing", "ready", "completed", "cancelled"].includes(payload.status)) patch.status = payload.status;
    if (["waiting", "delivering", "delivered"].includes(payload.deliveryStatus)) {
      patch.delivery_status = payload.deliveryStatus;
      if (payload.deliveryStatus === "delivered") patch.status = "completed";
    }
    if (["confirmed", "rejected"].includes(payload.paymentStatus)) patch.payment_status = payload.paymentStatus;
  } else {
    const accessToken = String(payload.accessToken || "");
    if (!/^[a-f0-9]{48}$/.test(accessToken) || payload.paymentStatus !== "submitted") {
      throw new BusinessError("无权更新该订单", 403);
    }
    const paymentMethodId = String(payload.paymentMethodId || "").trim();
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(paymentMethodId)) throw new BusinessError("请选择有效的收款方式");
    const methods = await pgRequest(`payment_methods?select=id&id=eq.${encodeURIComponent(paymentMethodId)}&enabled=eq.true&limit=1`);
    if (!Array.isArray(methods) || !methods[0]) throw new BusinessError("该收款方式已停用，请重新选择");
    query += `&access_token_hash=eq.${sha256(accessToken)}`;
    patch.payment_status = "submitted";
    patch.payment_reference = String(payload.paymentReference || "").trim().slice(0, 80);
    patch.payment_method_id = paymentMethodId;
  }
  if (Object.keys(patch).length === 1) throw new BusinessError("没有可更新的内容");
  const rows = await pgRequest(query, { method: "PATCH", body: patch, prefer: "return=representation" });
  if (!Array.isArray(rows) || rows.length === 0) throw new BusinessError("订单不存在或访问令牌已失效", 404);
  return { ok: true };
}

/** 校验并保存一个商品及库存、上下架状态。 */
async function saveProduct(payload) {
  await requireMerchantSession(payload);
  const product = payload.product || {};
  const productId = String(product.id || `product-${Date.now()}`).trim();
  const price = Number(product.price);
  const stock = Number(product.stock);
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(productId) || !String(product.name || "").trim() || !Number.isFinite(price) || price <= 0 || !Number.isInteger(stock) || stock < 0) {
    throw new BusinessError("请检查商品名称、价格和库存");
  }
  const currentRows = await pgRequest(`products?select=*&id=eq.${encodeURIComponent(productId)}&limit=1`);
  const current = Array.isArray(currentRows) ? currentRows[0] : null;
  const row = {
    id: productId,
    name: String(product.name).trim().slice(0, 60),
    description: String(product.description || "").trim().slice(0, 160),
    price: Number(price.toFixed(2)),
    unit: String(product.unit || "个").trim().slice(0, 10),
    category: String(product.category || "经典").trim().slice(0, 20),
    stock,
    badge: String(product.badge || "").trim().slice(0, 20),
    image_file_id: String(product.imageFileId || "").startsWith("cloud://") ? String(product.imageFileId) : (current && current.image_file_id) || "",
    tone: String(product.tone || "wheat").trim().slice(0, 20),
    available: product.available !== false,
    sort_order: Number.isInteger(product.sortOrder) ? product.sortOrder : (current && Number(current.sort_order)) || Date.now(),
    updated_at: new Date().toISOString(),
    created_at: current && current.created_at ? current.created_at : new Date().toISOString(),
  };
  const saved = await pgUpsert("products", row);
  const fileUrls = await getFileUrlMap([row.image_file_id]);
  return { product: mapProduct(saved || row, fileUrls) };
}

/** 校验并覆盖保存店铺装修设置。 */
async function saveStoreSettings(payload) {
  await requireMerchantSession(payload);
  const settings = payload.settings || {};
  if (!String(settings.brandName || "").trim() || !String(settings.heroTitle || "").trim()) {
    throw new BusinessError("请填写店铺名称和首页标题");
  }
  const currentRows = await pgRequest("store_settings?select=*&id=eq.default&limit=1");
  const current = Array.isArray(currentRows) && currentRows[0] ? currentRows[0] : {};
  const row = {
    id: "default",
    brand_mark: String(settings.brandMark || "馒").trim().slice(0, 2),
    brand_name: String(settings.brandName).trim().slice(0, 40),
    brand_tagline: String(settings.brandTagline || "").trim().slice(0, 80),
    hero_badge: String(settings.heroBadge || "").trim().slice(0, 80),
    hero_title: String(settings.heroTitle).trim().slice(0, 120),
    hero_description: String(settings.heroDescription || "").trim().slice(0, 300),
    hero_button_text: String(settings.heroButtonText || "看看今日馒头").trim().slice(0, 40),
    delivery_note: String(settings.deliveryNote || "").trim().slice(0, 160),
    hero_background_file_id: String(settings.heroBackgroundFileId || "").startsWith("cloud://") ? String(settings.heroBackgroundFileId) : current.hero_background_file_id || "",
    delivery_areas: Array.isArray(current.delivery_areas) ? current.delivery_areas : DEFAULT_DELIVERY_AREAS,
    delivery_range_km: Number(current.delivery_range_km || 3),
    delivery_minimum: Number(current.delivery_minimum || 15),
    delivery_fee: Number(current.delivery_fee || 3),
    free_delivery_threshold: Number(current.free_delivery_threshold || 30),
    updated_at: new Date().toISOString(),
  };
  const saved = await pgUpsert("store_settings", row);
  const fileUrls = await getFileUrlMap([row.hero_background_file_id]);
  return { settings: mapStoreSettings(saved || row, fileUrls) };
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
  await requireMerchantSession(payload);
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
  const rows = await pgRequest("rpc/ordering_replace_payment_methods", {
    method: "POST",
    body: { p_methods: normalized },
  });
  return { paymentMethods: (Array.isArray(rows) ? rows : []).map(mapPaymentMethod) };
}

/** 将网页压缩后的图片写入 CloudBase 云存储。 */
async function uploadImage(payload) {
  await requireMerchantSession(payload);
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

/** 根据 action 分派所有公开、顾客与商家业务动作。 */
async function handleAction(payload) {
  switch (payload.action) {
    case "merchantLogin": return merchantLogin(payload);
    case "merchantLogout": return merchantLogout(payload);
    case "getMerchantSession": return getMerchantSession(payload);
    case "changeMerchantPassword": return changeMerchantPassword(payload);
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
    try {
      body = body ? JSON.parse(body) : {};
    } catch {
      throw new BusinessError("请求 JSON 格式错误");
    }
  }
  return { ...event.queryStringParameters, ...body };
}

/** 生成支持 GitHub Pages 跨域访问的 HTTP 响应。 */
function createHttpResponse(statusCode, result) {
  return {
    statusCode,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type,x-order-token",
      "access-control-allow-methods": "POST,OPTIONS",
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(result),
  };
}

/** CloudBase Event 云函数入口，同时兼容现有 HTTP 访问服务。 */
exports.main = async (event = {}) => {
  const httpEvent = isHttpEvent(event);
  if (httpEvent && String(event.httpMethod || "").toUpperCase() === "OPTIONS") {
    return createHttpResponse(204, {});
  }
  let action = "";
  try {
    const payload = httpEvent ? parseHttpPayload(event) : event;
    action = String(payload.action || "");
    const data = await handleAction(payload);
    const result = { ok: true, data };
    return httpEvent ? createHttpResponse(200, result) : result;
  } catch (error) {
    const statusCode = error instanceof BusinessError ? error.statusCode : 500;
    const message = error instanceof BusinessError ? error.message : "店铺云服务暂时不可用，请稍后重试";
    // 日志只记录动作和错误类型，禁止输出完整事件、密码、令牌或运行时环境变量。
    console.error("ordering-api failed", { action, errorName: error && error.name, statusCode });
    const result = { ok: false, message };
    return httpEvent ? createHttpResponse(statusCode, result) : result;
  }
};
