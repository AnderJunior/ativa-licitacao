import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  ChevronDown, 
  ChevronUp, 
  ChevronLeft,
  ChevronRight,
  FileText, 
  Users,
  Plus,
  Search,
  Info,
  AlertCircle,
  UserX,
  UsersRound,
  Building,
  Globe,
  ListTree
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/contexts/SidebarContext';

interface SubMenuItem {
  label: string;
  path: string;
  icon: React.ElementType;
}

interface MenuItem {
  label: string;
  icon: React.ElementType;
  children: SubMenuItem[];
}

const menuItems: MenuItem[] = [
  {
    label: 'Licitação',
    icon: FileText,
    children: [
      { label: 'Cadastro', path: '/licitacoes/cadastro', icon: Plus },
      { label: 'Consulta', path: '/licitacoes/consulta', icon: Search },
      { label: 'Tipos de Licitação', path: '/licitacoes/tipos', icon: Info },
      { label: 'Marcação Pendente', path: '/licitacoes/marcacoes-pendentes', icon: AlertCircle },
    ],
  },
  {
    label: 'Orgãos',
    icon: Users,
    children: [
      { label: 'Cadastro', path: '/orgaos/cadastro', icon: Plus },
      { label: 'Sem IBGE', path: '/orgaos/sem-ibge', icon: UserX },
      { label: 'Agrupamentos', path: '/orgaos/agrupamentos', icon: UsersRound },
    ],
  },
  {
    label: 'Empresa',
    icon: Building,
    children: [
      { label: 'Sites', path: '/empresa/sites', icon: Globe },
      { label: 'Atividades', path: '/empresa/atividades', icon: ListTree },
    ],
  },
];

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isMinimized, toggleSidebar } = useSidebar();

  // Determine which menus should be open based on current path
  const getInitialOpenMenus = () => {
    const openMenus: string[] = [];
    menuItems.forEach(item => {
      if (item.children.some(child => location.pathname.startsWith(child.path.split('?')[0]))) {
        openMenus.push(item.label);
      }
    });
    return openMenus;
  };

  const [openMenus, setOpenMenus] = useState<string[]>(getInitialOpenMenus);

  // Update open menus when location changes
  useEffect(() => {
    const newOpenMenus: string[] = [];
    menuItems.forEach(item => {
      if (item.children.some(child => location.pathname.startsWith(child.path.split('?')[0]))) {
        newOpenMenus.push(item.label);
      }
    });
    setOpenMenus(newOpenMenus);
  }, [location.pathname]);

  const toggleMenu = (label: string) => {
    setOpenMenus(prev => 
      prev.includes(label) 
        ? prev.filter(m => m !== label) 
        : [...prev, label]
    );
  };

  const isActive = (path: string) => location.pathname === path;
  const isParentActive = (children: SubMenuItem[]) => 
    children.some(child => location.pathname.startsWith(child.path.split('?')[0]));

  return (
    <>
      <aside className={cn(
        "h-screen bg-white flex flex-col fixed left-0 top-0 z-50 border-r border-gray-200 transition-all duration-300",
        isMinimized ? "w-[60px]" : "w-[230px]"
      )}>
        {/* Logo */}
        <div className={cn(
          "flex items-center justify-center py-6 px-4 transition-all",
          isMinimized && "px-2 py-4"
        )}>
          <img 
            src="/logo.avif" 
            alt="Ativa Licitações" 
            className={cn(
              "w-auto object-contain transition-all",
              isMinimized ? "h-10" : "h-16"
            )}
          />
        </div>

        {/* Botão de Toggle - apenas quando expandido */}
        {!isMinimized && (
          <div className="absolute top-4 right-0 transform translate-x-1/2">
            <button
              onClick={toggleSidebar}
              className="bg-white border border-gray-200 rounded-full p-1.5 shadow-md hover:bg-gray-50 transition-colors z-10"
              aria-label="Minimizar sidebar"
            >
              <ChevronLeft className="w-4 h-4 text-gray-700" />
            </button>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isOpen = openMenus.includes(item.label);
            const hasActiveChild = isParentActive(item.children);
            
            return (
              <div key={item.label} className="mb-0">
                {/* Menu Header */}
                <button
                  onClick={() => item.children.length > 0 && !isMinimized ? toggleMenu(item.label) : null}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3 transition-colors",
                    isMinimized && "justify-center px-2",
                    hasActiveChild
                      ? "bg-[#02572E] text-white"
                      : "bg-white text-gray-700 hover:bg-[#CCDDD5]"
                  )}
                  title={isMinimized ? item.label : undefined}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className={cn(
                      "w-5 h-5 flex-shrink-0",
                      hasActiveChild ? "text-white" : "text-[#02572E]"
                    )} />
                    {!isMinimized && (
                      <span className="font-medium text-[15px]">{item.label}</span>
                    )}
                  </div>
                  {!isMinimized && item.children.length > 0 && (
                    isOpen 
                      ? <ChevronUp className="w-5 h-5" /> 
                      : <ChevronDown className="w-5 h-5" />
                  )}
                </button>
                
                {/* Submenu Items */}
                {item.children.length > 0 && isOpen && !isMinimized && (
                  <div className="bg-white ml-7 border-l border-gray-300">
                    {item.children.map((child) => (
                      <button
                        key={child.path}
                        onClick={() => navigate(child.path)}
                        className={cn(
                          "w-full flex items-center gap-3 pl-5 pr-4 py-2.5 transition-colors text-[14px]",
                          isActive(child.path) 
                            ? "bg-[#E5EEEA] text-[#02572E] font-medium"
                            : "text-gray-600 hover:bg-[#E5EEEA]"
                        )}
                      >
                        <child.icon className={cn(
                          "w-4 h-4",
                          isActive(child.path) ? "text-[#02572E]" : "text-gray-500"
                        )} />
                        <span>{child.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>
      
      {/* Botão flutuante quando minimizado */}
      {isMinimized && (
        <button
          onClick={toggleSidebar}
          className="fixed left-[60px] top-4 bg-white border border-gray-200 rounded-r-lg p-2 shadow-md hover:bg-gray-50 transition-colors z-50"
          aria-label="Expandir sidebar"
        >
          <ChevronRight className="w-5 h-5 text-gray-700" />
        </button>
      )}
    </>
  );
}
