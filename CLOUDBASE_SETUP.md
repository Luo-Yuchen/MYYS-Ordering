# 腾讯 CloudBase + GitHub Pages 部署说明

本项目已经固定使用 CloudBase 环境：`bun-order-d9gn0mjn09021bfbe`。

## 一、部署 CloudBase 云函数

1. 打开腾讯云 CloudBase 控制台并进入上述环境。
2. 在“云函数”中上传并部署 `cloudfunctions/ordering-api`，函数名称保持为 `ordering-api`。
3. 安装函数目录 `package.json` 中的依赖。
4. 在函数环境变量中设置 `ADMIN_ACCESS_KEY`，请使用至少 16 位、包含数字和大小写字母的管理口令，不要继续使用示例文字。
5. 小程序首次调用函数后会自动创建并初始化以下集合：

   - `products`：商品、价格、库存、上下架状态和云存储图片编号
   - `orders`：订单、顾客资料、自提/配送、金额和双状态
   - `store_settings`：店铺装修设置
   - `payment_methods`：多个个人收款码及名称、收款人、备注
   - `order_counters`：每天的 A/D 三位短订单号计数器

数据库安全规则应禁止网页和小程序直接读写以上集合。所有读写统一通过 `ordering-api` 云函数完成。

## 二、开启网页版匿名登录

GitHub Pages 使用 CloudBase Web SDK 调用云函数，因此需要在 CloudBase 控制台的“登录授权/身份源”中开启匿名登录。

同时把 GitHub Pages 地址和正式自定义域名加入 CloudBase Web 安全域名，否则浏览器会拒绝登录或调用云函数。

匿名用户只能调用云函数，不能直接访问数据库。商家操作还需要云函数环境变量中的 `ADMIN_ACCESS_KEY`。

## 三、小程序配置与上传

1. 使用微信开发者工具打开项目根目录的 `project.config.json`。
2. 确认小程序 AppID 有权访问环境 `bun-order-d9gn0mjn09021bfbe`。
3. 在开发者工具中右键 `cloudfunctions/ordering-api`，选择“上传并部署：云端安装依赖”。
4. 重新编译小程序。

小程序通过 `wx.cloud.callFunction` 操作业务数据，通过 `wx.cloud.uploadFile` 上传商品图和店铺背景，不再需要配置 H5 request 合法域名。

## 四、发布 GitHub Pages

项目已包含 `.github/workflows/deploy-pages.yml`：

1. 将 `OnlineOrdering-Mini-program` 目录作为一个独立 GitHub 仓库，并推送到 `main` 分支；当前上层 Git 仓库远程地址是 Gitee，不能直接提供 GitHub Pages。
2. 在仓库 Settings → Pages 中将 Source 设置为 GitHub Actions。
3. 推送后等待“部署点单网页到 GitHub Pages”工作流完成。
4. 如需使用自己的域名，在 GitHub Pages 设置中绑定域名并按 GitHub 提示配置 DNS。

静态构建命令为 `pnpm build:github-pages`，输出目录为 `dist-github-pages`。

## 五、云存储说明

商品图片和店铺主视觉背景保存在 CloudBase 云存储，数据库只保存永久文件编号。顾客读取店铺数据时，云函数会生成临时 HTTPS 展示地址，因此更换图片不需要重新部署 GitHub Pages。

个人收款码目前由商家填写 HTTPS 图片地址；请确保图片地址可被网页和微信客户端访问。
