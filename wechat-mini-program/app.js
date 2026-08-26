const { cloudBaseEnvId } = require("./config");
const { ensureSeedData } = require("./utils/store");

App({
  /** 当前小程序进程中的商家登录信息，退出小程序后自动清除。 */
  globalData: {
    /** 服务端签发的商家会话令牌。 */
    merchantSessionToken: "",
    /** 当前商家的公开账号信息。 */
    merchantAccount: null,
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
  },
});
