// @ts-check

import { defineConfig } from "astro/config";
import { unified } from "@astrojs/markdown-remark";

export default defineConfig({
  /**
   * GitHub Pages 所屬帳號網址。
   */
  site: "https://jasonkuo-0630.github.io",

  /**
   * GitHub Repository 名稱。
   * 網站會部署在：
   * https://jasonkuo-0630.github.io/Three-Kingdoms-Biographies/
   */
  base: "/Three-Kingdoms-Biographies",

  /**
   * Astro 7 預設改用 Sätteri（Rust 寫的原生 Markdown 引擎）處理
   * content collections，但它在部分公司電腦的 Windows 環境上，
   * 原生 .node 檔案會裝不上（跟 Node 版本、系統環境有關）。
   *
   * 這裡改回傳統的 Unified／Remark（純 JavaScript，沒有原生依賴）
   * 處理器，避免這個問題。我們的人物頁不透過 Astro 內建的 Markdown
   * 轉譯結果顯示內容——是自己寫的 parsePersonBody 直接讀取原始文字
   * 解析——所以換回哪一種處理器，都不影響人物頁實際顯示的內容。
   */
  markdown: {
    processor: unified(),
  },
});