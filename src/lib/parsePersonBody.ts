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
  title: string;
  period?: string;
  periodUncertain: boolean;
}


export interface ParsedRelation {
  targetName: string;
  targetId?: string;
  relationGroupLabel: string;
  historical?: string;
  romance?: string;
}


export interface ParsedEvaluation {
  quote: string;
  evaluator: string;
  context?: string;
}


export interface ParsedBiographyEntry {
  period: string;
  title: string;
  paragraphs: string[];
  uncertaintyNote?: string;
  originalText?: string;
  historicalDifference?: string;
}


export interface ParsedWork {
  title: string;
  type?: string;
  extant?: string;
  summaryParagraphs: string[];
  excerpt?: string;
  originalText?: string;
}


export interface ParsedPersonBody {
  introParagraphs: string[];
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

function groupIntoParagraphBlocks(lines: string[]): string[] {
  const blocks: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (line.trim() === "") {
      if (current.length > 0) {
        blocks.push(current.join(""));
        current = [];
      }
      continue;
    }

    current.push(line.trim());
  }

  if (current.length > 0) {
    blocks.push(current.join(""));
  }

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


/* ==============================
   人物總覽
   ============================== */

function parseIntro(lines: string[]): {
  paragraphs: string[];
  primaryIdentities: string[];
} {
  const paragraphs: string[] = [];
  let primaryIdentities: string[] = [];

  for (const block of groupIntoParagraphBlocks(lines)) {
    const match = block.match(/^\*\*主要身分\*\*[：:]\s*(.+)$/);

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

    const leaderMatch = leaderPart.match(
      /^(.+?)(?:（連結：([\w-]+)）)?$/,
    );

    stages.push({
      leaderName: leaderMatch?.[1]?.trim() ?? leaderPart,
      leaderId: leaderMatch?.[2],
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

  for (const rawLine of lines) {
    const topMatch = rawLine.match(
      /^-\s+\*\*(.+?)\*\*(?:（連結：([\w-]+)）)?\s*｜\s*(.+)$/,
    );

    if (topMatch) {
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

    const current = relations[relations.length - 1];

    const layerMatch = rawLine.match(
      /^\s+-\s+(史實|演義)[：:]\s*(.+)$/,
    );

    if (layerMatch) {
      if (layerMatch[1] === "史實") {
        current.historical = layerMatch[2].trim();
      } else {
        current.romance = layerMatch[2].trim();
      }
    }
  }

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
      (pending as Partial<ParsedEvaluation>).evaluator =
        evaluatorMatch[1].trim();

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
      });

      pending = null;
    }
  }

  flushQuote();

  if (pending) {
    evaluations.push({
      quote: (pending as ParsedEvaluation).quote ?? "",
      evaluator: (pending as ParsedEvaluation).evaluator ?? "",
      context: (pending as ParsedEvaluation).context,
    });
  }

  return evaluations;
}


/* ==============================
   生平（史實／演義共用）
   ============================== */

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

  const flushBuffer = () => {
    if (bufferLines.length > 0 && entries.length > 0) {
      const text = bufferLines.join("");
      const current = entries[entries.length - 1];

      if (bufferTarget === "difference") {
        current.historicalDifference = text;
      } else {
        current.paragraphs.push(text);
      }
    }

    bufferLines = [];
    bufferTarget = "paragraph";
  };

  for (const rawLine of lines) {
    const titleMatch = rawLine.match(/^\*\*(.+?)\*\*$/);

    if (titleMatch) {
      flushBuffer();

      const [period, title] = titleMatch[1]
        .split("・")
        .map((part) => part.trim());

      entries.push({
        period: period ?? titleMatch[1].trim(),
        title: title ?? "",
        paragraphs: [],
      });

      continue;
    }

    if (rawLine.trim() === "") {
      flushBuffer();
      continue;
    }

    if (entries.length === 0) {
      continue;
    }

    const current = entries[entries.length - 1];

    const noteMatch = rawLine.match(/^>\s*年代備註[：:]\s*(.+)$/);

    if (noteMatch) {
      flushBuffer();
      current.uncertaintyNote = noteMatch[1].trim();
      continue;
    }

    const originalTextMatch = rawLine.match(/^>\s*原文[：:]\s*(.+)$/);

    if (originalTextMatch) {
      flushBuffer();
      current.originalText = originalTextMatch[1].trim();
      continue;
    }

    const differenceMatch = rawLine.match(
      /^與史實的差異[：:]\s*(.+)$/,
    );

    if (differenceMatch) {
      flushBuffer();
      bufferTarget = "difference";
      bufferLines.push(differenceMatch[1].trim());
      continue;
    }

    bufferLines.push(rawLine.trim());
  }

  flushBuffer();

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

  const flushBuffer = () => {
    if (bufferLines.length > 0 && works.length > 0) {
      works[works.length - 1].summaryParagraphs.push(bufferLines.join(""));
    }

    bufferLines = [];
  };

  for (const rawLine of lines) {
    if (rawLine.trim() === "---") {
      continue;
    }

    const titleMatch = rawLine.match(/^\*\*(.+?)\*\*\s*(.*)$/);

    if (titleMatch) {
      flushBuffer();

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
      continue;
    }

    const noteMatch = rawLine.match(/^>\s*整體說明[：:]\s*(.+)$/);

    if (noteMatch) {
      flushBuffer();
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
      current.excerpt = excerptMatch[1].trim();
      continue;
    }

    const originalTextMatch = rawLine.match(/^>\s*原文[：:]\s*(.+)$/);

    if (originalTextMatch) {
      flushBuffer();
      current.originalText = originalTextMatch[1].trim();
      continue;
    }

    bufferLines.push(rawLine.trim());
  }

  flushBuffer();

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