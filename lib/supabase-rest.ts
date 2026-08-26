/** Supabase REST 请求的可选参数。 */
type SupabaseRequestOptions = {
  /** HTTP 请求方法。 */
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  /** 需要发送的 JSON 数据。 */
  body?: unknown;
  /** PostgREST 的 Prefer 请求头。 */
  prefer?: string;
};

/** 读取服务端 Supabase 配置，避免把服务角色密钥发送到浏览器或小程序。 */
function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }

  return { url, serviceRoleKey };
}

/** 调用 Supabase PostgREST 接口，并统一处理错误返回。 */
export async function supabaseRequest<T>(path: string, options: SupabaseRequestOptions = {}): Promise<T> {
  const { url, serviceRoleKey } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method: options.method ?? "GET",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(options.prefer ? { Prefer: options.prefer } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`SUPABASE_REQUEST_FAILED:${response.status}:${detail}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

/** 将服务端异常转换为不包含密钥和数据库细节的公开错误。 */
export function getPublicServerError(error: unknown) {
  if (error instanceof Error && error.message === "SUPABASE_NOT_CONFIGURED") {
    return { status: 503, message: "店铺数据库尚未配置" };
  }
  return { status: 500, message: "店铺服务暂时不可用，请稍后重试" };
}
