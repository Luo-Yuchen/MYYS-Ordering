const { orderingFunctionName } = require("../config");

/** 将 CloudBase 底层错误转换为适合顾客阅读的简短提示。 */
function createCloudFunctionError(error) {
  const errorCode = error && (error.errCode || error.code);
  const rawMessage = error && error.errMsg ? String(error.errMsg) : "";
  const isPermissionError = Number(errorCode) === -601034
    || rawMessage.includes("-601034")
    || rawMessage.includes("没有权限")
    || rawMessage.toLowerCase().includes("permission");

  // 权限错误不向页面透出调用编号、请求轨迹或平台内部说明。
  if (isPermissionError) {
    return new Error("云服务尚未完成小程序授权，当前显示本机缓存");
  }
  if (/timeout|timed out|network|网络/i.test(rawMessage)) {
    return new Error("云服务连接超时，当前显示本机缓存，请稍后重试");
  }
  return new Error("云服务暂时不可用，当前显示本机缓存，请稍后重试");
}

/** 调用 CloudBase 点单云函数并统一提取业务错误。 */
function callOrderingFunction(action, data = {}) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: orderingFunctionName,
      data: { action, ...data },
      success(response) {
        const result = response.result || {};
        if (result.ok) {
          resolve(result.data);
          return;
        }
        reject(new Error(result.message || "CloudBase 店铺服务暂时不可用"));
      },
      fail(error) {
        const friendlyError = createCloudFunctionError(error);
        // 开发者控制台仅记录动作和错误码，不记录调用轨迹或敏感上下文。
        console.warn("ordering-api 调用失败", { action, errorCode: error && (error.errCode || error.code) });
        reject(friendlyError);
      },
    });
  });
}

/** 使用数据库中的商家用户名和密码登录。 */
function loginMerchant(username, password) {
  return callOrderingFunction("merchantLogin", { username, password });
}

/** 修改商家数据库密码，成功后需要重新登录。 */
function changeMerchantPassword(merchantSessionToken, currentPassword, newPassword) {
  return callOrderingFunction("changeMerchantPassword", { merchantSessionToken, currentPassword, newPassword });
}

/** 主动撤销当前商家会话。 */
function logoutMerchant(merchantSessionToken) {
  return callOrderingFunction("merchantLogout", { merchantSessionToken });
}

/** 读取两端共用的公开商品、店铺设置和收款码配置。 */
function getRemoteStore() {
  return callOrderingFunction("getStore");
}

/** 使用商家会话覆盖保存两端共用的完整收款方式列表。 */
function saveRemotePaymentMethods(paymentMethods, merchantSessionToken) {
  return callOrderingFunction("savePaymentMethods", { paymentMethods, merchantSessionToken });
}

/** 根据当前设备保存的订单令牌读取顾客订单。 */
function getRemoteOrders(tokens) {
  return callOrderingFunction("getOrders", { tokens });
}

/** 使用商家会话读取商家有权查看的全部订单。 */
function getAdminOrders(merchantSessionToken) {
  return callOrderingFunction("getOrders", { merchantSessionToken });
}

/** 提交新订单，由 CloudBase 在事务中校验价格、库存和配送费。 */
function createRemoteOrder(data) {
  return callOrderingFunction("createOrder", data);
}

/** 更新订单制作状态、配送进度或付款核验状态。 */
function updateRemoteOrder(orderId, data, merchantSessionToken = "", accessToken = "") {
  return callOrderingFunction("updateOrder", { orderId, ...data, merchantSessionToken, accessToken });
}

/** 顾客扫码后提交付款待核验状态。 */
function submitRemotePayment(orderId, accessToken, paymentReference, paymentMethodId) {
  return updateRemoteOrder(orderId, { paymentStatus: "submitted", paymentReference, paymentMethodId }, "", accessToken);
}

/** 使用商家会话新增或更新一个云端商品。 */
function saveRemoteProduct(product, merchantSessionToken) {
  return callOrderingFunction("saveProduct", { product, merchantSessionToken });
}

/** 使用商家会话保存云端店铺装修设置。 */
function saveRemoteStoreSettings(settings, merchantSessionToken) {
  return callOrderingFunction("saveStoreSettings", { settings, merchantSessionToken });
}

/** 将小程序临时图片上传到当前 CloudBase 环境的云存储。 */
function uploadRemoteImage(tempFilePath, scene) {
  return new Promise((resolve, reject) => {
    const extensionMatch = /\.([a-zA-Z0-9]+)$/.exec(tempFilePath);
    const extension = extensionMatch ? extensionMatch[1].toLowerCase() : "jpg";
    const cloudPath = `ordering/${scene === "store" ? "store" : "products"}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
    wx.cloud.uploadFile({
      cloudPath,
      filePath: tempFilePath,
      success(result) {
        resolve(result.fileID);
      },
      fail() {
        // 图片上传失败时不向商家页面透出平台调用轨迹。
        reject(new Error("图片上传失败，请检查云服务授权或网络后重试"));
      },
    });
  });
}

module.exports = {
  callOrderingFunction,
  changeMerchantPassword,
  createRemoteOrder,
  getAdminOrders,
  loginMerchant,
  getRemoteOrders,
  getRemoteStore,
  saveRemotePaymentMethods,
  saveRemoteProduct,
  saveRemoteStoreSettings,
  logoutMerchant,
  submitRemotePayment,
  updateRemoteOrder,
  uploadRemoteImage,
};
