import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  Users,
  Plus,
  Search,
  Info,
  AlertCircle,
  UserX,
  UsersRound
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
];

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

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
    <aside className="w-[230px] h-screen bg-white flex flex-col fixed left-0 top-0 z-50 border-r border-gray-200">
      {/* Logo */}
      <div className="flex items-center justify-center py-6 px-4">
        <img 
          src="/logo.avif" 
          alt="Ativa Licitações" 
          className="h-16 w-auto object-contain"
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto">
        {menuItems.map((item) => {
          const isOpen = openMenus.includes(item.label);
          const hasActiveChild = isParentActive(item.children);
          
          return (
            <div key={item.label} className="mb-0">
              {/* Menu Header */}
              <button
                onClick={() => item.children.length > 0 ? toggleMenu(item.label) : null}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-3 transition-colors",
                  hasActiveChild
                    ? "bg-[#02572E] text-white"
                    : "bg-white text-gray-700 hover:bg-[#CCDDD5]"
                )}
              >
                <div className="flex items-center gap-3">
                  <item.icon className={cn(
                    "w-5 h-5",
                    hasActiveChild ? "text-white" : "text-[#02572E]"
                  )} />
                  <span className="font-medium text-[15px]">{item.label}</span>
                </div>
                {item.children.length > 0 && (
                  isOpen 
                    ? <ChevronUp className="w-5 h-5" /> 
                    : <ChevronDown className="w-5 h-5" />
                )}
              </button>
              
              {/* Submenu Items */}
              {item.children.length > 0 && isOpen && (
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
  );
}
