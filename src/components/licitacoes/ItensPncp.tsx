import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { ExternalLink, Loader2 } from 'lucide-react';

export interface IdCompraPncp {
  cnpj: string;
  ano: string;
  sequencial: string;
}

/**
 * Identifica a compra no PNCP a partir do que a licitação tiver:
 * - num_licitacao das importadas: "27165646000185-1-000061/2026"
 * - texto do cadastro manual: "Id Contratação PNCP: 28151363000147-1-000011/2026"
 * - link do processo: ".../app/editais/27165646000185/2026/61"
 */
export function extrairIdCompraPncp(
  ...fontes: (string | null | undefined)[]
): IdCompraPncp | null {
  for (const fonte of fontes) {
    if (!fonte) continue;
    const controle = fonte.match(/(\d{14})-\d+-(\d+)\/(\d{4})/);
    if (controle) return { cnpj: controle[1], sequencial: controle[2], ano: controle[3] };
    const link = fonte.match(/editais\/(\d{14})\/(\d{4})\/(\d+)/);
    if (link) return { cnpj: link[1], ano: link[2], sequencial: link[3] };
  }
  return null;
}

interface ItemPncp {
  numeroItem: number;
  descricao: string;
  quantidade: number | null;
  unidadeMedida: string | null;
  valorUnitarioEstimado: number | null;
  orcamentoSigiloso: boolean;
}

interface RespostaItens {
  pagina: number;
  tamanhoPagina: number;
  total: number;
  link: string;
  itens: ItemPncp[];
}

const TAMANHO_PAGINA = 10;

const formatarQtd = (v: number | null) =>
  v == null ? '-' : v.toLocaleString('pt-BR', { maximumFractionDigits: 4 });

const formatarValor = (v: number | null) =>
  v == null ? '-' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 4 });

/** Espelho dos itens do edital, lido do PNCP (igual ao "Exibir Licitação" do sistema antigo). */
export function ItensPncp({ id }: { id: IdCompraPncp }) {
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState<RespostaItens | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Outra licitação aberta → volta para a página 1
  useEffect(() => { setPagina(1); }, [id.cnpj, id.ano, id.sequencial]);

  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    setErro(null);
    api.get<RespostaItens>('/api/pncp/itens', {
      cnpj: id.cnpj,
      ano: id.ano,
      sequencial: id.sequencial,
      pagina: String(pagina),
      tamanhoPagina: String(TAMANHO_PAGINA),
    })
      .then(r => { if (!cancelado) setDados(r); })
      .catch((e: any) => { if (!cancelado) setErro(e?.message || 'Erro ao consultar o PNCP.'); })
      .finally(() => { if (!cancelado) setCarregando(false); });
    return () => { cancelado = true; };
  }, [id.cnpj, id.ano, id.sequencial, pagina]);

  const totalPaginas = dados ? Math.max(1, Math.ceil(dados.total / TAMANHO_PAGINA)) : 1;
  const linkPncp = dados?.link || `https://pncp.gov.br/app/editais/${id.cnpj}/${id.ano}/${Number(id.sequencial)}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          disabled={pagina <= 1 || carregando}
          onClick={() => setPagina(p => p - 1)}
        >
          « Página anterior
        </Button>
        <span className="text-sm text-[#262626] px-2">
          Página {pagina}{dados ? ` de ${totalPaginas}` : ''}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={pagina >= totalPaginas || carregando}
          onClick={() => setPagina(p => p + 1)}
        >
          Próxima página »
        </Button>
        {dados && (
          <span className="text-xs text-muted-foreground ml-2">
            {dados.total} {dados.total === 1 ? 'item' : 'itens'}
          </span>
        )}
        <a
          href={linkPncp}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex items-center gap-1 text-sm text-[#02572E] hover:underline"
        >
          <ExternalLink className="w-4 h-4" />
          Abrir no PNCP
        </a>
      </div>

      {carregando ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground text-sm gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Consultando itens no PNCP...
        </div>
      ) : erro ? (
        <p className="text-sm text-red-600 py-6 text-center">{erro}</p>
      ) : !dados || dados.itens.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">O PNCP não retornou itens para esta compra.</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 pr-3 font-semibold w-[70px]">Item</th>
              <th className="py-2 pr-3 font-semibold">Descrição dos Itens da Compra</th>
              <th className="py-2 pr-3 font-semibold text-right w-[90px]">Qtd</th>
              <th className="py-2 pr-3 font-semibold w-[130px]">Unidade</th>
              <th className="py-2 font-semibold text-right w-[130px]">V.Unit.Est.</th>
            </tr>
          </thead>
          <tbody>
            {dados.itens.map(item => (
              <tr key={item.numeroItem} className="border-b align-top">
                <td className="py-2 pr-3">{item.numeroItem}</td>
                <td className="py-2 pr-3 whitespace-pre-line">{item.descricao}</td>
                <td className="py-2 pr-3 text-right">{formatarQtd(item.quantidade)}</td>
                <td className="py-2 pr-3">{item.unidadeMedida || '-'}</td>
                <td className="py-2 text-right">
                  {item.orcamentoSigiloso ? (
                    <span className="inline-block px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs">Sigiloso</span>
                  ) : formatarValor(item.valorUnitarioEstimado)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
