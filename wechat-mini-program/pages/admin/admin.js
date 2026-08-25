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
  getAdminOrders,
  getRemoteStore,
  saveRemotePaymentMethods,
  saveRemoteProduct,
  updateRemoteOrder,
} = require("../../utils/api");

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
    /** 云端收款设置使用的管理口令。 */
    adminKey: "",
    /** 收款设置同步或保存提示。 */
    paymentMessage: "",
    /** 是否正在读取或同步云端收款设置。 */
    isSyncingPayments: false,
  },

  /** 页面显示时先读取缓存；已有管理口令时立即刷新 CloudBase 云端数据。 */
  onShow() {
    const adminKey = getApp().globalData.adminKey || "";
    this.setData({ adminKey });
    this.refreshAdminData();
    if (adminKey) void this.loadCloudData(adminKey);
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
    const adminKey = this.data.adminKey.trim();
    if (!adminKey) {
      wx.showToast({ title: "请先登录云端商家端", icon: "none" });
      return;
    }
    try {
      await updateRemoteOrder(orderId, { status }, adminKey);
      const orders = getOrders().map((order) => (order.id === orderId ? { ...order, status } : order));
      saveOrders(orders);
      this.refreshAdminData();
      wx.showToast({ title: "订单状态已同步", icon: "success" });
    } catch (error) {
      wx.showToast({ title: error.message || "订单状态更新失败", icon: "none" });
    }
  },

  /** 根据商家选择更新 CloudBase 配送进度；送达时同步完成订单。 */
  async changeDeliveryStatus(event) {
    const orderId = event.currentTarget.dataset.id;
    const deliveryStatus = DELIVERY_STATUS_OPTIONS[Number(event.detail.value)];
    const adminKey = this.data.adminKey.trim();
    if (!adminKey) {
      wx.showToast({ title: "请先登录云端商家端", icon: "none" });
      return;
    }
    try {
      await updateRemoteOrder(orderId, { deliveryStatus }, adminKey);
      const orders = getOrders().map((order) => (
        order.id === orderId
          ? { ...order, deliveryStatus, status: deliveryStatus === "delivered" ? "completed" : order.status }
          : order
      ));
      saveOrders(orders);
      this.refreshAdminData();
      wx.showToast({ title: "配送进度已同步", icon: "success" });
    } catch (error) {
      wx.showToast({ title: error.message || "配送进度更新失败", icon: "none" });
    }
  },

  /** 商家确认或驳回顾客提交的付款信息。 */
  async updatePaymentStatus(event) {
    const orderId = event.currentTarget.dataset.id;
    const paymentStatus = event.currentTarget.dataset.status;
    const adminKey = this.data.adminKey.trim();
    if (!adminKey) {
      wx.showToast({ title: "请先登录云端商家端", icon: "none" });
      return;
    }
    try {
      await updateRemoteOrder(orderId, { paymentStatus }, adminKey);
      saveOrders(getOrders().map((order) => order.id === orderId ? { ...order, paymentStatus } : order));
      this.refreshAdminData();
      wx.showToast({ title: paymentStatus === "confirmed" ? "已确认收款" : "已驳回付款信息", icon: "success" });
    } catch (error) {
      wx.showToast({ title: error.message || "付款核验失败", icon: "none" });
    }
  },

  /** 上架或下架指定 CloudBase 商品。 */
  async toggleProductAvailability(event) {
    const productId = event.currentTarget.dataset.id;
    const available = event.detail.value;
    const adminKey = this.data.adminKey.trim();
    const product = getProducts().find((item) => item.id === productId);
    if (!adminKey || !product) {
      wx.showToast({ title: "请先登录云端商家端", icon: "none" });
      return;
    }
    try {
      const result = await saveRemoteProduct({ ...product, available, imageFileId: product.imageFileId || "" }, adminKey);
      const products = getProducts().map((item) => item.id === productId
        ? { ...result.product, imagePath: result.product.imageUrl || "" }
        : item);
      saveProducts(products);
      this.refreshAdminData();
      wx.showToast({ title: available ? "已同步上架" : "已同步下架", icon: "none" });
    } catch (error) {
      wx.showToast({ title: error.message || "商品状态保存失败", icon: "none" });
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

  /** 更新收款设置使用的管理口令。 */
  updateAdminKey(event) {
    this.setData({ adminKey: event.detail.value });
  },

  /** 使用管理口令登录并读取 CloudBase 全部经营数据。 */
  async loadCloudPaymentMethods() {
    const adminKey = this.data.adminKey.trim();
    if (!adminKey) {
      wx.showToast({ title: "请先输入管理口令", icon: "none" });
      return;
    }
    this.setData({ isSyncingPayments: true, paymentMessage: "" });
    try {
      getApp().globalData.adminKey = adminKey;
      await this.loadCloudData(adminKey);
      this.setData({ paymentMessage: "已登录 CloudBase 云端商家端" });
    } catch (error) {
      this.setData({ paymentMessage: error.message || "云端收款设置读取失败" });
    } finally {
      this.setData({ isSyncingPayments: false });
    }
  },

  /** 读取 CloudBase 商品、订单、店铺装修和全部收款方式。 */
  async loadCloudData(adminKey) {
    const [storeResult, orderResult] = await Promise.all([
      getRemoteStore(adminKey),
      getAdminOrders(adminKey),
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

  /** 用管理口令将本机完整收款方式列表覆盖同步到云端。 */
  async syncPaymentMethods() {
    const adminKey = this.data.adminKey.trim();
    if (!adminKey) {
      wx.showToast({ title: "请先输入管理口令", icon: "none" });
      return;
    }
    this.setData({ isSyncingPayments: true, paymentMessage: "" });
    try {
      const result = await saveRemotePaymentMethods(getPaymentMethods(), adminKey);
      savePaymentMethods(result.paymentMethods || []);
      this.refreshAdminData();
      this.setData({ paymentMessage: "已同步到网页版和小程序顾客端" });
    } catch (error) {
      this.setData({ paymentMessage: error.message || "收款设置同步失败" });
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
        const adminKey = this.data.adminKey.trim();
        if (adminKey) void this.loadCloudData(adminKey);
        else this.refreshAdminData();
        wx.showToast({ title: "已刷新缓存", icon: "success" });
      },
    });
  },
});
