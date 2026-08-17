// @ts-check

import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";


/**
 * 「人物」內容集合。
 *
 * 這裡不是存資料本身，是定義「一份人物資料該長什麼樣子」的規則書。
 * 之後新增／修改人物時，Astro 會照這份規則檢查每一份 .md 檔案的
 * frontmatter（檔案最上面被 --- 夾住的那一段），
 * 漏填必填欄位或打錯字都會在 build 時直接報錯提醒，
 * 不會等到畫面壞掉才發現。
 */
const people = defineCollection({
  /**
   * 自動讀取 src/content/people/ 資料夾底下所有 .md 檔案。
   *
   * 新增人物只要把檔案丟進這個資料夾就好，
   * 不用手動登記或修改任何程式碼。
   */
  loader: glob({
    pattern: "**/*.md",
    base: "./src/content/people",
  }),

  schema: z.object({
    /**
     * 人物的網址代號，例如 guan-yu。
     * 建立後盡量不要更動，否則其他人物指向他的連結會失效。
     */
    id: z.string(),

    /** 姓名，必填。 */
    name: z.string(),

    /** 字，例如「雲長」。沒有就整行刪掉。 */
    courtesyName: z.string().optional(),

    /** 本字，較少見。沒有就整行刪掉。 */
    originalCourtesyName: z.string().optional(),

    /** 幼名。沒有就整行刪掉。 */
    childhoodName: z.string().optional(),

    /** 號。沒有就整行刪掉。 */
    artName: z.string().optional(),

    /** 其他稱呼或後世通稱，格式是 [A, B] 這樣的陣列。 */
    otherNames: z.array(z.string()).optional(),

    /**
     * 所屬勢力代號，只能是這六個之一：
     * wei（曹魏）／shu（蜀漢）／wu（孫吳）／
     * donghan（東漢）／qunxiong（群雄）／jin（西晉）。
     * 必填，且不能自己發明新代號。
     */
    faction: z.enum(["wei", "shu", "wu", "donghan", "qunxiong", "jin"]),

    /** 生卒年顯示文字，直接打想顯示的內容。沒有就整行刪掉。 */
    lifespan: z.string().optional(),

    /** 籍貫。沒有就整行刪掉。 */
    birthplace: z.string().optional(),

    /**
     * 人物卷首簡短介紹。
     *
     * 在 .md 裡用 `summary: |` 換行寫方便閱讀沒關係，
     * 這裡會把換行去掉、接成一整句，畫面上不會多出空格。
     */
    summary: z
      .string()
      .transform((value) => value.replace(/\r?\n\s*/g, "").trim()),

    /** 頭像圖片路徑，圖片要先放進 public/images/。必填。 */
    avatar: z.string(),

    /**
     * 諡號資料，整段選填。
     * 沒有追諡的人物，這一整塊（連同底下所有欄位）都可以刪掉。
     */
    posthumousTitle: z
      .object({
        /** 諡號本身，例如「壯繆侯」。 */
        title: z.string(),

        /** 追諡時間。沒有就整行刪掉。 */
        grantedAt: z.string().optional(),

        /** 授予者或政權。沒有就整行刪掉。 */
        grantedBy: z.string().optional(),

        /** 補充說明。沒有就整行刪掉。 */
        note: z.string().optional(),

        /** 史料來源清單。 */
        sources: z.array(z.string()).optional(),
      })
      .optional(),
  }),
});


export const collections = {
  people,
};