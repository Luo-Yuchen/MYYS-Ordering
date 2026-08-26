"use client";

import cloudbase from "@cloudbase/js-sdk";

/** 腾讯云 CloudBase 环境编号。 */
export const CLOUDBASE_ENV_ID = "bun-order-d9gn0mjn09021bfbe";

/** 腾讯云 CloudBase 环境所在地域。 */
const CLOUDBASE_REGION = "ap-shanghai";

/** 网页端公开使用的 CloudBase Publishable Key，仅具有匿名用户权限。 */
const CLOUDBASE_PUBLISHABLE_KEY = "eyJhbGciOiJSUzI1NiIsImtpZCI6ImUxNzQ5NzcxLTU5M2UtNGE1Zi05MmQ2LWIzMzhkYzFlOGIwNSJ9.eyJpc3MiOiJodHRwczovL2J1bi1vcmRlci1kOWduMG1qbjA5MDIxYmZiZS5hcC1zaGFuZ2hhaS50Y2ItYXBpLnRlbmNlbnRjbG91ZGFwaS5jb20iLCJzdWIiOiJhbm9uIiwiYXVkIjoiYnVuLW9yZGVyLWQ5Z24wbWpuMDkwMjFiZmJlIiwiZXhwIjo0MDkxNDEyODU1LCJpYXQiOjE3ODc3Mjk2NTUsIm5vbmNlIjoiaDlWTEZjXzZTSGE5TE83bEM4TnAzdyIsImF0X2hhc2giOiJoOVZMRmNfNlNIYTlMTzdsQzhOcDN3IiwibmFtZSI6IkFub255bW91cyIsInNjb3BlIjoiYW5vbnltb3VzIiwicHJvamVjdF9pZCI6ImJ1bi1vcmRlci1kOWduMG1qbjA5MDIxYmZiZSIsIm1ldGEiOnsicGxhdGZvcm0iOiJQdWJsaXNoYWJsZUtleSJ9LCJyb2xlIjoiYW5vbiIsImlzX2Fub255bW91cyI6dHJ1ZSwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiYW5vbnltb3VzIiwicHJvdmlkZXJzIjpbImFub255bW91cyJdfSwidXNlcl9tZXRhZGF0YSI6eyJuYW1lIjoiQW5vbnltb3VzIn0sInVzZXJfdHlwZSI6IiIsImNsaWVudF90eXBlIjoiY2xpZW50X3VzZXIiLCJpc19zeXN0ZW1fYWRtaW4iOmZhbHNlfQ.EzgilzO2NpvXW4CoaBWOkFQssOE87rxUyCqKmjPDJwyN5u5gu7XM5oQ-fFlsoQ4DkKxNZDQREzWwvr4XCZEBuRBQonzrkdWvMygXziCuoj4W7rn-6OBulQp09V7iENNMfwLghOfsNXpGb2klXPJEigPaPqs5nuz3sfZ9OK3gg1eKZhMnFCx_QvmqfJbrJl5JibL9QBRtgorRg35EpOmEZxdDJrMD8ntJUQuUWUWh6qG2cWM5qHfp3wkJSXrySYP1_rdbDY8SAQnr8urttcOeqZl-_e_K8KnQK1TSSW--oscoLDJRC-Q5Hs75ZjVrl19_jZDPUe6BWgoGkCU8GqrvVQ";

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

/** 初始化 CloudBase Web SDK，通过公开密钥获得匿名权限。 */
function getCloudBaseApp() {
  if (!cloudBaseApp) {
    cloudBaseApp = cloudbase.init({
      env: CLOUDBASE_ENV_ID,
      region: CLOUDBASE_REGION,
      accessKey: CLOUDBASE_PUBLISHABLE_KEY,
    });
  }
  return cloudBaseApp;
}

/** 调用点单系统 CloudBase 云函数，并统一提取业务数据与错误。 */
export async function callOrderingFunction<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const app = getCloudBaseApp();
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
