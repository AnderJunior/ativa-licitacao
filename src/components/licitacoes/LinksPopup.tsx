import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Plus, ExternalLink, Trash2 } from 'lucide-react';

interface LinksPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  linkProcesso: string | null;
  links: string[];
  onSave: (linkProcesso: string | null, links: string[]) => void;
}

export function LinksPopup({
  open,
  onOpenChange,
  linkProcesso,
  links,
  onSave,
}: LinksPopupProps) {
  const [newLink, setNewLink] = useState('');
  const [localLinks, setLocalLinks] = useState<string[]>(links || []);

  // Sincroniza estado local quando props mudam
  useEffect(() => {
    setLocalLinks(links || []);
  }, [links, open]);

  const handleAddLink = () => {
    if (newLink.trim()) {
      // Valida se é uma URL válida ou adiciona protocolo
      let urlToAdd = newLink.trim();
      if (!urlToAdd.startsWith('http://') && !urlToAdd.startsWith('https://')) {
        urlToAdd = 'https://' + urlToAdd;
      }
      
      // Verifica se o link já existe
      if (!localLinks.includes(urlToAdd)) {
        setLocalLinks([...localLinks, urlToAdd]);
        setNewLink('');
      }
    }
  };

  const handleRemoveLink = (index: number) => {
    setLocalLinks(localLinks.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddLink();
    }
  };

  const handleSave = () => {
    // Se linkProcesso estava na lista original de links e foi removido, limpa o linkProcesso
    // Caso contrário, mantém o linkProcesso como está
    const estavaNaListaOriginal = linkProcesso && (links || []).includes(linkProcesso);
    const aindaEstaNaLista = linkProcesso && localLinks.includes(linkProcesso);
    
    let linkProcessoAtual: string | null = null;
    if (linkProcesso && linkProcesso.trim() !== '') {
      // Se estava na lista original e foi removido, limpa
      if (estavaNaListaOriginal && !aindaEstaNaLista) {
        linkProcessoAtual = null;
      } else {
        // Caso contrário, mantém
        linkProcessoAtual = linkProcesso;
      }
    }
    
    onSave(linkProcessoAtual, localLinks);
    onOpenChange(false);
  };

  const handleCancel = () => {
    // Reseta para valores originais
    setLocalLinks(links || []);
    setNewLink('');
    onOpenChange(false);
  };

  // Todos os links para exibir - inclui link_processo no início se existir e não estiver duplicado
  const allLinksForDisplay = (() => {
    const linksList = [...localLinks];
    // Se link_processo existir e não estiver na lista, adiciona no início
    if (linkProcesso && linkProcesso.trim() !== '' && !linksList.includes(linkProcesso)) {
      linksList.unshift(linkProcesso);
    }
    return linksList;
  })();
  
  const allLinks = allLinksForDisplay;
  
  // Função auxiliar para verificar se um link é o link_processo
  const isLinkProcesso = (url: string) => {
    return linkProcesso && url === linkProcesso;
  };
  
  // Função auxiliar para obter o índice na lista localLinks
  const getLocalLinksIndex = (url: string): number => {
    // Se for o link_processo e não estiver na lista localLinks, retorna -1
    if (isLinkProcesso(url) && !localLinks.includes(url)) {
      return -1;
    }
    return localLinks.indexOf(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="text-xl font-semibold text-[#262626]">
            Licitações Links
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-4 space-y-4 overflow-hidden">
          {/* Campo para adicionar novos links */}
          <div className="space-y-2">
            <Label className="text-sm text-[#262626]">Adicionar Links</Label>
            <div className="flex gap-2">
              <Input
                placeholder="https://exemplo.com.br"
                value={newLink}
                onChange={(e) => setNewLink(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-white"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleAddLink}
                className="shrink-0"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Separador visual */}
          <div className="border-t border-gray-200" />

          {/* Lista de links cadastrados */}
          <div className="space-y-2">
            <Label className="text-sm text-[#262626]">
              Links Cadastrados ({allLinks.length})
            </Label>
            
            <ScrollArea className="h-[200px] pr-4 w-full">
              {allLinks.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nenhum link cadastrado ainda.
                </p>
              ) : (
                <div className="space-y-2 w-full">
                  {allLinks.map((url, displayIndex) => {
                    const isLinkProcessoUrl = isLinkProcesso(url);
                    const localLinksIndex = getLocalLinksIndex(url);
                    
                    return (
                      <div
                        key={url}
                        className="flex items-start gap-2 p-2 rounded-lg bg-gray-50 hover:bg-gray-100 group w-full max-w-full overflow-hidden"
                      >
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:text-blue-800 hover:underline break-all block"
                            title={url}
                          >
                            {url}
                          </a>
                        </div>
                        {isLinkProcessoUrl && (
                          <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full whitespace-nowrap shrink-0 self-start">
                            Link Original
                          </span>
                        )}
                        
                        <div className="flex items-center gap-1 shrink-0 self-start">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-gray-500 hover:text-blue-600 shrink-0"
                            onClick={() => window.open(url, '_blank')}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                          
                          {localLinksIndex !== -1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-gray-500 hover:text-red-600 shrink-0"
                              onClick={() => {
                                if (localLinksIndex >= 0 && localLinksIndex < localLinks.length) {
                                  handleRemoveLink(localLinksIndex);
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        {/* Footer com botões */}
        <div className="flex items-center justify-between p-6 pt-4 border-t border-gray-200">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            className="bg-gray-100 hover:bg-gray-200 text-[#262626]"
          >
            <X className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
          
          <Button
            type="button"
            onClick={handleSave}
            className="bg-[#5046E5] hover:bg-[#4338CA] text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Cadastrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

