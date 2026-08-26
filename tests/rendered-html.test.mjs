import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

/** 从构建产物中渲染首页响应。 */
async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("服务端可以渲染馒有意思首页", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>馒有意思｜每日现蒸馒头<\/title>/);
  assert.match(html, /每天现蒸/);
  assert.match(html, /把柔软送到家/);
  assert.match(html, /og-v2\.png/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("包含下单、接单、收款和默认复古怀旧风规则", async () => {
  const [page, layout, css, packageJson, miniProgramCss] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../wechat-mini-program/app.wxss", import.meta.url), "utf8"),
  ]);

  assert.match(page, /确认订单并显示收款码/);
  assert.match(page, /收款设置/);
  assert.match(page, /paymentMethods/);
  assert.match(page, /配送到家/);
  assert.match(page, /店铺接单台/);
  assert.match(page, /备货汇总/);
  assert.match(page, /商品管理/);
  assert.match(page, /新增商品/);
  assert.match(page, /上传商品图片/);
  assert.match(page, /编辑资料/);
  assert.match(page, /下架隐藏/);
  assert.match(page, /重新上架/);
  assert.match(page, /店铺装修/);
  assert.match(page, /顶部店铺信息/);
  assert.match(page, /首页主视觉文案/);
  assert.match(page, /上传背景图片/);
  assert.match(page, /恢复默认背景/);
  assert.match(page, /manxiang-orders-v1/);
  assert.match(page, /callOrderingFunction/);
  assert.match(page, /PG 云端接单/);
  assert.match(page, /merchantLogin/);
  assert.match(page, /changeMerchantPassword/);
  assert.match(page, /heroBackgroundFileId/);
  assert.match(page, /bg-\[#faf6f1\] rounded-\[2rem\] border border-stone-200/);
  assert.match(page, /px-6 py-3 rounded-full font-medium transition-colors duration-300/);
  assert.match(layout, /generateMetadata/);
  assert.match(layout, /og-v2\.png/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(page, /retro-vintage-theme/);
  assert.match(css, /--vintage-brown: #8b4513/);
  assert.match(css, /--vintage-rust: #c94c4c/);
  assert.match(css, /transition: background-color 700ms/);
  assert.match(miniProgramCss, /复古怀旧风为小程序端默认主题/);
  assert.match(miniProgramCss, /--vintage-forest: #2e4a3f/);
  assert.match(miniProgramCss, /收款码不使用复古滤镜/);
  assert.doesNotMatch(`${page}\n${css}`, /bg-(blue|purple|cyan|gradient)|text-black|rounded-(none|sm)|shadow-(lg|xl|2xl)/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton|site-creator-vinext-starter/);

  await access(new URL("../public/og-v2.png", import.meta.url));
  await assert.rejects(access(new URL("../app/_sites-preview", templateRoot)));
});


test("两端通过 CloudBase 云函数遵循自提配送业务规则", async () => {
  const [page, webClient, cloudFunction, miniConfig, miniApi, miniCustomer, miniCustomerView, miniAdmin, pagesWorkflow] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/cloudbase-client.ts", import.meta.url), "utf8"),
    readFile(new URL("../cloudfunctions/ordering-api/index.js", import.meta.url), "utf8"),
    readFile(new URL("../wechat-mini-program/config.js", import.meta.url), "utf8"),
    readFile(new URL("../wechat-mini-program/utils/api.js", import.meta.url), "utf8"),
    readFile(new URL("../wechat-mini-program/pages/customer/customer.js", import.meta.url), "utf8"),
    readFile(new URL("../wechat-mini-program/pages/customer/customer.wxml", import.meta.url), "utf8"),
    readFile(new URL("../wechat-mini-program/pages/admin/admin.js", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/deploy-pages.yml", import.meta.url), "utf8"),
  ]);

  assert.match(webClient, /bun-order-d9gn0mjn09021bfbe/);
  assert.match(webClient, /signInAnonymously/);
  assert.match(page, /callOrderingFunction/);
  assert.match(page, /const DELIVERY_MINIMUM = 15/);
  assert.match(page, /const FREE_DELIVERY_THRESHOLD = 30/);
  assert.match(page, /shortCode/);
  assert.match(page, /deliveryStatus/);
  assert.match(cloudFunction, /rpc\/ordering_create_order/);
  assert.match(cloudFunction, /deliveryMinimum: 15/);
  assert.match(cloudFunction, /freeDeliveryThreshold: 30/);
  assert.match(cloudFunction, /merchantLogin/);
  assert.match(cloudFunction, /merchantSessionToken/);
  assert.doesNotMatch(cloudFunction, /ADMIN_ACCESS_KEY|x-admin-key|adminKey/);
  assert.match(cloudFunction, /uploadFile/);
  assert.match(cloudFunction, /savePaymentMethods/);
  assert.match(miniConfig, /bun-order-d9gn0mjn09021bfbe/);
  assert.match(miniApi, /wx.cloud.callFunction/);
  assert.match(miniApi, /wx.cloud.uploadFile/);
  assert.match(miniApi, /merchantLogin/);
  assert.match(miniApi, /changeMerchantPassword/);
  assert.match(miniApi, /-601034/);
  assert.doesNotMatch(miniApi, /new Error\(error\.errMsg/);
  assert.doesNotMatch(miniApi, /wx.request/);
  assert.match(miniCustomer, /DELIVERY_MINIMUM = 15/);
  assert.match(miniCustomer, /retryRemoteSync/);
  assert.match(miniCustomerView, /service-retry-button/);
  assert.match(miniCustomerView, /确认订单并显示收款码/);
  assert.match(miniAdmin, /updateRemoteOrder/);
  assert.match(pagesWorkflow, /actions\/deploy-pages@v4/);
});
