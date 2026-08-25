const { orderingFunctionName } = require("../config");

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
        reject(new Error(error.errMsg || "CloudBase 网络连接失败"));
      },
    });
  });
}

/** 读取两端共用的商品、店铺设置和收款码配置。 */
function getRemoteStore(adminKey = "") {
  return callOrderingFunction("getStore", { adminKey });
}

/** 使用管理口令覆盖保存两端共用的完整收款方式列表。 */
function saveRemotePaymentMethods(paymentMethods, adminKey) {
  return callOrderingFunction("savePaymentMethods", { paymentMethods, adminKey });
}

/** 根据当前设备保存的订单令牌读取顾客订单。 */
function getRemoteOrders(tokens) {
  return callOrderingFunction("getOrders", { tokens });
}

/** 使用管理口令读取商家有权查看的全部订单。 */
function getAdminOrders(adminKey) {
  return callOrderingFunction("getOrders", { adminKey });
}

/** 提交新订单，由 CloudBase 在事务中校验价格、库存和配送费。 */
function createRemoteOrder(data) {
  return callOrderingFunction("createOrder", data);
}

/** 更新订单制作状态、配送进度或付款核验状态。 */
function updateRemoteOrder(orderId, data, adminKey = "", accessToken = "") {
  return callOrderingFunction("updateOrder", { orderId, ...data, adminKey, accessToken });
}

/** 顾客扫码后提交付款待核验状态。 */
function submitRemotePayment(orderId, accessToken, paymentReference, paymentMethodId) {
  return updateRemoteOrder(orderId, { paymentStatus: "submitted", paymentReference, paymentMethodId }, "", accessToken);
}

/** 使用管理口令新增或更新一个云端商品。 */
function saveRemoteProduct(product, adminKey) {
  return callOrderingFunction("saveProduct", { product, adminKey });
}

/** 使用管理口令保存云端店铺装修设置。 */
function saveRemoteStoreSettings(settings, adminKey) {
  return callOrderingFunction("saveStoreSettings", { settings, adminKey });
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
      fail(error) {
        reject(new Error(error.errMsg || "图片上传到 CloudBase 失败"));
      },
    });
  });
}

module.exports = {
  callOrderingFunction,
  createRemoteOrder,
  getAdminOrders,
  getRemoteOrders,
  getRemoteStore,
  saveRemotePaymentMethods,
  saveRemoteProduct,
  saveRemoteStoreSettings,
  submitRemotePayment,
  updateRemoteOrder,
  uploadRemoteImage,
};
