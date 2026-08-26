import { getPublicServerError, supabaseRequest } from "../../../lib/supabase-rest";

/** Supabase 返回的商品记录。 */
type ProductRow = {
  /** 商品唯一标识。 */
  id: string;
  /** 商品名称。 */
  name: string;
  /** 商品说明。 */
  description: string;
  /** 商品单价。 */
  price: number;
  /** 商品计价单位。 */
  unit: string;
  /** 商品分类。 */
  category: string;
  /** 当前库存。 */
  stock: number;
  /** 商品角标。 */
  badge: string | null;
  /** 商品图片地址。 */
  image_url: string | null;
  /** 默认插画色调。 */
  tone: string;
  /** 是否在售。 */
  available: boolean;
};

/** Supabase 返回的店铺设置记录。 */
type StoreSettingsRow = {
  /** 顶部圆形标记文字。 */
  brand_mark: string;
  /** 店铺名称。 */
  brand_name: string;
  /** 店铺简短说明。 */
  brand_tagline: string;
  /** 主视觉小标签。 */
  hero_badge: string;
  /** 主视觉标题。 */
  hero_title: string;
  /** 主视觉说明。 */
  hero_description: string;
  /** 主视觉按钮文字。 */
  hero_button_text: string;
  /** 配送提示。 */
  delivery_note: string;
  /** 主视觉背景图地址。 */
  hero_background_image: string;
};

/** Supabase 返回的收款方式记录。 */
type PaymentMethodRow = {
  /** 收款方式唯一标识。 */
  id: string;
  /** 收款方式名称。 */
  name: string;
  /** 收款人展示名称。 */
  payee_name: string;
  /** 收款二维码图片地址。 */
  qr_code_url: string;
  /** 付款说明或备注。 */
  note: string;
  /** 是否向顾客展示。 */
  enabled: boolean;
  /** 商家设置的排序值。 */
  sort_order: number;
};

/** 将数据库收款方式转换为两端共用的驼峰结构。 */
function mapPaymentMethod(row: PaymentMethodRow) {
  return {
    id: row.id,
    name: row.name,
    payeeName: row.payee_name,
    qrCodeUrl: row.qr_code_url,
    note: row.note,
    enabled: row.enabled,
  };
}

/** 读取环境变量中的旧版单收款码，兼容尚未迁移数据库的店铺。 */
function getLegacyPaymentMethods() {
  const qrCodeUrl = process.env.PAYMENT_QR_CODE_URL ?? "";
  if (!qrCodeUrl) return [];
  return [{
    id: "legacy-default",
    name: process.env.PAYMENT_PAYEE_NAME ?? "默认收款码",
    payeeName: process.env.PAYMENT_PAYEE_NAME ?? "商家",
    qrCodeUrl,
    note: process.env.PAYMENT_INSTRUCTIONS ?? "扫码付款时请备注订单号，付款后点击“我已付款”。",
    enabled: true,
  }];
}

/** 返回 H5 与小程序共用的在售商品、店铺设置和收款方式列表。 */
export async function GET() {
  try {
    const [products, settingsRows, paymentRows] = await Promise.all([
      supabaseRequest<ProductRow[]>("products?select=*&available=eq.true&order=sort_order.asc"),
      supabaseRequest<StoreSettingsRow[]>("store_settings?select=*&id=eq.default&limit=1"),
      // 数据库尚未执行新增表迁移时继续兼容旧版环境变量收款码。
      supabaseRequest<PaymentMethodRow[]>("payment_methods?select=*&order=sort_order.asc").catch(() => []),
    ]);
    const settings = settingsRows[0];
    const paymentMethods = paymentRows.length > 0
      ? paymentRows.filter((method) => method.enabled).map(mapPaymentMethod)
      : getLegacyPaymentMethods();
    const primaryPayment = paymentMethods.find((method) => method.enabled) ?? paymentMethods[0];

    return Response.json({
      products: products.map((product) => ({
        id: product.id,
        name: product.name,
        description: product.description,
        price: Number(product.price),
        unit: product.unit,
        category: product.category,
        stock: product.stock,
        badge: product.badge ?? undefined,
        imageUrl: product.image_url ?? undefined,
        tone: product.tone,
      })),
      settings: settings ? {
        brandMark: settings.brand_mark,
        brandName: settings.brand_name,
        brandTagline: settings.brand_tagline,
        heroBadge: settings.hero_badge,
        heroTitle: settings.hero_title,
        heroDescription: settings.hero_description,
        heroButtonText: settings.hero_button_text,
        deliveryNote: settings.delivery_note,
        heroBackgroundImage: settings.hero_background_image,
      } : null,
      paymentMethods,
      // 保留旧字段，避免尚未更新的小程序版本无法展示收款码。
      payment: {
        qrCodeUrl: primaryPayment?.qrCodeUrl ?? "",
        payeeName: primaryPayment?.payeeName ?? "商家",
        instructions: primaryPayment?.note ?? "扫码付款时请备注订单号，付款后点击“我已付款”。",
      },
      miniProgram: {
        entryUrl: process.env.MINI_PROGRAM_ENTRY_URL ?? "",
        qrCodeUrl: process.env.MINI_PROGRAM_QR_CODE_URL ?? "",
      },
    });
  } catch (error) {
    const publicError = getPublicServerError(error);
    return Response.json({ message: publicError.message }, { status: publicError.status });
  }
}

/** 旧 Supabase 管理写入口已停用，商家操作统一由 CloudBase PG 云函数校验会话。 */
export async function PUT() {
  return Response.json({ message: "请通过 CloudBase 商家端保存收款设置" }, { status: 410 });
}