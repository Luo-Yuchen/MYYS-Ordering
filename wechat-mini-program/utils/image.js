/** 让商家从相册或相机中选择一张图片。 */
function chooseSingleImage() {
  return new Promise((resolve, reject) => {
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      sizeType: ["compressed"],
      success(result) {
        const file = result.tempFiles && result.tempFiles[0];
        if (!file || !file.tempFilePath) {
          reject(new Error("没有读取到图片"));
          return;
        }
        resolve(file.tempFilePath);
      },
      fail(error) {
        reject(error);
      },
    });
  });
}

/** 将临时图片保存到小程序本地文件目录，便于下次打开继续预览。 */
function saveImageLocally(tempFilePath) {
  return new Promise((resolve, reject) => {
    const fileSystem = wx.getFileSystemManager();
    fileSystem.saveFile({
      tempFilePath,
      success(result) {
        resolve(result.savedFilePath);
      },
      fail(error) {
        reject(error);
      },
    });
  });
}

/** 选择并保存一张本地体验图片。 */
async function chooseAndSaveImage() {
  const tempFilePath = await chooseSingleImage();
  return saveImageLocally(tempFilePath);
}

module.exports = {
  chooseAndSaveImage,
};
