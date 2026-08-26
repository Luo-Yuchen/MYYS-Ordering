"use client";

/** 腾讯云 CloudBase 环境编号。 */
export const CLOUDBASE_ENV_ID = "bun-order-d9gn0mjn09021bfbe";

/** 网页端调用点单云函数的 CloudBase HTTPS 路由。 */
const CLOUDBASE_ORDERING_API_URL = "https://bun-order-d9gn0mjn09021bfbe-1474635915.ap-shanghai.app.tcloudbase.com/ordering-api";

/** CloudBase 云函数统一返回结构。 */
type CloudBaseFunctionResult<T> = {
  /** 请求是否成功。 */
  ok: boolean;
  /** 成功时返回的业务数据。 */
  data?: T;
  /** 失败时返回的公开错误提示。 */
  message?: string;
};

/** 通过公开 HTTPS 路由调用点单云函数，并统一提取业务数据与错误。 */
export async function callOrderingFunction<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(CLOUDBASE_ORDERING_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  const result = await response.json() as CloudBaseFunctionResult<T>;
  if (!response.ok || !result?.ok) throw new Error(result?.message || "CloudBase 店铺服务暂时不可用");
  return result.data as T;
}