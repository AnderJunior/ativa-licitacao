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
    onSave(linkProcesso, localLinks);
    onOpenChange(false);
  };

  const handleCancel = () => {
    // Reseta para valores originais
    setLocalLinks(links || []);
    setNewLink('');
    onOpenChange(false);
  };

  // Todos os links para exibir
  const allLinks = localLinks;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0 gap-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="text-xl font-semibold text-[#262626]">
            Licitações Links
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-4 space-y-4">
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
            
            <ScrollArea className="h-[200px] pr-4">
              {allLinks.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nenhum link cadastrado ainda.
                </p>
              ) : (
                <div className="space-y-2">
                  {allLinks.map((url, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 hover:bg-gray-100 group"
                    >
                      <div className="flex-1 min-w-0">
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-800 hover:underline truncate block"
                        >
                          {url}
                        </a>
                      </div>
                      
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-gray-500 hover:text-blue-600"
                          onClick={() => window.open(url, '_blank')}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                        
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-gray-500 hover:text-red-600"
                          onClick={() => handleRemoveLink(index)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
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

