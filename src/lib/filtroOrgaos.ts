import { normalizarTexto } from '@/lib/orgaoUasg';

export interface FiltroOrgaos {
  nome?: string;
  cidade?: string;
  uf?: string;
  uasg?: string;
}

interface OrgaoFiltravel {
  nome_orgao: string;
  uf?: string | null;
  cidade_nome?: string | null;
  compras_net?: string | null;
  compras_mg?: string | null;
}

/**
 * Localiza órgãos na Consulta de Órgãos.
 *
 * Ignora acento e caixa: "vila velha" acha "VILA VELHA/ES" e "piuma" acha
 * "PIÚMA". A busca por cidade também olha o nome do órgão, porque a maioria
 * dos cadastros traz o município no próprio nome ("PREF. MUNIC. DE VILA
 * VELHA/ES") e nem todos têm o código IBGE preenchido.
 */
export function filtrarOrgaos<T extends OrgaoFiltravel>(lista: T[], filtro: FiltroOrgaos): T[] {
  const nome = normalizarTexto(filtro.nome);
  const cidade = normalizarTexto(filtro.cidade);
  const uf = (filtro.uf || '').trim();
  const uasg = (filtro.uasg || '').replace(/\D/g, '');

  if (!nome && !cidade && !uf && !uasg) return lista;

  return lista.filter(o => {
    if (uf && o.uf !== uf) return false;
    if (nome && !normalizarTexto(o.nome_orgao).includes(nome)) return false;

    if (cidade) {
      const naCidade = normalizarTexto(o.cidade_nome).includes(cidade);
      const noNome = normalizarTexto(o.nome_orgao).includes(cidade);
      if (!naCidade && !noNome) return false;
    }

    if (uasg) {
      const net = (o.compras_net || '').replace(/\D/g, '');
      const mg = (o.compras_mg || '').replace(/\D/g, '');
      if (!net.includes(uasg) && !mg.includes(uasg)) return false;
    }

    return true;
  });
}
