import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronRight, ChevronDown } from 'lucide-react';

interface CidadePopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (uf: string, cidadeId: string, cidadeNome: string) => void;
}

interface Estado {
  sigla: string;
  nome: string;
  regiao: string;
}

interface Municipio {
  id: number;
  nome: string;
}

const ESTADOS: Estado[] = [
  { sigla: 'AC', nome: 'Acre', regiao: 'Norte' },
  { sigla: 'AL', nome: 'Alagoas', regiao: 'Nordeste' },
  { sigla: 'AP', nome: 'Amapá', regiao: 'Norte' },
  { sigla: 'AM', nome: 'Amazonas', regiao: 'Norte' },
  { sigla: 'BA', nome: 'Bahia', regiao: 'Nordeste' },
  { sigla: 'CE', nome: 'Ceará', regiao: 'Nordeste' },
  { sigla: 'DF', nome: 'Distrito Federal', regiao: 'Centro-Oeste' },
  { sigla: 'ES', nome: 'Espírito Santo', regiao: 'Sudeste' },
  { sigla: 'GO', nome: 'Goiás', regiao: 'Centro-Oeste' },
  { sigla: 'MA', nome: 'Maranhão', regiao: 'Nordeste' },
  { sigla: 'MT', nome: 'Mato Grosso', regiao: 'Centro-Oeste' },
  { sigla: 'MS', nome: 'Mato Grosso do Sul', regiao: 'Centro-Oeste' },
  { sigla: 'MG', nome: 'Minas Gerais', regiao: 'Sudeste' },
  { sigla: 'PA', nome: 'Pará', regiao: 'Norte' },
  { sigla: 'PB', nome: 'Paraíba', regiao: 'Nordeste' },
  { sigla: 'PR', nome: 'Paraná', regiao: 'Sul' },
  { sigla: 'PE', nome: 'Pernambuco', regiao: 'Nordeste' },
  { sigla: 'PI', nome: 'Piauí', regiao: 'Nordeste' },
  { sigla: 'RJ', nome: 'Rio de Janeiro', regiao: 'Sudeste' },
  { sigla: 'RN', nome: 'Rio Grande do Norte', regiao: 'Nordeste' },
  { sigla: 'RS', nome: 'Rio Grande do Sul', regiao: 'Sul' },
  { sigla: 'RO', nome: 'Rondônia', regiao: 'Norte' },
  { sigla: 'RR', nome: 'Roraima', regiao: 'Norte' },
  { sigla: 'SC', nome: 'Santa Catarina', regiao: 'Sul' },
  { sigla: 'SP', nome: 'São Paulo', regiao: 'Sudeste' },
  { sigla: 'SE', nome: 'Sergipe', regiao: 'Nordeste' },
  { sigla: 'TO', nome: 'Tocantins', regiao: 'Norte' },
];

export function CidadePopup({ open, onOpenChange, onSelect }: CidadePopupProps) {
  const [search, setSearch] = useState('');
  const [expandedEstados, setExpandedEstados] = useState<string[]>([]);
  const [municipios, setMunicipios] = useState<Record<string, Municipio[]>>({});
  const [loadingEstado, setLoadingEstado] = useState<string | null>(null);

  // Reset ao fechar
  useEffect(() => {
    if (!open) {
      setSearch('');
    }
  }, [open]);

  const loadMunicipios = async (uf: string) => {
    if (municipios[uf]) return; // Já carregado
    
    setLoadingEstado(uf);
    try {
      const response = await fetch(
        `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`
      );
      const data = await response.json();
      setMunicipios(prev => ({ ...prev, [uf]: data }));
    } catch (error) {
      console.error('Erro ao carregar municípios:', error);
    }
    setLoadingEstado(null);
  };

  const toggleEstado = async (uf: string) => {
    if (expandedEstados.includes(uf)) {
      setExpandedEstados(prev => prev.filter(e => e !== uf));
    } else {
      setExpandedEstados(prev => [...prev, uf]);
      await loadMunicipios(uf);
    }
  };

  const handleSelectMunicipio = (uf: string, municipio: Municipio) => {
    onSelect(uf, String(municipio.id), municipio.nome);
    onOpenChange(false);
  };

  // Filtrar estados e municípios pela busca
  const filteredEstados = ESTADOS.filter(estado => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    
    // Verifica se o estado corresponde
    if (estado.nome.toLowerCase().includes(searchLower) || 
        estado.sigla.toLowerCase().includes(searchLower)) {
      return true;
    }
    
    // Verifica se algum município corresponde
    const estadoMunicipios = municipios[estado.sigla] || [];
    return estadoMunicipios.some(m => m.nome.toLowerCase().includes(searchLower));
  });

  const getFilteredMunicipios = (uf: string): Municipio[] => {
    const estadoMunicipios = municipios[uf] || [];
    if (!search) return estadoMunicipios;
    
    const searchLower = search.toLowerCase();
    return estadoMunicipios.filter(m => m.nome.toLowerCase().includes(searchLower));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0 gap-0 max-h-[80vh]">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="text-xl font-semibold text-[#262626]">
            Selecionar Cidade
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-4">
          <Input
            placeholder="Digite o nome"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 bg-white"
          />
        </div>

        <ScrollArea className="h-[400px] px-6 pb-6">
          <div className="space-y-0.5">
            {filteredEstados.map(estado => {
              const isExpanded = expandedEstados.includes(estado.sigla);
              const isLoading = loadingEstado === estado.sigla;
              const estadoMunicipios = getFilteredMunicipios(estado.sigla);
              
              return (
                <div key={estado.sigla}>
                  {/* Estado */}
                  <div
                    className="flex items-center gap-2 py-1.5 pr-2 hover:bg-muted rounded cursor-pointer select-none"
                    onClick={() => toggleEstado(estado.sigla)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-gray-500 shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-500 shrink-0" />
                    )}
                    <div className="w-3 h-3 bg-green-500 rounded-sm shrink-0" />
                    <span className="text-sm text-[#262626]">
                      {estado.sigla}-{estado.nome}
                    </span>
                    <span className="text-xs text-gray-500 ml-auto">
                      Região: {estado.regiao}
                    </span>
                  </div>
                  
                  {/* Municípios */}
                  {isExpanded && (
                    <div className="ml-[30px] border-l border-gray-200 pl-2">
                      {isLoading ? (
                        <div className="py-2 px-2 text-sm text-gray-500">
                          Carregando municípios...
                        </div>
                      ) : estadoMunicipios.length === 0 ? (
                        <div className="py-2 px-2 text-sm text-gray-500">
                          Nenhum município encontrado
                        </div>
                      ) : (
                        estadoMunicipios.map(municipio => (
                          <div
                            key={municipio.id}
                            className="flex items-center gap-2 py-1 px-2 hover:bg-muted rounded cursor-pointer select-none"
                            onDoubleClick={() => handleSelectMunicipio(estado.sigla, municipio)}
                          >
                            <div className="w-3 h-3 bg-green-500 rounded-sm shrink-0" />
                            <span className="text-sm text-[#262626]">
                              {municipio.nome}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

