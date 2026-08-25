"use client";

import cloudbase from "@cloudbase/js-sdk";

/** 腾讯云 CloudBase 环境编号。 */
export const CLOUDBASE_ENV_ID = "bun-order-d9gn0mjn09021bfbe";

/** 点单系统使用的 CloudBase 云函数名称。 */
const ORDERING_FUNCTION_NAME = "ordering-api";

/** CloudBase 云函数统一返回结构。 */
type CloudBaseFunctionResult<T> = {
  /** 请求是否成功。 */
  ok: boolean;
  /** 成功时返回的业务数据。 */
  data?: T;
  /** 失败时返回的公开错误提示。 */
  message?: string;
};

/** CloudBase Web SDK 应用实例，仅在浏览器中初始化。 */
let cloudBaseApp: ReturnType<typeof cloudbase.init> | null = null;

/** 匿名登录过程缓存，避免并发请求重复登录。 */
let loginPromise: Promise<void> | null = null;

/** 初始化 CloudBase Web SDK 并确保匿名身份可调用云函数。 */
async function getCloudBaseApp() {
  if (!cloudBaseApp) {
    cloudBaseApp = cloudbase.init({ env: CLOUDBASE_ENV_ID });
  }
  if (!loginPromise) {
    loginPromise = (async () => {
      const auth = cloudBaseApp!.auth({ persistence: "local" });
      const loginState = await auth.getLoginState();
      if (!loginState) {
        const result = await auth.signInAnonymously();
        if (result.error) throw new Error(result.error.message || "CloudBase 匿名登录失败");
      }
    })().catch((error) => {
      loginPromise = null;
      throw error;
    });
  }
  await loginPromise;
  return cloudBaseApp;
}

/** 调用点单系统 CloudBase 云函数，并统一提取业务数据与错误。 */
export async function callOrderingFunction<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const app = await getCloudBaseApp();
  const response = await app.callFunction({
    name: ORDERING_FUNCTION_NAME,
    data: { action, ...payload },
    parse: true,
  });
  const result = response.result as CloudBaseFunctionResult<T> | string;
  const parsed = typeof result === "string" ? JSON.parse(result) as CloudBaseFunctionResult<T> : result;
  if (!parsed?.ok) throw new Error(parsed?.message || "CloudBase 店铺服务暂时不可用");
  return parsed.data as T;
}
