/**
 * parsePersonBody.ts
 *
 * 把人物 Markdown 檔案「填空區」（frontmatter）以外、用中文標題＋
 * 段落／條列寫的內容，轉換成頁面元件可以直接使用的結構化資料。
 *
 * 這是第一版格式解析器，先求「格式清楚、好寫」，
 * 不追求應付所有可能的例外寫法——寫法固定下來、
 * 大家實際填寫一陣子之後，再回頭把解析規則補強即可。
 *
 * 支援的標題結構（標題文字必須完全一致，內容照格式寫）：
 *
 * ## 人物總覽
 *   （開頭幾段文字＋「**主要身分**：A、B、C」）
 *   ### 官職與爵位
 *   ### 所屬勢力與效力歷程
 * ## 親屬關係
 * ## 人物評價
 *   ### 當世
 *   ### 後世
 * ## 生平
 *   ### 史實生平
 *   ### 演義生平
 * ## 著作
 */


export interface ParsedCitation {
  source: string;
  locator?: string;
}


export interface ParsedTitleAndRank {
  title: string;
  period?: string;
  type?: string;
  note?: string;
  citations: ParsedCitation[];
}


export interface ParsedFactionStage {
  leaderName: string;
  leaderId?: string;
  hideAvatar: boolean;
  title: string;
  period?: string;
  periodUncertain: boolean;
}


export interface ParsedRelation {
  targetName: string;
  targetId?: string;
  relationGroupLabel: string;
  historical?: ParsedRelationLayer;
  romance?: ParsedRelationLayer;
}


export interface ParsedRelationLayer {
  text: string[];
  citations: ParsedCitation[];
}


export interface ParsedEvaluation {
  quote: string;
  evaluator: string;
  context?: string;
  citations: ParsedCitation[];
}


/**
 * 一段白話文字，加上緊接在後面的史料出處。
 *
 * 出處會用比內文小一號的乾淨格式（書名＋卷次）獨立顯示，
 * 不再混在段落文字裡面，方便之後串連到三國文獻庫。
 */
export interface ParsedParagraph {
  text: string;
  citations: ParsedCitation[];
}


export interface ParsedBiographyEntry {
  period: string;
  title: string;
  paragraphs: ParsedParagraph[];
  uncertaintyNote?: string;
  originalTexts: ParsedParagraph[];
  historicalDifference?: ParsedParagraph[];
}


export interface ParsedWork {
  title: string;
  type?: string;
  extant?: string;
  summaryParagraphs: ParsedParagraph[];
  excerpt?: string;
  originalText?: string[];
}


export interface ParsedPersonBody {
  introParagraphs: ParsedParagraph[];
  primaryIdentities: string[];
  titlesAndRanks: ParsedTitleAndRank[];
  factionStages: ParsedFactionStage[];
  relations: ParsedRelation[];
  evaluations: {
    contemporary: ParsedEvaluation[];
    later: ParsedEvaluation[];
  };
  historicalBio: ParsedBiographyEntry[];
  romanceBio: ParsedBiographyEntry[];
  works: ParsedWork[];
  worksNote?: string;
}


/* ==============================
   第一步：依「## 」「### 」標題分堆
   ============================== */

type SectionMap = Record<string, Record<string, string[]>>;


function splitBySections(body: string): SectionMap {
  const lines = body.split(/\r?\n/);

  const sections: SectionMap = {};

  let currentSection = "";
  let currentSub = "";

  for (const rawLine of lines) {
    const h2Match = rawLine.match(/^##\s+(.+?)\s*$/);
    const h3Match = rawLine.match(/^###\s+(.+?)\s*$/);

    if (h2Match) {
      currentSection = h2Match[1].trim();
      currentSub = "";
      sections[currentSection] ??= {};
      continue;
    }

    if (h3Match) {
      currentSub = h3Match[1].trim();
      sections[currentSection] ??= {};
      sections[currentSection][currentSub] ??= [];
      continue;
    }

    if (!currentSection) {
      // 標題出現以前的內容（例如 HTML 註解）直接忽略。
      continue;
    }

    sections[currentSection] ??= {};
    sections[currentSection][currentSub] ??= [];
    sections[currentSection][currentSub].push(rawLine);
  }

  return sections;
}


/* ==============================
   共用小工具
   ============================== */

/**
 * 依空白行把段落分堆，並且把段落最後那一行「（來源：……）」
 * 抽出來變成 citations，不再留在段落文字裡面。
 */
function groupIntoParagraphBlocks(lines: string[]): ParsedParagraph[] {
  const blocks: ParsedParagraph[] = [];

  let currentTextLines: string[] = [];
  let currentCitations: ParsedCitation[] = [];

  const flush = () => {
    if (currentTextLines.length === 0 && currentCitations.length === 0) {
      return;
    }

    blocks.push({
      text: currentTextLines.join(""),
      citations: currentCitations,
    });

    currentTextLines = [];
    currentCitations = [];
  };

  for (const line of lines) {
    if (line.trim() === "") {
      flush();
      continue;
    }

    const citations = parseCitationLine(line);

    if (citations) {
      currentCitations.push(...citations);
      continue;
    }

    currentTextLines.push(line.trim());
  }

  flush();

  return blocks;
}


function parseCitationLine(line: string): ParsedCitation[] | null {
  const match = line
    .trim()
    .match(/^[（(]來源[：:]\s*(.+?)[）)]$/);

  if (!match) {
    return null;
  }

  return match[1]
    .split("；")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [source, locator] = entry.split("・");

      return {
        source: source.trim(),
        locator: locator?.trim(),
      };
    });
}


/**
 * 將親屬說明尾端的「（來源：……）」拆成正文與來源清單。
 * 吃一整串行（可能是好幾行換行分開的句子），
 * 只有最後一行結尾可能帶「（來源：……）」。
 */
function parseRelationLayerLines(
  lines: string[],
): ParsedRelationLayer {
  if (lines.length === 0) {
    return { text: [], citations: [] };
  }

  const lastLine = lines[lines.length - 1];

  const match = lastLine.match(
    /^(.*?)[（(]來源[：:]\s*(.+?)[）)]\s*$/,
  );

  if (!match) {
    return {
      text: lines,
      citations: [],
    };
  }

  const textLines = lines.slice(0, -1);
  const lastText = match[1].trim();

  if (lastText) {
    textLines.push(lastText);
  }

  return {
    text: textLines,
    citations:
      parseCitationLine(`（來源：${match[2]}）`) ?? [],
  };
}

/**
 * 相容單行呼叫（例如人物評價的評論者那一行）。
 */
function parseRelationLayer(value: string): ParsedRelationLayer {
  return parseRelationLayerLines([value]);
}


/* ==============================
   人物總覽
   ============================== */

function parseIntro(lines: string[]): {
  paragraphs: ParsedParagraph[];
  primaryIdentities: string[];
} {
  const paragraphs: ParsedParagraph[] = [];
  let primaryIdentities: string[] = [];

  for (const block of groupIntoParagraphBlocks(lines)) {
    const match = block.text.match(/^\*\*主要身分\*\*[：:]\s*(.+)$/);

    if (match) {
      primaryIdentities = match[1]
        .split(/[、,]/)
        .map((entry) => entry.trim())
        .filter(Boolean);

      continue;
    }

    paragraphs.push(block);
  }

  return {
    paragraphs,
    primaryIdentities,
  };
}


function parseTitlesAndRanks(lines: string[]): ParsedTitleAndRank[] {
  const entries: ParsedTitleAndRank[] = [];

  for (const rawLine of lines) {
    const bulletMatch = rawLine.match(/^-\s+(.+)$/);

    if (bulletMatch) {
      const [title, period, type] = bulletMatch[1]
        .split("｜")
        .map((part) => part.trim());

      entries.push({
        title: title ?? bulletMatch[1].trim(),
        period: period || undefined,
        type: type || undefined,
        citations: [],
      });

      continue;
    }

    if (rawLine.trim() === "" || entries.length === 0) {
      continue;
    }

    const current = entries[entries.length - 1];

    const noteMatch = rawLine.match(/^\s+說明[：:]\s*(.+)$/);

    if (noteMatch) {
      current.note = noteMatch[1].trim();
      continue;
    }

    const citations = parseCitationLine(rawLine);

    if (citations) {
      current.citations.push(...citations);
    }
  }

  return entries;
}


function parseFactionStages(lines: string[]): ParsedFactionStage[] {
  const stages: ParsedFactionStage[] = [];

  for (const rawLine of lines) {
    const match = rawLine.match(/^\d+\.\s+(.+)$/);

    if (!match) {
      continue;
    }

    const [leaderPart, title, period, flag] = match[1]
      .split("｜")
      .map((part) => part.trim());

    // 「（無頭像）」：這個階段的效力對象不需要頭像也不需要連結，
    // 例如朝廷、政權這類非人物實體，或效力對象就是這篇人物本人。
    const hideAvatarMatch = leaderPart.match(/^(.+?)（無頭像）$/);

    if (hideAvatarMatch) {
      stages.push({
        leaderName: hideAvatarMatch[1].trim(),
        leaderId: undefined,
        hideAvatar: true,
        title: title ?? "",
        period: period || undefined,
        periodUncertain: Boolean(flag?.includes("推定")),
      });
      continue;
    }

    const leaderMatch = leaderPart.match(
      /^(.+?)(?:（連結：([\w-]+)）)?$/,
    );

    stages.push({
      leaderName: leaderMatch?.[1]?.trim() ?? leaderPart,
      leaderId: leaderMatch?.[2],
      hideAvatar: false,
      title: title ?? "",
      period: period || undefined,
      periodUncertain: Boolean(flag?.includes("推定")),
    });
  }

  return stages;
}


/* ==============================
   親屬關係
   ============================== */

function parseRelations(lines: string[]): ParsedRelation[] {
  const relations: ParsedRelation[] = [];

  let bufferLines: string[] = [];
  let bufferField: "historical" | "romance" | null = null;

  const flushLayer = () => {
    if (
      bufferField &&
      bufferLines.length > 0 &&
      relations.length > 0
    ) {
      const current = relations[relations.length - 1];

      current[bufferField] = parseRelationLayerLines(bufferLines);
    }

    bufferLines = [];
    bufferField = null;
  };

  for (const rawLine of lines) {
    const topMatch = rawLine.match(
      /^-\s+\*\*(.+?)\*\*(?:（連結：([\w-]+)）)?\s*｜\s*(.+)$/,
    );

    if (topMatch) {
      flushLayer();

      relations.push({
        targetName: topMatch[1].trim(),
        targetId: topMatch[2],
        relationGroupLabel: topMatch[3].trim(),
      });

      continue;
    }

    if (relations.length === 0) {
      continue;
    }

    const layerMatch = rawLine.match(
      /^\s+-\s+(史實|演義)[：:]\s*(.+)$/,
    );

    if (layerMatch) {
      flushLayer();

      bufferField =
        layerMatch[1] === "史實" ? "historical" : "romance";
      bufferLines = [layerMatch[2].trim()];

      continue;
    }

    if (rawLine.trim() === "") {
      continue;
    }

    if (bufferField) {
      bufferLines.push(rawLine.trim());
    }
  }

  flushLayer();

  return relations;
}


/* ==============================
   人物評價
   ============================== */

function parseEvaluationBlock(lines: string[]): ParsedEvaluation[] {
  const evaluations: ParsedEvaluation[] = [];

  let quoteLines: string[] = [];
  let pending: Partial<ParsedEvaluation> | null = null;

  const flushQuote = () => {
    if (quoteLines.length > 0) {
      pending = {
        quote: quoteLines.join(""),
      };

      quoteLines = [];
    }
  };

  for (const rawLine of lines) {
    const quoteMatch = rawLine.match(/^>\s*(.*)$/);

    if (quoteMatch) {
      quoteLines.push(quoteMatch[1].trim());
      continue;
    }

    flushQuote();

    const evaluatorMatch = rawLine.match(/^—\s*(.+)$/);

    if (evaluatorMatch && pending) {
      // 評論者這行結尾如果有「（來源：……）」，
      // 拆成純評論者名稱＋citations，跟親屬關係借用同一套規則。
      const evaluatorLayer = parseRelationLayer(evaluatorMatch[1]);

      (pending as Partial<ParsedEvaluation>).evaluator =
        evaluatorLayer.text.join("");
      (pending as Partial<ParsedEvaluation>).citations =
        evaluatorLayer.citations;

      continue;
    }

    const contextMatch = rawLine.match(/^說明[：:]\s*(.+)$/);

    if (contextMatch && pending) {
      const current = pending as Partial<ParsedEvaluation>;

      current.context = contextMatch[1].trim();

      evaluations.push({
        quote: current.quote ?? "",
        evaluator: current.evaluator ?? "",
        context: current.context,
        citations: current.citations ?? [],
      });

      pending = null;
    }
  }

  flushQuote();

  if (pending) {
    const current = pending as Partial<ParsedEvaluation>;

    evaluations.push({
      quote: current.quote ?? "",
      evaluator: current.evaluator ?? "",
      context: current.context,
      citations: current.citations ?? [],
    });
  }

  return evaluations;
}


/* ==============================
   生平（史實／演義共用）
   ============================== */

/**
 * 一段文字裡，如果結尾有獨立成行的「（來源：……）」，
 * 抽出來變成 citations，不留在文字裡面。
 * 一般段落、與史實的差異說明共用這套邏輯。
 */
function extractParagraphCitations(lines: string[]): ParsedParagraph {
  const textLines: string[] = [];
  const citations: ParsedCitation[] = [];

  for (const line of lines) {
    const found = parseCitationLine(line);

    if (found) {
      citations.push(...found);
      continue;
    }

    textLines.push(line);
  }

  return {
    text: textLines.join(""),
    citations,
  };
}


function parseBiographySection(
  lines: string[],
): ParsedBiographyEntry[] {
  const entries: ParsedBiographyEntry[] = [];

  let bufferLines: string[] = [];

  /**
   * 目前這串連續非空行，最後要接到哪裡：
   * 一般段落（paragraphs）還是「與史實的差異」說明。
   * 這樣「與史實的差異：」那一行，跟緊接著沒有空行分隔的
   * 下一行（通常是補充來源），才會被接成同一段，
   * 不會被誤判成一段獨立的白話段落。
   */
  let bufferTarget: "paragraph" | "difference" = "paragraph";
  let originalTextLines: string[] | null = null;

  const flushOriginalText = () => {
    if (
      originalTextLines &&
      originalTextLines.length > 0 &&
      entries.length > 0
    ) {
      const current = entries[entries.length - 1];
      // 原文的來源是接在最後一行句尾，不是獨立成行，
      // 這跟親屬關係同一種格式，借用同一套規則，
      // 不能用 extractParagraphCitations（那個是找獨立成行的來源）。
      const layer = parseRelationLayerLines(originalTextLines);

      current.originalTexts.push({
        text: layer.text.join(""),
        citations: layer.citations,
      });
    }

    originalTextLines = null;
  };

  const flushBuffer = () => {
    if (bufferLines.length > 0 && entries.length > 0) {
      const current = entries[entries.length - 1];

      const parsed = extractParagraphCitations(bufferLines);

      if (bufferTarget === "difference") {
        current.historicalDifference = current.historicalDifference ?? [];
        current.historicalDifference.push(parsed);
      } else {
        current.paragraphs.push(parsed);
      }
    }

    bufferLines = [];
    // 注意：這裡不再把 bufferTarget 重置回 "paragraph"。
    // 讓「與史實的差異」可以跨越空行分成好幾段，
    // 不會因為你想換段而被誤判成一般段落塞錯地方。
    // bufferTarget 只在遇到下一個人物階段標題時才歸零，見下方 titleMatch。
  };

  for (const rawLine of lines) {
    const titleMatch = rawLine.match(/^\*\*(.+?)\*\*$/);

    if (titleMatch) {
      flushBuffer();
      flushOriginalText();
      bufferTarget = "paragraph";

      const [period, title] = titleMatch[1]
        .split("・")
        .map((part) => part.trim());

      entries.push({
        period: period ?? titleMatch[1].trim(),
        title: title ?? "",
        paragraphs: [],
        originalTexts: [],
      });

      continue;
    }

    if (rawLine.trim() === "") {
      flushBuffer();
      flushOriginalText();
      continue;
    }

    if (entries.length === 0) {
      continue;
    }

    const current = entries[entries.length - 1];

    const noteMatch = rawLine.match(/^>\s*年代備註[：:]\s*(.+)$/);

    if (noteMatch) {
      flushBuffer();
      flushOriginalText();
      current.uncertaintyNote = noteMatch[1].trim();
      continue;
    }

    const originalTextMatch = rawLine.match(/^>\s*原文[：:]\s*(.+)$/);

    if (originalTextMatch) {
      flushBuffer();
      // 上一則「> 原文：」還沒被空行結束就遇到新的一則，
      // 先把前一則收掉，再開新的一則，不會互相蓋掉。
      flushOriginalText();
      originalTextLines = [originalTextMatch[1].trim()];
      continue;
    }

    // 同一則原文如果分成好幾行、每行都用 > 開頭延續，
    // 沒有再寫一次「原文：」，這裡接續收集。
    if (originalTextLines) {
      const originalContinuationMatch = rawLine.match(/^>\s*(.+)$/);

      if (originalContinuationMatch) {
        originalTextLines.push(originalContinuationMatch[1].trim());
        continue;
      }
    }

    const differenceMatch = rawLine.match(
      /^與史實的差異[：:]\s*(.+)$/,
    );

    if (differenceMatch) {
      flushBuffer();
      flushOriginalText();
      bufferTarget = "difference";
      bufferLines.push(differenceMatch[1].trim());
      continue;
    }

    bufferLines.push(rawLine.trim());
  }

  flushBuffer();
  flushOriginalText();

  return entries;
}


/* ==============================
   著作
   ============================== */

function parseWorks(lines: string[]): {
  works: ParsedWork[];
  note?: string;
} {
  const works: ParsedWork[] = [];
  let note: string | undefined;

  let bufferLines: string[] = [];
  let originalTextLines: string[] | null = null;

  const flushBuffer = () => {
    if (bufferLines.length > 0 && works.length > 0) {
      works[works.length - 1].summaryParagraphs.push(
        extractParagraphCitations(bufferLines),
      );
    }

    bufferLines = [];
  };

  const flushOriginalText = () => {
    if (
      originalTextLines &&
      originalTextLines.length > 0 &&
      works.length > 0
    ) {
      works[works.length - 1].originalText = originalTextLines;
    }

    originalTextLines = null;
  };

  for (const rawLine of lines) {
    if (rawLine.trim() === "---") {
      continue;
    }

    const titleMatch = rawLine.match(/^\*\*(.+?)\*\*\s*(.*)$/);

    if (titleMatch) {
      flushBuffer();
      flushOriginalText();

      const [type, extant] = titleMatch[2]
        .replace(/^｜/, "")
        .split("｜")
        .map((part) => part.trim())
        .filter(Boolean);

      works.push({
        title: titleMatch[1].trim(),
        type: type || undefined,
        extant: extant || undefined,
        summaryParagraphs: [],
      });

      continue;
    }

    if (rawLine.trim() === "") {
      flushBuffer();
      flushOriginalText();
      continue;
    }

    const noteMatch = rawLine.match(/^>\s*整體說明[：:]\s*(.+)$/);

    if (noteMatch) {
      flushBuffer();
      flushOriginalText();
      note = noteMatch[1].trim();
      continue;
    }

    if (works.length === 0) {
      continue;
    }

    const current = works[works.length - 1];

    const excerptMatch = rawLine.match(/^>\s*摘錄[：:]\s*(.+)$/);

    if (excerptMatch) {
      flushBuffer();
      flushOriginalText();
      current.excerpt = excerptMatch[1].trim();
      continue;
    }

    const originalTextMatch = rawLine.match(/^>\s*原文[：:]\s*(.+)$/);

    if (originalTextMatch) {
      flushBuffer();
      originalTextLines = [originalTextMatch[1].trim()];
      continue;
    }

    if (originalTextLines) {
      const continuationMatch = rawLine.match(/^>\s*(.+)$/);

      if (continuationMatch) {
        originalTextLines.push(continuationMatch[1].trim());
        continue;
      }
    }

    bufferLines.push(rawLine.trim());
  }

  flushBuffer();
  flushOriginalText();

  return { works, note };
}


/* ==============================
   主要入口
   ============================== */

export function parsePersonBody(body: string): ParsedPersonBody {
  const sections = splitBySections(body);

  const overviewSection = sections["人物總覽"] ?? {};
  const relationsSection = sections["親屬關係"] ?? {};
  const evaluationsSection = sections["人物評價"] ?? {};
  const biographySection = sections["生平"] ?? {};
  const worksSection = sections["著作"] ?? {};

  const intro = parseIntro(overviewSection[""] ?? []);
  const worksParsed = parseWorks(worksSection[""] ?? []);

  return {
    introParagraphs: intro.paragraphs,
    primaryIdentities: intro.primaryIdentities,

    titlesAndRanks: parseTitlesAndRanks(
      overviewSection["官職與爵位"] ?? [],
    ),

    factionStages: parseFactionStages(
      overviewSection["所屬勢力與效力歷程"] ?? [],
    ),

    relations: parseRelations(relationsSection[""] ?? []),

    evaluations: {
      contemporary: parseEvaluationBlock(
        evaluationsSection["當世"] ?? [],
      ),

      later: parseEvaluationBlock(
        evaluationsSection["後世"] ?? [],
      ),
    },

    historicalBio: parseBiographySection(
      biographySection["史實生平"] ?? [],
    ),

    romanceBio: parseBiographySection(
      biographySection["演義生平"] ?? [],
    ),

    works: worksParsed.works,
    worksNote: worksParsed.note,
  };
}