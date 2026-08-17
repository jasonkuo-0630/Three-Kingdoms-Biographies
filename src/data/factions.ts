/**
 * 勢力固定代號對照：
 *
 * wei      = 曹魏
 * shu      = 蜀漢
 * wu       = 孫吳
 * donghan  = 東漢
 * qunxiong = 群雄
 * jin      = 西晉（目前僅預留）
 */
export type FactionId =
  | "wei"
  | "shu"
  | "wu"
  | "donghan"
  | "qunxiong"
  | "jin";

export interface FactionMeta {
  /** 程式與網址使用的固定代號 */
  id: FactionId;

  /** 勢力大字 */
  mark: string;

  /** 畫面顯示的勢力名稱 */
  name: string;

  /** 首頁入口使用的四言對句 */
  homeMotto: string;

  /** 勢力總覽橫幅使用的七言對句 */
  overviewMotto: string;

  /** 首頁入口代表人物 */
  representative: string;

  /** 首頁入口人物圖片 */
  portrait: string;
}

/**
 * 首頁與勢力總覽共同使用的勢力資料。
 *
 * 日後若要修改名稱、標語或代表人物，
 * 只需要修改這一個檔案。
 */
export const factions: FactionMeta[] = [
  {
    id: "wei",
    mark: "魏",
    name: "曹魏",
    homeMotto: "唯才是舉，雄踞中原",
    overviewMotto: "唯才是舉納群賢，魏武揮鞭傲中原。",
    representative: "曹操",
    portrait: "images/cao_cao_main.png",
  },
  {
    id: "shu",
    mark: "蜀",
    name: "蜀漢",
    homeMotto: "承漢之志，義聚群英",
    overviewMotto: "義膽忠魂扶漢志，凌雲揮戈挽山河。",
    representative: "劉備",
    portrait: "images/liu_bei_main.png",
  },
  {
    id: "wu",
    mark: "吳",
    name: "孫吳",
    homeMotto: "據有江東，豪傑並起",
    overviewMotto: "江東才俊領風騷，赤壁雄兵火連天。",
    representative: "孫權",
    portrait: "images/sun_quan_main.png",
  },
  {
    id: "donghan",
    mark: "漢",
    name: "東漢",
    homeMotto: "四百年祚，餘暉未盡",
    overviewMotto: "四百年治終將亂，帝星黯淡暮色沉。",
    representative: "劉協",
    portrait: "images/liu_xie_main.png",
  },
  {
    id: "qunxiong",
    mark: "群",
    name: "群雄",
    homeMotto: "逐鹿天下，各領風騷",
    overviewMotto: "逐鹿天下無常主，虎嘯龍吟各一方。",
    representative: "袁紹",
    portrait: "images/yuan_shao_main.png",
  },
];

/**
 * 產生勢力頁網址時使用的 ID 清單。
 */
export const factionIds = factions.map((faction) => faction.id);

/**
 * 依照網址中的 ID 取得勢力資料。
 */
export function getFactionById(id: string) {
  return factions.find((faction) => faction.id === id);
}