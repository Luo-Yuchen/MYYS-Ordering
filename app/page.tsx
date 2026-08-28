"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import NextImage from "next/image";
import { callOrderingFunction } from "../lib/cloudbase-client";

/** 商品分类。 */
type Category = "全部" | "经典" | "粗粮" | "甜味";

/** 商品信息。 */
type Product = {
  /** 商品唯一标识。 */
  id: string;
  /** 商品名称。 */
  name: string;
  /** 商品卖点说明。 */
  description: string;
  /** 商品单价。 */
  price: number;
  /** 商品计价单位。 */
  unit: string;
  /** 商品分类。 */
  category: Exclude<Category, "全部">;
  /** 当日可售库存。 */
  stock: number;
  /** 商品角标。 */
  badge?: string;
  /** 商家上传的商品图片临时 HTTPS 地址。 */
  imageUrl?: string;
  /** 商品图片在 CloudBase 云存储中的永久文件编号。 */
  imageFileId?: string;
  /** 商品是否在云端上架。 */
  available?: boolean;
  /** 商品插画配色。 */
  tone: "wheat" | "corn" | "purple" | "brown" | "jujube" | "green";
};

/** 商品编辑表单数据。 */
type ProductDraft = {
  /** 商品名称。 */
  name: string;
  /** 商品卖点说明。 */
  description: string;
  /** 商品单价文本。 */
  price: string;
  /** 商品计价单位。 */
  unit: string;
  /** 商品分类。 */
  category: Exclude<Category, "全部">;
  /** 当日库存文本。 */
  stock: string;
  /** 商品角标。 */
  badge: string;
  /** 商家上传的商品图片临时 HTTPS 地址。 */
  imageUrl: string;
  /** 商品图片在 CloudBase 云存储中的永久文件编号。 */
  imageFileId: string;
};

/** 顾客端店铺展示设置。 */
type StoreSettings = {
  /** 顶部圆形标记文字。 */
  brandMark: string;
  /** 店铺名称。 */
  brandName: string;
  /** 店铺名称下方的简短说明。 */
  brandTagline: string;
  /** 主视觉顶部小标签。 */
  heroBadge: string;
  /** 主视觉大标题。 */
  heroTitle: string;
  /** 主视觉介绍文案。 */
  heroDescription: string;
  /** 主视觉按钮文字。 */
  heroButtonText: string;
  /** 配送与优惠提示。 */
  deliveryNote: string;
  /** 商家上传的主视觉背景图片临时 HTTPS 地址。 */
  heroBackgroundImage: string;
  /** 主视觉背景在 CloudBase 云存储中的永久文件编号。 */
  heroBackgroundFileId: string;
};

/** 购物车商品数量映射。 */
type Cart = Record<string, number>;

/** 单个商品的营业设置。 */
type ProductAvailability = {
  /** 当前可售库存。 */
  stock: number;
  /** 是否允许顾客下单。 */
  available: boolean;
};

/** 商品营业设置映射。 */
type ProductInventory = Record<string, ProductAvailability>;

/** 配送方式。 */
type Fulfillment = "pickup" | "delivery";

/** 订单制作状态。 */
type OrderStatus = "pending" | "preparing" | "ready" | "completed" | "cancelled";

/** 配送进度状态，仅配送订单使用。 */
type DeliveryStatus = "waiting" | "delivering" | "delivered";

/** 个人收款码付款核验状态。 */
type PaymentStatus = "pending" | "submitted" | "confirmed" | "rejected";

/** 订单商品明细。 */
type OrderItem = {
  /** 商品唯一标识。 */
  productId: string;
  /** 下单时商品名称。 */
  name: string;
  /** 下单数量。 */
  quantity: number;
  /** 下单时商品单位。 */
  unit: string;
  /** 下单时商品单价。 */
  price: number;
};

/** H5 与小程序共用的订单。 */
type Order = {
  /** 订单编号。 */
  id: string;
  /** 下单时间。 */
  createdAt: string;
  /** 商品明细。 */
  items: OrderItem[];
  /** 顾客和商家识别订单使用的 A/D 短号。 */
  shortCode: string;
  /** 商品金额，不包含配送费。 */
  subtotal: number;
  /** 配送费，自提订单固定为零。 */
  deliveryFee: number;
  /** 订单应付总金额。 */
  total: number;
  /** 取餐方式。 */
  fulfillment: Fulfillment;
  /** 顾客姓名或配送收货人。 */
  customerName: string;
  /** 联系电话。 */
  phone: string;
  /** 完整配送地址，兼容历史订单。 */
  address: string;
  /** 可配送区域。 */
  deliveryArea: string;
  /** 楼栋、单元和门牌号。 */
  doorNumber: string;
  /** 预约日期。 */
  pickupDay: string;
  /** 预计取餐时间。 */
  pickupTime: string;
  /** 预计送达时间。 */
  deliveryTime: string;
  /** 顾客备注。 */
  note: string;
  /** 当前订单制作状态。 */
  status: OrderStatus;
  /** 当前配送进度。 */
  deliveryStatus: DeliveryStatus;
  /** 当前付款核验状态。 */
  paymentStatus: PaymentStatus;
  /** 顾客填写的付款备注或流水号。 */
  paymentReference?: string;
  /** 顾客实际选择的收款方式编号。 */
  paymentMethodId?: string;
  /** 顾客读取和更新该订单所需的随机令牌。 */
  accessToken?: string;
};

/** 个人收款码展示配置。 */
type PaymentConfig = {
  /** 收款码图片地址。 */
  qrCodeUrl: string;
  /** 收款人展示名称。 */
  payeeName: string;
  /** 扫码付款说明。 */
  instructions: string;
};

/** 微信小程序入口配置。 */
type MiniProgramConfig = {
  /** 微信小程序 URL Link 或 URL Scheme。 */
  entryUrl: string;
  /** 微信小程序码图片地址。 */
  qrCodeUrl: string;
};

/** 商家可配置并向顾客展示的一个收款方式。 */
type PaymentMethod = {
  /** 收款方式唯一标识。 */
  id: string;
  /** 收款方式名称，例如“微信收款码”。 */
  name: string;
  /** 收款人展示名称。 */
  payeeName: string;
  /** 可跨端访问的二维码 HTTPS 图片地址。 */
  qrCodeUrl: string;
  /** 付款说明或商家备注。 */
  note: string;
  /** 是否允许顾客选择。 */
  enabled: boolean;
};

/** 店铺公开接口返回的数据。 */
type StoreResponse = {
  /** 在售商品列表。 */
  products: Product[];
  /** 店铺装修设置。 */
  settings: StoreSettings | null;
  /** 新版多收款方式列表。 */
  paymentMethods?: PaymentMethod[];
  /** 兼容旧版的单收款码配置。 */
  payment: PaymentConfig;
  /** 微信小程序入口配置。 */
  miniProgram: MiniProgramConfig;
};

/** 商家账号权限等级。 */
type MerchantRole = "super_admin" | "admin" | "merchant" | "customer";

/** 商家账号的公开信息，不包含密码摘要和会话令牌。 */
type MerchantAccount = {
  /** 商家账号唯一标识。 */
  id: string;
  /** 商家登录用户名。 */
  username: string;
  /** 商家后台展示名称。 */
  displayName: string;
  /** 商家账号权限等级。 */
  role: MerchantRole;
  /** 商家账号是否启用。 */
  enabled: boolean;
  /** 是否必须先修改初始密码。 */
  mustChangePassword: boolean;
  /** 最近一次登录时间。 */
  lastLoginAt: string;
};

/** 商家登录接口返回的数据。 */
type MerchantLoginResponse = {
  /** 已通过数据库校验的商家账号。 */
  merchant: MerchantAccount;
  /** 仅保存到当前设备且服务端只存摘要的商家会话令牌。 */
  merchantSessionToken: string;
  /** 商家会话失效时间。 */
  expiresAt: string;
  /** 本次会话固定有效分钟数。 */
  sessionDurationMinutes: number;
};

/** 账号权限页面返回的公开数据。 */
type AccessManagementResponse = {
  /** 管理员可查看的账号列表。 */
  accounts: MerchantAccount[];
  /** 新登录会话使用的固定有效分钟数。 */
  sessionDurationMinutes: number;
  /** 会话设置最近更新时间。 */
  settingsUpdatedAt: string;
};

/** 新增或编辑账号时使用的表单草稿。 */
type MerchantAccountDraft = {
  /** 被编辑账号编号；空值代表新增。 */
  id: string;
  /** 登录用户名。 */
  username: string;
  /** 后台显示名称。 */
  displayName: string;
  /** 账号权限等级。 */
  role: MerchantRole;
  /** 账号是否启用。 */
  enabled: boolean;
  /** 新增或重置时使用的临时密码。 */
  temporaryPassword: string;
};

/** 当前设备持久化的后台会话公开结构。 */
type StoredMerchantSession = {
  /** 服务端签发的随机会话令牌。 */
  merchantSessionToken: string;
  /** 当前账号的公开资料。 */
  merchant: MerchantAccount;
  /** 服务端固定签发的到期时间。 */
  expiresAt: string;
};

/** 顾客端页面标签。 */
type CustomerView = "shop" | "cart" | "profile" | "profile-details" | "orders" | "management";

/** 保存在当前设备中的顾客常用资料。 */
type CustomerProfile = {
  /** 顾客姓名或常用称呼。 */
  name: string;
  /** 顾客联系电话。 */
  phone: string;
  /** 默认配送区域。 */
  deliveryArea: string;
  /** 默认楼栋和门牌号。 */
  doorNumber: string;
};

/** 商家端页面标签。 */
type AdminView = "orders" | "production" | "products" | "payments" | "store" | "access";

/** 商家角色对应的中文名称。 */
const MERCHANT_ROLE_LABELS: Record<MerchantRole, string> = {
  super_admin: "超级管理员",
  admin: "普通管理员",
  merchant: "商家",
  customer: "顾客",
};

/** 网页端持久化后台会话使用的版本化键名。 */
const MERCHANT_SESSION_STORAGE_KEY = "manyouyisi-merchant-session-v2";

/** 新增账号表单的默认内容。 */
const EMPTY_MERCHANT_ACCOUNT_DRAFT: MerchantAccountDraft = {
  id: "",
  username: "",
  displayName: "",
  role: "merchant",
  enabled: true,
  temporaryPassword: "",
};

/** 商品列表。 */
const PRODUCTS: Product[] = [
  {
    id: "plain",
    name: "老面白馒头",
    description: "自然醒发，麦香柔软",
    price: 2,
    unit: "个",
    category: "经典",
    stock: 60,
    badge: "招牌",
    tone: "wheat",
  },
  {
    id: "corn",
    name: "玉米面馒头",
    description: "细腻清甜，粗粮好味",
    price: 2.5,
    unit: "个",
    category: "粗粮",
    stock: 38,
    badge: "人气",
    tone: "corn",
  },
  {
    id: "purple",
    name: "紫薯开花馒头",
    description: "真紫薯泥，松软微甜",
    price: 3.5,
    unit: "个",
    category: "甜味",
    stock: 24,
    tone: "purple",
  },
  {
    id: "brown-sugar",
    name: "红糖馒头",
    description: "古法红糖，温润回甘",
    price: 3,
    unit: "个",
    category: "甜味",
    stock: 30,
    tone: "brown",
  },
  {
    id: "jujube",
    name: "红枣馒头",
    description: "枣肉看得见，香甜不腻",
    price: 4,
    unit: "个",
    category: "甜味",
    stock: 18,
    badge: "新品",
    tone: "jujube",
  },
  {
    id: "wholegrain",
    name: "全麦杂粮馒头",
    description: "麦麸谷物，饱腹扎实",
    price: 3,
    unit: "个",
    category: "粗粮",
    stock: 26,
    tone: "green",
  },
];

/** 首次打开时使用的默认库存和在售状态。 */
const DEFAULT_INVENTORY: ProductInventory = Object.fromEntries(
  PRODUCTS.map((product) => [product.id, { stock: product.stock, available: true }]),
);

/** 新增商品时使用的空白表单。 */
const EMPTY_PRODUCT_DRAFT: ProductDraft = {
  name: "",
  description: "",
  price: "",
  unit: "个",
  category: "经典",
  stock: "20",
  badge: "",
  imageUrl: "",
  imageFileId: "",
};

/** 首次打开时使用的店铺展示文案。 */
const DEFAULT_STORE_SETTINGS: StoreSettings = {
  brandMark: "馒",
  brandName: "馒有意思",
  brandTagline: "每日现蒸 · 预约不等",
  heroBadge: "老面慢发酵 · 不加改良剂",
  heroTitle: "每天现蒸，\n把柔软送到家",
  heroDescription: "清晨和面、自然醒发、按单现蒸。今晚预约，明早不排队，热乎乎的麦香刚刚好。",
  heroButtonText: "看看今日馒头",
  deliveryNote: "本店 3km 内配送 · 15元起送 · 配送费3元 · 满30元免配送费",
  heroBackgroundImage: "",
  heroBackgroundFileId: "",
};

/** 第一版允许配送的 3km 内区域。 */
const DELIVERY_AREAS = ["幸福小区", "阳光花园", "麦香公寓", "邻里写字楼"] as const;

/** 固定配送费。 */
const DELIVERY_FEE = 3;

/** 配送订单最低商品金额。 */
const DELIVERY_MINIMUM = 15;

/** 免配送费商品金额门槛。 */
const FREE_DELIVERY_THRESHOLD = 30;

/** 订单制作状态对应的展示文案。 */
const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "待接单",
  preparing: "制作中",
  ready: "待取货/待配送",
  completed: "已完成",
  cancelled: "已取消",
};

/** 商家处理订单时允许选择的制作状态。 */
const STATUS_OPTIONS: OrderStatus[] = ["pending", "preparing", "ready", "completed", "cancelled"];

/** 配送进度对应的展示文案。 */
const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  waiting: "待配送",
  delivering: "配送中",
  delivered: "已送达",
};

/** 商家处理配送单时允许选择的配送进度。 */
const DELIVERY_STATUS_OPTIONS: DeliveryStatus[] = ["waiting", "delivering", "delivered"];

/** 将旧缓存订单映射到新的短号、金额和双状态结构。 */
function normalizeOrder(order: Order): Order {
  const legacyStatus = order.status as unknown as string;
  const statusMap: Record<string, OrderStatus> = {
    new: "pending",
    preparing: "preparing",
    ready: "ready",
    delivering: "ready",
    done: "completed",
    pending: "pending",
    completed: "completed",
    cancelled: "cancelled",
  };
  const deliveryFee = Number(order.deliveryFee ?? (order.fulfillment === "delivery" ? DELIVERY_FEE : 0));
  return {
    ...order,
    shortCode: order.shortCode || (order.fulfillment === "delivery" ? "D" : "A") + String(order.id).slice(-3).padStart(3, "0"),
    subtotal: Number(order.subtotal ?? Math.max(0, Number(order.total) - deliveryFee)),
    deliveryFee,
    deliveryArea: order.deliveryArea || "",
    doorNumber: order.doorNumber || order.address || "",
    deliveryTime: order.deliveryTime || (order.fulfillment === "delivery" ? order.pickupTime : ""),
    status: statusMap[legacyStatus] ?? "pending",
    deliveryStatus: order.deliveryStatus || (legacyStatus === "delivering" ? "delivering" : legacyStatus === "done" ? "delivered" : "waiting"),
  };
}

/** 付款核验状态对应的展示文案。 */
const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "待付款",
  submitted: "已付款，待商家核验",
  confirmed: "商家已确认收款",
  rejected: "付款信息未通过",
};

/** 将原有 REST 路径转换成 CloudBase 云函数动作，保持页面调用代码稳定。 */
async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const url = new URL(rawUrl, window.location.origin);
  const headers = new Headers(init?.headers);
  const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
  const merchantSessionToken = headers.get("x-merchant-session") ?? "";
  const accessToken = headers.get("x-order-token") ?? "";
  if (url.pathname === "/api/store") {
    if ((init?.method ?? "GET") === "PUT") {
      return callOrderingFunction<T>("savePaymentMethods", { ...body, merchantSessionToken });
    }
    return callOrderingFunction<T>("getStore", {});
  }
  if (url.pathname === "/api/orders" && (init?.method ?? "GET") === "POST") {
    return callOrderingFunction<T>("createOrder", body);
  }
  if (url.pathname === "/api/orders") {
    const tokens = (url.searchParams.get("tokens") ?? "").split(",").filter(Boolean);
    return callOrderingFunction<T>("getOrders", { tokens, merchantSessionToken });
  }
  if (url.pathname.startsWith("/api/orders/") && (init?.method ?? "GET") === "PATCH") {
    return callOrderingFunction<T>("updateOrder", {
      ...body,
      orderId: decodeURIComponent(url.pathname.slice("/api/orders/".length)),
      merchantSessionToken,
      accessToken,
    });
  }
  throw new Error("未知的 CloudBase 业务请求");
}

/** 将金额格式化为人民币展示。 */
function formatMoney(value: number) {
  return `¥${value.toFixed(value % 1 === 0 ? 0 : 1)}`;
}

/** 生成新增收款方式使用的本机唯一编号。 */
function createPaymentMethodId() {
  return `payment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 校验二维码图片是否为两端均可访问的 HTTPS 地址。 */
function isValidPaymentImageUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/** 读取新版收款方式列表，并兼容接口中的旧版单收款码字段。 */
function getStorePaymentMethods(storeResult: StoreResponse): PaymentMethod[] {
  if (Array.isArray(storeResult.paymentMethods)) return storeResult.paymentMethods;
  if (!storeResult.payment.qrCodeUrl) return [];
  return [{
    id: "legacy-default",
    name: storeResult.payment.payeeName || "默认收款码",
    payeeName: storeResult.payment.payeeName || "商家",
    qrCodeUrl: storeResult.payment.qrCodeUrl,
    note: storeResult.payment.instructions,
    enabled: true,
  }];
}

/** 将日期时间转换成简洁的中文时间。 */
function formatCreatedAt(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

/** 返回商品对应的自然色插画类名。 */
function getProductTone(tone: Product["tone"]) {
  const toneMap: Record<Product["tone"], string> = {
    wheat: "bun-wheat",
    corn: "bun-corn",
    purple: "bun-purple",
    brown: "bun-brown",
    jujube: "bun-jujube",
    green: "bun-green",
  };
  return toneMap[tone];
}

/** 根据商品分类选择默认的自然色插画。 */
function getToneForCategory(category: Product["category"]): Product["tone"] {
  if (category === "粗粮") return "green";
  if (category === "甜味") return "brown";
  return "wheat";
}

/** 将商家上传的图片压缩为适合本机保存和手机展示的图片。 */
function compressUploadedImage(file: File, maxEdge = 900, quality = 0.78): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      // 限制图片尺寸和质量，避免一张原图占满浏览器的本机存储空间。
      const scale = Math.min(maxEdge / image.width, maxEdge / image.height, 1);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(Math.round(image.width * scale), 1);
      canvas.height = Math.max(Math.round(image.height * scale), 1);
      const context = canvas.getContext("2d");

      if (!context) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("图片处理失败"));
        return;
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL("image/webp", quality));
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("无法读取这张图片"));
    };

    image.src = objectUrl;
  });
}

/** 馒头商品的手作感插画。 */
function BunIllustration({ tone }: { /** 商品插画配色。 */ tone: Product["tone"] }) {
  return (
    <div className={`bun-illustration ${getProductTone(tone)}`} aria-hidden="true">
      <span className="bun-fold bun-fold-one" />
      <span className="bun-fold bun-fold-two" />
      <span className="bun-fold bun-fold-three" />
      <span className="bun-dot bun-dot-one" />
      <span className="bun-dot bun-dot-two" />
    </div>
  );
}

/** 商品数量加减器。 */
function QuantityControl({
  quantity,
  onAdd,
  onRemove,
  disabled = false,
}: {
  /** 当前商品数量。 */
  quantity: number;
  /** 增加商品数量。 */
  onAdd: () => void;
  /** 减少商品数量。 */
  onRemove: () => void;
  /** 是否禁止继续选购。 */
  disabled?: boolean;
}) {
  if (disabled && quantity === 0) {
    return (
      <button
        type="button"
        disabled
        className="px-6 py-3 rounded-full font-medium transition-colors duration-300 bg-stone-200 text-stone-600 cursor-not-allowed"
      >
        已售罄
      </button>
    );
  }

  if (quantity === 0) {
    return (
      <button
        type="button"
        onClick={onAdd}
        className="px-6 py-3 rounded-full font-medium transition-colors duration-300 bg-stone-800 text-stone-50 hover:bg-stone-700 active:scale-95 focus:outline-none focus:ring-2 focus:ring-stone-300"
        aria-label="加入购物车"
      >
        选一份
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3" aria-label={`当前数量 ${quantity}`}>
      <button
        type="button"
        onClick={onRemove}
        className="quantity-button"
        aria-label="减少一个"
      >
        −
      </button>
      <span className="min-w-5 text-center font-medium text-stone-800">{quantity}</span>
      <button
        type="button"
        onClick={onAdd}
        className="quantity-button"
        aria-label="增加一个"
      >
        +
      </button>
    </div>
  );
}

/** 单个商品卡片。 */
function ProductCard({
  product,
  quantity,
  onAdd,
  onRemove,
  available,
}: {
  /** 商品信息。 */
  product: Product;
  /** 购物车中的数量。 */
  quantity: number;
  /** 增加商品。 */
  onAdd: () => void;
  /** 减少商品。 */
  onRemove: () => void;
  /** 商品是否在售。 */
  available: boolean;
}) {
  return (
    <article className="bg-[#faf6f1] rounded-[2rem] border border-stone-200 p-5 md:p-6 product-card">
      <div className="product-visual">
        {product.badge ? <span className="product-badge">{product.badge}</span> : null}
        {product.imageUrl ? (
          <NextImage src={product.imageUrl} alt={product.name} width={1200} height={900} unoptimized className="product-uploaded-image" />
        ) : (
          <BunIllustration tone={product.tone} />
        )}
      </div>
      <div className="mt-5 product-copy">
        <p className="text-xs text-stone-600">{available ? `每日现蒸 · 余 ${product.stock} ${product.unit}` : "今日已售罄 · 明天再来"}</p>
        <h3 className="mt-1 font-serif text-xl md:text-2xl text-stone-800">{product.name}</h3>
        <p className="mt-1 text-sm text-stone-600">{product.description}</p>
      </div>
      <div className="mt-5 flex items-center justify-between gap-4 product-buy-row">
        <div>
          <span className="font-serif text-2xl text-stone-800">{formatMoney(product.price)}</span>
          <span className="ml-1 text-xs text-stone-600">/ {product.unit}</span>
        </div>
        <QuantityControl quantity={quantity} onAdd={onAdd} onRemove={onRemove} disabled={!available || product.stock === 0} />
      </div>
    </article>
  );
}

/** 空状态提示。 */
function EmptyState({ title, description }: { /** 提示标题。 */ title: string; /** 提示说明。 */ description: string }) {
  return (
    <div className="bg-[#faf6f1] rounded-[2rem] border border-stone-200 px-6 py-12 text-center">
      <div className="empty-basket" aria-hidden="true">麦</div>
      <h2 className="mt-5 font-serif text-2xl md:text-3xl text-stone-800">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm md:text-base text-stone-600">{description}</p>
    </div>
  );
}

/** 应用首页，承载顾客下单与商家接单的第一版流程。 */
export default function Home() {
  const [customerView, setCustomerView] = useState<CustomerView>("shop");
  const [adminView, setAdminView] = useState<AdminView>("orders");
  const [isAdmin, setIsAdmin] = useState(false);
  const [category, setCategory] = useState<Category>("全部");
  const [cart, setCart] = useState<Cart>({});
  const [orders, setOrders] = useState<Order[]>([]);
  const [hasLoadedOrders, setHasLoadedOrders] = useState(false);
  const [products, setProducts] = useState<Product[]>(PRODUCTS);
  const [hasLoadedProducts, setHasLoadedProducts] = useState(false);
  const [inventory, setInventory] = useState<ProductInventory>(DEFAULT_INVENTORY);
  const [hasLoadedInventory, setHasLoadedInventory] = useState(false);
  const [isProductEditorOpen, setIsProductEditorOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productDraft, setProductDraft] = useState<ProductDraft>(EMPTY_PRODUCT_DRAFT);
  const [productEditorError, setProductEditorError] = useState("");
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);
  const [storeSettingsDraft, setStoreSettingsDraft] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);
  const [hasLoadedStoreSettings, setHasLoadedStoreSettings] = useState(false);
  const [storeSettingsMessage, setStoreSettingsMessage] = useState("");
  const [isProcessingStoreImage, setIsProcessingStoreImage] = useState(false);
  const [fulfillment, setFulfillment] = useState<Fulfillment>("pickup");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  /** 配送订单选择的 3km 内区域。 */
  const [deliveryArea, setDeliveryArea] = useState("");
  /** 配送订单填写的详细门牌号。 */
  const [doorNumber, setDoorNumber] = useState("");
  const [pickupDay, setPickupDay] = useState("今天");
  const [pickupTime, setPickupTime] = useState("07:00–08:00");
  /** 配送订单预计送达时段。 */
  const [deliveryTime, setDeliveryTime] = useState("08:00–09:00");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState("");
  const [successOrderId, setSuccessOrderId] = useState("");
  /** 顾客当前可见的收款方式列表。 */
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  /** 商家正在编辑、尚未保存的收款方式列表。 */
  const [paymentMethodDrafts, setPaymentMethodDrafts] = useState<PaymentMethod[]>([]);
  /** 顾客当前选择的收款方式编号。 */
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState("");
  /** 收款设置保存结果或校验提示。 */
  const [paymentSettingsMessage, setPaymentSettingsMessage] = useState("");
  /** 是否正在保存收款设置。 */
  const [isSavingPaymentMethods, setIsSavingPaymentMethods] = useState(false);
  const [miniProgram, setMiniProgram] = useState<MiniProgramConfig>({ entryUrl: "", qrCodeUrl: "" });
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [backendMessage, setBackendMessage] = useState("");
  /** 当前设备恢复出的商家会话令牌，数据库只保存其摘要。 */
  const [merchantSessionToken, setMerchantSessionToken] = useState("");
  /** 当前商家会话的固定到期时间。 */
  const [merchantSessionExpiresAt, setMerchantSessionExpiresAt] = useState("");
  /** 商家登录用户名。 */
  const [merchantUsername, setMerchantUsername] = useState("admin");
  /** 商家登录或首次改密时填写的当前密码。 */
  const [merchantPassword, setMerchantPassword] = useState("");
  /** 商家首次登录后填写的新密码。 */
  const [merchantNewPassword, setMerchantNewPassword] = useState("");
  /** 当前已登录商家的公开账号信息。 */
  const [merchant, setMerchant] = useState<MerchantAccount | null>(null);
  /** 是否显示商家账号登录或首次改密弹层。 */
  const [isMerchantLoginOpen, setIsMerchantLoginOpen] = useState(false);
  /** 是否正在校验商家账号或修改密码。 */
  const [isMerchantAuthenticating, setIsMerchantAuthenticating] = useState(false);
  /** 商家登录和首次改密的校验提示。 */
  const [merchantAuthMessage, setMerchantAuthMessage] = useState("");
  /** 管理员可查看和维护的账号列表。 */
  const [merchantAccounts, setMerchantAccounts] = useState<MerchantAccount[]>([]);
  /** 全局后台会话时长输入值。 */
  const [sessionDurationDraft, setSessionDurationDraft] = useState("30");
  /** 当前新增或编辑的账号表单。 */
  const [merchantAccountDraft, setMerchantAccountDraft] = useState<MerchantAccountDraft>(EMPTY_MERCHANT_ACCOUNT_DRAFT);
  /** 账号权限页面的保存与校验提示。 */
  const [accessManagementMessage, setAccessManagementMessage] = useState("");
  /** 账号权限页面是否正在提交数据。 */
  const [isSavingAccessManagement, setIsSavingAccessManagement] = useState(false);
  /** 顾客资料二级页面的校验提示。 */
  const [profileError, setProfileError] = useState("");

  useEffect(() => {
    // 从当前设备恢复常用联系人和地址，使结算页能够自动带入资料。
    try {
      const savedProfile = window.localStorage.getItem("manyouyisi-customer-profile-v1");
      if (!savedProfile) return;
      const profile = JSON.parse(savedProfile) as Partial<CustomerProfile>;
      queueMicrotask(() => {
        if (typeof profile.name === "string") setCustomerName(profile.name);
        if (typeof profile.phone === "string") setPhone(profile.phone);
        if (typeof profile.deliveryArea === "string") setDeliveryArea(profile.deliveryArea);
        if (typeof profile.doorNumber === "string") setDoorNumber(profile.doorNumber);
      });
    } catch {
      window.localStorage.removeItem("manyouyisi-customer-profile-v1");
    }
  }, []);

  useEffect(() => {
    // 页面刷新后仅恢复未过期会话，并向服务端重新确认账号状态和角色。
    let isCancelled = false;
    try {
      const raw = window.localStorage.getItem(MERCHANT_SESSION_STORAGE_KEY);
      if (!raw) return () => { isCancelled = true; };
      const saved = JSON.parse(raw) as StoredMerchantSession;
      if (!saved.merchantSessionToken || !saved.merchant || new Date(saved.expiresAt).getTime() <= Date.now()) {
        window.localStorage.removeItem(MERCHANT_SESSION_STORAGE_KEY);
        return () => { isCancelled = true; };
      }
      queueMicrotask(async () => {
        try {
          const result = await callOrderingFunction<{ /** 服务端确认后的账号。 */ merchant: MerchantAccount; /** 会话固定到期时间。 */ expiresAt: string }>("getMerchantSession", { merchantSessionToken: saved.merchantSessionToken });
          if (isCancelled) return;
          await loadMerchantWorkspace(saved.merchantSessionToken, result.merchant);
          if (isCancelled) return;
          persistMerchantSession(saved.merchantSessionToken, result.merchant, result.expiresAt);
          setMerchantUsername(result.merchant.username);
          const isSuperAdmin = result.merchant.role === "super_admin";
          setIsAdmin(!isSuperAdmin);
          if (isSuperAdmin) setCustomerView("management");
        } catch {
          if (!isCancelled) clearMerchantSessionState();
        }
      });
    } catch {
      window.localStorage.removeItem(MERCHANT_SESSION_STORAGE_KEY);
    }
    return () => { isCancelled = true; };
    // 页面挂载时只恢复一次，避免后台数据加载函数的状态依赖触发重复登录。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // 到达服务端签发的固定时间后立即清理本机会话，避免继续展示过期后台。
    if (!merchantSessionToken || !merchantSessionExpiresAt) return;
    const remaining = new Date(merchantSessionExpiresAt).getTime() - Date.now();
    if (remaining <= 0) {
      queueMicrotask(() => clearMerchantSessionState());
      return;
    }
    const timer = window.setTimeout(() => clearMerchantSessionState(), remaining);
    return () => window.clearTimeout(timer);
  }, [merchantSessionExpiresAt, merchantSessionToken]);

  useEffect(() => {
    /** 统一处理任一后台接口返回的会话失效事件。 */
    function handleMerchantSessionInvalid(event: Event) {
      const message = event instanceof CustomEvent && typeof event.detail === "string" ? event.detail : "登录已失效，请重新登录";
      clearMerchantSessionState();
      setMerchantAuthMessage(message);
      setIsMerchantLoginOpen(true);
    }
    window.addEventListener("manyouyisi-merchant-session-invalid", handleMerchantSessionInvalid);
    return () => window.removeEventListener("manyouyisi-merchant-session-invalid", handleMerchantSessionInvalid);
  }, []);

  useEffect(() => {
    let isCancelled = false;
    let savedOrderList: Order[] = [];
    let savedPaymentMethods: PaymentMethod[] = [];
    try {
      const savedPayments = window.localStorage.getItem("manxiang-payment-methods-v1");
      savedPaymentMethods = savedPayments ? JSON.parse(savedPayments) as PaymentMethod[] : [];
    } catch {
      window.localStorage.removeItem("manxiang-payment-methods-v1");
    }
    try {
      const savedOrders = window.localStorage.getItem("manxiang-orders-v1");
      if (savedOrders) {
        savedOrderList = (JSON.parse(savedOrders) as Order[]).map((order) => normalizeOrder({
          ...order,
          paymentStatus: order.paymentStatus ?? "confirmed",
        }));
      }
    } catch {
      window.localStorage.removeItem("manxiang-orders-v1");
    }

    /** 从共享服务读取店铺资料和当前设备有权查看的订单。 */
    async function loadSharedStore() {
      try {
        const storeResult = await requestJson<StoreResponse>("/api/store");
        const tokens = savedOrderList.map((order) => order.accessToken).filter(Boolean).join(",");
        const orderResult = await requestJson<{ /** 当前设备有权查看的订单。 */ orders: Order[] }>(`/api/orders?tokens=${encodeURIComponent(tokens)}`);
        if (isCancelled) return;

        setProducts(storeResult.products);
        setInventory(Object.fromEntries(storeResult.products.map((product) => [product.id, { stock: product.stock, available: product.available !== false }])));
        if (storeResult.settings) {
          setStoreSettings(storeResult.settings);
          setStoreSettingsDraft(storeResult.settings);
        }
        const sharedPaymentMethods = getStorePaymentMethods(storeResult);
        setPaymentMethods(sharedPaymentMethods);
        setPaymentMethodDrafts(sharedPaymentMethods);
        setSelectedPaymentMethodId(sharedPaymentMethods.find((method) => method.enabled)?.id ?? "");
        setMiniProgram(storeResult.miniProgram);
        setOrders(orderResult.orders.length > 0 ? orderResult.orders.map(normalizeOrder) : savedOrderList);
        setBackendMessage("");
      } catch (error) {
        if (isCancelled) return;
        // 网络不可用时保留当前设备缓存，顾客仍可查看历史订单和本机收款设置。
        setOrders(savedOrderList);
        setPaymentMethods(savedPaymentMethods);
        setPaymentMethodDrafts(savedPaymentMethods);
        setSelectedPaymentMethodId(savedPaymentMethods.find((method) => method.enabled)?.id ?? "");
        setBackendMessage(error instanceof Error ? error.message : "共享服务暂时不可用");
      } finally {
        if (!isCancelled) setHasLoadedOrders(true);
      }
    }

    void loadSharedStore();
    return () => {
      isCancelled = true;
    };
  }, []);
  useEffect(() => {
    // 等本机数据读取完成后再保存，避免首次渲染覆盖历史订单。
    // 商家端会临时加载全部订单，禁止把其他顾客的订单令牌和联系信息写入顾客缓存。
    if (hasLoadedOrders && !isAdmin) {
      window.localStorage.setItem("manxiang-orders-v1", JSON.stringify(orders));
    }
  }, [hasLoadedOrders, isAdmin, orders]);

  useEffect(() => {
    // 商品库存和在售状态同样保存在当前设备，方便店主即时调整。
    let savedInventory = DEFAULT_INVENTORY;
    try {
      const localInventory = window.localStorage.getItem("manxiang-inventory-v1");
      if (localInventory) {
        savedInventory = { ...DEFAULT_INVENTORY, ...JSON.parse(localInventory) as ProductInventory };
      }
    } catch {
      window.localStorage.removeItem("manxiang-inventory-v1");
    }

    queueMicrotask(() => {
      setInventory(savedInventory);
      setHasLoadedInventory(true);
    });
  }, []);

  useEffect(() => {
    // 完成本机库存读取后，持续保存店主的调整结果。
    if (hasLoadedInventory) {
      window.localStorage.setItem("manxiang-inventory-v1", JSON.stringify(inventory));
    }
  }, [hasLoadedInventory, inventory]);

  useEffect(() => {
    // 商品资料保存在当前设备，包含商家新增和修改后的完整信息。
    let savedProducts = PRODUCTS;
    try {
      const localProducts = window.localStorage.getItem("manyouyisi-products-v1");
      if (localProducts) {
        savedProducts = JSON.parse(localProducts) as Product[];
      }
    } catch {
      window.localStorage.removeItem("manyouyisi-products-v1");
    }

    queueMicrotask(() => {
      setProducts(savedProducts);
      setInventory((current) => {
        const nextInventory = { ...current };
        savedProducts.forEach((product) => {
          if (!nextInventory[product.id]) {
            nextInventory[product.id] = { stock: product.stock, available: true };
          }
        });
        return nextInventory;
      });
      setHasLoadedProducts(true);
    });
  }, []);

  useEffect(() => {
    // 完成本机商品读取后，持续保存新增和编辑结果。
    if (hasLoadedProducts) {
      window.localStorage.setItem("manyouyisi-products-v1", JSON.stringify(products));
    }
  }, [hasLoadedProducts, products]);

  useEffect(() => {
    // 店铺装修内容保存在当前设备，刷新后继续使用商家上次保存的设置。
    let savedSettings = DEFAULT_STORE_SETTINGS;
    try {
      const localSettings = window.localStorage.getItem("manyouyisi-store-settings-v1");
      if (localSettings) {
        savedSettings = { ...DEFAULT_STORE_SETTINGS, ...JSON.parse(localSettings) as StoreSettings };
        // 只迁移旧默认配送提示，保留商家自行填写的其他文案。
        if (savedSettings.deliveryNote === "满 20 元可配送 · 配送费 3 元") {
          savedSettings.deliveryNote = DEFAULT_STORE_SETTINGS.deliveryNote;
        }
      }
    } catch {
      window.localStorage.removeItem("manyouyisi-store-settings-v1");
    }

    queueMicrotask(() => {
      setStoreSettings(savedSettings);
      setStoreSettingsDraft(savedSettings);
      setHasLoadedStoreSettings(true);
    });
  }, []);

  useEffect(() => {
    // 仅在读取完成后写入，避免首次渲染覆盖已有店铺装修。
    if (hasLoadedStoreSettings) {
      window.localStorage.setItem("manyouyisi-store-settings-v1", JSON.stringify(storeSettings));
    }
  }, [hasLoadedStoreSettings, storeSettings]);

  const effectiveProducts = useMemo(
    () => products.map((product) => ({
      ...product,
      stock: inventory[product.id]?.stock ?? product.stock,
    })),
    [inventory, products],
  );

  const filteredProducts = useMemo(
    () => effectiveProducts.filter((product) => (
      (inventory[product.id]?.available ?? true)
      && (category === "全部" || product.category === category)
    )),
    [category, effectiveProducts, inventory],
  );

  const cartItems = useMemo(
    () => effectiveProducts.filter((product) => (
      (cart[product.id] ?? 0) > 0 && (inventory[product.id]?.available ?? true)
    )),
    [cart, effectiveProducts, inventory],
  );

  const cartCount = useMemo(
    () => Object.values(cart).reduce((sum, quantity) => sum + quantity, 0),
    [cart],
  );

  const cartTotal = useMemo(
    () => cartItems.reduce((sum, product) => sum + product.price * cart[product.id], 0),
    [cart, cartItems],
  );

  /** 当前取餐方式对应的配送费，满额时自动减免。 */
  const currentDeliveryFee = fulfillment === "delivery" && cartTotal < FREE_DELIVERY_THRESHOLD ? DELIVERY_FEE : 0;

  /** 当前订单应付金额。 */
  const payableTotal = cartTotal + currentDeliveryFee;

  const activeOrders = useMemo(
    () => orders.filter((order) => order.status !== "completed" && order.status !== "cancelled"),
    [orders],
  );

  const todayRevenue = useMemo(
    () => orders.reduce((sum, order) => sum + order.total, 0),
    [orders],
  );

  const productionSummary = useMemo(
    () => effectiveProducts.map((product) => ({
      product,
      quantity: activeOrders.reduce((sum, order) => {
        const item = order.items.find((orderItem) => orderItem.productId === product.id);
        return sum + (item?.quantity ?? 0);
      }, 0),
    })).filter((item) => item.quantity > 0),
    [activeOrders, effectiveProducts],
  );

  const successOrder = useMemo(
    () => orders.find((order) => order.id === successOrderId),
    [orders, successOrderId],
  );

  /** 当前向顾客展示的已启用收款方式。 */
  const activePaymentMethods = useMemo(
    () => paymentMethods.filter((method) => method.enabled && method.qrCodeUrl),
    [paymentMethods],
  );

  /** 顾客选择的收款方式；选择失效时自动回退到第一项。 */
  const selectedPaymentMethod = useMemo(
    () => activePaymentMethods.find((method) => method.id === selectedPaymentMethodId) ?? activePaymentMethods[0],
    [activePaymentMethods, selectedPaymentMethodId],
  );

  /** 增加指定商品的购物车数量，并受当日库存限制。 */
  function addProduct(product: Product) {
    setCart((current) => {
      const currentQuantity = current[product.id] ?? 0;
      if (!inventory[product.id]?.available || currentQuantity >= product.stock) {
        return current;
      }
      return { ...current, [product.id]: currentQuantity + 1 };
    });
  }

  /** 减少指定商品的购物车数量。 */
  function removeProduct(productId: string) {
    setCart((current) => {
      const nextQuantity = Math.max((current[productId] ?? 0) - 1, 0);
      return { ...current, [productId]: nextQuantity };
    });
  }

  /** 切换至顾客端页面并回到页面顶部。 */
  function navigateCustomer(view: CustomerView) {
    if (view === "management" && (!merchantSessionToken || merchant?.role !== "super_admin")) return;
    setCustomerView(view);
    setSuccessOrderId("");
    setProfileError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /** 校验并保存顾客常用联系人和默认配送地址。 */
  function saveCustomerProfile() {
    if (!customerName.trim()) {
      setProfileError("请填写姓名或常用称呼");
      return;
    }
    if (!/^1\d{10}$/.test(phone)) {
      setProfileError("请填写正确的 11 位手机号");
      return;
    }
    if ((deliveryArea && !doorNumber.trim()) || (!deliveryArea && doorNumber.trim())) {
      setProfileError("配送区域和门牌号需要一起填写");
      return;
    }

    // 资料仅保存在顾客当前设备，不会在未下单时上传到云端。
    const profile: CustomerProfile = {
      name: customerName.trim(),
      phone,
      deliveryArea,
      doorNumber: doorNumber.trim(),
    };
    window.localStorage.setItem("manyouyisi-customer-profile-v1", JSON.stringify(profile));
    setCustomerName(profile.name);
    setDoorNumber(profile.doorNumber);
    setProfileError("");
    navigateCustomer("profile");
  }

  /** 放弃本次编辑并恢复最近一次保存的顾客常用资料。 */
  function cancelCustomerProfileEdit() {
    try {
      const savedProfile = window.localStorage.getItem("manyouyisi-customer-profile-v1");
      const profile = savedProfile ? JSON.parse(savedProfile) as Partial<CustomerProfile> : {};
      setCustomerName(typeof profile.name === "string" ? profile.name : "");
      setPhone(typeof profile.phone === "string" ? profile.phone : "");
      setDeliveryArea(typeof profile.deliveryArea === "string" ? profile.deliveryArea : "");
      setDoorNumber(typeof profile.doorNumber === "string" ? profile.doorNumber : "");
    } catch {
      window.localStorage.removeItem("manyouyisi-customer-profile-v1");
      setCustomerName("");
      setPhone("");
      setDeliveryArea("");
      setDoorNumber("");
    }
    navigateCustomer("profile");
  }

  /** 将有效后台会话保存到当前设备并同步页面状态。 */
  function persistMerchantSession(sessionToken: string, account: MerchantAccount, expiresAt: string) {
    const storedSession: StoredMerchantSession = { merchantSessionToken: sessionToken, merchant: account, expiresAt };
    window.localStorage.setItem(MERCHANT_SESSION_STORAGE_KEY, JSON.stringify(storedSession));
    setMerchantSessionToken(sessionToken);
    setMerchantSessionExpiresAt(expiresAt);
    setMerchant(account);
  }

  /** 清除当前设备和页面中的后台会话信息。 */
  function clearMerchantSessionState() {
    window.localStorage.removeItem(MERCHANT_SESSION_STORAGE_KEY);
    setMerchantSessionToken("");
    setMerchantSessionExpiresAt("");
    setMerchant(null);
    setMerchantAccounts([]);
    setIsAdmin(false);
    setAdminView("orders");
    // 会话失效后立即离开超级管理员页面，避免继续展示缓存中的账号资料。
    setCustomerView((current) => current === "management" ? "shop" : current);
  }

  /** 读取管理员可见的账号和全局会话配置。 */
  async function loadAccessManagement(sessionToken: string) {
    const result = await callOrderingFunction<AccessManagementResponse>("getAccessManagement", { merchantSessionToken: sessionToken });
    setMerchantAccounts(result.accounts);
    setSessionDurationDraft(String(result.sessionDurationMinutes));
  }

  /** 使用数据库会话加载商家有权查看的商品、订单、店铺装修和收款设置。 */
  async function loadMerchantWorkspace(sessionToken: string, account?: MerchantAccount) {
    const [result, storeResult] = await Promise.all([
      callOrderingFunction<{ /** 商家有权查看的全部订单。 */ orders: Order[] }>("getOrders", { merchantSessionToken: sessionToken }),
      callOrderingFunction<StoreResponse>("getStore", { merchantSessionToken: sessionToken }),
    ]);
    const sharedPaymentMethods = getStorePaymentMethods(storeResult);
    setOrders(result.orders);
    setProducts(storeResult.products);
    setInventory(Object.fromEntries(storeResult.products.map((product) => [product.id, { stock: product.stock, available: product.available !== false }])));
    if (storeResult.settings) {
      setStoreSettings(storeResult.settings);
      setStoreSettingsDraft(storeResult.settings);
    }
    setPaymentMethods(sharedPaymentMethods);
    setPaymentMethodDrafts(sharedPaymentMethods);
    setSelectedPaymentMethodId(sharedPaymentMethods.find((method) => method.enabled)?.id ?? "");
    if (account && ["super_admin", "admin"].includes(account.role)) await loadAccessManagement(sessionToken);
    else setMerchantAccounts([]);
  }

  /** 使用数据库中的商家用户名和密码登录，并取得可在当前设备恢复的短期会话。 */
  async function loginMerchant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const username = merchantUsername.trim().toLowerCase();
    if (!username || !merchantPassword) {
      setMerchantAuthMessage("请输入商家用户名和密码");
      return;
    }
    setIsMerchantAuthenticating(true);
    setMerchantAuthMessage("");
    try {
      const result = await callOrderingFunction<MerchantLoginResponse>("merchantLogin", { username, password: merchantPassword });
      // 初始密码账号只能先改密；其他后台账号按角色加载受保护的经营数据。
      if (!result.merchant.mustChangePassword) await loadMerchantWorkspace(result.merchantSessionToken, result.merchant);
      persistMerchantSession(result.merchantSessionToken, result.merchant, result.expiresAt);
      setMerchantUsername(result.merchant.username);
      const isSuperAdmin = result.merchant.role === "super_admin";
      setIsAdmin(!isSuperAdmin);
      if (isSuperAdmin) setCustomerView("management");
      setIsMerchantLoginOpen(false);
      setBackendMessage("");
      if (!result.merchant.mustChangePassword) setMerchantPassword("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      clearMerchantSessionState();
      setMerchantAuthMessage(error instanceof Error ? error.message : "商家登录失败");
    } finally {
      setIsMerchantAuthenticating(false);
    }
  }

  /** 首次登录后校验当前密码，并通过云函数原子更新数据库密码摘要。 */
  async function changeMerchantPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!merchantSessionToken || !merchantPassword || merchantNewPassword.length < 10) {
      setMerchantAuthMessage("新密码至少需要 10 位");
      return;
    }
    setIsMerchantAuthenticating(true);
    setMerchantAuthMessage("");
    try {
      await callOrderingFunction<{ /** 密码是否修改成功。 */ ok: boolean }>("changeMerchantPassword", {
        merchantSessionToken,
        currentPassword: merchantPassword,
        newPassword: merchantNewPassword,
      });
      // 改密事务会撤销旧会话，前端必须清除令牌并要求使用新密码重新登录。
      clearMerchantSessionState();
      setIsMerchantLoginOpen(true);
      setMerchantPassword("");
      setMerchantNewPassword("");
      setMerchantAuthMessage("密码已修改，请使用新密码重新登录");
    } catch (error) {
      setMerchantAuthMessage(error instanceof Error ? error.message : "密码修改失败");
    } finally {
      setIsMerchantAuthenticating(false);
    }
  }

  /** 保存全局后台登录有效期，新值只用于之后创建的会话。 */
  async function saveSessionDuration() {
    const sessionDurationMinutes = Number(sessionDurationDraft);
    if (!merchantSessionToken || !Number.isInteger(sessionDurationMinutes) || sessionDurationMinutes < 5 || sessionDurationMinutes > 1440) {
      setAccessManagementMessage("登录有效期必须是 5 至 1440 分钟的整数");
      return;
    }
    setIsSavingAccessManagement(true);
    setAccessManagementMessage("");
    try {
      const result = await callOrderingFunction<{ /** 保存后的登录有效分钟数。 */ sessionDurationMinutes: number }>("saveSessionSettings", { merchantSessionToken, sessionDurationMinutes });
      setSessionDurationDraft(String(result.sessionDurationMinutes));
      setAccessManagementMessage("会话时长已保存，将从下一次登录开始生效");
    } catch (error) {
      setAccessManagementMessage(error instanceof Error ? error.message : "会话设置保存失败");
    } finally {
      setIsSavingAccessManagement(false);
    }
  }

  /** 打开一个空白账号表单。 */
  function startNewMerchantAccount() {
    setMerchantAccountDraft(EMPTY_MERCHANT_ACCOUNT_DRAFT);
    setAccessManagementMessage("");
  }

  /** 将选中账号的公开资料载入编辑表单。 */
  function editMerchantAccount(account: MerchantAccount) {
    setMerchantAccountDraft({
      id: account.id,
      username: account.username,
      displayName: account.displayName,
      role: account.role,
      enabled: account.enabled,
      temporaryPassword: "",
    });
    setAccessManagementMessage("");
  }

  /** 新增或保存账号，并用服务端返回值刷新权限列表。 */
  async function saveMerchantAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!merchantSessionToken || !merchantAccountDraft.username.trim() || !merchantAccountDraft.displayName.trim()) {
      setAccessManagementMessage("请完整填写用户名和显示名称");
      return;
    }
    if (!merchantAccountDraft.id && merchantAccountDraft.temporaryPassword.length < 10) {
      setAccessManagementMessage("新账号临时密码至少需要 10 位");
      return;
    }
    setIsSavingAccessManagement(true);
    setAccessManagementMessage("");
    try {
      const result = await callOrderingFunction<AccessManagementResponse>("saveMerchantAccount", {
        merchantSessionToken,
        account: {
          id: merchantAccountDraft.id,
          username: merchantAccountDraft.username,
          displayName: merchantAccountDraft.displayName,
          role: merchantAccountDraft.role,
          enabled: merchantAccountDraft.enabled,
        },
        temporaryPassword: merchantAccountDraft.temporaryPassword,
      });
      setMerchantAccounts(result.accounts);
      setSessionDurationDraft(String(result.sessionDurationMinutes));
      setMerchantAccountDraft(EMPTY_MERCHANT_ACCOUNT_DRAFT);
      setAccessManagementMessage("账号设置已保存；角色、停用或重置密码会立即撤销旧会话");
    } catch (error) {
      setAccessManagementMessage(error instanceof Error ? error.message : "账号设置保存失败");
    } finally {
      setIsSavingAccessManagement(false);
    }
  }

  /** 二次确认后删除后台账号，并使用服务端返回结果刷新权限列表。 */
  async function removeMerchantAccount(account: MerchantAccount) {
    if (!merchantSessionToken || merchant?.role !== "super_admin" || account.id === merchant.id) return;
    const confirmed = window.confirm(`确认删除“${account.displayName}（${account.username}）”？该账号的全部登录会话会立即失效，且无法恢复。`);
    if (!confirmed) return;
    setIsSavingAccessManagement(true);
    setAccessManagementMessage("");
    try {
      const result = await callOrderingFunction<AccessManagementResponse>("deleteMerchantAccount", {
        merchantSessionToken,
        accountId: account.id,
      });
      setMerchantAccounts(result.accounts);
      setSessionDurationDraft(String(result.sessionDurationMinutes));
      if (merchantAccountDraft.id === account.id) setMerchantAccountDraft(EMPTY_MERCHANT_ACCOUNT_DRAFT);
      setAccessManagementMessage("账号已删除，其全部旧会话已撤销");
    } catch (error) {
      setAccessManagementMessage(error instanceof Error ? error.message : "账号删除失败");
    } finally {
      setIsSavingAccessManagement(false);
    }
  }

  /** 从当前设备读取顾客订单，退出后台后恢复顾客自己的订单列表。 */
  function restoreCustomerOrdersFromDevice() {
    try {
      const savedOrders = window.localStorage.getItem("manxiang-orders-v1");
      setOrders(savedOrders ? (JSON.parse(savedOrders) as Order[]).map(normalizeOrder) : []);
    } catch {
      setOrders([]);
    }
  }

  /** 主动撤销后台会话并退出超级管理员管理页。 */
  async function logoutMerchantSession() {
    if (merchantSessionToken) {
      try {
        await callOrderingFunction("merchantLogout", { merchantSessionToken });
      } catch {
        // 退出界面不依赖网络成功；令牌仍会在服务端固定到期。
      }
    }
    restoreCustomerOrdersFromDevice();
    clearMerchantSessionState();
    setMerchantPassword("");
    setMerchantNewPassword("");
    setMerchantAuthMessage("");
    navigateCustomer("shop");
  }

  /** 在顾客端与 CloudBase 云端商家工作台之间切换，但保留有效会话。 */
  async function toggleAdmin() {
    if (isAdmin) {
      setIsAdmin(false);
      navigateCustomer(merchant?.role === "super_admin" ? "management" : "profile");
      return;
    }
    if (merchantSessionToken && merchant) {
      try {
        await loadMerchantWorkspace(merchantSessionToken, merchant);
        setIsAdmin(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (error) {
        clearMerchantSessionState();
        setMerchantAuthMessage(error instanceof Error ? error.message : "商家登录已失效");
        setIsMerchantLoginOpen(true);
      }
      return;
    }
    setMerchantAuthMessage("");
    setIsMerchantLoginOpen(true);
  }

  /** 校验顾客信息，并通过共享服务生成一条待付款订单。 */
  async function submitOrder() {
    if (!customerName.trim()) {
      setFormError("请填写取餐人姓名");
      return;
    }
    if (!/^1\d{10}$/.test(phone)) {
      setFormError("请填写正确的 11 位手机号");
      return;
    }
    if (fulfillment === "delivery" && cartTotal < DELIVERY_MINIMUM) {
      setFormError("配送订单满 " + DELIVERY_MINIMUM + " 元起送");
      return;
    }
    if (fulfillment === "delivery" && (!deliveryArea || !doorNumber.trim())) {
      setFormError("请选择配送区域并填写楼栋门牌号");
      return;
    }
    if (cartItems.length === 0) {
      setFormError("购物车还是空的");
      return;
    }

    setIsSubmittingOrder(true);
    try {
      const result = await requestJson<{
        /** 新订单编号。 */
        id: string;
        /** 顾客访问该订单的随机令牌。 */
        accessToken: string;
        /** 服务端下单时间。 */
        createdAt: string;
        /** A/D 三位短订单号。 */
        shortCode: string;
        /** 服务端重新计算的商品金额。 */
        subtotal: number;
        /** 服务端重新计算的配送费。 */
        deliveryFee: number;
        /** 服务端重新计算的订单总额。 */
        total: number;
        /** 初始订单状态。 */
        status: OrderStatus;
        /** 初始配送状态。 */
        deliveryStatus: DeliveryStatus;
        /** 初始付款状态。 */
        paymentStatus: PaymentStatus;
      }>("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cartItems.map((product) => ({ productId: product.id, quantity: cart[product.id] })),
          orderType: fulfillment,
          customerName,
          phone,
          deliveryArea,
          doorNumber,
          pickupDay,
          pickupTime: fulfillment === "pickup" ? pickupTime : "",
          deliveryTime: fulfillment === "delivery" ? deliveryTime : "",
          remark: note,
        }),
      });
      const order: Order = {
        ...result,
        items: cartItems.map((product) => ({
          productId: product.id,
          name: product.name,
          quantity: cart[product.id],
          unit: product.unit,
          price: product.price,
        })),
        fulfillment,
        customerName: customerName.trim(),
        phone,
        address: fulfillment === "delivery" ? deliveryArea + " " + doorNumber.trim() : "",
        deliveryArea: fulfillment === "delivery" ? deliveryArea : "",
        doorNumber: fulfillment === "delivery" ? doorNumber.trim() : "",
        pickupDay,
        pickupTime: fulfillment === "pickup" ? pickupTime : "",
        deliveryTime: fulfillment === "delivery" ? deliveryTime : "",
        note: note.trim(),
      };
      setOrders((current) => [order, ...current]);
      setCart({});
      setFormError("");
      setSuccessOrderId(order.id);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "下单失败，请稍后重试");
    } finally {
      setIsSubmittingOrder(false);
    }
  }

  /** 通过 CloudBase 云函数更新商家端订单状态。 */
  async function updateOrderStatus(orderId: string, status: OrderStatus) {
    if (!merchantSessionToken) {
      window.alert("请先使用用户名和密码登录云端商家端");
      return;
    }

    try {
      await requestJson<{ /** 更新是否成功。 */ ok: boolean }>(`/api/orders/${encodeURIComponent(orderId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-merchant-session": merchantSessionToken },
        body: JSON.stringify({ status }),
      });
      setOrders((current) => current.map((order) => (
        order.id === orderId ? { ...order, status } : order
      )));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "订单状态更新失败");
    }
  }

  /** 通过共享服务单独更新配送订单的配送进度。 */
  async function updateDeliveryStatus(orderId: string, deliveryStatus: DeliveryStatus) {
    if (!merchantSessionToken) {
      window.alert("请先使用用户名和密码登录云端商家端");
      return;
    }

    try {
      await requestJson<{ /** 更新是否成功。 */ ok: boolean }>("/api/orders/" + encodeURIComponent(orderId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-merchant-session": merchantSessionToken },
        body: JSON.stringify({ deliveryStatus }),
      });
      setOrders((current) => current.map((order) => (
        order.id === orderId
          ? { ...order, deliveryStatus, status: deliveryStatus === "delivered" ? "completed" : order.status }
          : order
      )));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "配送状态更新失败");
    }
  }

  /** 由商家确认或驳回顾客提交的付款信息。 */
  async function updatePaymentStatus(orderId: string, paymentStatus: Extract<PaymentStatus, "confirmed" | "rejected">) {
    if (!merchantSessionToken) {
      window.alert("请先使用用户名和密码登录云端商家端");
      return;
    }

    try {
      await requestJson<{ /** 更新是否成功。 */ ok: boolean }>(`/api/orders/${encodeURIComponent(orderId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-merchant-session": merchantSessionToken },
        body: JSON.stringify({ paymentStatus }),
      });
      setOrders((current) => current.map((order) => (
        order.id === orderId ? { ...order, paymentStatus } : order
      )));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "付款状态更新失败");
    }
  }

  /** 新增一个空白收款方式草稿并滚动到设置区。 */
  function addPaymentMethod() {
    if (paymentMethodDrafts.length >= 12) {
      setPaymentSettingsMessage("最多可配置 12 个收款码");
      return;
    }
    setPaymentMethodDrafts((current) => [...current, {
      id: createPaymentMethodId(),
      name: "",
      payeeName: "",
      qrCodeUrl: "",
      note: "",
      enabled: true,
    }]);
    setPaymentSettingsMessage("已新增空白收款方式，请填写后保存");
  }

  /** 更新指定收款方式草稿中的一个或多个字段。 */
  function updatePaymentMethodDraft(paymentMethodId: string, updates: Partial<PaymentMethod>) {
    setPaymentMethodDrafts((current) => current.map((method) => (
      method.id === paymentMethodId ? { ...method, ...updates } : method
    )));
  }

  /** 经商家确认后删除一个收款方式草稿。 */
  function removePaymentMethod(paymentMethodId: string) {
    if (!window.confirm("确定删除这个收款码吗？保存设置后将不再向顾客展示。")) return;
    setPaymentMethodDrafts((current) => current.filter((method) => method.id !== paymentMethodId));
    setPaymentSettingsMessage("已从列表移除，点击保存后生效");
  }

  /** 校验并将完整收款方式列表保存到 CloudBase。 */
  async function savePaymentMethods() {
    const normalizedMethods = paymentMethodDrafts.map((method) => ({
      ...method,
      name: method.name.trim(),
      payeeName: method.payeeName.trim(),
      qrCodeUrl: method.qrCodeUrl.trim(),
      note: method.note.trim(),
    }));
    if (normalizedMethods.some((method) => !method.name || !method.payeeName || !isValidPaymentImageUrl(method.qrCodeUrl))) {
      setPaymentSettingsMessage("请完整填写名称、收款人和 HTTPS 二维码图片地址");
      return;
    }

    setIsSavingPaymentMethods(true);
    try {
      if (!merchantSessionToken) {
        setPaymentSettingsMessage("请先使用用户名和密码登录云端商家端");
        return;
      }

      const result = await requestJson<{ /** 服务端保存后的收款方式列表。 */ paymentMethods: PaymentMethod[] }>("/api/store", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-merchant-session": merchantSessionToken },
        body: JSON.stringify({ paymentMethods: normalizedMethods }),
      });
      setPaymentMethods(result.paymentMethods);
      setPaymentMethodDrafts(result.paymentMethods);
      setSelectedPaymentMethodId((current) => result.paymentMethods.some((method) => method.id === current && method.enabled)
        ? current
        : result.paymentMethods.find((method) => method.enabled)?.id ?? "");
      setPaymentSettingsMessage("收款设置已保存，并同步到网页版");
    } catch (error) {
      setPaymentSettingsMessage(error instanceof Error ? error.message : "收款设置保存失败");
    } finally {
      setIsSavingPaymentMethods(false);
    }
  }

  /** 顾客扫码后提交付款待核验状态，实际到账仍由商家人工确认。 */
  async function markOrderPaid(order: Order) {
    if (!order.accessToken) return;
    if (!selectedPaymentMethod) {
      window.alert("商家尚未配置可用收款码");
      return;
    }
    const paymentReference = window.prompt("可填写付款备注或流水号后四位（选填）")?.trim() ?? "";
    try {
      await requestJson<{ /** 更新是否成功。 */ ok: boolean }>(`/api/orders/${encodeURIComponent(order.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-order-token": order.accessToken },
        body: JSON.stringify({ paymentStatus: "submitted", paymentReference, paymentMethodId: selectedPaymentMethod.id }),
      });
      setOrders((current) => current.map((item) => (
        item.id === order.id ? { ...item, paymentStatus: "submitted", paymentReference, paymentMethodId: selectedPaymentMethod.id } : item
      )));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "付款信息提交失败");
    }
  }
  /** 调整指定商品库存并立即保存到 CloudBase。 */
  async function updateProductStock(productId: string, change: number) {
    const product = products.find((item) => item.id === productId);
    if (!product || !merchantSessionToken) return;
    const nextStock = Math.max((inventory[productId]?.stock ?? product.stock) + change, 0);
    try {
      const result = await callOrderingFunction<{ /** 云端保存后的商品。 */ product: Product }>("saveProduct", {
        merchantSessionToken,
        product: { ...product, stock: nextStock, available: inventory[productId]?.available ?? true },
      });
      setProducts((current) => current.map((item) => item.id === productId ? result.product : item));
      setInventory((current) => ({ ...current, [productId]: { stock: result.product.stock, available: result.product.available !== false } }));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "库存保存失败");
    }
  }

  /** 切换商品上下架状态并立即保存到 CloudBase。 */
  async function toggleProductAvailability(productId: string) {
    const product = products.find((item) => item.id === productId);
    if (!product || !merchantSessionToken) return;
    const available = !(inventory[productId]?.available ?? true);
    try {
      const result = await callOrderingFunction<{ /** 云端保存后的商品。 */ product: Product }>("saveProduct", {
        merchantSessionToken,
        product: { ...product, stock: inventory[productId]?.stock ?? product.stock, available },
      });
      setProducts((current) => current.map((item) => item.id === productId ? result.product : item));
      setInventory((current) => ({ ...current, [productId]: { stock: result.product.stock, available: result.product.available !== false } }));
      if (!available) setCart((current) => ({ ...current, [productId]: 0 }));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "上下架状态保存失败");
    }
  }

  /** 打开新增商品表单。 */
  function openNewProductEditor() {
    setEditingProductId(null);
    setProductDraft(EMPTY_PRODUCT_DRAFT);
    setProductEditorError("");
    setIsProductEditorOpen(true);
    requestAnimationFrame(() => document.getElementById("product-editor")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  /** 打开指定商品的编辑表单。 */
  function openProductEditor(product: Product) {
    setEditingProductId(product.id);
    setProductDraft({
      name: product.name,
      description: product.description,
      price: String(product.price),
      unit: product.unit,
      category: product.category,
      stock: String(product.stock),
      badge: product.badge ?? "",
      imageUrl: product.imageUrl ?? "",
      imageFileId: product.imageFileId ?? "",
    });
    setProductEditorError("");
    setIsProductEditorOpen(true);
    requestAnimationFrame(() => document.getElementById("product-editor")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  /** 关闭商品编辑表单并清除临时内容。 */
  function closeProductEditor() {
    setIsProductEditorOpen(false);
    setEditingProductId(null);
    setProductDraft(EMPTY_PRODUCT_DRAFT);
    setProductEditorError("");
  }

  /** 读取并压缩商家选择的商品图片。 */
  async function handleProductImage(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setProductEditorError("请选择 JPG、PNG 或 WebP 图片");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setProductEditorError("图片不能超过 12MB");
      return;
    }

    setIsProcessingImage(true);
    setProductEditorError("");
    try {
      const dataUrl = await compressUploadedImage(file);
      const uploaded = await callOrderingFunction<{ /** 云存储文件编号。 */ fileId: string; /** 临时预览地址。 */ url: string }>("uploadImage", { merchantSessionToken, scene: "product", dataUrl });
      setProductDraft((current) => ({ ...current, imageUrl: uploaded.url, imageFileId: uploaded.fileId }));
    } catch (error) {
      setProductEditorError(error instanceof Error ? error.message : "图片处理失败");
    } finally {
      setIsProcessingImage(false);
    }
  }

  /** 读取并压缩商家选择的主视觉背景图片。 */
  async function handleStoreBackground(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setStoreSettingsMessage("请选择 JPG、PNG 或 WebP 图片");
      return;
    }
    if (file.size > 16 * 1024 * 1024) {
      setStoreSettingsMessage("背景图片不能超过 16MB");
      return;
    }

    setIsProcessingStoreImage(true);
    setStoreSettingsMessage("");
    try {
      const dataUrl = await compressUploadedImage(file, 1800, 0.8);
      const uploaded = await callOrderingFunction<{ /** 云存储文件编号。 */ fileId: string; /** 临时预览地址。 */ url: string }>("uploadImage", { merchantSessionToken, scene: "store", dataUrl });
      setStoreSettingsDraft((current) => ({ ...current, heroBackgroundImage: uploaded.url, heroBackgroundFileId: uploaded.fileId }));
    } catch (error) {
      setStoreSettingsMessage(error instanceof Error ? error.message : "背景图片处理失败");
    } finally {
      setIsProcessingStoreImage(false);
    }
  }

  /** 校验并保存顾客端店铺展示设置。 */
  async function saveStoreSettings() {
    const nextSettings: StoreSettings = {
      brandMark: storeSettingsDraft.brandMark.trim(),
      brandName: storeSettingsDraft.brandName.trim(),
      brandTagline: storeSettingsDraft.brandTagline.trim(),
      heroBadge: storeSettingsDraft.heroBadge.trim(),
      heroTitle: storeSettingsDraft.heroTitle.trim(),
      heroDescription: storeSettingsDraft.heroDescription.trim(),
      heroButtonText: storeSettingsDraft.heroButtonText.trim(),
      deliveryNote: storeSettingsDraft.deliveryNote.trim(),
      heroBackgroundImage: storeSettingsDraft.heroBackgroundImage,
      heroBackgroundFileId: storeSettingsDraft.heroBackgroundFileId,
    };

    if (!nextSettings.brandMark || !nextSettings.brandName || !nextSettings.brandTagline) {
      setStoreSettingsMessage("请填写完整的店铺名称区域");
      return;
    }
    if (!nextSettings.heroBadge || !nextSettings.heroTitle || !nextSettings.heroDescription) {
      setStoreSettingsMessage("请填写完整的首页主视觉文案");
      return;
    }
    if (!nextSettings.heroButtonText || !nextSettings.deliveryNote) {
      setStoreSettingsMessage("请填写按钮文字和配送提示");
      return;
    }

    if (!merchantSessionToken) {
      setStoreSettingsMessage("请先使用用户名和密码登录云端商家端");
      return;
    }
    try {
      const result = await callOrderingFunction<{ /** 云端保存后的店铺设置。 */ settings: StoreSettings }>("saveStoreSettings", { merchantSessionToken, settings: nextSettings });
      setStoreSettings(result.settings);
      setStoreSettingsDraft(result.settings);
      setStoreSettingsMessage("店铺展示已保存到 CloudBase，两端已同步更新");
    } catch (error) {
      setStoreSettingsMessage(error instanceof Error ? error.message : "店铺设置保存失败");
    }
  }

  /** 恢复店铺装修的默认文案和默认背景。 */
  function restoreDefaultStoreSettings() {
    setStoreSettingsDraft(DEFAULT_STORE_SETTINGS);
    setStoreSettingsMessage("已恢复默认内容，点击保存后生效");
  }

  /** 校验商品表单并保存新增或修改结果。 */
  async function saveProduct() {
    const name = productDraft.name.trim();
    const description = productDraft.description.trim();
    const unit = productDraft.unit.trim();
    const price = Number(productDraft.price);
    const stock = Number(productDraft.stock);

    if (!name) {
      setProductEditorError("请填写商品名字");
      return;
    }
    if (!description) {
      setProductEditorError("请填写商品描述");
      return;
    }
    if (!unit) {
      setProductEditorError("请填写计价单位");
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setProductEditorError("请输入大于 0 的商品价格");
      return;
    }
    if (!Number.isInteger(stock) || stock < 0) {
      setProductEditorError("库存需要填写 0 或正整数");
      return;
    }

    if (!merchantSessionToken) {
      setProductEditorError("请先使用用户名和密码登录云端商家端");
      return;
    }
    const productId = editingProductId || `product-${Date.now()}`;
    const currentProduct = products.find((product) => product.id === productId);
    try {
      const result = await callOrderingFunction<{ /** 云端保存后的商品。 */ product: Product }>("saveProduct", {
        merchantSessionToken,
        product: {
          id: productId,
          name,
          description,
          price,
          unit,
          category: productDraft.category,
          stock,
          badge: productDraft.badge.trim(),
          imageFileId: productDraft.imageFileId,
          tone: getToneForCategory(productDraft.category),
          available: currentProduct ? inventory[productId]?.available ?? true : true,
        },
      });
      setProducts((current) => current.some((product) => product.id === productId)
        ? current.map((product) => product.id === productId ? result.product : product)
        : [...current, result.product]);
      setInventory((current) => ({ ...current, [productId]: { stock: result.product.stock, available: result.product.available !== false } }));
      closeProductEditor();
    } catch (error) {
      setProductEditorError(error instanceof Error ? error.message : "商品保存失败");
    }
  }

  /** 根据订单当前制作阶段返回商家下一步操作。 */
  function getNextOrderAction(order: Order): { /** 下一状态。 */ status: OrderStatus; /** 按钮文案。 */ label: string } | null {
    if (order.status === "pending") return { status: "preparing", label: "接单并开始制作" };
    if (order.status === "preparing") {
      return { status: "ready", label: order.fulfillment === "pickup" ? "制作完成，通知取货" : "制作完成，等待配送" };
    }
    if (order.status === "ready" && order.fulfillment === "pickup") return { status: "completed", label: "确认已取餐" };
    return null;
  }

  /** 渲染管理员账号增删改查、权限分配和会话设置的统一内容。 */
  function renderAccessManagement() {
    return (
            <section className="mt-5 space-y-6">
              <div>
                <h2 className="font-serif text-2xl md:text-3xl">{merchant?.role === "super_admin" ? "系统管理" : "账号与权限"}</h2>
                <p className="mt-1 text-sm text-stone-600">{merchant?.role === "super_admin" ? "新增、修改、删除账号并分配四级权限" : "维护商家和顾客账号及新登录会话时长"}</p>
              </div>

              {accessManagementMessage ? <p className="rounded-2xl bg-amber-50 px-5 py-4 text-sm text-amber-900" role="status">{accessManagementMessage}</p> : null}

              <article className="rounded-[2rem] border border-stone-200 bg-[#faf6f1] p-6 md:p-8">
                <h3 className="font-serif text-xl md:text-2xl">登录保持时间</h3>
                <p className="mt-1 text-sm text-stone-600">默认 30 分钟，可设置 5 至 1440 分钟；只影响保存后新创建的会话。</p>
                <div className="mt-5 flex flex-wrap items-end gap-3">
                  <label className="field-label min-w-[220px] flex-1">
                    有效分钟数
                    <input type="number" min={5} max={1440} step={1} value={sessionDurationDraft} onChange={(event) => setSessionDurationDraft(event.target.value)} className="rounded-full border border-stone-200 bg-white px-5 py-3" />
                  </label>
                  <button type="button" onClick={() => void saveSessionDuration()} disabled={isSavingAccessManagement} className="rounded-full bg-stone-800 px-7 py-3 font-medium text-stone-50 disabled:opacity-60">保存时长</button>
                </div>
              </article>

              <form onSubmit={saveMerchantAccount} className="rounded-[2rem] border border-stone-200 bg-[#faf6f1] p-6 md:p-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-serif text-xl md:text-2xl">{merchantAccountDraft.id ? "编辑账号" : "新增账号"}</h3>
                    <p className="mt-1 text-sm text-stone-600">重置密码、停用或修改角色后，该账号的旧会话会立即失效。</p>
                  </div>
                  {merchantAccountDraft.id ? <button type="button" onClick={startNewMerchantAccount} className="rounded-full border border-stone-300 px-5 py-2 text-sm">取消编辑</button> : null}
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label className="field-label">
                    登录用户名
                    <input value={merchantAccountDraft.username} onChange={(event) => setMerchantAccountDraft((current) => ({ ...current, username: event.target.value }))} className="rounded-full border border-stone-200 bg-white px-5 py-3" placeholder="例如：store01" />
                  </label>
                  <label className="field-label">
                    显示名称
                    <input value={merchantAccountDraft.displayName} onChange={(event) => setMerchantAccountDraft((current) => ({ ...current, displayName: event.target.value }))} className="rounded-full border border-stone-200 bg-white px-5 py-3" placeholder="例如：早班店员" />
                  </label>
                  <label className="field-label">
                    权限等级
                    <select value={merchantAccountDraft.role} disabled={merchantAccountDraft.id === merchant?.id} onChange={(event) => setMerchantAccountDraft((current) => ({ ...current, role: event.target.value as MerchantRole }))} className="rounded-full border border-stone-200 bg-white px-5 py-3 disabled:opacity-60">
                      {(merchant?.role === "super_admin" ? (["super_admin", "admin", "merchant", "customer"] as MerchantRole[]) : (["merchant", "customer"] as MerchantRole[])).map((role) => <option key={role} value={role}>{MERCHANT_ROLE_LABELS[role]}</option>)}
                    </select>
                  </label>
                  <label className="field-label">
                    {merchantAccountDraft.id ? "重置临时密码（可留空）" : "临时密码（至少 10 位）"}
                    <input type="password" value={merchantAccountDraft.temporaryPassword} disabled={merchantAccountDraft.id === merchant?.id} onChange={(event) => setMerchantAccountDraft((current) => ({ ...current, temporaryPassword: event.target.value }))} className="rounded-full border border-stone-200 bg-white px-5 py-3 disabled:opacity-60" autoComplete="new-password" />
                  </label>
                  <label className="flex items-center gap-3 text-sm text-stone-700 sm:col-span-2">
                    <input type="checkbox" checked={merchantAccountDraft.enabled} disabled={merchantAccountDraft.id === merchant?.id} onChange={(event) => setMerchantAccountDraft((current) => ({ ...current, enabled: event.target.checked }))} className="h-5 w-5 accent-[#59694d] disabled:opacity-60" />
                    启用账号
                  </label>
                </div>
                <button type="submit" disabled={isSavingAccessManagement} className="mt-6 rounded-full bg-[#59694d] px-7 py-3 font-medium text-white disabled:opacity-60">{merchantAccountDraft.id ? "保存账号修改" : "创建账号"}</button>
              </form>

              <div className="grid gap-4 lg:grid-cols-2">
                {merchantAccounts.map((account) => {
                  const canEditAccount = merchant?.role === "super_admin" || ["merchant", "customer"].includes(account.role);
                  return (
                    <article key={account.id} className="rounded-[2rem] border border-stone-200 bg-[#faf6f1] p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs ${account.enabled ? "bg-emerald-50 text-emerald-800" : "bg-stone-200 text-stone-600"}`}>{account.enabled ? "已启用" : "已停用"}</span>
                          <h3 className="mt-3 font-serif text-xl">{account.displayName}</h3>
                          <p className="text-sm text-stone-600">@{account.username} · {MERCHANT_ROLE_LABELS[account.role]}</p>
                          <p className="mt-2 text-xs text-stone-500">{account.lastLoginAt ? `最近登录 ${formatDateTime(account.lastLoginAt)}` : "尚未登录"}{account.mustChangePassword ? " · 下次登录需改密" : ""}</p>
                        </div>
                        <div className="flex shrink-0 flex-wrap justify-end gap-2">
                          {canEditAccount ? <button type="button" onClick={() => editMerchantAccount(account)} className="rounded-full border border-stone-300 px-4 py-2 text-sm">编辑</button> : null}
                          {merchant?.role === "super_admin" && account.id !== merchant.id ? <button type="button" onClick={() => void removeMerchantAccount(account)} disabled={isSavingAccessManagement} className="rounded-full border border-[#a23f35] px-4 py-2 text-sm text-[#8b2f27] disabled:opacity-50">删除</button> : null}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
    );
  }

  return (
    <div className="retro-vintage-theme min-h-screen bg-[#faf6f1] text-stone-800">
      <header className="sticky top-0 z-40 border-b border-stone-200 bg-[#faf6f1]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 md:px-12">
          <button type="button" onClick={() => navigateCustomer("shop")} className="flex items-center gap-3 text-left focus:outline-none focus:ring-2 focus:ring-stone-300 rounded-full">
            <span className="brand-mark" aria-hidden="true">{storeSettings.brandMark}</span>
            <span>
              <span className="block font-serif text-xl md:text-2xl">{storeSettings.brandName}</span>
              <span className="block text-xs text-stone-600">{storeSettings.brandTagline}</span>
            </span>
          </button>
          <div className="flex items-center gap-2">
            {miniProgram.entryUrl ? (
              <a href={miniProgram.entryUrl} className="hidden rounded-full border border-stone-300 px-4 py-3 text-sm font-medium text-stone-800 transition-colors hover:bg-stone-100 sm:inline-flex">打开小程序</a>
            ) : <span className="hidden text-xs text-stone-600 sm:inline">当前：网页版</span>}
            <button
              type="button"
              onClick={toggleAdmin}
              className="px-5 py-3 rounded-full font-medium transition-colors duration-300 border border-stone-300 bg-transparent text-stone-800 hover:bg-stone-100 active:scale-95 focus:outline-none focus:ring-2 focus:ring-stone-300"
            >
              {isAdmin ? (merchant?.role === "super_admin" ? "返回管理页" : "返回顾客端") : "商家接单"}
            </button>
          </div>
        </div>
      </header>

      {isMerchantLoginOpen || merchant?.mustChangePassword ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/45 px-5 py-8 backdrop-blur-sm">
          <form onSubmit={merchant?.mustChangePassword ? changeMerchantPassword : loginMerchant} className="w-full max-w-md rounded-[2rem] border border-stone-200 bg-[#faf6f1] p-7 shadow-[0_24px_70px_rgba(76,63,52,0.24)] md:p-9">
            <p className="text-sm text-stone-600">{merchant?.mustChangePassword ? "首次登录安全设置" : "CloudBase PG 商家后台"}</p>
            <h2 className="mt-2 font-serif text-3xl">{merchant?.mustChangePassword ? "请先修改初始密码" : "商家账号登录"}</h2>
            <div className="mt-6 space-y-4">
              {!merchant?.mustChangePassword ? (
                <label className="field-label">
                  商家用户名
                  <input value={merchantUsername} onChange={(event) => setMerchantUsername(event.target.value)} autoComplete="username" className="rounded-full border border-stone-200 bg-white px-5 py-3" placeholder="admin" />
                </label>
              ) : <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">账号 {merchant.username} 正在使用临时密码，完成修改后才能管理订单和店铺。</p>}
              <label className="field-label">
                {merchant?.mustChangePassword ? "当前临时密码" : "登录密码"}
                <input type="password" value={merchantPassword} onChange={(event) => setMerchantPassword(event.target.value)} autoComplete="current-password" className="rounded-full border border-stone-200 bg-white px-5 py-3" />
              </label>
              {merchant?.mustChangePassword ? (
                <label className="field-label">
                  新密码（至少 10 位）
                  <input type="password" value={merchantNewPassword} onChange={(event) => setMerchantNewPassword(event.target.value)} autoComplete="new-password" className="rounded-full border border-stone-200 bg-white px-5 py-3" />
                </label>
              ) : null}
            </div>
            {merchantAuthMessage ? <p className="mt-4 text-sm font-medium text-red-800" role="alert">{merchantAuthMessage}</p> : null}
            <div className="mt-7 flex justify-end gap-3">
              {!merchant?.mustChangePassword ? <button type="button" onClick={() => setIsMerchantLoginOpen(false)} className="rounded-full border border-stone-300 px-6 py-3">取消</button> : null}
              <button type="submit" disabled={isMerchantAuthenticating} className="rounded-full bg-stone-800 px-7 py-3 font-medium text-stone-50 disabled:opacity-60">
                {isMerchantAuthenticating ? "正在验证中" : merchant?.mustChangePassword ? "保存新密码" : "登录商家端"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {backendMessage ? (
        <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-center text-sm text-amber-900" role="status">
          {backendMessage}。当前显示最近一次缓存，CloudBase 恢复后请刷新重试。
        </div>
      ) : null}

      {isAdmin ? (
        <main className="mx-auto max-w-6xl px-5 pb-20 pt-8 md:px-12 md:pt-12">
          <section className="admin-heading">
            <div>
              <p className="text-sm text-stone-600">今天也要蒸出好味道</p>
              <h1 className="mt-1 font-serif text-3xl md:text-4xl">店铺接单台</h1>
            </div>
            <div className="admin-date-mark" aria-label="当前营业状态">
              <span className="status-dot" /> {merchantSessionToken ? `${merchant?.displayName ?? merchantUsername} · ${merchant ? MERCHANT_ROLE_LABELS[merchant.role] : "商家"} · PG 云端接单` : "等待云端登录"}
            </div>
          </section>

          <section className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="bg-[#faf6f1] rounded-[2rem] border border-stone-200 p-5 md:p-6 metric-card">
              <span className="text-xs text-stone-600">待处理</span>
              <strong className="mt-2 block font-serif text-3xl">{activeOrders.length}</strong>
              <span className="text-xs text-stone-600">笔订单</span>
            </div>
            <div className="bg-[#faf6f1] rounded-[2rem] border border-stone-200 p-5 md:p-6 metric-card">
              <span className="text-xs text-stone-600">今日订单</span>
              <strong className="mt-2 block font-serif text-3xl">{orders.length}</strong>
              <span className="text-xs text-stone-600">笔订单</span>
            </div>
            <div className="bg-[#faf6f1] rounded-[2rem] border border-stone-200 p-5 md:p-6 metric-card">
              <span className="text-xs text-stone-600">今日营收</span>
              <strong className="mt-2 block font-serif text-3xl">{formatMoney(todayRevenue)}</strong>
              <span className="text-xs text-stone-600">CloudBase 云端数据</span>
            </div>
            <div className="bg-[#faf6f1] rounded-[2rem] border border-stone-200 p-5 md:p-6 metric-card">
              <span className="text-xs text-stone-600">待制作</span>
              <strong className="mt-2 block font-serif text-3xl">{productionSummary.reduce((sum, item) => sum + item.quantity, 0)}</strong>
              <span className="text-xs text-stone-600">个馒头</span>
            </div>
          </section>

          <div className="mt-8 flex gap-2 overflow-x-auto pb-2">
            <button type="button" onClick={() => setAdminView("orders")} className={`section-chip ${adminView === "orders" ? "section-chip-active" : ""}`}>
              实时订单 {activeOrders.length > 0 ? `(${activeOrders.length})` : ""}
            </button>
            <button type="button" onClick={() => setAdminView("production")} className={`section-chip ${adminView === "production" ? "section-chip-active" : ""}`}>
              备货汇总
            </button>
            <button type="button" onClick={() => setAdminView("products")} className={`section-chip ${adminView === "products" ? "section-chip-active" : ""}`}>
              商品管理
            </button>
            <button type="button" onClick={() => setAdminView("payments")} className={`section-chip ${adminView === "payments" ? "section-chip-active" : ""}`}>
              收款设置
            </button>
            <button type="button" onClick={() => setAdminView("store")} className={`section-chip ${adminView === "store" ? "section-chip-active" : ""}`}>
              店铺装修
            </button>
            {merchant?.role === "admin" ? (
              <button type="button" onClick={() => setAdminView("access")} className={`section-chip ${adminView === "access" ? "section-chip-active" : ""}`}>
                账号与权限
              </button>
            ) : null}
          </div>

          {adminView === "orders" ? (
            <section className="mt-5 space-y-4">
              {orders.length === 0 ? (
                <EmptyState title="还没有新订单" description="顾客提交订单后，会立即出现在这里。你可以直接用手机接单和更新状态。" />
              ) : orders.map((order) => {
                const nextAction = getNextOrderAction(order);
                return (
                  <article key={order.id} className="bg-[#faf6f1] rounded-[2rem] border border-stone-200 p-6 md:p-8 order-card">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={"order-status status-" + order.status}>{STATUS_LABELS[order.status]}</span>
                          <span className="text-xs font-semibold text-stone-700">{order.shortCode}【{order.fulfillment === "pickup" ? "自提" : "配送"}】</span>
                          <span className="text-xs text-stone-600">#{order.id}</span>
                        </div>
                        <h2 className="mt-3 font-serif text-xl md:text-2xl">{order.customerName} · {order.phone}</h2>
                        <p className="mt-1 text-sm text-stone-600">
                          {order.fulfillment === "pickup"
                            ? "预计 " + order.pickupDay + " " + order.pickupTime + " 取餐"
                            : "预计 " + order.pickupDay + " " + order.deliveryTime + " 送达"}
                        </p>
                        <p className="mt-2 text-sm font-medium text-stone-700">付款：{PAYMENT_STATUS_LABELS[order.paymentStatus]}</p>
                        {order.paymentMethodId ? <p className="mt-1 text-xs text-stone-600">收款方式：{paymentMethods.find((method) => method.id === order.paymentMethodId)?.name ?? "已停用的收款方式"}</p> : null}
                        {order.paymentReference ? <p className="mt-1 text-xs text-stone-600">付款备注：{order.paymentReference}</p> : null}
                      </div>
                      <div className="text-right">
                        <strong className="font-serif text-2xl">{formatMoney(order.total)}</strong>
                        <p className="mt-1 text-xs text-stone-600">商品 {formatMoney(order.subtotal)} · 配送费 {formatMoney(order.deliveryFee)}</p>
                        <p className="mt-1 text-xs text-stone-600">{formatCreatedAt(order.createdAt)} 下单</p>
                      </div>
                    </div>
                    <div className="my-5 border-t border-dashed border-stone-300" />
                    <div className="space-y-2 text-sm">
                      {order.items.map((item) => (
                        <div key={item.productId} className="flex justify-between gap-4">
                          <span>{item.name}</span>
                          <span className="font-medium">× {item.quantity} {item.unit}</span>
                        </div>
                      ))}
                    </div>
                    {order.fulfillment === "delivery" ? <p className="mt-4 text-sm text-stone-600">配送地址：{order.deliveryArea} {order.doorNumber}</p> : null}
                    {order.note ? <p className="mt-2 text-sm text-stone-600">备注：{order.note}</p> : null}
                    {order.paymentStatus === "submitted" ? (
                      <div className="mt-5 flex flex-wrap gap-3">
                        <button type="button" onClick={() => updatePaymentStatus(order.id, "confirmed")} className="rounded-full bg-stone-800 px-5 py-2 text-sm font-medium text-stone-50">确认已收款</button>
                        <button type="button" onClick={() => updatePaymentStatus(order.id, "rejected")} className="rounded-full border border-stone-300 px-5 py-2 text-sm font-medium">未查到款项</button>
                      </div>
                    ) : null}
                    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <label className="flex items-center gap-3 text-sm text-stone-600">
                        制作状态
                        <select
                          value={order.status}
                          onChange={(event) => updateOrderStatus(order.id, event.target.value as OrderStatus)}
                          className="rounded-full border border-stone-200 bg-white px-4 py-2 text-stone-800 focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-200"
                          aria-label={`修改订单 ${order.id} 状态`}
                        >
                          {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
                        </select>
                      </label>
                      {order.fulfillment === "delivery" ? (
                        <label className="flex items-center gap-3 text-sm text-stone-600">
                          配送进度
                          <select
                            value={order.deliveryStatus}
                            onChange={(event) => updateDeliveryStatus(order.id, event.target.value as DeliveryStatus)}
                            className="rounded-full border border-stone-200 bg-white px-4 py-2 text-stone-800"
                            aria-label={"修改配送单 " + order.shortCode + " 配送进度"}
                          >
                            {DELIVERY_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{DELIVERY_STATUS_LABELS[status]}</option>)}
                          </select>
                        </label>
                      ) : null}
                      {nextAction ? (
                        <button
                          type="button"
                          onClick={() => updateOrderStatus(order.id, nextAction.status)}
                          className="px-6 py-3 rounded-full font-medium transition-colors duration-300 bg-stone-800 text-stone-50 hover:bg-stone-700 active:scale-95 focus:outline-none focus:ring-2 focus:ring-stone-300"
                        >
                          {nextAction.label}
                        </button>
                      ) : <span className="text-sm text-stone-600">{order.status === "cancelled" ? "订单已取消" : order.fulfillment === "delivery" && order.status === "ready" ? "等待配送进度更新" : "订单已完成"}</span>}
                    </div>
                  </article>
                );
              })}
            </section>
          ) : adminView === "production" ? (
            <section className="mt-5">
              {productionSummary.length === 0 ? (
                <EmptyState title="暂时无需备货" description="新订单接入后，这里会自动汇总每种馒头需要制作的总数量。" />
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {productionSummary.map(({ product, quantity }) => (
                    <article key={product.id} className="bg-[#faf6f1] rounded-[2rem] border border-stone-200 p-6 md:p-8 flex items-center justify-between gap-5 production-card">
                      <div className="flex items-center gap-4">
                        <div className="mini-bun"><BunIllustration tone={product.tone} /></div>
                        <div>
                          <h2 className="font-serif text-xl md:text-2xl">{product.name}</h2>
                          <p className="mt-1 text-sm text-stone-600">当前库存 {product.stock} {product.unit}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <strong className="font-serif text-4xl">{quantity}</strong>
                        <span className="ml-1 text-sm text-stone-600">{product.unit}</span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          ) : adminView === "products" ? (
            <section className="mt-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-serif text-2xl md:text-3xl">商品管理</h2>
                  <p className="mt-1 text-sm text-stone-600">共 {effectiveProducts.length} 件商品，下架后顾客端立即隐藏</p>
                </div>
                <button
                  type="button"
                  onClick={openNewProductEditor}
                  className="px-6 py-3 rounded-full font-medium transition-colors duration-300 bg-stone-800 text-stone-50 hover:bg-stone-700 active:scale-95 focus:outline-none focus:ring-2 focus:ring-stone-300"
                >
                  + 新增商品
                </button>
              </div>

              {isProductEditorOpen ? (
                <div id="product-editor" className="mt-5 scroll-mt-24 bg-[#faf6f1] rounded-[2rem] border border-stone-200 p-6 md:p-8 product-editor">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-stone-600">{editingProductId ? "修改商品资料" : "添加新的在售商品"}</p>
                      <h3 className="mt-1 font-serif text-2xl md:text-3xl">{editingProductId ? "编辑商品" : "新增商品"}</h3>
                    </div>
                    <button type="button" onClick={closeProductEditor} className="quantity-button" aria-label="关闭商品编辑">×</button>
                  </div>

                  <div className="mt-6 grid gap-6 lg:grid-cols-[220px_1fr]">
                    <div>
                      <label className="product-image-uploader">
                        {productDraft.imageUrl ? (
                          <NextImage src={productDraft.imageUrl} alt="商品图片预览" width={1200} height={900} unoptimized />
                        ) : (
                          <span>
                            <strong>上传商品图片</strong>
                            <small>支持 JPG、PNG、WebP</small>
                          </span>
                        )}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(event) => void handleProductImage(event.target.files?.[0])}
                          disabled={isProcessingImage}
                        />
                      </label>
                      {productDraft.imageUrl ? (
                        <button
                          type="button"
                          onClick={() => setProductDraft((current) => ({ ...current, imageUrl: "", imageFileId: "" }))}
                          className="mt-3 w-full px-6 py-3 rounded-full font-medium transition-colors duration-300 border border-stone-300 bg-transparent text-stone-800 hover:bg-stone-100 active:scale-95 focus:outline-none focus:ring-2 focus:ring-stone-300"
                        >
                          移除图片
                        </button>
                      ) : null}
                      {isProcessingImage ? <p className="mt-3 text-center text-xs text-stone-600">正在处理图片…</p> : null}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="field-label sm:col-span-2">
                        商品名字
                        <input value={productDraft.name} onChange={(event) => setProductDraft((current) => ({ ...current, name: event.target.value }))} className="px-5 py-3 bg-white border border-stone-200 rounded-full text-stone-800 placeholder:text-stone-400 focus:border-stone-400 focus:ring-2 focus:ring-stone-200 transition-all duration-300" placeholder="例如：南瓜馒头" />
                      </label>
                      <label className="field-label sm:col-span-2">
                        商品描述
                        <input value={productDraft.description} onChange={(event) => setProductDraft((current) => ({ ...current, description: event.target.value }))} className="px-5 py-3 bg-white border border-stone-200 rounded-full text-stone-800 placeholder:text-stone-400 focus:border-stone-400 focus:ring-2 focus:ring-stone-200 transition-all duration-300" placeholder="简单说说口味和用料" />
                      </label>
                      <label className="field-label">
                        售价（元）
                        <input value={productDraft.price} onChange={(event) => setProductDraft((current) => ({ ...current, price: event.target.value }))} inputMode="decimal" className="px-5 py-3 bg-white border border-stone-200 rounded-full text-stone-800 placeholder:text-stone-400 focus:border-stone-400 focus:ring-2 focus:ring-stone-200 transition-all duration-300" placeholder="3.5" />
                      </label>
                      <label className="field-label">
                        计价单位
                        <input value={productDraft.unit} onChange={(event) => setProductDraft((current) => ({ ...current, unit: event.target.value }))} className="px-5 py-3 bg-white border border-stone-200 rounded-full text-stone-800 placeholder:text-stone-400 focus:border-stone-400 focus:ring-2 focus:ring-stone-200 transition-all duration-300" placeholder="个、袋、斤" />
                      </label>
                      <label className="field-label">
                        商品分类
                        <select value={productDraft.category} onChange={(event) => setProductDraft((current) => ({ ...current, category: event.target.value as Product["category"] }))} className="form-select">
                          <option>经典</option>
                          <option>粗粮</option>
                          <option>甜味</option>
                        </select>
                      </label>
                      <label className="field-label">
                        当前库存
                        <input value={productDraft.stock} onChange={(event) => setProductDraft((current) => ({ ...current, stock: event.target.value.replace(/\D/g, "") }))} inputMode="numeric" className="px-5 py-3 bg-white border border-stone-200 rounded-full text-stone-800 placeholder:text-stone-400 focus:border-stone-400 focus:ring-2 focus:ring-stone-200 transition-all duration-300" placeholder="20" />
                      </label>
                      <label className="field-label sm:col-span-2">
                        商品角标（选填）
                        <input value={productDraft.badge} onChange={(event) => setProductDraft((current) => ({ ...current, badge: event.target.value.slice(0, 6) }))} className="px-5 py-3 bg-white border border-stone-200 rounded-full text-stone-800 placeholder:text-stone-400 focus:border-stone-400 focus:ring-2 focus:ring-stone-200 transition-all duration-300" placeholder="例如：新品、招牌、人气" />
                      </label>
                    </div>
                  </div>

                  {productEditorError ? <p className="mt-5 text-sm font-medium text-red-800" role="alert">{productEditorError}</p> : null}
                  <div className="mt-6 flex flex-wrap justify-end gap-3">
                    <button type="button" onClick={closeProductEditor} className="px-6 py-3 rounded-full font-medium transition-colors duration-300 border border-stone-300 bg-transparent text-stone-800 hover:bg-stone-100 active:scale-95 focus:outline-none focus:ring-2 focus:ring-stone-300">取消</button>
                    <button type="button" onClick={saveProduct} disabled={isProcessingImage} className="px-6 py-3 rounded-full font-medium transition-colors duration-300 bg-stone-800 text-stone-50 hover:bg-stone-700 active:scale-95 focus:outline-none focus:ring-2 focus:ring-stone-300 disabled:cursor-not-allowed disabled:bg-stone-300">保存商品</button>
                  </div>
                </div>
              ) : null}

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {effectiveProducts.map((product) => {
                  const productInventory = inventory[product.id] ?? { stock: product.stock, available: true };
                  return (
                    <article key={product.id} className="bg-[#faf6f1] rounded-[2rem] border border-stone-200 p-6 md:p-8 product-admin-card">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <span className={`order-status ${productInventory.available ? "status-ready" : "status-done"}`}>
                            {productInventory.available ? (product.stock > 0 ? "已上架" : "已售罄") : "已下架"}
                          </span>
                          <h3 className="mt-3 truncate font-serif text-xl md:text-2xl">{product.name}</h3>
                          <p className="mt-1 text-sm text-stone-600">{formatMoney(product.price)} / {product.unit} · {product.category}</p>
                          <p className="mt-2 line-clamp-2 text-sm text-stone-600">{product.description}</p>
                        </div>
                        <div className="admin-product-image">
                          {product.imageUrl ? <NextImage src={product.imageUrl} alt={product.name} width={360} height={320} unoptimized /> : <BunIllustration tone={product.tone} />}
                        </div>
                      </div>
                      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <span className="block text-xs text-stone-600">当前库存</span>
                          <strong className="font-serif text-3xl">{product.stock}</strong>
                          <span className="ml-1 text-sm text-stone-600">{product.unit}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <button type="button" onClick={() => updateProductStock(product.id, -5)} className="quantity-button" aria-label={`${product.name} 库存减少五个`}>−5</button>
                          <button type="button" onClick={() => updateProductStock(product.id, 5)} className="quantity-button" aria-label={`${product.name} 库存增加五个`}>+5</button>
                        </div>
                      </div>
                      <div className="mt-6 grid grid-cols-2 gap-3">
                        <button type="button" onClick={() => openProductEditor(product)} className="px-6 py-3 rounded-full font-medium transition-colors duration-300 border border-stone-300 bg-transparent text-stone-800 hover:bg-stone-100 active:scale-95 focus:outline-none focus:ring-2 focus:ring-stone-300">编辑资料</button>
                        <button
                          type="button"
                          onClick={() => toggleProductAvailability(product.id)}
                          className={`px-6 py-3 rounded-full font-medium transition-colors duration-300 active:scale-95 focus:outline-none focus:ring-2 focus:ring-stone-300 ${productInventory.available ? "border border-stone-300 bg-transparent text-stone-800 hover:bg-stone-100" : "bg-stone-800 text-stone-50 hover:bg-stone-700"}`}
                        >
                          {productInventory.available ? "下架隐藏" : "重新上架"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : adminView === "payments" ? (
            <section className="mt-5">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="font-serif text-2xl md:text-3xl">收款设置</h2>
                  <p className="mt-1 text-sm text-stone-600">最多配置 12 个收款码；顾客只能看到已启用的项目</p>
                </div>
                <button type="button" onClick={addPaymentMethod} className="rounded-full bg-stone-800 px-6 py-3 text-sm font-medium text-stone-50">新增收款码</button>
              </div>

              {paymentSettingsMessage ? <p className="mt-5 rounded-2xl bg-amber-50 px-5 py-4 text-sm text-amber-900" role="status">{paymentSettingsMessage}</p> : null}
              {paymentMethodDrafts.length === 0 ? (
                <div className="mt-5"><EmptyState title="还没有收款码" description="点击“新增收款码”，填写名称、收款人、备注和二维码 HTTPS 图片地址。" /></div>
              ) : (
                <div className="mt-5 space-y-5">
                  {paymentMethodDrafts.map((method, index) => (
                    <article key={method.id} className="grid gap-5 rounded-[2rem] border border-stone-200 bg-[#faf6f1] p-6 lg:grid-cols-[180px_1fr] md:p-8">
                      <div>
                        <div className="flex aspect-square items-center justify-center overflow-hidden rounded-[1.5rem] border border-stone-200 bg-white">
                          {isValidPaymentImageUrl(method.qrCodeUrl) ? <NextImage src={method.qrCodeUrl} alt={`${method.name || "收款方式"}二维码预览`} width={320} height={320} unoptimized className="h-full w-full object-contain" /> : <span className="px-4 text-center text-sm text-stone-500">填写 HTTPS 图片地址后显示预览</span>}
                        </div>
                        <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs ${method.enabled ? "bg-emerald-50 text-emerald-800" : "bg-stone-200 text-stone-600"}`}>{method.enabled ? "顾客可见" : "已停用"}</span>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="field-label">
                          收款码名称
                          <input value={method.name} onChange={(event) => updatePaymentMethodDraft(method.id, { name: event.target.value })} className="rounded-full border border-stone-200 bg-white px-5 py-3" placeholder={`例如：微信收款码 ${index + 1}`} />
                        </label>
                        <label className="field-label">
                          收款人名称
                          <input value={method.payeeName} onChange={(event) => updatePaymentMethodDraft(method.id, { payeeName: event.target.value })} className="rounded-full border border-stone-200 bg-white px-5 py-3" placeholder="例如：王女士" />
                        </label>
                        <label className="field-label sm:col-span-2">
                          二维码 HTTPS 图片地址
                          <input value={method.qrCodeUrl} onChange={(event) => updatePaymentMethodDraft(method.id, { qrCodeUrl: event.target.value })} className="rounded-full border border-stone-200 bg-white px-5 py-3" inputMode="url" placeholder="https://example.com/payment-qr.png" />
                        </label>
                        <label className="field-label sm:col-span-2">
                          付款说明与备注
                          <textarea value={method.note} onChange={(event) => updatePaymentMethodDraft(method.id, { note: event.target.value })} className="organic-textarea" rows={3} placeholder="例如：付款时请备注订单号，仅用于本店订单收款" />
                        </label>
                        <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
                          <label className="flex items-center gap-3 text-sm text-stone-700">
                            <input type="checkbox" checked={method.enabled} onChange={(event) => updatePaymentMethodDraft(method.id, { enabled: event.target.checked })} className="h-5 w-5 accent-[#59694d]" />
                            向顾客启用这个收款码
                          </label>
                          <button type="button" onClick={() => removePaymentMethod(method.id)} className="rounded-full border border-red-200 px-5 py-2 text-sm font-medium text-red-800">删除</button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-[2rem] border border-stone-200 bg-white p-5">
                <p className="text-sm text-stone-600">{merchantSessionToken ? "保存后同步到网页版" : "请先使用用户名和密码登录 CloudBase 商家端"}</p>
                <button type="button" onClick={() => void savePaymentMethods()} disabled={isSavingPaymentMethods} className="rounded-full bg-[#59694d] px-7 py-3 font-medium text-white disabled:cursor-wait disabled:opacity-60">{isSavingPaymentMethods ? "正在保存…" : "保存全部收款设置"}</button>
              </div>
            </section>
          ) : adminView === "store" ? (
            <section className="mt-5">
              <div>
                <h2 className="font-serif text-2xl md:text-3xl">店铺装修</h2>
                <p className="mt-1 text-sm text-stone-600">修改顶部店铺信息与首页主视觉，保存后顾客端立即更新</p>
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_0.9fr]">
                <div className="bg-[#faf6f1] rounded-[2rem] border border-stone-200 p-6 md:p-8 store-settings-card">
                  <h3 className="font-serif text-xl md:text-2xl">顶部店铺信息</h3>
                  <div className="mt-5 grid gap-4 sm:grid-cols-[120px_1fr]">
                    <label className="field-label">
                      圆形标记
                      <input value={storeSettingsDraft.brandMark} onChange={(event) => setStoreSettingsDraft((current) => ({ ...current, brandMark: event.target.value.slice(0, 2) }))} className="px-5 py-3 bg-white border border-stone-200 rounded-full text-stone-800 placeholder:text-stone-400 focus:border-stone-400 focus:ring-2 focus:ring-stone-200 transition-all duration-300" placeholder="馒" />
                    </label>
                    <label className="field-label">
                      店铺名称
                      <input value={storeSettingsDraft.brandName} onChange={(event) => setStoreSettingsDraft((current) => ({ ...current, brandName: event.target.value }))} className="px-5 py-3 bg-white border border-stone-200 rounded-full text-stone-800 placeholder:text-stone-400 focus:border-stone-400 focus:ring-2 focus:ring-stone-200 transition-all duration-300" placeholder="馒有意思" />
                    </label>
                    <label className="field-label sm:col-span-2">
                      店铺副标题
                      <input value={storeSettingsDraft.brandTagline} onChange={(event) => setStoreSettingsDraft((current) => ({ ...current, brandTagline: event.target.value }))} className="px-5 py-3 bg-white border border-stone-200 rounded-full text-stone-800 placeholder:text-stone-400 focus:border-stone-400 focus:ring-2 focus:ring-stone-200 transition-all duration-300" placeholder="每日现蒸 · 预约不等" />
                    </label>
                  </div>

                  <div className="my-7 border-t border-dashed border-stone-300" />
                  <h3 className="font-serif text-xl md:text-2xl">首页主视觉文案</h3>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <label className="field-label sm:col-span-2">
                      顶部小标签
                      <input value={storeSettingsDraft.heroBadge} onChange={(event) => setStoreSettingsDraft((current) => ({ ...current, heroBadge: event.target.value }))} className="px-5 py-3 bg-white border border-stone-200 rounded-full text-stone-800 placeholder:text-stone-400 focus:border-stone-400 focus:ring-2 focus:ring-stone-200 transition-all duration-300" placeholder="老面慢发酵 · 不加改良剂" />
                    </label>
                    <label className="field-label sm:col-span-2">
                      主标题
                      <textarea value={storeSettingsDraft.heroTitle} onChange={(event) => setStoreSettingsDraft((current) => ({ ...current, heroTitle: event.target.value }))} className="organic-textarea" rows={3} placeholder="每天现蒸，&#10;把柔软送到家" />
                      <span className="text-xs text-stone-600">换行位置会原样显示在首页</span>
                    </label>
                    <label className="field-label sm:col-span-2">
                      介绍文案
                      <textarea value={storeSettingsDraft.heroDescription} onChange={(event) => setStoreSettingsDraft((current) => ({ ...current, heroDescription: event.target.value }))} className="organic-textarea" rows={3} placeholder="介绍制作方式、预约时间或品牌特色" />
                    </label>
                    <label className="field-label">
                      按钮文字
                      <input value={storeSettingsDraft.heroButtonText} onChange={(event) => setStoreSettingsDraft((current) => ({ ...current, heroButtonText: event.target.value }))} className="px-5 py-3 bg-white border border-stone-200 rounded-full text-stone-800 placeholder:text-stone-400 focus:border-stone-400 focus:ring-2 focus:ring-stone-200 transition-all duration-300" placeholder="看看今日馒头" />
                    </label>
                    <label className="field-label">
                      配送提示
                      <input value={storeSettingsDraft.deliveryNote} onChange={(event) => setStoreSettingsDraft((current) => ({ ...current, deliveryNote: event.target.value }))} className="px-5 py-3 bg-white border border-stone-200 rounded-full text-stone-800 placeholder:text-stone-400 focus:border-stone-400 focus:ring-2 focus:ring-stone-200 transition-all duration-300" placeholder="本店 3km 内配送 · 15元起送 · 满30元免配送费" />
                    </label>
                  </div>
                </div>

                <div className="bg-[#faf6f1] rounded-[2rem] border border-stone-200 p-6 md:p-8 store-settings-card">
                  <h3 className="font-serif text-xl md:text-2xl">主视觉背景图片</h3>
                  <p className="mt-1 text-sm text-stone-600">建议上传横版图片，文字区域尽量简洁</p>
                  <label className="mt-5 product-image-uploader store-background-uploader">
                    {storeSettingsDraft.heroBackgroundImage ? (
                      <NextImage src={storeSettingsDraft.heroBackgroundImage} alt="首页背景预览" width={1600} height={900} unoptimized />
                    ) : (
                      <span>
                        <strong>上传背景图片</strong>
                        <small>支持 JPG、PNG、WebP，最大 16MB</small>
                      </span>
                    )}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) => void handleStoreBackground(event.target.files?.[0])}
                      disabled={isProcessingStoreImage}
                    />
                  </label>
                  {isProcessingStoreImage ? <p className="mt-3 text-center text-xs text-stone-600">正在处理背景图片…</p> : null}
                  {storeSettingsDraft.heroBackgroundImage ? (
                    <button type="button" onClick={() => setStoreSettingsDraft((current) => ({ ...current, heroBackgroundImage: "", heroBackgroundFileId: "" }))} className="mt-3 w-full px-6 py-3 rounded-full font-medium transition-colors duration-300 border border-stone-300 bg-transparent text-stone-800 hover:bg-stone-100 active:scale-95 focus:outline-none focus:ring-2 focus:ring-stone-300">恢复默认背景</button>
                  ) : null}

                  <div className="mt-6 store-brand-preview">
                    <span className="brand-mark" aria-hidden="true">{storeSettingsDraft.brandMark || "馒"}</span>
                    <span>
                      <strong className="block font-serif text-xl">{storeSettingsDraft.brandName || "店铺名称"}</strong>
                      <small className="block text-stone-600">{storeSettingsDraft.brandTagline || "店铺副标题"}</small>
                    </span>
                  </div>

                  {storeSettingsMessage ? <p className="mt-5 text-sm font-medium text-stone-700" role="status">{storeSettingsMessage}</p> : null}
                  <div className="mt-6 flex flex-wrap gap-3">
                    <button type="button" onClick={restoreDefaultStoreSettings} className="flex-1 px-6 py-3 rounded-full font-medium transition-colors duration-300 border border-stone-300 bg-transparent text-stone-800 hover:bg-stone-100 active:scale-95 focus:outline-none focus:ring-2 focus:ring-stone-300">恢复全部默认</button>
                    <button type="button" onClick={saveStoreSettings} disabled={isProcessingStoreImage} className="flex-1 px-6 py-3 rounded-full font-medium transition-colors duration-300 bg-stone-800 text-stone-50 hover:bg-stone-700 active:scale-95 focus:outline-none focus:ring-2 focus:ring-stone-300 disabled:cursor-not-allowed disabled:bg-stone-300">保存并应用</button>
                  </div>
                </div>
              </div>
            </section>
          ) : renderAccessManagement()}
        </main>
      ) : (
        <>
          <main className="pb-28">
            {customerView === "shop" ? (
              <>
                <section className="mobile-order-toolbar" aria-label="移动端点单设置">
                  <div className="mobile-fulfillment-tabs" aria-label="选择取餐方式">
                    <button type="button" onClick={() => setFulfillment("pickup")} className={fulfillment === "pickup" ? "mobile-fulfillment-active" : ""}>自提</button>
                    <button type="button" onClick={() => setFulfillment("delivery")} className={fulfillment === "delivery" ? "mobile-fulfillment-active" : ""}>外送</button>
                  </div>
                  <button type="button" onClick={() => navigateCustomer("profile-details")} className="mobile-store-row">
                    <span className="mobile-location-mark" aria-hidden="true" />
                    <span className="min-w-0 flex-1 text-left">
                      <strong>{fulfillment === "pickup" ? `${storeSettings.brandName}门店` : deliveryArea || "设置配送地址"}</strong>
                      <small>{fulfillment === "pickup" ? "到店自提 · 预约免排队" : deliveryArea ? `${doorNumber || "请补充门牌号"} · 本店 3km 内` : "完善收货信息后自动带入订单"}</small>
                    </span>
                    <span className="mobile-store-chevron" aria-hidden="true">›</span>
                  </button>
                </section>

                <section
                  className={`hero-section ${storeSettings.heroBackgroundImage ? "hero-section-custom-background" : ""}`}
                  style={storeSettings.heroBackgroundImage ? { backgroundImage: `url(${storeSettings.heroBackgroundImage})` } : undefined}
                >
                  {storeSettings.heroBackgroundImage ? <div className="hero-background-overlay" aria-hidden="true" /> : null}
                  <div className="mx-auto grid max-w-6xl items-center gap-8 px-6 py-12 md:grid-cols-[1.15fr_0.85fr] md:px-12 md:py-20">
                    <div className={`relative z-10 ${storeSettings.heroBackgroundImage ? "hero-custom-copy" : ""}`}>
                      <span className="hero-note">{storeSettings.heroBadge}</span>
                      <h1 className="mt-5 max-w-2xl whitespace-pre-line font-serif text-4xl leading-tight md:text-5xl lg:text-6xl">
                        {storeSettings.heroTitle}
                      </h1>
                      <p className="mt-5 max-w-xl text-sm leading-7 md:text-base">
                        {storeSettings.heroDescription}
                      </p>
                      <div className="mt-7 flex flex-wrap items-center gap-4">
                        <button
                          type="button"
                          onClick={() => document.getElementById("menu")?.scrollIntoView({ behavior: "smooth" })}
                          className="px-6 py-3 rounded-full font-medium transition-colors duration-300 bg-stone-800 text-stone-50 hover:bg-stone-700 active:scale-95 focus:outline-none focus:ring-2 focus:ring-stone-300"
                        >
                          {storeSettings.heroButtonText}
                        </button>
                        <span className="text-sm">{storeSettings.deliveryNote}</span>
                      </div>
                    </div>
                    {storeSettings.heroBackgroundImage ? (
                      <div className="hero-visual hero-custom-visual-space" aria-hidden="true" />
                    ) : (
                      <div className="hero-visual" aria-label="一笼刚出锅的馒头插画">
                        <div className="steam steam-one" />
                        <div className="steam steam-two" />
                        <div className="steam steam-three" />
                        <div className="hero-bun hero-bun-one"><BunIllustration tone="wheat" /></div>
                        <div className="hero-bun hero-bun-two"><BunIllustration tone="corn" /></div>
                        <div className="hero-bun hero-bun-three"><BunIllustration tone="brown" /></div>
                        <div className="bamboo-tray" />
                        <span className="handwritten-stamp">今日<br />现蒸</span>
                      </div>
                    )}
                  </div>
                </section>

                <section id="menu" className="customer-menu-section mx-auto max-w-6xl px-5 py-12 md:px-12 md:py-16">
                  <div className="desktop-menu-heading flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="text-sm text-stone-600">真材实料，简单好吃</p>
                      <h2 className="mt-1 font-serif text-3xl md:text-4xl">今日蒸笼</h2>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1" aria-label="商品分类">
                      {(["全部", "经典", "粗粮", "甜味"] as Category[]).map((item) => (
                        <button
                          type="button"
                          key={item}
                          onClick={() => setCategory(item)}
                          className={`category-chip ${category === item ? "category-chip-active" : ""}`}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mobile-menu-shell">
                    <aside className="mobile-category-rail" aria-label="移动端商品分类">
                      {(["全部", "经典", "粗粮", "甜味"] as Category[]).map((item) => (
                        <button
                          type="button"
                          key={item}
                          onClick={() => setCategory(item)}
                          className={category === item ? "mobile-category-active" : ""}
                        >
                          {item}
                        </button>
                      ))}
                    </aside>
                    <div className="product-list-grid mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                      {filteredProducts.map((product) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          quantity={cart[product.id] ?? 0}
                          onAdd={() => addProduct(product)}
                          onRemove={() => removeProduct(product.id)}
                          available={(inventory[product.id]?.available ?? true) && product.stock > 0}
                        />
                      ))}
                    </div>
                  </div>
                </section>

                <section className="mx-auto max-w-6xl px-5 pb-12 md:px-12 md:pb-20">
                  <div className="promise-strip">
                    <div><strong>01</strong><span>每日新鲜现做</span></div>
                    <div><strong>02</strong><span>预约到店即取</span></div>
                    <div><strong>03</strong><span>邻里安心配送</span></div>
                  </div>
                </section>
              </>
            ) : null}

            {customerView === "cart" ? (
              <section className="mx-auto max-w-5xl px-5 py-8 md:px-12 md:py-12">
                <div>
                  <p className="text-sm text-stone-600">核对口味与取餐时间</p>
                  <h1 className="mt-1 font-serif text-3xl md:text-4xl">确认这份麦香</h1>
                </div>
                {successOrderId ? (
                  <div className="mt-8 bg-[#faf6f1] rounded-[2rem] border border-stone-200 p-8 md:p-12 success-card">
                    <div className="success-mark" aria-hidden="true">单</div>
                    <h2 className="mt-5 font-serif text-3xl md:text-4xl">订单已创建，请扫码付款</h2>
                    <p className="mt-3 text-sm md:text-base text-stone-600">订单号 {successOrder?.shortCode ?? "#" + successOrderId}，应付 {successOrder ? formatMoney(successOrder.total) : "--"}。</p>
                    {successOrder ? (
                      <div className="mx-auto mt-4 max-w-sm space-y-1 text-sm text-stone-600">
                        <p className="flex justify-between"><span>商品金额</span><span>{formatMoney(successOrder.subtotal)}</span></p>
                        <p className="flex justify-between"><span>配送费</span><span>{formatMoney(successOrder.deliveryFee)}</span></p>
                      </div>
                    ) : null}
                    {activePaymentMethods.length > 0 ? (
                      <>
                        <div className="mx-auto mt-6 flex max-w-2xl flex-wrap justify-center gap-2" aria-label="选择收款方式">
                          {activePaymentMethods.map((method) => (
                            <button key={method.id} type="button" onClick={() => setSelectedPaymentMethodId(method.id)} aria-pressed={selectedPaymentMethod?.id === method.id} className={`rounded-full border px-5 py-2 text-sm font-medium ${selectedPaymentMethod?.id === method.id ? "border-[#59694d] bg-[#59694d] text-white" : "border-stone-300 bg-white text-stone-700"}`}>
                              {method.name}
                            </button>
                          ))}
                        </div>
                        {selectedPaymentMethod ? (
                          <div className="payment-qr-card">
                            <NextImage src={selectedPaymentMethod.qrCodeUrl} alt={`${selectedPaymentMethod.name}二维码`} width={320} height={320} unoptimized className="payment-qr-image" />
                            <strong>{selectedPaymentMethod.name} · {selectedPaymentMethod.payeeName}</strong>
                            <p>{selectedPaymentMethod.note || "付款时请备注订单号，付款后通知商家核验。"}</p>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <p className="mx-auto mt-6 max-w-lg rounded-2xl bg-amber-50 px-5 py-4 text-sm text-amber-900">商家尚未配置可用收款码，请先联系商家，不要向陌生二维码付款。</p>
                    )}
                    {successOrder ? <p className="mt-4 text-sm font-medium text-stone-700">{PAYMENT_STATUS_LABELS[successOrder.paymentStatus]}</p> : null}
                    <div className="mt-7 flex flex-wrap justify-center gap-3">
                      {successOrder && selectedPaymentMethod && (successOrder.paymentStatus === "pending" || successOrder.paymentStatus === "rejected") ? (
                        <button type="button" onClick={() => markOrderPaid(successOrder)} className="px-6 py-3 rounded-full font-medium transition-colors duration-300 bg-[#59694d] text-white hover:bg-[#48563f] active:scale-95 focus:outline-none focus:ring-2 focus:ring-stone-300">
                          我已付款，通知商家核验
                        </button>
                      ) : null}
                      <button type="button" onClick={() => navigateCustomer("orders")} className="px-6 py-3 rounded-full font-medium transition-colors duration-300 bg-stone-800 text-stone-50 hover:bg-stone-700 active:scale-95 focus:outline-none focus:ring-2 focus:ring-stone-300">
                        查看订单
                      </button>
                      <button type="button" onClick={() => navigateCustomer("shop")} className="px-6 py-3 rounded-full font-medium transition-colors duration-300 border border-stone-300 bg-transparent text-stone-800 hover:bg-stone-100 active:scale-95 focus:outline-none focus:ring-2 focus:ring-stone-300">
                        再逛逛
                      </button>
                    </div>
                  </div>
                ) : cartItems.length === 0 ? (
                  <div className="mt-8">
                    <EmptyState title="蒸笼还是空的" description="去挑几样喜欢的馒头吧，选好取餐时间后就能提交订单。" />
                    <button type="button" onClick={() => navigateCustomer("shop")} className="mx-auto mt-5 block px-6 py-3 rounded-full font-medium transition-colors duration-300 bg-stone-800 text-stone-50 hover:bg-stone-700 active:scale-95 focus:outline-none focus:ring-2 focus:ring-stone-300">
                      去选馒头
                    </button>
                  </div>
                ) : (
                  <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
                    <div className="space-y-4">
                      {cartItems.map((product) => (
                        <article key={product.id} className="bg-[#faf6f1] rounded-[2rem] border border-stone-200 p-5 md:p-6 flex items-center gap-4 cart-item">
                          <div className="cart-bun"><BunIllustration tone={product.tone} /></div>
                          <div className="min-w-0 flex-1">
                            <h2 className="font-serif text-xl">{product.name}</h2>
                            <p className="mt-1 text-sm text-stone-600">{formatMoney(product.price)} / {product.unit}</p>
                          </div>
                          <QuantityControl quantity={cart[product.id]} onAdd={() => addProduct(product)} onRemove={() => removeProduct(product.id)} />
                        </article>
                      ))}
                      <div className="flex items-center justify-between px-2 pt-2">
                        <span className="text-sm text-stone-600">商品小计</span>
                        <strong className="font-serif text-2xl">{formatMoney(cartTotal)}</strong>
                      </div>
                    </div>

                    <div className="bg-[#faf6f1] rounded-[2rem] border border-stone-200 p-6 md:p-8 checkout-form">
                      <h2 className="font-serif text-2xl md:text-3xl">取餐方式与订单信息</h2>
                      <div className="mt-6 grid grid-cols-2 gap-3">
                        <button type="button" onClick={() => setFulfillment("pickup")} className={"fulfillment-option " + (fulfillment === "pickup" ? "fulfillment-option-active" : "")}>
                          <span className="font-medium">到店自提</span><span className="text-xs">生成 A 开头取餐号</span>
                        </button>
                        <button type="button" onClick={() => setFulfillment("delivery")} className={"fulfillment-option " + (fulfillment === "delivery" ? "fulfillment-option-active" : "")}>
                          <span className="font-medium">配送到家</span><span className="text-xs">3km 内 · 满30元免配送费</span>
                        </button>
                      </div>

                      <button type="button" onClick={() => navigateCustomer("profile-details")} className="checkout-profile-summary">
                        <span className="checkout-profile-mark" aria-hidden="true">我</span>
                        <span className="min-w-0 flex-1 text-left">
                          <strong>{fulfillment === "pickup" ? "取餐人资料" : "收货信息"}</strong>
                          <small>
                            {customerName && /^1\d{10}$/.test(phone)
                              ? fulfillment === "pickup"
                                ? `${customerName} · ${phone}`
                                : deliveryArea && doorNumber
                                  ? `${customerName} · ${phone} · ${deliveryArea} ${doorNumber}`
                                  : "联系人已保存，请补充配送地址"
                              : "请先完善姓名和手机号"}
                          </small>
                        </span>
                        <span className="checkout-profile-chevron" aria-hidden="true">›</span>
                      </button>

                      <div className="mt-5 grid gap-4 sm:grid-cols-2">
                        <label className="field-label">
                          {fulfillment === "pickup" ? "取餐日期" : "送达日期"}
                          <select value={pickupDay} onChange={(event) => setPickupDay(event.target.value)} className="form-select">
                            <option>今天</option><option>明天</option><option>后天</option>
                          </select>
                        </label>
                        {fulfillment === "pickup" ? (
                          <label className="field-label">
                            预计取餐时间
                            <select value={pickupTime} onChange={(event) => setPickupTime(event.target.value)} className="form-select">
                              <option>07:00–08:00</option><option>08:00–09:00</option><option>11:00–12:00</option><option>17:00–18:00</option>
                            </select>
                          </label>
                        ) : (
                          <label className="field-label">
                            预计送达时间
                            <select value={deliveryTime} onChange={(event) => setDeliveryTime(event.target.value)} className="form-select">
                              <option>08:00–09:00</option><option>09:00–10:00</option><option>11:30–12:30</option><option>17:30–18:30</option>
                            </select>
                          </label>
                        )}
                      </div>

                      <label className="field-label mt-4">
                        备注
                        <input value={note} onChange={(event) => setNote(event.target.value)} className="px-5 py-3 bg-white border border-stone-200 rounded-full text-stone-800 placeholder:text-stone-400 focus:border-stone-400 focus:ring-2 focus:ring-stone-200 transition-all duration-300" placeholder="例如：分两袋装" />
                      </label>

                      {fulfillment === "delivery" ? (
                        <p className="mt-4 border-l-4 border-[#c94c4c] bg-[#e8d5c0] px-4 py-3 text-sm text-stone-700">
                          配送范围：本店 3km 内 · 最低起送 {formatMoney(DELIVERY_MINIMUM)} · 配送费 {formatMoney(DELIVERY_FEE)} · 满 {formatMoney(FREE_DELIVERY_THRESHOLD)} 免配送费
                        </p>
                      ) : null}
                      {formError ? <p className="mt-4 text-sm font-medium text-red-800" role="alert">{formError}</p> : null}
                      <div className="mt-6 space-y-2 border-t border-dashed border-stone-400 pt-5 text-sm">
                        <p className="flex justify-between"><span>商品金额</span><span>{formatMoney(cartTotal)}</span></p>
                        <p className="flex justify-between"><span>配送费</span><span>{formatMoney(currentDeliveryFee)}</span></p>
                        <p className="flex items-end justify-between"><strong>应付金额</strong><strong className="font-serif text-3xl">{formatMoney(payableTotal)}</strong></p>
                      </div>
                      <button type="button" onClick={submitOrder} disabled={isSubmittingOrder} className="mt-6 w-full px-6 py-3 rounded-full font-medium transition-colors duration-300 bg-stone-800 text-stone-50 hover:bg-stone-700 active:scale-95 focus:outline-none focus:ring-2 focus:ring-stone-300 disabled:cursor-wait disabled:opacity-60">
                        {isSubmittingOrder ? "正在提交…" : "确认订单并显示收款码"}
                      </button>
                      <p className="mt-4 text-xs leading-5 text-stone-600">提交成功后显示订单金额和商家个人收款码；到账仍由商家人工核验。</p>
                    </div>
                  </div>
                )}
              </section>
            ) : null}

            {customerView === "profile" ? (
              <section className="mx-auto max-w-5xl px-5 py-8 md:px-12 md:py-12">
                <button type="button" onClick={() => navigateCustomer("profile-details")} className="customer-profile-overview">
                  <div className="customer-profile-avatar" aria-hidden="true">{customerName.trim().slice(0, 1) || "我"}</div>
                  <span className="min-w-0 flex-1 text-left">
                    <strong className="block truncate font-serif text-2xl md:text-3xl">{customerName.trim() || "未设置姓名"}</strong>
                    <small className="mt-1 block text-stone-600">
                      {customerName && /^1\d{10}$/.test(phone) ? `${phone}${deliveryArea ? ` · ${deliveryArea}` : ""}` : "完善资料，下单时自动填入"}
                    </small>
                  </span>
                  <span className="customer-profile-channel">个人资料</span>
                  <span className="customer-profile-chevron" aria-hidden="true">›</span>
                </button>

                <button type="button" onClick={() => navigateCustomer("orders")} className="customer-order-entry">
                  <span className="customer-order-entry-icon" aria-hidden="true">单</span>
                  <span className="min-w-0 flex-1 text-left">
                    <strong className="block font-serif text-xl md:text-2xl">我的订单</strong>
                    <small className="mt-1 block truncate text-stone-600">
                      {orders.length > 0 ? `最近订单 #${orders[0].id} · ${STATUS_LABELS[orders[0].status]}` : "还没有订单，去挑一笼喜欢的馒头吧"}
                    </small>
                  </span>
                  <span className="customer-order-metrics" aria-label={`全部订单 ${orders.length} 笔，进行中 ${activeOrders.length} 笔`}>
                    <b>{orders.length}</b><small>全部</small>
                    <b>{activeOrders.length}</b><small>进行中</small>
                  </span>
                  <span className="customer-order-chevron" aria-hidden="true">›</span>
                </button>

                <div className="customer-profile-quick-grid">
                  <button type="button" onClick={() => navigateCustomer("shop")}>
                    <span aria-hidden="true">麦</span>
                    <strong>再来一单</strong>
                    <small>看看今日在售</small>
                  </button>
                  <button type="button" onClick={() => navigateCustomer("cart")}>
                    <span aria-hidden="true">笼</span>
                    <strong>我的购物车</strong>
                    <small>{cartCount > 0 ? `已选 ${cartCount} 件商品` : "暂未选择商品"}</small>
                  </button>
                </div>

                <div className="customer-profile-note">
                  <strong>温馨提示</strong>
                  <p>个人收款码付款后需要商家人工核验，到账状态请以订单详情中的提示为准。</p>
                </div>
              </section>
            ) : null}

            {customerView === "management" && merchantSessionToken && merchant?.role === "super_admin" ? (
              <section className="management-page mx-auto max-w-6xl px-5 py-8 md:px-12 md:py-12">
                <div className="management-masthead">
                  <div>
                    <p className="text-sm text-stone-600">超级管理员 · 系统权限中心</p>
                    <h1 className="mt-2 font-serif text-3xl md:text-5xl">账号、角色与会话</h1>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-600">所有高权限操作集中在此页。账号角色、启停状态、临时密码和删除操作保存后立即由 CloudBase 生效。</p>
                  </div>
                  <div className="management-stamp" aria-label={`当前共有 ${merchantAccounts.length} 个后台账号`}>
                    <strong>{merchantAccounts.length}</strong>
                    <span>后台账号</span>
                  </div>
                </div>

                <div className="management-role-strip">
                  <div>
                    <span className="management-role-mark" aria-hidden="true">管</span>
                    <span>
                      <strong>{merchant.displayName}</strong>
                      <small>@{merchant.username} · {MERCHANT_ROLE_LABELS[merchant.role]}</small>
                    </span>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button type="button" onClick={() => void toggleAdmin()} className="rounded-full border border-[#9a4811] px-5 py-2 text-sm text-[#7b390d]">进入商家工作台</button>
                    <button type="button" onClick={() => void logoutMerchantSession()} className="rounded-full border border-[#a23f35] px-5 py-2 text-sm text-[#8b2f27]">退出管理员</button>
                  </div>
                </div>

                <div className="mt-8">{renderAccessManagement()}</div>
              </section>
            ) : null}
            {customerView === "profile-details" ? (
              <section className="mx-auto max-w-3xl px-5 py-8 md:px-12 md:py-12">
                <div className="customer-secondary-heading">
                  <button type="button" onClick={() => navigateCustomer("profile")} className="customer-secondary-back" aria-label="返回个人中心">←</button>
                  <div>
                    <p className="text-sm text-stone-600">个人中心 · 下单时自动带入</p>
                    <h1 className="mt-1 font-serif text-3xl md:text-4xl">个人资料与收货地址</h1>
                  </div>
                </div>

                <div className="profile-details-form mt-8 bg-[#faf6f1] rounded-[2rem] border border-stone-200 p-6 md:p-8">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="field-label">
                      姓名或称呼
                      <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} className="px-5 py-3 bg-white border border-stone-200 rounded-full text-stone-800 placeholder:text-stone-400 focus:border-stone-400 focus:ring-2 focus:ring-stone-200 transition-all duration-300" placeholder="例如：王女士" />
                    </label>
                    <label className="field-label">
                      联系电话
                      <input value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 11))} inputMode="tel" className="px-5 py-3 bg-white border border-stone-200 rounded-full text-stone-800 placeholder:text-stone-400 focus:border-stone-400 focus:ring-2 focus:ring-stone-200 transition-all duration-300" placeholder="请输入 11 位手机号" />
                    </label>
                    <label className="field-label">
                      默认配送区域（选填）
                      <select value={deliveryArea} onChange={(event) => setDeliveryArea(event.target.value)} className="form-select">
                        <option value="">暂不设置配送地址</option>
                        {DELIVERY_AREAS.map((area) => <option key={area} value={area}>{area}</option>)}
                      </select>
                    </label>
                    <label className="field-label">
                      楼栋和门牌号（选填）
                      <input value={doorNumber} onChange={(event) => setDoorNumber(event.target.value)} className="px-5 py-3 bg-white border border-stone-200 rounded-full text-stone-800 placeholder:text-stone-400 focus:border-stone-400 focus:ring-2 focus:ring-stone-200 transition-all duration-300" placeholder="例如：3 幢 2 单元 502" />
                    </label>
                  </div>
                  <p className="profile-privacy-note">资料只保存在当前设备；提交订单时才会随订单发送给商家。</p>
                  {profileError ? <p className="mt-4 text-sm font-medium text-red-800" role="alert">{profileError}</p> : null}
                  <div className="mt-6 flex flex-wrap justify-end gap-3">
                    <button type="button" onClick={cancelCustomerProfileEdit} className="px-6 py-3 rounded-full font-medium border border-stone-300 bg-transparent text-stone-800">取消</button>
                    <button type="button" onClick={saveCustomerProfile} className="px-6 py-3 rounded-full font-medium bg-stone-800 text-stone-50">保存常用资料</button>
                  </div>
                </div>
              </section>
            ) : null}

            {customerView === "orders" ? (
              <section className="mx-auto max-w-5xl px-5 py-8 md:px-12 md:py-12">
                <div className="customer-secondary-heading">
                  <button type="button" onClick={() => navigateCustomer("profile")} className="customer-secondary-back" aria-label="返回个人中心">←</button>
                  <div>
                    <p className="text-sm text-stone-600">个人中心 · 制作进度随时查看</p>
                    <h1 className="mt-1 font-serif text-3xl md:text-4xl">我的订单</h1>
                  </div>
                </div>
                {orders.length === 0 ? (
                  <div className="mt-8"><EmptyState title="还没有下过单" description="选几样今天想吃的馒头，预约好时间，就等热乎出锅。" /></div>
                ) : (
                  <div className="mt-8 space-y-4">
                    {orders.map((order) => (
                      <article key={order.id} className="bg-[#faf6f1] rounded-[2rem] border border-stone-200 p-6 md:p-8 order-card">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <span className={`order-status status-${order.status}`}>{STATUS_LABELS[order.status]}</span>
                            <h2 className="mt-3 font-serif text-xl md:text-2xl">{order.shortCode}【{order.fulfillment === "pickup" ? "自提" : "配送"}】</h2>
                            <p className="mt-1 text-sm text-stone-600">
                              {order.fulfillment === "pickup"
                                ? "预计 " + order.pickupDay + " " + order.pickupTime + " 取餐"
                                : "预计 " + order.pickupDay + " " + order.deliveryTime + " 送至 " + order.deliveryArea + " " + order.doorNumber}
                            </p>
                            {order.fulfillment === "delivery" ? (
                              <p className="mt-2 text-sm font-medium text-stone-700">配送进度：{DELIVERY_STATUS_LABELS[order.deliveryStatus]}</p>
                            ) : null}
                            <p className="mt-2 text-sm font-medium text-stone-700">{PAYMENT_STATUS_LABELS[order.paymentStatus]}</p>
                            {order.paymentMethodId ? <p className="mt-1 text-xs text-stone-600">收款方式：{paymentMethods.find((method) => method.id === order.paymentMethodId)?.name ?? "原收款方式"}</p> : null}
                          </div>
                          <div className="text-right">
                            <strong className="font-serif text-2xl">{formatMoney(order.total)}</strong>
                            <p className="mt-1 text-xs text-stone-600">商品 {formatMoney(order.subtotal)} · 配送费 {formatMoney(order.deliveryFee)}</p>
                            <p className="mt-1 text-xs text-stone-600">#{order.id}</p>
                          </div>
                        </div>
                        <div className="my-5 border-t border-dashed border-stone-300" />
                        <p className="text-sm leading-7 text-stone-600">{order.items.map((item) => `${item.name} × ${item.quantity}`).join("、")}</p>
                        <div className="mt-5 order-progress" aria-label={`订单状态：${STATUS_LABELS[order.status]}`}>
                          {(["pending", "preparing", "ready", "completed"] as OrderStatus[]).map((status, index, list) => {
                            const currentIndex = list.indexOf(order.status);
                            const active = index <= currentIndex;
                            return <span key={status} className={active ? "progress-active" : ""}>{STATUS_LABELS[status]}</span>;
                          })}
                        </div>
                        {(order.paymentStatus === "pending" || order.paymentStatus === "rejected") && selectedPaymentMethod ? (
                          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4">
                            <select value={selectedPaymentMethod.id} onChange={(event) => setSelectedPaymentMethodId(event.target.value)} className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm" aria-label="选择付款收款码">
                              {activePaymentMethods.map((method) => <option key={method.id} value={method.id}>{method.name} · {method.payeeName}</option>)}
                            </select>
                            <a href={selectedPaymentMethod.qrCodeUrl} target="_blank" rel="noreferrer" className="rounded-full border border-stone-300 px-5 py-2 text-sm font-medium">打开收款码</a>
                            <button type="button" onClick={() => void markOrderPaid(order)} className="rounded-full bg-[#59694d] px-5 py-2 text-sm font-medium text-white">我已付款</button>
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                )}
              </section>
            ) : null}
          </main>

          <nav className={`customer-nav ${merchantSessionToken && merchant?.role === "super_admin" ? "customer-nav-management" : ""}`} aria-label="顾客端主导航">
            <button type="button" onClick={() => navigateCustomer("shop")} className={customerView === "shop" ? "nav-active" : ""}>
              <span aria-hidden="true">麦</span>
              <small>点单</small>
            </button>
            <button type="button" onClick={() => navigateCustomer("cart")} className={customerView === "cart" ? "nav-active" : ""}>
              <span aria-hidden="true">笼</span>
              <small>选好了</small>
              {cartCount > 0 ? <b>{cartCount}</b> : null}
            </button>
            <button type="button" onClick={() => navigateCustomer("profile")} className={customerView === "profile" || customerView === "profile-details" || customerView === "orders" ? "nav-active" : ""}>
              <span aria-hidden="true">我</span>
              <small>我的</small>
            </button>
            {merchantSessionToken && merchant?.role === "super_admin" ? (
              <button type="button" onClick={() => navigateCustomer("management")} className={customerView === "management" ? "nav-active" : ""}>
                <span aria-hidden="true">管</span>
                <small>管理</small>
              </button>
            ) : null}
          </nav>
        </>
      )}
    </div>
  );
}
