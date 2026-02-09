import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const raw = fs.readFileSync(path.join(__dirname, 'palavras_chaves_arvode_de_atividades.md'), 'utf8');
const lines = raw.split(/\r?\n/);

const isActivityLine = (line) => /^\s{10,}(.+)$/.test(line) && line.trim().length > 0;
const getActivityName = (line) => line.replace(/^\s+/, '').trim();
const isHeaderLine = (line) => {
  const t = line.trim();
  return t === 'Ramos de Atividades' || t.startsWith('Impresso em:') || /^Página\s+\d+$/i.test(t) || t === '';
};
const stopLine = (line) => line.startsWith('# ') || line.startsWith('INSERT ');
const hasNoLeadingSpaces = (line) => line.length > 0 && !/^\s/.test(line);

const activityKeywords = new Map();
let currentActivity = null;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (stopLine(line)) break;

  if (isActivityLine(line)) {
    let name = getActivityName(line);
    // Continuação do nome na próxima linha quando o nome termina com " E" ou " DE"
    const isIncompleteName = name.endsWith(' E') || name.endsWith(' DE');
    if (isIncompleteName && i + 1 < lines.length && hasNoLeadingSpaces(lines[i + 1]) && !isHeaderLine(lines[i + 1])) {
      const next = lines[i + 1].trim();
      if (next) {
        name = (name + ' ' + next).trim();
        i += 1;
      }
    }
    currentActivity = name;
    if (!activityKeywords.has(currentActivity)) {
      activityKeywords.set(currentActivity, []);
    }
    continue;
  }

  if (currentActivity && !isHeaderLine(line)) {
    const words = line.trim().split(/\s+/).filter(Boolean);
    activityKeywords.get(currentActivity).push(...words);
  }
}

function escapeSql(str) {
  return str.replace(/'/g, "''");
}

const updates = [];
for (const [nome, keywords] of activityKeywords) {
  if (keywords.length === 0) continue;
  const unique = [...new Set(keywords)];
  const arrLiteral = unique.map((k) => `'${escapeSql(k)}'`).join(', ');
  const nomeEscaped = escapeSql(nome);
  updates.push(
    `UPDATE public.ramos_de_atividade SET palavras_chaves = ARRAY[${arrLiteral}]::text[] WHERE LOWER(TRIM(nome)) = LOWER(TRIM('${nomeEscaped}'));`
  );
}

const sql = `-- Atualização de palavras_chaves a partir de docs/palavras_chaves_arvode_de_atividades.md
-- Gerado automaticamente. Execute no SQL Editor do Supabase.

${updates.join('\n')}
`;

const outPath = path.join(__dirname, 'update_palavras_chaves_ramos.sql');
fs.writeFileSync(outPath, sql, 'utf8');
console.log(`Gerado: ${outPath} (${updates.length} UPDATEs)`);
