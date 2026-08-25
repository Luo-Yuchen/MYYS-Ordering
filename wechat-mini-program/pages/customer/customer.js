const {
  formatDateTime,
  formatMoney,
  getCart,
  getOrders,
  getPaymentMethods,
  getProducts,
  getSettings,
  saveCart,
  saveOrders,
  savePaymentMethods,
  saveProducts,
  saveSettings,
} = require("../../utils/store");
const {
  createRemoteOrder,
  getRemoteOrders,
  getRemoteStore,
  submitRemotePayment,
} = require("../../utils/api");

/** 订单制作状态对应的顾客端文案。 */
const STATUS_LABELS = {
  /** 待接单状态文案。 */
  pending: "待接单",
  /** 制作中状态文案。 */
  preparing: "制作中",
  /** 待取货或待配送状态文案。 */
  ready: "待取货/待配送",
  /** 已完成状态文案。 */
  completed: "已完成",
  /** 已取消状态文案。 */
  cancelled: "已取消",
};

/** 配送进度对应的顾客端文案。 */
const DELIVERY_STATUS_LABELS = {
  /** 等待配送。 */
  waiting: "待配送",
  /** 正在配送。 */
  delivering: "配送中",
  /** 已经送达。 */
  delivered: "已送达",
};

/** 第一版固定的 3km 内配送区域。 */
const DELIVERY_AREAS = ["幸福小区", "阳光花园", "麦香公寓", "邻里写字楼"];

/** 固定配送费。 */
const DELIVERY_FEE = 3;

/** 配送订单最低商品金额。 */
const DELIVERY_MINIMUM = 15;

/** 免配送费商品金额门槛。 */
const FREE_DELIVERY_THRESHOLD = 30;

Page({
  data: {
    /** 当前顾客端视图。 */
    activeView: "home",
    /** 当前商品分类。 */
    activeCategory: "全部",
    /** 顾客端分类列表。 */
    categories: ["全部", "经典", "粗粮", "甜味"],
    /** 当前店铺装修设置。 */
    settings: {},
    /** 顾客端可见商品。 */
    visibleProducts: [],
    /** 当前打开详情的商品；为空时隐藏详情弹层。 */
    selectedProduct: null,
    /** 购物车商品明细。 */
    cartItems: [],
    /** 购物车商品总数。 */
    cartCount: 0,
    /** 购物车商品金额文本。 */
    cartTotalText: "¥0",
    /** 当前配送费文本。 */
    deliveryFeeText: "¥0",
    /** 当前应付金额文本。 */
    payableTotalText: "¥0",
    /** 顾客订单列表。 */
    orders: [],
    /** 顾客订单总数。 */
    orderCount: 0,
    /** 尚未完成的订单数量。 */
    activeOrderCount: 0,
    /** 最近一笔订单状态文案。 */
    latestOrderStatusText: "暂无订单",
    /** 商家当前启用的多收款方式列表。 */
    paymentMethods: [],
    /** 顾客当前选择的收款方式编号。 */
    selectedPaymentMethodId: "",
    /** 收款方式选择器显示文案。 */
    paymentMethodLabels: [],
    /** 是否正在向共享服务提交订单。 */
    isSubmittingOrder: false,
    /** 共享服务不可用时的提示。 */
    serviceMessage: "",
    /** 配送方式。 */
    fulfillment: "pickup",
    /** 顾客姓名。 */
    customerName: "",
    /** 联系电话。 */
    phone: "",
    /** 配送地址，保留给个人资料默认值。 */
    address: "",
    /** 可配送区域选项。 */
    deliveryAreas: ["请选择 3km 内区域", ...DELIVERY_AREAS],
    /** 当前配送区域下标，零表示尚未选择。 */
    deliveryAreaIndex: 0,
    /** 配送订单楼栋和门牌号。 */
    doorNumber: "",
    /** 预约日期选项。 */
    pickupDays: ["今天", "明天", "后天"],
    /** 当前预约日期下标。 */
    pickupDayIndex: 1,
    /** 预计取餐时段选项。 */
    pickupTimes: ["07:00–08:00", "08:00–09:00", "17:00–18:00", "18:00–19:00"],
    /** 当前预计取餐时段下标。 */
    pickupTimeIndex: 0,
    /** 预计送达时段选项。 */
    deliveryTimes: ["08:00–09:00", "09:00–10:00", "11:30–12:30", "17:30–18:30"],
    /** 当前预计送达时段下标。 */
    deliveryTimeIndex: 0,
    /** 顾客备注。 */
    note: "",
    profileName: "",
    profilePhone: "",
    profileAddress: "",
    profileNote: "",
    profileSaved: false,
    navLabels: {
      home: "\u9996\u9875",
      homeIcon: "\u9996",
      cart: "\u8d2d\u7269\u8f66",
      profile: "\u6211\u7684",
      profileIcon: "\u6211",
    },
    profileLabels: {
      avatar: "\u6211",
      guest: "\u672a\u8bbe\u7f6e\u59d3\u540d",
      saved: "\u8d44\u6599\u5df2\u4fdd\u5b58",
      unsaved: "\u5b8c\u5584\u8d44\u6599\uff0c\u4e0b\u5355\u65f6\u81ea\u52a8\u586b\u5165",
      title: "\u4e2a\u4eba\u4fe1\u606f",
      description: "\u7528\u4e8e\u9884\u7ea6\u4e0e\u914d\u9001\uff0c\u4ec5\u4fdd\u5b58\u5728\u5f53\u524d\u8bbe\u5907\u3002",
      name: "\u59d3\u540d\u6216\u6635\u79f0",
      namePlaceholder: "\u4f8b\u5982\uff1a\u738b\u5973\u58eb",
      phone: "\u8054\u7cfb\u7535\u8bdd",
      phonePlaceholder: "\u8bf7\u8f93\u516511\u4f4d\u624b\u673a\u53f7",
      address: "\u9ed8\u8ba4\u5730\u5740",
      addressPlaceholder: "\u5c0f\u533a\u3001\u697c\u680b\u548c\u95e8\u724c\u53f7",
      note: "\u5e38\u7528\u5907\u6ce8",
      notePlaceholder: "\u4f8b\u5982\uff1a\u5c11\u88c5\u5851\u6599\u888b",
      save: "\u4fdd\u5b58\u4e2a\u4eba\u8d44\u6599",
      localTip: "\u4e2a\u4eba\u8d44\u6599\u4ec5\u4fdd\u5b58\u5728\u5f53\u524d\u8bbe\u5907\u3002",
    },
  },

  /** 页面显示时同步商品、购物车、订单和店铺设置。 */
  async onShow() {
    const profile = wx.getStorageSync("manyouyisi-mini-profile-v1") || {};
    this.setData({
      profileName: profile.name || "",
      profilePhone: profile.phone || "",
      profileAddress: profile.address || "",
      profileNote: profile.note || "",
      profileSaved: Boolean(profile.name || profile.phone || profile.address || profile.note),
      customerName: this.data.customerName || profile.name || "",
      phone: this.data.phone || profile.phone || "",
      address: this.data.address || profile.address || "",
      doorNumber: this.data.doorNumber || profile.address || "",
      note: this.data.note || profile.note || "",
    });
    this.refreshPageData();
    await this.syncRemoteData();
  },

  /** 从共享服务同步商品、店铺设置、收款码和当前设备订单。 */
  async syncRemoteData() {
    try {
      const localOrders = getOrders();
      const tokens = localOrders.map((order) => order.accessToken).filter(Boolean);
      const [storeResult, orderResult] = await Promise.all([
        getRemoteStore(),
        getRemoteOrders(tokens),
      ]);
      const products = storeResult.products.map((product) => ({
        ...product,
        /** 小程序商品图片字段。 */
        imagePath: product.imageUrl || "",
        /** 共享服务只返回在售商品。 */
        available: true,
      }));
      const settings = storeResult.settings ? {
        ...storeResult.settings,
        /** 小程序主视觉背景字段。 */
        heroBackgroundPath: storeResult.settings.heroBackgroundImage || "",
      } : getSettings();

      const paymentMethods = Array.isArray(storeResult.paymentMethods)
        ? storeResult.paymentMethods
        : (storeResult.payment && storeResult.payment.qrCodeUrl ? [{
          /** 兼容旧版接口生成的收款方式编号。 */
          id: "legacy-default",
          /** 兼容旧版接口生成的收款方式名称。 */
          name: storeResult.payment.payeeName || "默认收款码",
          /** 收款人展示名称。 */
          payeeName: storeResult.payment.payeeName || "商家",
          /** 收款二维码图片地址。 */
          qrCodeUrl: storeResult.payment.qrCodeUrl,
          /** 付款说明。 */
          note: storeResult.payment.instructions || "",
          /** 是否向顾客展示。 */
          enabled: true,
        }] : []);
      saveProducts(products);
      saveSettings(settings);
      savePaymentMethods(paymentMethods);
      if (orderResult.orders.length > 0) saveOrders(orderResult.orders);
      this.setData({
        paymentMethods,
        selectedPaymentMethodId: paymentMethods.find((method) => method.enabled)?.id || "",
        serviceMessage: "",
      });
      this.refreshPageData();
    } catch (error) {
      this.setData({ serviceMessage: error.message || "共享服务暂时不可用，当前显示本机缓存" });
    }
  },

  /** 从本地存储读取数据并生成页面需要的展示结构。 */
  refreshPageData() {
    const products = getProducts();
    const cart = getCart();
    const orders = getOrders();
    const settings = getSettings();
    const paymentMethods = getPaymentMethods().filter((method) => method.enabled && method.qrCodeUrl);
    const selectedPaymentMethod = paymentMethods.find((method) => method.id === this.data.selectedPaymentMethodId) || paymentMethods[0] || null;
    const activeCategory = this.data.activeCategory;

    // 顾客端仅展示已经上架的商品，并附加购物车数量和金额文本。
    const availableProducts = products.filter((product) => product.available);
    const displayProducts = availableProducts.map((product) => ({
        ...product,
        /** 商品金额展示文本。 */
        priceText: formatMoney(product.price),
        /** 当前购物车数量。 */
        quantity: Number(cart[product.id]) || 0,
        /** 默认插画对应的样式类名。 */
        toneClass: `bun-${product.tone || "wheat"}`,
      }));
    const visibleProducts = displayProducts.filter(
      (product) => activeCategory === "全部" || product.category === activeCategory,
    );
    const selectedProduct = this.data.selectedProduct
      ? displayProducts.find((product) => product.id === this.data.selectedProduct.id) || null
      : null;

    const cartItems = availableProducts
      .filter((product) => Number(cart[product.id]) > 0)
      .map((product) => ({
        ...product,
        /** 当前购物车数量。 */
        quantity: Number(cart[product.id]),
        /** 单项小计展示文本。 */
        subtotalText: formatMoney(product.price * Number(cart[product.id])),
        /** 默认插画对应的样式类名。 */
        toneClass: `bun-${product.tone || "wheat"}`,
      }));

    const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0);
    const cartTotal = cartItems.reduce((total, item) => total + item.price * item.quantity, 0);
    // 配送费跟随取餐方式和满额门槛即时变化。
    const deliveryFee = this.data.fulfillment === "delivery" && cartTotal < FREE_DELIVERY_THRESHOLD ? DELIVERY_FEE : 0;
    const payableTotal = cartTotal + deliveryFee;
    const viewOrders = orders.map((order) => ({
      ...order,
      /** 商品金额展示文本。 */
      subtotalText: formatMoney(order.subtotal),
      /** 配送费展示文本。 */
      deliveryFeeText: formatMoney(order.deliveryFee),
      /** 订单应付金额展示文本。 */
      totalText: formatMoney(order.total),
      /** A/D 短订单号。 */
      shortCode: order.shortCode,
      /** 预计取餐或送达文案。 */
      appointmentText: order.fulfillment === "delivery"
        ? "预计 " + order.pickupDay + " " + order.deliveryTime + " 送达"
        : "预计 " + order.pickupDay + " " + order.pickupTime + " 取餐",
      /** 配送地址展示文本。 */
      deliveryAddressText: order.fulfillment === "delivery" ? order.deliveryArea + " " + order.doorNumber : "",
      /** 配送进度展示文本。 */
      deliveryStatusText: DELIVERY_STATUS_LABELS[order.deliveryStatus] || "待配送",
      /** 下单时间展示文本。 */
      createdAtText: formatDateTime(order.createdAt),
      /** 订单状态展示文本。 */
      statusText: STATUS_LABELS[order.status] || "待处理",
      /** 付款核验状态展示文本。 */
      paymentStatusText: {
        pending: "待付款",
        submitted: "已付款，待商家核验",
        confirmed: "商家已确认收款",
        rejected: "付款信息未通过",
      }[order.paymentStatus || "pending"],
      /** 是否允许再次提交付款待核验状态。 */
      canSubmitPayment: !order.paymentStatus || order.paymentStatus === "pending" || order.paymentStatus === "rejected",
      /** 是否存在可展示的收款码。 */
      canShowPaymentCode: paymentMethods.length > 0,
      /** 顾客实际选择的收款方式名称。 */
      paymentMethodName: paymentMethods.find((method) => method.id === order.paymentMethodId)?.name || "",
      /** 配送方式展示文本。 */
      fulfillmentText: order.fulfillment === "delivery" ? "配送到家" : "到店自提",
      /** 订单商品摘要。 */
      itemSummary: order.items.map((item) => `${item.name} × ${item.quantity}`).join("、"),
    }));

    this.setData({
      settings,
      paymentMethods,
      selectedPaymentMethodId: selectedPaymentMethod ? selectedPaymentMethod.id : "",
      paymentMethodLabels: paymentMethods.map((method) => `${method.name} · ${method.payeeName}`),
      visibleProducts,
      selectedProduct,
      cartItems,
      cartCount,
      cartTotalText: formatMoney(cartTotal),
      deliveryFeeText: formatMoney(deliveryFee),
      payableTotalText: formatMoney(payableTotal),
      orders: viewOrders,
      orderCount: viewOrders.length,
      activeOrderCount: viewOrders.filter((order) => order.status !== "completed" && order.status !== "cancelled").length,
      latestOrderStatusText: viewOrders.length > 0 ? "最近订单 " + viewOrders[0].shortCode + " · " + viewOrders[0].statusText : "还没有订单，去挑一笼喜欢的馒头吧",
    });
  },

  /** 切换首页、点单、购物车、个人中心或订单二级视图。 */
  setActiveView(event) {
    const activeView = event.currentTarget.dataset.view;
    this.setData({ activeView });
    wx.pageScrollTo({ scrollTop: 0, duration: 250 });
  },

  /** 切换商品分类。 */
  selectCategory(event) {
    const activeCategory = event.currentTarget.dataset.category;
    this.setData({ activeCategory }, () => this.refreshPageData());
  },

  /** 打开商品详情弹层。 */
  openProductDetail(event) {
    const productId = event.currentTarget.dataset.id;
    const selectedProduct = this.data.visibleProducts.find((item) => item.id === productId) || null;
    this.setData({ selectedProduct });
  },

  /** 关闭商品详情弹层。 */
  closeProductDetail() {
    this.setData({ selectedProduct: null });
  },

  /** 阻止详情面板点击事件冒泡至遮罩。 */
  stopPropagation() {},

  /** 将指定商品增加一份并保存本地购物车。 */
  addToCart(event) {
    const productId = event.currentTarget.dataset.id;
    const product = getProducts().find((item) => item.id === productId);
    const cart = getCart();
    if (!product || !product.available) return;
    const nextQuantity = Math.min((Number(cart[productId]) || 0) + 1, Number(product.stock) || 0);
    cart[productId] = nextQuantity;
    saveCart(cart);
    this.refreshPageData();
  },

  /** 将指定商品减少一份并保存本地购物车。 */
  removeFromCart(event) {
    const productId = event.currentTarget.dataset.id;
    const cart = getCart();
    const nextQuantity = Math.max((Number(cart[productId]) || 0) - 1, 0);
    if (nextQuantity === 0) {
      delete cart[productId];
    } else {
      cart[productId] = nextQuantity;
    }
    saveCart(cart);
    this.refreshPageData();
  },

  /** 从首页主按钮进入商品列表位置。 */
  scrollToMenu() {
    wx.pageScrollTo({ selector: "#menu", duration: 300 });
  },

  /** 打开商家端预览页面。 */
  openAdmin() {
    wx.navigateTo({ url: "/pages/admin/admin" });
  },

  /** 切换到店自提或配送到家，并重新计算应付金额。 */
  selectFulfillment(event) {
    this.setData({ fulfillment: event.currentTarget.dataset.value }, () => this.refreshPageData());
  },

  /** 更新顾客填写的普通文本字段。 */
  updateField(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [field]: event.detail.value });
  },

  /** 更新预约日期。 */
  updateProfileField(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [field]: event.detail.value });
  },

  saveCustomerProfile() {
    const name = this.data.profileName.trim();
    const phone = this.data.profilePhone.trim();
    const address = this.data.profileAddress.trim();
    const note = this.data.profileNote.trim();
    if (!name) {
      wx.showToast({ title: "\u8bf7\u586b\u5199\u59d3\u540d\u6216\u6635\u79f0", icon: "none" });
      return;
    }
    if (phone && !/^1\d{10}$/.test(phone)) {
      wx.showToast({ title: "\u8bf7\u586b\u5199\u6b63\u786e\u624b\u673a\u53f7", icon: "none" });
      return;
    }
    wx.setStorageSync("manyouyisi-mini-profile-v1", { name, phone, address, note });
    this.setData({
      profileName: name,
      profilePhone: phone,
      profileAddress: address,
      profileNote: note,
      profileSaved: true,
      customerName: name,
      phone,
      address,
      doorNumber: address,
      note,
    });
    wx.showToast({ title: "\u8d44\u6599\u5df2\u4fdd\u5b58", icon: "success" });
  },

  changePickupDay(event) {
    this.setData({ pickupDayIndex: Number(event.detail.value) });
  },

  /** 更新预计取餐时段。 */
  changePickupTime(event) {
    this.setData({ pickupTimeIndex: Number(event.detail.value) });
  },

  /** 更新可配送区域。 */
  changeDeliveryArea(event) {
    this.setData({ deliveryAreaIndex: Number(event.detail.value) });
  },

  /** 更新预计送达时段。 */
  changeDeliveryTime(event) {
    this.setData({ deliveryTimeIndex: Number(event.detail.value) });
  },

  /** 校验表单并通过 H5 共用服务创建待付款订单。 */
  async submitOrder() {
    if (this.data.isSubmittingOrder) return;
    const cart = getCart();
    const products = getProducts();
    const items = products
      .filter((product) => product.available && Number(cart[product.id]) > 0)
      .map((product) => ({
        /** 商品唯一标识。 */
        productId: product.id,
        /** 下单数量。 */
        quantity: Number(cart[product.id]),
      }));

    if (items.length === 0) {
      wx.showToast({ title: "请先选择馒头", icon: "none" });
      return;
    }
    if (!this.data.customerName.trim() || !/^1\d{10}$/.test(this.data.phone.trim())) {
      wx.showToast({ title: "请填写姓名和正确手机号", icon: "none" });
      return;
    }
    const cartSubtotal = products.reduce((total, product) => total + Number(product.price) * Number(cart[product.id] || 0), 0);
    if (this.data.fulfillment === "delivery" && cartSubtotal < DELIVERY_MINIMUM) {
      wx.showToast({ title: "配送订单满15元起送", icon: "none" });
      return;
    }
    if (this.data.fulfillment === "delivery" && (this.data.deliveryAreaIndex <= 0 || !this.data.doorNumber.trim())) {
      wx.showToast({ title: "请选择配送区域并填写门牌号", icon: "none" });
      return;
    }

    this.setData({ isSubmittingOrder: true });
    try {
      const result = await createRemoteOrder({
        items,
        orderType: this.data.fulfillment,
        customerName: this.data.customerName.trim(),
        phone: this.data.phone.trim(),
        deliveryArea: this.data.fulfillment === "delivery" ? this.data.deliveryAreas[this.data.deliveryAreaIndex] : "",
        doorNumber: this.data.fulfillment === "delivery" ? this.data.doorNumber.trim() : "",
        pickupDay: this.data.pickupDays[this.data.pickupDayIndex],
        pickupTime: this.data.fulfillment === "pickup" ? this.data.pickupTimes[this.data.pickupTimeIndex] : "",
        deliveryTime: this.data.fulfillment === "delivery" ? this.data.deliveryTimes[this.data.deliveryTimeIndex] : "",
        remark: this.data.note.trim(),
      });
      const order = {
        ...result,
        /** 下单商品明细。 */
        items: products.filter((product) => Number(cart[product.id]) > 0).map((product) => ({
          productId: product.id,
          name: product.name,
          quantity: Number(cart[product.id]),
          unit: product.unit,
          price: Number(product.price),
        })),
        /** 配送方式。 */
        fulfillment: this.data.fulfillment,
        /** 顾客姓名。 */
        customerName: this.data.customerName.trim(),
        /** 联系电话。 */
        phone: this.data.phone.trim(),
        /** 完整配送地址。 */
        address: this.data.fulfillment === "delivery"
          ? this.data.deliveryAreas[this.data.deliveryAreaIndex] + " " + this.data.doorNumber.trim()
          : "",
        /** 可配送区域。 */
        deliveryArea: this.data.fulfillment === "delivery" ? this.data.deliveryAreas[this.data.deliveryAreaIndex] : "",
        /** 楼栋和门牌号。 */
        doorNumber: this.data.fulfillment === "delivery" ? this.data.doorNumber.trim() : "",
        /** 预约日期。 */
        pickupDay: this.data.pickupDays[this.data.pickupDayIndex],
        /** 预计取餐时间。 */
        pickupTime: this.data.fulfillment === "pickup" ? this.data.pickupTimes[this.data.pickupTimeIndex] : "",
        /** 预计送达时间。 */
        deliveryTime: this.data.fulfillment === "delivery" ? this.data.deliveryTimes[this.data.deliveryTimeIndex] : "",
        /** 顾客备注。 */
        note: this.data.note.trim(),
      };
      const orders = getOrders();
      orders.unshift(order);
      saveOrders(orders);
      saveCart({});
      this.setData({
        activeView: "profile",
        customerName: "",
        phone: "",
        address: "",
        deliveryAreaIndex: 0,
        doorNumber: "",
        note: "",
      });
      this.refreshPageData();
      wx.showModal({
        title: "订单已创建",
        content: "订单 " + order.shortCode + " 应付 " + formatMoney(order.total) + "。请在“我的订单”中查看收款码，付款后通知商家核验。",
        showCancel: false,
      });
    } catch (error) {
      wx.showToast({ title: error.message || "下单失败", icon: "none" });
    } finally {
      this.setData({ isSubmittingOrder: false });
    }
  },

  /** 从选择器更新顾客当前使用的收款方式。 */
  selectPaymentMethod(event) {
    const paymentMethod = (this.data.paymentMethods || [])[Number(event.detail.value)];
    if (!paymentMethod) return;
    this.setData({ selectedPaymentMethodId: paymentMethod.id });
    wx.showToast({ title: `已选择${paymentMethod.name}`, icon: "none" });
  },

  /** 预览顾客当前选择的收款码。 */
  showPaymentCode() {
    const paymentMethod = (this.data.paymentMethods || []).find((method) => method.id === this.data.selectedPaymentMethodId)
      || (this.data.paymentMethods || [])[0];
    if (!paymentMethod) {
      wx.showToast({ title: "商家尚未配置收款码", icon: "none" });
      return;
    }
    wx.previewImage({ current: paymentMethod.qrCodeUrl, urls: [paymentMethod.qrCodeUrl] });
  },

  /** 顾客付款后提交待核验状态，实际到账仍由商家人工确认。 */
  markOrderPaid(event) {
    const orderId = event.currentTarget.dataset.id;
    const order = getOrders().find((item) => item.id === orderId);
    if (!order || !order.accessToken) return;
    const paymentMethod = (this.data.paymentMethods || []).find((method) => method.id === this.data.selectedPaymentMethodId)
      || (this.data.paymentMethods || [])[0];
    if (!paymentMethod) {
      wx.showToast({ title: "请先选择收款码", icon: "none" });
      return;
    }
    wx.showModal({
      title: "通知商家核验",
      content: "可填写付款备注或流水号后四位",
      editable: true,
      placeholderText: "选填",
      success: async (result) => {
        if (!result.confirm) return;
        try {
          await submitRemotePayment(order.id, order.accessToken, result.content || "", paymentMethod.id);
          const orders = getOrders().map((item) => (
            item.id === order.id ? { ...item, paymentStatus: "submitted", paymentReference: result.content || "", paymentMethodId: paymentMethod.id } : item
          ));
          saveOrders(orders);
          this.refreshPageData();
          wx.showToast({ title: "已通知商家核验", icon: "success" });
        } catch (error) {
          wx.showToast({ title: error.message || "提交失败", icon: "none" });
        }
      },
    });
  },
});
