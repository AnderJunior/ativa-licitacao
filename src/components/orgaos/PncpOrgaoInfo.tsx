import { Loader2 } from 'lucide-react';

export interface PncpUnidade {
  un_cod: string | null;
  unidade: string | null;
  uf: string | null;
  municipio: string | null;
}

export interface PncpOrgaoDados {
  associado: boolean;
  cnpj: string | null;
  esfera?: string | null;
  poder?: string | null;
  orgao_pncp?: string | null;
  unidades: PncpUnidade[];
}

/** O PNCP envia o poder como código de uma letra. */
const PODER_POR_CODIGO: Record<string, string> = {
  E: 'Executivo',
  L: 'Legislativo',
  J: 'Judiciário',
};

const descreverPoder = (poder: string | null | undefined): string => {
  if (!poder) return '-';
  return PODER_POR_CODIGO[poder.trim().toUpperCase()] || poder;
};

const formatarCnpj = (cnpj: string | null | undefined): string => {
  const d = (cnpj || '').replace(/\D/g, '');
  if (d.length !== 14) return cnpj || '-';
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
};

interface Props {
  dados: PncpOrgaoDados | null;
  carregando?: boolean;
  className?: string;
}

/**
 * Bloco de informações do PNCP do órgão, no mesmo formato do sistema antigo:
 * CNPJ / Esfera / Poder, nome do órgão no PNCP e a lista de unidades
 * compradoras (código - nome, UF-município).
 */
export function PncpOrgaoInfo({ dados, carregando, className }: Props) {
  const base = 'rounded-md border border-input bg-white p-2 text-[12px] leading-relaxed overflow-auto';

  if (carregando) {
    return (
      <div className={`${base} flex items-center justify-center ${className || ''}`}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!dados?.associado) {
    return (
      <div className={`${base} ${className || ''}`}>
        <span className="text-muted-foreground">
          Órgão não associado a uma unidade do PNCP. Associe em Licitações &gt; Consulta &gt; Unidades.
        </span>
      </div>
    );
  }

  return (
    <div className={`${base} text-[#262626] ${className || ''}`}>
      <div className="flex flex-wrap gap-x-4">
        <span><strong>CNPJ:</strong> {formatarCnpj(dados.cnpj)}</span>
        <span><strong>Esfera:</strong> {dados.esfera || '-'}</span>
        <span><strong>Poder:</strong> {descreverPoder(dados.poder)}</span>
      </div>
      <div className="mt-0.5">
        <strong>Órgão:</strong> {dados.orgao_pncp || '-'}
      </div>

      {dados.unidades.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {dados.unidades.map((u, i) => (
            <div key={`${u.un_cod}-${i}`}>
              <div>{[u.un_cod, u.unidade].filter(Boolean).join(' - ') || '-'}</div>
              {(u.uf || u.municipio) && (
                <div className="text-muted-foreground">
                  {[u.uf, u.municipio].filter(Boolean).join('-')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {dados.unidades.length === 0 && (
        <div className="mt-2 text-muted-foreground">Nenhuma unidade compradora encontrada para este CNPJ.</div>
      )}
    </div>
  );
}
