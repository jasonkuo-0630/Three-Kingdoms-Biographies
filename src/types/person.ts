import type { FactionId } from "../data/factions";


/**
 * 人物卷首（PersonHero）用得到的型別。
 *
 * 這個檔案只保留目前實際會用到的部分，
 * 不需要的舊型別已經清掉。
 */


/** 諡號的史料來源 */
export interface PosthumousTitleCitation {
  source: string;
  locator?: string;
}


/** 諡號資料 */
export interface PosthumousTitle {
  /** 諡號，例如「壯繆侯」 */
  title: string;

  /** 追諡時間 */
  grantedAt?: string;

  /** 授予者或政權 */
  grantedBy?: string;

  /** 補充說明 */
  note?: string;

  /** 史料來源 */
  citations?: PosthumousTitleCitation[];
}


/**
 * 人物最基本的識別資料，顯示在人物頁最上方卷首。
 */
export interface PersonIdentity {
  /** 人物固定代號與網址 */
  id: string;

  /** 姓名 */
  name: string;

  /** 字 */
  courtesyName?: string;

  /** 本字 */
  originalCourtesyName?: string;

  /** 幼名 */
  childhoodName?: string;

  /** 號 */
  artName?: string;

  /** 其他名稱或後世稱呼 */
  otherNames?: string[];

  /** 所屬勢力 */
  faction: FactionId;

  /** 生卒年顯示文字。不填則顯示「不詳」。 */
  lifespan?: string;

  /** 籍貫。不填則顯示「不詳」。 */
  birthplace?: string;

  /** 人物卷首的簡短介紹 */
  summary: string;

  /** 頭像圖片路徑 */
  avatar: string;

  /** 諡號。不填則顯示「未記載」。 */
  posthumousTitle?: PosthumousTitle;
}