import { getPublicServerError, supabaseRequest } from "../../../lib/supabase-rest";

/** 第一版允许配送的 3km 内区域。 */
const DELIVERY_AREAS = ["幸福小区", "阳光花园", "麦香公寓", "邻里写字楼"];

/** 顾客提交的订单商品。 */
type RequestedItem = {
  /** 商品唯一标识。 */
  productId?: string;
  /** 下单数量。 */
  quantity?: number;
};

/** 顾客提交的订单表单。 */
type CreateOrderBody = {
  /** 订单商品列表。 */
  items?: RequestedItem[];
  /** 订单类型。 */
  orderType?: "pickup" | "delivery";
  /** 兼容旧客户端的配送方式。 */
  fulfillment?: "pickup" | "delivery";
  /** 顾客姓名或收货人。 */
  customerName?: string;
  /** 联系电话。 */
  phone?: string;
  /** 可配送区域。 */
  deliveryArea?: string;
  /** 楼栋、单元和门牌号。 */
  doorNumber?: string;
  /** 预约日期。 */
  pickupDay?: string;
  /** 预计取餐时间。 */
  pickupTime?: string;
  /** 预计送达时间。 */
  deliveryTime?: string;
  /** 顾客备注。 */
  remark?: string;
  /** 兼容旧客户端的配送地址。 */
  address?: string;
  /** 兼容旧客户端的订单备注。 */
  note?: string;
};

/** 将历史制作状态映射到新的五状态结构。 */
function normalizeStatus(value: unknown) {
  const statusMap: Record<string, string> = {
    new: "pending",
    preparing: "preparing",
    ready: "ready",
    delivering: "ready",
    done: "completed",
    pending: "pending",
    completed: "completed",
    cancelled: "cancelled",
  };
  return statusMap[String(value)] ?? "pending";
}

/** 将数据库订单字段转换为两端共用的驼峰结构。 */
function mapOrder(row: Record<string, unknown>) {
  const rawItems = Array.isArray(row.order_items) ? row.order_items as Record<string, unknown>[] : [];
  const fulfillment = String(row.order_type ?? row.fulfillment ?? "pickup");
  const legacyStatus = String(row.status ?? "pending");
  const deliveryFee = Number(row.delivery_fee ?? 0);
  const address = String(row.address ?? "");
  return {
    id: row.id,
    shortCode: row.short_code ?? (fulfillment === "delivery" ? "D" : "A") + String(row.id).slice(-3).padStart(3, "0"),
    createdAt: row.created_at,
    items: rawItems.map((item) => ({
      productId: item.product_id,
      name: item.product_name,
      quantity: item.quantity,
      unit: item.unit,
      price: Number(item.unit_price),
    })),
    subtotal: Number(row.subtotal ?? Math.max(0, Number(row.total) - deliveryFee)),
    deliveryFee,
    total: Number(row.total),
    fulfillment,
    customerName: row.customer_name,
    phone: row.phone,
    address,
    deliveryArea: row.delivery_area ?? "",
    doorNumber: row.door_number ?? address,
    pickupDay: row.pickup_day,
    pickupTime: row.pickup_time ?? "",
    deliveryTime: row.delivery_time ?? (fulfillment === "delivery" ? row.pickup_time ?? "" : ""),
    note: row.remark ?? row.note ?? "",
    status: normalizeStatus(legacyStatus),
    deliveryStatus: row.delivery_status ?? (legacyStatus === "delivering" ? "delivering" : legacyStatus === "done" ? "delivered" : "waiting"),
    paymentStatus: row.payment_status,
    paymentReference: row.payment_reference,
    paymentMethodId: row.payment_method_id,
    accessToken: row.access_token,
  };
}

/** 旧兼容路由仅允许顾客凭随机订单令牌查询自己的订单。 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const tokens = (url.searchParams.get("tokens") ?? "")
      .split(",")
      .map((token) => token.trim())
      .filter((token) => /^[a-f0-9]{48}$/.test(token))
      .slice(0, 30);

    if (tokens.length === 0) {
      return Response.json({ orders: [] });
    }

    // 顾客只能凭每笔订单的随机访问令牌读取自己的记录。
    const filter = "&access_token=in.(" + tokens.join(",") + ")";
    const rows = await supabaseRequest<Record<string, unknown>[]>(
      "orders?select=*,order_items(*)&order=created_at.desc" + filter,
    );
    return Response.json({ orders: rows.map(mapOrder) });
  } catch (error) {
    const publicError = getPublicServerError(error);
    return Response.json({ message: publicError.message }, { status: publicError.status });
  }
}

/** 校验订单表单并通过数据库事务函数创建订单。 */
export async function POST(request: Request) {
  try {
    const body = await request.json() as CreateOrderBody;
    const items = (body.items ?? []).filter((item) => (
      typeof item.productId === "string"
      && Number.isInteger(item.quantity)
      && Number(item.quantity) > 0
      && Number(item.quantity) <= 99
    ));
    const orderType = body.orderType ?? body.fulfillment ?? "pickup";
    const deliveryArea = (body.deliveryArea ?? "").trim();
    const doorNumber = (body.doorNumber ?? body.address ?? "").trim();
    const remark = (body.remark ?? body.note ?? "").trim();

    if (items.length === 0 || !body.customerName?.trim() || !/^1\d{10}$/.test(body.phone ?? "")) {
      return Response.json({ message: "请检查商品、姓名和手机号" }, { status: 400 });
    }
    if (new Set(items.map((item) => item.productId)).size !== items.length) {
      return Response.json({ message: "同一商品不能重复提交" }, { status: 400 });
    }
    if (orderType === "pickup" && !body.pickupTime?.trim()) {
      return Response.json({ message: "请选择预计取餐时间" }, { status: 400 });
    }
    if (orderType === "delivery" && (!DELIVERY_AREAS.includes(deliveryArea) || !doorNumber || !body.deliveryTime?.trim())) {
      return Response.json({ message: "请选择 3km 内配送区域，并填写门牌号和送达时间" }, { status: 400 });
    }

    // 金额、最低起送、配送费和库存均由数据库重新计算，不能信任客户端传入的价格。
    const result = await supabaseRequest<Record<string, unknown>>("rpc/create_order", {
      method: "POST",
      body: {
        p_items: items.map((item) => ({ product_id: item.productId, quantity: item.quantity })),
        p_order_type: orderType,
        p_customer_name: body.customerName.trim().slice(0, 40),
        p_phone: body.phone,
        p_delivery_area: orderType === "delivery" ? deliveryArea : "",
        p_door_number: orderType === "delivery" ? doorNumber.slice(0, 120) : "",
        p_pickup_day: (body.pickupDay ?? "").slice(0, 20),
        p_pickup_time: orderType === "pickup" ? (body.pickupTime ?? "").slice(0, 30) : "",
        p_delivery_time: orderType === "delivery" ? (body.deliveryTime ?? "").slice(0, 30) : "",
        p_remark: remark.slice(0, 200),
      },
    });
    return Response.json(result, { status: 201 });
  } catch (error) {
    const publicError = getPublicServerError(error);
    return Response.json({ message: publicError.message }, { status: publicError.status });
  }
}
