import React from "react";
import { createRoot } from "react-dom/client";
import OrderingPage from "../app/page";
import "../app/globals.css";

/** GitHub Pages 静态入口容器。 */
const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("没有找到网页挂载节点");
}

/** 挂载与本地网页端共用的点单界面。 */
createRoot(rootElement).render(
  <React.StrictMode>
    <OrderingPage />
  </React.StrictMode>,
);
