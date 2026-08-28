const {
  formatDateTime,
  formatMoney,
  getOrders,
  getPaymentMethods,
  getProducts,
  getSettings,
  resetDemoData,
  saveOrders,
  savePaymentMethods,
  saveProducts,
  saveSettings,
} = require("../../utils/store");
const {
  changeMerchantPassword,
  deleteMerchantAccount,
  getAccessManagement,
  getAdminOrders,
  getMerchantSession,
  getRemoteStore,
  loginMerchant,
  logoutMerchant,
  saveMerchantAccount,
  saveRemotePaymentMethods,
  saveRemoteProduct,
  saveSessionSettings,
  updateRemoteOrder,
} = require("../../utils/api");

/** 小程序端持久化后台会话使用的版本化键名。 */
const MERCHANT_SESSION_STORAGE_KEY = "manyouyisi-merchant-session-v2";

/** 后台角色对应的中文名称。 */
const MERCHANT_ROLE_LABELS = {
  /** 超级管理员角色名称。 */
  super_admin: "超级管理员",
  /** 普通管理员角色名称。 */
  admin: "普通管理员",
  /** 商家角色名称。 */
  merchant: "商家",
  /** 顾客角色名称。 */
  customer: "顾客",
};

/** 商家可设置的订单制作状态。 */
const STATUS_OPTIONS = ["pending", "preparing", "ready", "completed", "cancelled"];

/** 订单制作状态对应的商家端文案。 */
const STATUS_LABELS = ["待接单", "制作中", "待取货/待配送", "已完成", "已取消"];

/** 商家可设置的配送进度。 */
const DELIVERY_STATUS_OPTIONS = ["waiting", "delivering", "delivered"];

/** 配送进度对应的商家端文案。 */
const DELIVERY_STATUS_LABELS = ["待配送", "配送中", "已送达"];

Page({
  data: {
    /** 当前商家端视图。 */
    activeView: "orders",
    /** 商家端订单列表。 */
    orders: [],
    /** 商家端商品列表。 */
    products: [],
    /** 当前店铺装修设置。 */
    settings: {},
    /** 订单制作状态选择文案。 */
    statusLabels: STATUS_LABELS,
    /** 配送进度选择文案。 */
    deliveryStatusLabels: DELIVERY_STATUS_LABELS,
    /** 今日订单数。 */
    orderCount: 0,
    /** 待处理订单数。 */
    pendingCount: 0,
    /** 今日销售额文本。 */
    revenueText: "¥0",
    /** 在售商品数。 */
    availableCount: 0,
    /** 待制作商品汇总。 */
    productionItems: [],
    /** 商家当前配置的收款方式列表。 */
    paymentMethods: [],
    /** 当前是否显示收款方式编辑表单。 */
    isPaymentEditorOpen: false,
    /** 当前正在编辑的收款方式编号。 */
    editingPaymentMethodId: "",
    /** 当前收款方式表单草稿。 */
    paymentDraft: {},
    /** 商家登录用户名。 */
    merchantUsername: "",
    /** 商家登录或首次改密时填写的当前密码。 */
    merchantPassword: "",
    /** 商家首次登录后填写的新密码。 */
    merchantNewPassword: "",
    /** 服务端签发的商家会话令牌。 */
    merchantSessionToken: "",
    /** 当前商家的公开账号信息。 */
    merchantAccount: null,
    /** 当前商家会话的固定到期时间。 */
    merchantSessionExpiresAt: "",
    /** 当前账号角色的中文名称。 */
    merchantRoleLabel: "",
    /** 当前账号是否可以管理账号与会话设置。 */
    canManageAccess: false,
    /** 当前账号是否为超级管理员。 */
    isSuperAdmin: false,
    /** 当前账号是否可以进入商家工作台。 */
    canOpenMerchantWorkspace: false,
    /** 登录成功后是否返回顾客端“我的”页面。 */
    returnToCustomerAfterLogin: false,
    /** 管理员可查看的账号列表。 */
    accessAccounts: [],
    /** 新登录会话使用的有效分钟数。 */
    sessionDurationDraft: "30",
    /** 账号表单允许选择的角色值。 */
    availableRoleValues: ["merchant", "customer"],
    /** 账号表单允许选择的角色名称。 */
    availableRoleLabels: ["商家", "顾客"],
    /** 当前账号表单选择的角色下标。 */
    accountRoleIndex: 0,
    /** 新增或编辑账号使用的表单草稿。 */
    accountDraft: { id: "", username: "", displayName: "", role: "merchant", enabled: true, temporaryPassword: "", mustChangePassword: false },
    /** 账号权限页面的保存与校验提示。 */
    accessMessage: "",
    /** 收款设置同步或保存提示。 */
    paymentMessage: "",
    /** 是否正在读取或同步云端收款设置。 */
    isSyncingPayments: false,
  },

  /** 接收顾客端传入的目标视图和登录成功后的返回方式。 */
  onLoad(options) {
    this.setData({
      activeView: options && options.view === "access" ? "access" : "orders",
      returnToCustomerAfterLogin: Boolean(options && options.returnToCustomer === "1"),
    });
  },

  /** 页面显示时恢复本机会话，并向服务端重新确认账号状态和角色。 */
  async onShow() {
    const merchantSessionToken = getApp().globalData.merchantSessionToken || "";
    const merchantAccount = getApp().globalData.merchantAccount || null;
    const expiresAt = getApp().globalData.merchantSessionExpiresAt || "";
    this.setData({ merchantSessionToken, merchantAccount, merchantSessionExpiresAt: expiresAt });
    this.refreshAdminData();
    if (!merchantSessionToken || !merchantAccount || new Date(expiresAt).getTime() <= Date.now()) {
      this.clearMerchantSession(merchantSessionToken ? "登录已过期，请重新登录" : "");
      return;
    }
    try {
      const result = await getMerchantSession(merchantSessionToken);
      this.persistMerchantSession(merchantSessionToken, result.merchant, result.expiresAt);
      if (!result.merchant.mustChangePassword && result.merchant.role === "customer") {
        wx.showToast({ title: "顾客账号已登录", icon: "success" });
        this.returnCustomer();
        return;
      }
      if (!result.merchant.mustChangePassword && this.data.returnToCustomerAfterLogin) {
        this.returnCustomer();
        return;
      }
      if (!result.merchant.mustChangePassword) await this.loadCloudData(merchantSessionToken, result.merchant);
    } catch (error) {
      this.clearMerchantSession(error.message || "登录已失效，请重新登录");
    }
  },

  /** 页面销毁时清理会话到期计时器。 */
  onUnload() {
    if (this.sessionExpiryTimer) clearTimeout(this.sessionExpiryTimer);
  },

  /** 保存未过期会话并安排固定到期清理。 */
  persistMerchantSession(merchantSessionToken, merchantAccount, expiresAt) {
    const canManageAccess = ["super_admin", "admin"].includes(merchantAccount.role);
    const isSuperAdmin = merchantAccount.role === "super_admin";
    const canOpenMerchantWorkspace = ["super_admin", "admin", "merchant"].includes(merchantAccount.role);
    const availableRoleValues = merchantAccount.role === "super_admin"
      ? ["super_admin", "admin", "merchant", "customer"]
      : ["merchant", "customer"];
    const savedSession = { merchantSessionToken, merchant: merchantAccount, expiresAt };
    wx.setStorageSync(MERCHANT_SESSION_STORAGE_KEY, savedSession);
    getApp().globalData.merchantSessionToken = merchantSessionToken;
    getApp().globalData.merchantAccount = merchantAccount;
    getApp().globalData.merchantSessionExpiresAt = expiresAt;
    this.setData({
      merchantSessionToken,
      merchantAccount,
      merchantSessionExpiresAt: expiresAt,
      merchantRoleLabel: MERCHANT_ROLE_LABELS[merchantAccount.role] || merchantAccount.role,
      canManageAccess,
      isSuperAdmin,
      canOpenMerchantWorkspace,
      availableRoleValues,
      availableRoleLabels: availableRoleValues.map((role) => MERCHANT_ROLE_LABELS[role]),
    });
    if (this.sessionExpiryTimer) clearTimeout(this.sessionExpiryTimer);
    const remaining = new Date(expiresAt).getTime() - Date.now();
    if (remaining > 0) this.sessionExpiryTimer = setTimeout(() => this.clearMerchantSession("登录已过期，请重新登录"), remaining);
  },

  /** 清除小程序本机和当前进程中的后台会话。 */
  clearMerchantSession(message = "") {
    if (this.sessionExpiryTimer) clearTimeout(this.sessionExpiryTimer);
    wx.removeStorageSync(MERCHANT_SESSION_STORAGE_KEY);
    getApp().globalData.merchantSessionToken = "";
    getApp().globalData.merchantAccount = null;
    getApp().globalData.merchantSessionExpiresAt = "";
    this.setData({
      merchantSessionToken: "",
      merchantSessionExpiresAt: "",
      merchantAccount: null,
      merchantRoleLabel: "",
      canManageAccess: false,
      isSuperAdmin: false,
      canOpenMerchantWorkspace: false,
      accessAccounts: [],
      activeView: "orders",
      paymentMessage: message,
    });
  },

  /** 统一处理后台请求错误，并在 401 时立即清除失效会话。 */
  handleAdminError(error, fallbackMessage) {
    const message = error.message || fallbackMessage;
    if (Number(error.statusCode) === 401) {
      this.clearMerchantSession(message);
      wx.showToast({ title: message, icon: "none" });
      return true;
    }
    wx.showToast({ title: message, icon: "none" });
    return false;
  },
  /** 将本地数据转换为商家端展示结构和经营汇总。 */
  refreshAdminData() {
    const orders = getOrders();
    const products = getProducts();
    const settings = getSettings();
    const paymentMethods = getPaymentMethods();
    const pendingOrders = orders.filter((order) => order.status !== "completed" && order.status !== "cancelled");
    const productionMap = {};

    // 汇总尚未完成订单中的商品数量，形成备货清单。
    pendingOrders.forEach((order) => {
      order.items.forEach((item) => {
        if (!productionMap[item.productId]) {
          productionMap[item.productId] = {
            /** 商品唯一标识。 */
            productId: item.productId,
            /** 商品名称。 */
            name: item.name,
            /** 待制作数量。 */
            quantity: 0,
            /** 商品计价单位。 */
            unit: item.unit,
          };
        }
        productionMap[item.productId].quantity += Number(item.quantity);
      });
    });

    const viewOrders = orders.map((order) => ({
      ...order,
      /** 商品金额展示文本。 */
      subtotalText: formatMoney(order.subtotal),
      /** 配送费展示文本。 */
      deliveryFeeText: formatMoney(order.deliveryFee),
      /** 订单应付金额展示文本。 */
      totalText: formatMoney(order.total),
      /** 预计取餐或送达文案。 */
      appointmentText: order.fulfillment === "delivery"
        ? "预计 " + order.pickupDay + " " + order.deliveryTime + " 送达"
        : "预计 " + order.pickupDay + " " + order.pickupTime + " 取餐",
      /** 配送地址展示文本。 */
      deliveryAddressText: order.fulfillment === "delivery" ? order.deliveryArea + " " + order.doorNumber : "",
      /** 下单时间展示文本。 */
      createdAtText: formatDateTime(order.createdAt),
      /** 当前状态选择下标。 */
      statusIndex: Math.max(STATUS_OPTIONS.indexOf(order.status), 0),
      /** 当前状态展示文本。 */
      statusText: STATUS_LABELS[Math.max(STATUS_OPTIONS.indexOf(order.status), 0)],
      /** 配送方式展示文本。 */
      fulfillmentText: order.fulfillment === "delivery" ? "配送" : "自提",
      /** 当前配送进度选择下标。 */
      deliveryStatusIndex: Math.max(DELIVERY_STATUS_OPTIONS.indexOf(order.deliveryStatus), 0),
      /** 当前配送进度展示文本。 */
      deliveryStatusText: DELIVERY_STATUS_LABELS[Math.max(DELIVERY_STATUS_OPTIONS.indexOf(order.deliveryStatus), 0)],
      /** 商品明细展示文本。 */
      itemSummary: order.items.map((item) => `${item.name} × ${item.quantity}`).join("、"),
      /** 顾客实际选择的收款方式名称。 */
      paymentMethodName: paymentMethods.find((method) => method.id === order.paymentMethodId)?.name || "",
      /** 付款核验状态展示文本。 */
      paymentStatusText: {
        pending: "待付款",
        submitted: "待核验",
        confirmed: "已确认收款",
        rejected: "核验未通过",
      }[order.paymentStatus || "pending"],
      /** 是否需要商家处理顾客付款通知。 */
      canReviewPayment: order.paymentStatus === "submitted",
    }));

    const viewProducts = products.map((product) => ({
      ...product,
      /** 商品金额展示文本。 */
      priceText: formatMoney(product.price),
      /** 默认插画对应的样式类名。 */
      toneClass: `bun-${product.tone || "wheat"}`,
    }));

    this.setData({
      orders: viewOrders,
      products: viewProducts,
      settings,
      paymentMethods,
      orderCount: orders.length,
      pendingCount: pendingOrders.length,
      revenueText: formatMoney(orders.reduce((total, order) => total + Number(order.total), 0)),
      availableCount: products.filter((product) => product.available).length,
      productionItems: Object.values(productionMap),
    });
  },

  /** 切换订单、备货、商品、收款设置或店铺装修视图。 */
  setActiveView(event) {
    this.setData({ activeView: event.currentTarget.dataset.view });
    wx.pageScrollTo({ scrollTop: 0, duration: 250 });
  },

  /** 返回顾客端继续体验。 */
  returnCustomer() {
    wx.navigateBack({
      fail() {
        wx.reLaunch({ url: "/pages/customer/customer" });
      },
    });
  },

  /** 根据商家选择更新 CloudBase 订单状态。 */
  async changeOrderStatus(event) {
    const orderId = event.currentTarget.dataset.id;
    const status = STATUS_OPTIONS[Number(event.detail.value)];
    const merchantSessionToken = this.data.merchantSessionToken.trim();
    if (!merchantSessionToken) {
      wx.showToast({ title: "请先登录云端商家端", icon: "none" });
      return;
    }
    try {
      await updateRemoteOrder(orderId, { status }, merchantSessionToken);
      const orders = getOrders().map((order) => (order.id === orderId ? { ...order, status } : order));
      saveOrders(orders);
      this.refreshAdminData();
      wx.showToast({ title: "订单状态已同步", icon: "success" });
    } catch (error) {
      this.handleAdminError(error, "订单状态更新失败");
    }
  },

  /** 根据商家选择更新 CloudBase 配送进度；送达时同步完成订单。 */
  async changeDeliveryStatus(event) {
    const orderId = event.currentTarget.dataset.id;
    const deliveryStatus = DELIVERY_STATUS_OPTIONS[Number(event.detail.value)];
    const merchantSessionToken = this.data.merchantSessionToken.trim();
    if (!merchantSessionToken) {
      wx.showToast({ title: "请先登录云端商家端", icon: "none" });
      return;
    }
    try {
      await updateRemoteOrder(orderId, { deliveryStatus }, merchantSessionToken);
      const orders = getOrders().map((order) => (
        order.id === orderId
          ? { ...order, deliveryStatus, status: deliveryStatus === "delivered" ? "completed" : order.status }
          : order
      ));
      saveOrders(orders);
      this.refreshAdminData();
      wx.showToast({ title: "配送进度已同步", icon: "success" });
    } catch (error) {
      this.handleAdminError(error, "配送进度更新失败");
    }
  },

  /** 商家确认或驳回顾客提交的付款信息。 */
  async updatePaymentStatus(event) {
    const orderId = event.currentTarget.dataset.id;
    const paymentStatus = event.currentTarget.dataset.status;
    const merchantSessionToken = this.data.merchantSessionToken.trim();
    if (!merchantSessionToken) {
      wx.showToast({ title: "请先登录云端商家端", icon: "none" });
      return;
    }
    try {
      await updateRemoteOrder(orderId, { paymentStatus }, merchantSessionToken);
      saveOrders(getOrders().map((order) => order.id === orderId ? { ...order, paymentStatus } : order));
      this.refreshAdminData();
      wx.showToast({ title: paymentStatus === "confirmed" ? "已确认收款" : "已驳回付款信息", icon: "success" });
    } catch (error) {
      this.handleAdminError(error, "付款核验失败");
    }
  },

  /** 上架或下架指定 CloudBase 商品。 */
  async toggleProductAvailability(event) {
    const productId = event.currentTarget.dataset.id;
    const available = event.detail.value;
    const merchantSessionToken = this.data.merchantSessionToken.trim();
    const product = getProducts().find((item) => item.id === productId);
    if (!merchantSessionToken || !product) {
      wx.showToast({ title: "请先登录云端商家端", icon: "none" });
      return;
    }
    try {
      const result = await saveRemoteProduct({ ...product, available, imageFileId: product.imageFileId || "" }, merchantSessionToken);
      const products = getProducts().map((item) => item.id === productId
        ? { ...result.product, imagePath: result.product.imageUrl || "" }
        : item);
      saveProducts(products);
      this.refreshAdminData();
      wx.showToast({ title: available ? "已同步上架" : "已同步下架", icon: "none" });
    } catch (error) {
      this.handleAdminError(error, "商品状态保存失败");
    }
  },

  /** 打开新增商品页面。 */
  addProduct() {
    wx.navigateTo({ url: "/pages/product-edit/product-edit" });
  },

  /** 打开指定商品的编辑页面。 */
  editProduct(event) {
    const productId = event.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/product-edit/product-edit?id=${productId}` });
  },

  /** 打开店铺装修编辑页面。 */
  editStore() {
    wx.navigateTo({ url: "/pages/store-edit/store-edit" });
  },

  /** 更新商家登录用户名。 */
  updateMerchantUsername(event) {
    this.setData({ merchantUsername: event.detail.value });
  },

  /** 更新商家登录或改密时使用的当前密码。 */
  updateMerchantPassword(event) {
    this.setData({ merchantPassword: event.detail.value });
  },

  /** 更新商家首次登录后设置的新密码。 */
  updateMerchantNewPassword(event) {
    this.setData({ merchantNewPassword: event.detail.value });
  },

  /** 使用数据库中的商家用户名和密码登录并持久化固定时长会话。 */
  async loginMerchant() {
    const merchantUsername = this.data.merchantUsername.trim().toLowerCase();
    const merchantPassword = this.data.merchantPassword;
    if (!merchantUsername || !merchantPassword) {
      wx.showToast({ title: "请输入用户名和密码", icon: "none" });
      return;
    }
    this.setData({ isSyncingPayments: true, paymentMessage: "" });
    try {
      const result = await loginMerchant(merchantUsername, merchantPassword);
      this.persistMerchantSession(result.merchantSessionToken, result.merchant, result.expiresAt);
      this.setData({ paymentMessage: result.merchant.mustChangePassword ? "请先修改初始密码" : "账号登录成功" });
      // 统一登录入口成功后先回到“我的”，经营角色再主动进入工作台。
      if (!result.merchant.mustChangePassword && (result.merchant.role === "customer" || this.data.returnToCustomerAfterLogin)) {
        this.setData({ merchantPassword: "" });
        wx.showToast({ title: "登录成功", icon: "success" });
        this.returnCustomer();
        return;
      }
      if (!result.merchant.mustChangePassword) {
        await this.loadCloudData(result.merchantSessionToken, result.merchant);
        this.setData({ merchantPassword: "" });
      }
    } catch (error) {
      this.clearMerchantSession(error.message || "账号登录失败");
    } finally {
      this.setData({ isSyncingPayments: false });
    }
  },

  /** 首次登录后修改数据库密码，并清除已撤销的旧会话。 */
  async changeMerchantPassword() {
    const merchantSessionToken = this.data.merchantSessionToken;
    const currentPassword = this.data.merchantPassword;
    const newPassword = this.data.merchantNewPassword;
    if (!merchantSessionToken || !currentPassword || newPassword.length < 6) {
      wx.showToast({ title: "新密码至少需要6位", icon: "none" });
      return;
    }
    this.setData({ isSyncingPayments: true, paymentMessage: "" });
    try {
      await changeMerchantPassword(merchantSessionToken, currentPassword, newPassword);
      this.clearMerchantSession("密码已修改，请使用新密码重新登录");
      this.setData({ merchantPassword: "", merchantNewPassword: "" });
    } catch (error) {
      if (!this.handleAdminError(error, "密码修改失败")) this.setData({ paymentMessage: error.message || "密码修改失败" });
    } finally {
      this.setData({ isSyncingPayments: false });
    }
  },

  /** 主动撤销商家会话并清空小程序进程内的登录状态。 */
  async logoutMerchant() {
    const merchantSessionToken = this.data.merchantSessionToken;
    if (merchantSessionToken) {
      try {
        await logoutMerchant(merchantSessionToken);
      } catch {
        // 退出界面不依赖网络成功；服务端会话仍会自动到期。
      }
    }
    this.clearMerchantSession("已退出商家端");
    this.setData({ merchantPassword: "", merchantNewPassword: "" });
  },

  /** 读取 CloudBase 商品、订单、店铺装修和全部收款方式。 */
  async loadCloudData(merchantSessionToken, merchantAccount = this.data.merchantAccount) {
    const [storeResult, orderResult] = await Promise.all([
      getRemoteStore(merchantSessionToken),
      getAdminOrders(merchantSessionToken),
    ]);
    const products = storeResult.products.map((product) => ({
      ...product,
      /** 小程序商品图片临时地址。 */
      imagePath: product.imageUrl || "",
    }));
    const settings = storeResult.settings ? {
      ...storeResult.settings,
      /** 小程序主视觉背景临时地址。 */
      heroBackgroundPath: storeResult.settings.heroBackgroundImage || "",
    } : getSettings();
    saveProducts(products);
    saveOrders(orderResult.orders || []);
    saveSettings(settings);
    savePaymentMethods(storeResult.paymentMethods || []);
    this.refreshAdminData();
    if (merchantAccount && ["super_admin", "admin"].includes(merchantAccount.role)) await this.loadAccessManagement(merchantSessionToken);
  },

  /** 读取并格式化管理员可见的账号和会话设置。 */
  async loadAccessManagement(merchantSessionToken) {
    const result = await getAccessManagement(merchantSessionToken);
    const actor = this.data.merchantAccount;
    const accessAccounts = (result.accounts || []).map((account) => ({
      ...account,
      /** 角色中文名称。 */
      roleLabel: MERCHANT_ROLE_LABELS[account.role] || account.role,
      /** 最近登录时间展示文本。 */
      lastLoginText: account.lastLoginAt ? formatDateTime(account.lastLoginAt) : "尚未登录",
      /** 当前管理员是否允许编辑此账号。 */
      canEdit: actor && (actor.role === "super_admin" || ["merchant", "customer"].includes(account.role)),
      /** 当前超级管理员是否允许删除此账号。 */
      canDelete: actor && actor.role === "super_admin" && actor.id !== account.id,
    }));
    this.setData({ accessAccounts, sessionDurationDraft: String(result.sessionDurationMinutes) });
  },

  /** 更新会话有效分钟数输入值。 */
  updateSessionDuration(event) {
    this.setData({ sessionDurationDraft: event.detail.value });
  },

  /** 保存新登录会话使用的固定有效时间。 */
  async saveSessionDuration() {
    const sessionDurationMinutes = Number(this.data.sessionDurationDraft);
    if (!Number.isInteger(sessionDurationMinutes) || sessionDurationMinutes < 5 || sessionDurationMinutes > 1440) {
      this.setData({ accessMessage: "登录有效期必须是 5 至 1440 分钟的整数" });
      return;
    }
    this.setData({ isSyncingPayments: true, accessMessage: "" });
    try {
      const result = await saveSessionSettings(this.data.merchantSessionToken, sessionDurationMinutes);
      this.setData({ sessionDurationDraft: String(result.sessionDurationMinutes), accessMessage: "已保存，将从下一次登录开始生效" });
    } catch (error) {
      if (!this.handleAdminError(error, "会话时长保存失败")) this.setData({ accessMessage: error.message || "会话时长保存失败" });
    } finally {
      this.setData({ isSyncingPayments: false });
    }
  },

  /** 清空账号表单以创建新账号。 */
  startNewAccount() {
    this.setData({
      accountDraft: { id: "", username: "", displayName: "", role: "merchant", enabled: true, temporaryPassword: "", mustChangePassword: false },
      accountRoleIndex: Math.max(this.data.availableRoleValues.indexOf("merchant"), 0),
      accessMessage: "",
    });
  },

  /** 将选中账号载入编辑表单。 */
  editAccount(event) {
    const account = this.data.accessAccounts.find((item) => item.id === event.currentTarget.dataset.id);
    if (!account || !account.canEdit) return;
    const roleIndex = this.data.availableRoleValues.indexOf(account.role);
    this.setData({
      accountDraft: { id: account.id, username: account.username, displayName: account.displayName, role: account.role, enabled: account.enabled, temporaryPassword: "", mustChangePassword: account.mustChangePassword === true },
      accountRoleIndex: Math.max(roleIndex, 0),
      accessMessage: "",
    });
  },

  /** 更新账号表单中的文本字段。 */
  updateAccountField(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [`accountDraft.${field}`]: event.detail.value });
  },

  /** 更新账号表单中的角色。 */
  changeAccountRole(event) {
    const accountRoleIndex = Number(event.detail.value);
    this.setData({ accountRoleIndex, "accountDraft.role": this.data.availableRoleValues[accountRoleIndex] });
  },

  /** 更新账号表单中的启用状态。 */
  toggleAccountEnabled(event) {
    this.setData({ "accountDraft.enabled": event.detail.value });
  },

  /** 更新账号首次登录必须改密的安全开关。 */
  toggleAccountMustChangePassword(event) {
    this.setData({ "accountDraft.mustChangePassword": event.detail.value });
  },

  /** 新增或保存账号，并刷新服务器返回的权限列表。 */
  async saveAccount() {
    const draft = this.data.accountDraft;
    if (!(draft.username || "").trim() || !(draft.displayName || "").trim()) {
      this.setData({ accessMessage: "请完整填写用户名和显示名称" });
      return;
    }
    if (!draft.id && (draft.temporaryPassword || "").length < 6) {
      this.setData({ accessMessage: "新账号临时密码至少需要 6 位" });
      return;
    }
    this.setData({ isSyncingPayments: true, accessMessage: "" });
    try {
      /** 发送给云函数的账号公开资料和安全选项。 */
      const accountPayload = {
        id: draft.id,
        username: draft.username,
        displayName: draft.displayName,
        role: draft.role,
        enabled: draft.enabled,
      };
      // 只有超级管理员界面会提交首次改密开关，普通管理员请求不携带该字段。
      if (this.data.isSuperAdmin) accountPayload.mustChangePassword = draft.mustChangePassword === true;
      await saveMerchantAccount(this.data.merchantSessionToken, accountPayload, draft.temporaryPassword || "");
      await this.loadAccessManagement(this.data.merchantSessionToken);
      this.startNewAccount();
      this.setData({ accessMessage: "账号设置已保存，权限变化会立即撤销旧会话" });
    } catch (error) {
      if (!this.handleAdminError(error, "账号设置保存失败")) this.setData({ accessMessage: error.message || "账号设置保存失败" });
    } finally {
      this.setData({ isSyncingPayments: false });
    }
  },

  /** 二次确认后删除指定账号，并使用服务端返回结果刷新权限列表。 */
  deleteAccount(event) {
    const account = this.data.accessAccounts.find((item) => item.id === event.currentTarget.dataset.id);
    if (!account || !account.canDelete || !this.data.isSuperAdmin) return;
    wx.showModal({
      title: "确认删除账号",
      content: `删除“${account.displayName}（${account.username}）”后，其全部登录会话会立即失效且无法恢复。`,
      confirmText: "确认删除",
      confirmColor: "#a23f35",
      success: async (result) => {
        if (!result.confirm) return;
        this.setData({ isSyncingPayments: true, accessMessage: "" });
        try {
          await deleteMerchantAccount(this.data.merchantSessionToken, account.id);
          await this.loadAccessManagement(this.data.merchantSessionToken);
          if (this.data.accountDraft.id === account.id) this.startNewAccount();
          this.setData({ accessMessage: "账号已删除，其全部旧会话已撤销" });
        } catch (error) {
          if (!this.handleAdminError(error, "账号删除失败")) this.setData({ accessMessage: error.message || "账号删除失败" });
        } finally {
          this.setData({ isSyncingPayments: false });
        }
      },
    });
  },

  /** 打开新增收款方式表单。 */
  addPaymentMethod() {
    if (getPaymentMethods().length >= 12) {
      wx.showToast({ title: "最多配置 12 个收款码", icon: "none" });
      return;
    }
    this.setData({
      editingPaymentMethodId: "",
      isPaymentEditorOpen: true,
      paymentDraft: {
        /** 新收款方式唯一标识。 */
        id: `payment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        /** 收款方式名称。 */
        name: "",
        /** 收款人展示名称。 */
        payeeName: "",
        /** 收款二维码图片地址。 */
        qrCodeUrl: "",
        /** 付款说明或备注。 */
        note: "",
        /** 是否向顾客展示。 */
        enabled: true,
      },
    });
  },

  /** 打开指定收款方式的编辑表单。 */
  editPaymentMethod(event) {
    const paymentMethodId = event.currentTarget.dataset.id;
    const paymentMethod = getPaymentMethods().find((method) => method.id === paymentMethodId);
    if (!paymentMethod) return;
    this.setData({
      editingPaymentMethodId: paymentMethodId,
      isPaymentEditorOpen: true,
      paymentDraft: { ...paymentMethod },
    });
  },

  /** 更新收款方式草稿中的普通文本字段。 */
  updatePaymentDraftField(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [`paymentDraft.${field}`]: event.detail.value });
  },

  /** 更新收款方式草稿的启用状态。 */
  togglePaymentDraftEnabled(event) {
    this.setData({ "paymentDraft.enabled": event.detail.value });
  },

  /** 校验并保存新增或编辑的收款方式到本机。 */
  savePaymentDraft() {
    const draft = this.data.paymentDraft;
    const paymentMethod = {
      /** 收款方式唯一标识。 */
      id: draft.id,
      /** 收款方式名称。 */
      name: (draft.name || "").trim(),
      /** 收款人展示名称。 */
      payeeName: (draft.payeeName || "").trim(),
      /** 收款二维码图片地址。 */
      qrCodeUrl: (draft.qrCodeUrl || "").trim(),
      /** 付款说明或备注。 */
      note: (draft.note || "").trim(),
      /** 是否向顾客展示。 */
      enabled: draft.enabled !== false,
    };
    if (!paymentMethod.name || !paymentMethod.payeeName || !/^https:\/\//.test(paymentMethod.qrCodeUrl)) {
      wx.showToast({ title: "请填写名称、收款人和 HTTPS 图片地址", icon: "none" });
      return;
    }
    const paymentMethods = getPaymentMethods();
    const index = paymentMethods.findIndex((method) => method.id === paymentMethod.id);
    if (index >= 0) paymentMethods[index] = paymentMethod;
    else paymentMethods.push(paymentMethod);
    savePaymentMethods(paymentMethods);
    this.setData({ isPaymentEditorOpen: false, editingPaymentMethodId: "", paymentMessage: "已保存到本机，点击同步后两端生效" });
    this.refreshAdminData();
  },

  /** 经确认后删除一个本机收款方式。 */
  removePaymentMethod(event) {
    const paymentMethodId = event.currentTarget.dataset.id;
    wx.showModal({
      title: "删除收款码",
      content: "同步云端后，顾客将不能再选择这个收款码。",
      confirmColor: "#8c4f3d",
      success: (result) => {
        if (!result.confirm) return;
        savePaymentMethods(getPaymentMethods().filter((method) => method.id !== paymentMethodId));
        this.refreshAdminData();
        this.setData({ paymentMessage: "已从本机列表删除，点击同步后两端生效" });
      },
    });
  },

  /** 用商家会话将本机完整收款方式列表覆盖同步到云端。 */
  async syncPaymentMethods() {
    const merchantSessionToken = this.data.merchantSessionToken.trim();
    if (!merchantSessionToken) {
      wx.showToast({ title: "请先登录商家账号", icon: "none" });
      return;
    }
    this.setData({ isSyncingPayments: true, paymentMessage: "" });
    try {
      const result = await saveRemotePaymentMethods(getPaymentMethods(), merchantSessionToken);
      savePaymentMethods(result.paymentMethods || []);
      this.refreshAdminData();
      this.setData({ paymentMessage: "已同步到网页版和小程序顾客端" });
    } catch (error) {
      if (!this.handleAdminError(error, "收款设置同步失败")) this.setData({ paymentMessage: error.message || "收款设置同步失败" });
    } finally {
      this.setData({ isSyncingPayments: false });
    }
  },
  /** 清理只读缓存后重新拉取 CloudBase 数据。 */
  resetDemo() {
    wx.showModal({
      title: "恢复演示数据",
      content: "将清理当前缓存并重新读取 CloudBase 云端数据。",
      confirmText: "确认恢复",
      confirmColor: "#8c4f3d",
      success: (result) => {
        if (!result.confirm) return;
        resetDemoData();
        const merchantSessionToken = this.data.merchantSessionToken.trim();
        if (merchantSessionToken) void this.loadCloudData(merchantSessionToken);
        else this.refreshAdminData();
        wx.showToast({ title: "已刷新缓存", icon: "success" });
      },
    });
  },
});
