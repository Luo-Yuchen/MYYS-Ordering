import { getPublicServerError, isAdminKeyValid, supabaseRequest } from "../../../lib/supabase-rest";

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

/** 商家提交的收款方式。 */
type PaymentMethodInput = {
  /** 收款方式唯一标识。 */
  id?: string;
  /** 收款方式名称。 */
  name?: string;
  /** 收款人展示名称。 */
  payeeName?: string;
  /** 收款二维码图片地址。 */
  qrCodeUrl?: string;
  /** 付款说明或备注。 */
  note?: string;
  /** 是否向顾客展示。 */
  enabled?: boolean;
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

/** 校验二维码是否使用可跨端访问的 HTTPS 地址。 */
function isValidPaymentImageUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
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
export async function GET(request: Request) {
  try {
    const providedAdminKey = request.headers.get("x-admin-key");
    const isAdmin = isAdminKeyValid(providedAdminKey);
    if (providedAdminKey && !isAdmin) {
      return Response.json({ message: "商家管理口令错误" }, { status: 403 });
    }

    const [products, settingsRows, paymentRows] = await Promise.all([
      supabaseRequest<ProductRow[]>("products?select=*&available=eq.true&order=sort_order.asc"),
      supabaseRequest<StoreSettingsRow[]>("store_settings?select=*&id=eq.default&limit=1"),
      // 数据库尚未执行新增表迁移时继续兼容旧版环境变量收款码。
      supabaseRequest<PaymentMethodRow[]>("payment_methods?select=*&order=sort_order.asc").catch(() => []),
    ]);
    const settings = settingsRows[0];
    const paymentMethods = paymentRows.length > 0
      ? paymentRows.filter((method) => isAdmin || method.enabled).map(mapPaymentMethod)
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

/** 校验管理口令并覆盖保存完整收款方式列表。 */
export async function PUT(request: Request) {
  try {
    if (!isAdminKeyValid(request.headers.get("x-admin-key"))) {
      return Response.json({ message: "商家管理口令错误" }, { status: 403 });
    }
    const body = await request.json() as { /** 完整收款方式列表。 */ paymentMethods?: PaymentMethodInput[] };
    if (!Array.isArray(body.paymentMethods) || body.paymentMethods.length > 12) {
      return Response.json({ message: "收款码列表格式错误，最多可配置 12 个" }, { status: 400 });
    }

    const paymentMethods = body.paymentMethods.map((method, index) => ({
      id: (method.id ?? "").trim(),
      name: (method.name ?? "").trim().slice(0, 40),
      payeeName: (method.payeeName ?? "").trim().slice(0, 40),
      qrCodeUrl: (method.qrCodeUrl ?? "").trim().slice(0, 2000),
      note: (method.note ?? "").trim().slice(0, 200),
      enabled: method.enabled !== false,
      sortOrder: index,
    }));

    if (paymentMethods.some((method) => (
      !/^[a-zA-Z0-9_-]{1,64}$/.test(method.id)
      || !method.name
      || !method.payeeName
      || !isValidPaymentImageUrl(method.qrCodeUrl)
    ))) {
      return Response.json({ message: "请完整填写名称、收款人和 HTTPS 二维码地址" }, { status: 400 });
    }
    if (new Set(paymentMethods.map((method) => method.id)).size !== paymentMethods.length) {
      return Response.json({ message: "收款方式编号不能重复" }, { status: 400 });
    }

    if (paymentMethods.length > 0) {
      // 先原子写入本次列表，再删除不在列表中的旧记录，避免编辑失败时丢失原配置。
      await supabaseRequest<PaymentMethodRow[]>("payment_methods?on_conflict=id", {
        method: "POST",
        body: paymentMethods.map((method) => ({
          id: method.id,
          name: method.name,
          payee_name: method.payeeName,
          qr_code_url: method.qrCodeUrl,
          note: method.note,
          enabled: method.enabled,
          sort_order: method.sortOrder,
          updated_at: new Date().toISOString(),
        })),
        prefer: "resolution=merge-duplicates,return=representation",
      });
    }

    const deleteFilter = paymentMethods.length > 0
      ? `id=not.in.(${paymentMethods.map((method) => method.id).join(",")})`
      : "id=not.is.null";
    await supabaseRequest<void>(`payment_methods?${deleteFilter}`, { method: "DELETE" });
    return Response.json({
      paymentMethods: paymentMethods.map((method) => ({
        id: method.id,
        name: method.name,
        payeeName: method.payeeName,
        qrCodeUrl: method.qrCodeUrl,
        note: method.note,
        enabled: method.enabled,
      })),
    });
  } catch (error) {
    const publicError = getPublicServerError(error);
    return Response.json({ message: publicError.message }, { status: publicError.status });
  }
}
