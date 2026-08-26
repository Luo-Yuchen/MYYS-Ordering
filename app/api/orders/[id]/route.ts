import { getPublicServerError, supabaseRequest } from "../../../../lib/supabase-rest";

/** 订单更新请求。 */
type UpdateOrderBody = {
  /** 订单制作状态。 */
  status?: "pending" | "preparing" | "ready" | "completed" | "cancelled";
  /** 配送进度状态。 */
  deliveryStatus?: "waiting" | "delivering" | "delivered";
  /** 付款核验状态。 */
  paymentStatus?: "submitted" | "confirmed" | "rejected";
  /** 顾客填写的付款备注或流水号。 */
  paymentReference?: string;
  /** 顾客实际选择的收款方式编号。 */
  paymentMethodId?: string;
};

/** 更新订单制作或配送状态，或由顾客提交付款待核验信息。 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json() as UpdateOrderBody;
    const accessToken = request.headers.get("x-order-token") ?? "";
    const patch: Record<string, string> = {};

    if (/^[a-f0-9]{48}$/.test(accessToken) && body.paymentStatus === "submitted") {
      const paymentMethodId = (body.paymentMethodId ?? "").trim();
      if (paymentMethodId) {
        if (!/^[a-zA-Z0-9_-]{1,64}$/.test(paymentMethodId)) {
          return Response.json({ message: "收款方式编号无效" }, { status: 400 });
        }
        // 顾客只能选择当前仍启用的收款方式，防止提交已停用或伪造的编号。
        const paymentRows = await supabaseRequest<Record<string, unknown>[]>(
          "payment_methods?select=id&id=eq." + paymentMethodId + "&enabled=eq.true&limit=1",
        );
        if (paymentRows.length === 0) {
          return Response.json({ message: "该收款方式已停用，请重新选择" }, { status: 400 });
        }
        patch.payment_method_id = paymentMethodId;
      }
      patch.payment_status = "submitted";
      patch.payment_reference = (body.paymentReference ?? "").trim().slice(0, 80);
    } else {
      return Response.json({ message: "无权更新该订单" }, { status: 403 });
    }
    if (Object.keys(patch).length === 0) {
      return Response.json({ message: "没有可更新的内容" }, { status: 400 });
    }

    // 顾客更新时附带随机令牌条件，防止通过猜订单号修改他人订单。
    const tokenFilter = "&access_token=eq." + accessToken;
    const rows = await supabaseRequest<Record<string, unknown>[]>(
      "orders?id=eq." + encodeURIComponent(id) + tokenFilter,
      { method: "PATCH", body: patch, prefer: "return=representation" },
    );
    if (rows.length === 0) {
      return Response.json({ message: "订单不存在或访问令牌已失效" }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    const publicError = getPublicServerError(error);
    return Response.json({ message: publicError.message }, { status: publicError.status });
  }
}
