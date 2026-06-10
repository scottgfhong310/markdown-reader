const SECTION_MARKERS = [
	["\\*\\*段落角色\\*\\*：", "### 段落角色\n\n> "],
	["\\*\\*字面義\\*\\*", "### 1) 字面義"],
	["\\*\\*義理脈絡\\*\\*", "### 2) 義理脈絡"],
	["\\*\\*修行指向\\*\\*", "### 3) 修行指向"],
	["\\* 段落角色：", "### 段落角色\n\n> "],
	["\\* 字面義", "### 1) 字面義"],
	["\\* 義理脈絡", "### 2) 義理脈絡"],
	["\\* 修行指向", "### 3) 修行指向"],
];

const MERMAID_HEADER = '```mermaid\n--- \nconfig: \n  layout: elk \n--- \n%%{init: { \n  "theme": "dark", \n  "themeVariables": { \n    "primaryColor": "#0f172a", \n    "primaryTextColor": "#f8fafc", \n    "primaryBorderColor": "#38bdf8", \n    "lineColor": "#60a5fa", \n    "secondaryColor": "#1e293b", \n    "tertiaryColor": "#334155", \n    "fontSize": "18px", \n    "fontFamily": "Microsoft JhengHei, PingFang TC, sans-serif" \n  } \n}}%% \n';

const CJK_PUNCT_MAP = { 
	",": "，", 
	".": "。", 
	"?": "？", 
	"!": "！", 
	":": "：", 
	";": "；", 
};

class MdFormater {
	constructor() {}

	formatTagsSection(md = "") {
		return md.replace(
			/(^## Tags\s*\n+)([\s\S]*?)(?=\n## |\n# |$)/m,
			(match, heading, body) => {
				const newBody = body.trim().replace(/、/g, " #");
				return `${heading}#${newBody}\n`;
			}
		);
	}

	normalizeCJKPunctuation(text) {
		return text
			// 半形標點 + 可選空白，後接漢字 → 全形標點
			.replace(/(?<![A-Za-z0-9])([,.?!:;])\s*(?=\p{Script=Han})/gu, (_, p) => CJK_PUNCT_MAP[p])
			// 左括號
			.replace(/\s*\((?=\p{Script=Han})/gu, "（")
			// 右括號
			.replace(/(?<=\p{Script=Han})\)\s*/gu, "）");
	}

	_normalizeLineBreaks(md) {
		return md
			.replace(/\r/g, "\n")
			.replace(/\n\n\n/g, "\n\n")
			.replace(/\n/g, "\n\n")
			.replace(/]\n\n/g, "]<br/>\n")
			.replace(/\n[ \t]*\n(?=[ \t]*\*)/g, "\n")
			.replace(/\n[ \t]*\n(?=\d+\.)/g, "\n")
			.replace(/\n[ \t]*\n(?=[ \t]*>)/g, "<br/>\n")
			.replace("<br/>\n> project:", "\n> \n> project:")
			.replace("<br/>\n> subject:", "\n> \n> subject:");
	}

	_applySectionMarkers(md) {
		let result = md;
		for (const [pattern, replacement] of SECTION_MARKERS) {
			result = result.replace(new RegExp(pattern, "g"), replacement);
		}
		return result.replace(/（段落角色：(.*?)）/g, "### 段落角色\n\n> $1");
	}

	_cleanupBlocks(md) {
		return md
			.replace(/\n\n\n/g, "\n\n")
			.replace(/\|\n\n\|/g, "\n|")
			.replace(/\n<br\/>/g, "\n")
			.replace(/(```)([\s\S]*?)(```)/g,
				(match, start, inner, end) => start + inner.replace(/\n\n/g, "\n") + end)
			.replace(/(> ```)([\s\S]*?)(> ```)/g,
				(match, start, inner, end) => start + inner.replace(/<br\s*\/?>/g, "") + end)
			.replace(/> ```<br\/>/g, "> ```")
			.replace(/<br\/>\n```/g, "\n```")
			.replace(/]<br\/>\n/g, "]\n")
			.replace(/> \* /g, "> - ")
			.replace(/> <br\/>\n/g, "> \n");
	}

	_compactLists(md) {
		return md
			.replace(/\n\n  - /g, "\n  - ")
			.replace(/\n\n\n- #/g, "\n\n#")
			.replace(/\n\n- #/g, " #");
	}

	_toFullWidthPunctuation(md) {
		return md
			.replace(/,/g, "，")
			.replace(/:\n/g, "：\n")
			.replace(/;/g, "；")
			// 純數字之間的冒號保留半形（時間、比例等）
			.replace(/:(?!\s)/g, (m, i, s) =>
				/\d/.test(s[i - 1] || "") && /\d/.test(s[i + 1] || "") ? m : "：");
	}

	_fixTags(md) {
		let f_md = md
			.replace(/\*\*Tag\*\*\n/g, "**Tags**\n")
			.replace(/`(#[^`]+)`/g, "$1")
			.replace("**Tags**\n\n* #", "**Tags**\n\n#");

		console.info("Before fixing tags:\n", f_md);
		
		f_md = f_md.replace(/\n\* #/g, " #");

		console.info("After fixing tags:\n", f_md);
		
		return f_md;
	}

	_revertAsciiContexts(md) {
		return md
			.replace(/([A-Za-z0-9])，/g, "$1,")
			.replace(/([A-Za-z0-9])；/g, "$1; ")
			.replace(/;  /g, "; ")
			.replace(/：\/\//g, "://");
	}

	format(text) {
		if (!text) return "";

		let md = text;
		md = this._normalizeLineBreaks(md);
		md = this._applySectionMarkers(md);
		md = md.replace(/```mermaid/g, MERMAID_HEADER);
		md = this._cleanupBlocks(md);
		md = this._compactLists(md);
		md = this._toFullWidthPunctuation(md);
		md = this.formatTagsSection(md);
		md = this._revertAsciiContexts(md);
		md = this.normalizeCJKPunctuation(md);
		md = this._fixTags(md);

		md = md.replace(/\*\*Tags\*\*\n\n\n- \\#/g, "**Tags**\n\n#")
			.replace(/\n\n- \\#/g, " #")
			.trim();

		console.info(">>> Final formatted markdown:\n", md);

		return md;
	}
}

export { MdFormater };
