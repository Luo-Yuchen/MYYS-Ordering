const { getSettings, saveSettings } = require("../../utils/store");
const { chooseAndSaveImage } = require("../../utils/image");
const { saveRemoteStoreSettings, uploadRemoteImage } = require("../../utils/api");

Page({
  data: {
    /** 顶部圆形标记文字。 */
    brandMark: "",
    /** 店铺名称。 */
    brandName: "",
    /** 店铺名称下方说明。 */
    brandTagline: "",
    /** 主视觉小标签。 */
    heroBadge: "",
    /** 主视觉大标题。 */
    heroTitle: "",
    /** 主视觉介绍。 */
    heroDescription: "",
    /** 主视觉按钮文字。 */
    heroButtonText: "",
    /** 配送与优惠提示。 */
    deliveryNote: "",
    /** 主视觉背景预览路径。 */
    heroBackgroundPath: "",
    /** 主视觉背景在 CloudBase 云存储中的文件编号。 */
    heroBackgroundFileId: "",
    /** 是否正在处理背景图片。 */
    isProcessingImage: false,
  },

  /** 页面打开时读取当前店铺装修设置。 */
  onLoad() {
    this.setData(getSettings());
  },

  /** 更新店铺装修中的普通文本字段。 */
  updateField(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [field]: event.detail.value });
  },

  /** 选择图片并永久保存为本机主视觉背景。 */
  async chooseBackground() {
    if (this.data.isProcessingImage) return;
    this.setData({ isProcessingImage: true });
    try {
      const heroBackgroundPath = await chooseAndSaveImage();
      const adminKey = getApp().globalData.adminKey || "";
      if (!adminKey) throw new Error("请先登录云端商家端");
      const heroBackgroundFileId = await uploadRemoteImage(heroBackgroundPath, "store");
      this.setData({ heroBackgroundPath, heroBackgroundFileId });
    } catch (error) {
      const message = error && error.errMsg && error.errMsg.includes("cancel")
        ? ""
        : "背景图片保存失败，请重试";
      if (message) wx.showToast({ title: message, icon: "none" });
    } finally {
      this.setData({ isProcessingImage: false });
    }
  },

  /** 移除自定义背景并恢复默认自然绿色主视觉。 */
  removeBackground() {
    this.setData({ heroBackgroundPath: "", heroBackgroundFileId: "" });
  },

  /** 校验并保存店铺装修设置。 */
  async saveStoreSettings() {
    if (!this.data.brandName.trim() || !this.data.heroTitle.trim()) {
      wx.showToast({ title: "请填写店铺名称和首页标题", icon: "none" });
      return;
    }
    const settings = {
      /** 顶部圆形标记文字。 */
      brandMark: this.data.brandMark.trim() || "馒",
      /** 店铺名称。 */
      brandName: this.data.brandName.trim(),
      /** 店铺名称下方说明。 */
      brandTagline: this.data.brandTagline.trim(),
      /** 主视觉小标签。 */
      heroBadge: this.data.heroBadge.trim(),
      /** 主视觉大标题。 */
      heroTitle: this.data.heroTitle.trim(),
      /** 主视觉介绍。 */
      heroDescription: this.data.heroDescription.trim(),
      /** 主视觉按钮文字。 */
      heroButtonText: this.data.heroButtonText.trim() || "看看今日馒头",
      /** 配送与优惠提示。 */
      deliveryNote: this.data.deliveryNote.trim(),
      /** 主视觉背景预览路径。 */
      heroBackgroundPath: this.data.heroBackgroundPath,
      /** 主视觉背景在 CloudBase 云存储中的文件编号。 */
      heroBackgroundFileId: this.data.heroBackgroundFileId,
    };
    const adminKey = getApp().globalData.adminKey || "";
    if (!adminKey) {
      wx.showToast({ title: "请先登录云端商家端", icon: "none" });
      return;
    }
    try {
      const result = await saveRemoteStoreSettings(settings, adminKey);
      saveSettings({ ...result.settings, heroBackgroundPath: result.settings.heroBackgroundImage || this.data.heroBackgroundPath });
      wx.showToast({ title: "店铺装修已同步云端", icon: "success" });
      setTimeout(() => wx.navigateBack(), 450);
    } catch (error) {
      wx.showToast({ title: error.message || "店铺设置保存失败", icon: "none" });
    }
  },
});
