const { cloudBaseEnvId } = require("./config");
const { ensureSeedData } = require("./utils/store");

App({
  /** 当前小程序进程中的商家登录信息，会从本机未过期会话恢复。 */
  globalData: {
    /** 服务端签发的商家会话令牌。 */
    merchantSessionToken: "",
    /** 当前商家的公开账号信息。 */
    merchantAccount: null,
    /** 当前商家会话的固定到期时间。 */
    merchantSessionExpiresAt: "",
  },

  /** 小程序启动时初始化指定 CloudBase 环境和只读本机缓存。 */
  onLaunch() {
    if (!wx.cloud) {
      wx.showModal({ title: "基础库版本过低", content: "请升级微信后重新打开小程序。", showCancel: false });
      return;
    }
    wx.cloud.init({
      env: cloudBaseEnvId,
      traceUser: true,
    });
    // 本机缓存只用于离线展示、购物车和订单令牌，业务数据以 CloudBase 为准。
    ensureSeedData();
    // 仅恢复仍在固定有效期内的后台会话，管理页会继续向服务端二次校验。
    const savedSession = wx.getStorageSync("manyouyisi-merchant-session-v2");
    if (savedSession && savedSession.merchantSessionToken && new Date(savedSession.expiresAt).getTime() > Date.now()) {
      this.globalData.merchantSessionToken = savedSession.merchantSessionToken;
      this.globalData.merchantAccount = savedSession.merchant;
      this.globalData.merchantSessionExpiresAt = savedSession.expiresAt;
    } else {
      wx.removeStorageSync("manyouyisi-merchant-session-v2");
    }
  },
});
