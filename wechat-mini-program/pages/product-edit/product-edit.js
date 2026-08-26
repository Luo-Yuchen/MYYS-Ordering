const {
  getProductById,
  getToneForCategory,
  upsertProduct,
} = require("../../utils/store");
const { chooseAndSaveImage } = require("../../utils/image");
const { saveRemoteProduct, uploadRemoteImage } = require("../../utils/api");

Page({
  data: {
    /** 正在编辑的商品标识，空值表示新增。 */
    productId: "",
    /** 页面标题。 */
    pageTitle: "新增商品",
    /** 商品名称。 */
    name: "",
    /** 商品描述。 */
    description: "",
    /** 商品价格文本。 */
    price: "",
    /** 商品计价单位。 */
    unit: "个",
    /** 可选商品分类。 */
    categories: ["经典", "粗粮", "甜味"],
    /** 当前分类下标。 */
    categoryIndex: 0,
    /** 商品库存文本。 */
    stock: "20",
    /** 商品角标。 */
    badge: "",
    /** 商品图片预览路径。 */
    imagePath: "",
    /** 商品图片在 CloudBase 云存储中的文件编号。 */
    imageFileId: "",
    /** 商品是否上架。 */
    available: true,
    /** 原商品插画色调。 */
    tone: "wheat",
    /** 是否正在处理图片。 */
    isProcessingImage: false,
  },

  /** 根据路由参数初始化新增或编辑表单。 */
  onLoad(options) {
    const productId = options.id || "";
    if (!productId) return;
    const product = getProductById(productId);
    if (!product) {
      wx.showToast({ title: "没有找到该商品", icon: "none" });
      return;
    }
    const categoryIndex = Math.max(this.data.categories.indexOf(product.category), 0);
    this.setData({
      productId,
      pageTitle: "编辑商品",
      name: product.name,
      description: product.description,
      price: String(product.price),
      unit: product.unit,
      categoryIndex,
      stock: String(product.stock),
      badge: product.badge || "",
      imagePath: product.imagePath || "",
      imageFileId: product.imageFileId || "",
      available: product.available,
      tone: product.tone || "wheat",
    });
    wx.setNavigationBarTitle({ title: "编辑商品" });
  },

  /** 更新商品表单中的普通文本字段。 */
  updateField(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [field]: event.detail.value });
  },

  /** 更新商品分类。 */
  changeCategory(event) {
    this.setData({ categoryIndex: Number(event.detail.value) });
  },

  /** 更新商品上架状态。 */
  changeAvailability(event) {
    this.setData({ available: event.detail.value });
  },

  /** 选择图片并永久保存在小程序本地文件目录。 */
  async chooseImage() {
    if (this.data.isProcessingImage) return;
    this.setData({ isProcessingImage: true });
    try {
      const imagePath = await chooseAndSaveImage();
      const merchantSessionToken = getApp().globalData.merchantSessionToken || "";
      if (!merchantSessionToken) throw new Error("请先登录云端商家端");
      const imageFileId = await uploadRemoteImage(imagePath, "product");
      this.setData({ imagePath, imageFileId });
    } catch (error) {
      const message = error && error.errMsg && error.errMsg.includes("cancel")
        ? ""
        : "图片保存失败，请重试";
      if (message) wx.showToast({ title: message, icon: "none" });
    } finally {
      this.setData({ isProcessingImage: false });
    }
  },

  /** 移除当前商品的自定义图片，恢复默认插画。 */
  removeImage() {
    this.setData({ imagePath: "", imageFileId: "" });
  },

  /** 校验并保存新增或修改后的商品。 */
  async saveProduct() {
    const name = this.data.name.trim();
    const description = this.data.description.trim();
    const price = Number(this.data.price);
    const stock = Number(this.data.stock);
    const category = this.data.categories[this.data.categoryIndex];

    if (!name || !description) {
      wx.showToast({ title: "请填写商品名称和描述", icon: "none" });
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      wx.showToast({ title: "请输入正确价格", icon: "none" });
      return;
    }
    if (!Number.isInteger(stock) || stock < 0) {
      wx.showToast({ title: "库存需要是非负整数", icon: "none" });
      return;
    }

    const product = {
      /** 商品唯一标识。 */
      id: this.data.productId || `product-${Date.now()}`,
      /** 商品名称。 */
      name,
      /** 商品描述。 */
      description,
      /** 商品价格。 */
      price,
      /** 商品计价单位。 */
      unit: this.data.unit.trim() || "个",
      /** 商品分类。 */
      category,
      /** 当前库存。 */
      stock,
      /** 商品角标。 */
      badge: this.data.badge.trim(),
      /** 是否在顾客端展示。 */
      available: this.data.available,
      /** 默认插画色调。 */
      tone: this.data.productId ? this.data.tone : getToneForCategory(category),
      /** 商品图片预览路径。 */
      imagePath: this.data.imagePath,
      /** 商品图片在 CloudBase 云存储中的文件编号。 */
      imageFileId: this.data.imageFileId,
    };
    const merchantSessionToken = getApp().globalData.merchantSessionToken || "";
    if (!merchantSessionToken) {
      wx.showToast({ title: "请先登录云端商家端", icon: "none" });
      return;
    }
    try {
      const result = await saveRemoteProduct(product, merchantSessionToken);
      upsertProduct({ ...result.product, imagePath: result.product.imageUrl || this.data.imagePath });
      wx.showToast({ title: "商品已同步云端", icon: "success" });
      setTimeout(() => wx.navigateBack(), 450);
    } catch (error) {
      wx.showToast({ title: error.message || "商品保存失败", icon: "none" });
    }
  },
});
