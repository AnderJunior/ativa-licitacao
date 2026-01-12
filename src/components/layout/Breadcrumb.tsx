import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

const routeNames: Record<string, string> = {
  'licitacoes': 'Licitação',
  'cadastro': 'Cadastro',
  'consulta': 'Consulta',
  'tipos': 'Tipos',
  'marcacoes-pendentes': 'Marcações Pendentes',
  'orgaos': 'Órgãos',
  'sem-ibge': 'Sem IBGE',
  'agrupamentos': 'Agrupamentos',
};

export function Breadcrumb() {
  const location = useLocation();
  const pathSegments = location.pathname.split('/').filter(Boolean);

  const breadcrumbs = pathSegments.map((segment, index) => {
    const path = '/' + pathSegments.slice(0, index + 1).join('/');
    const name = routeNames[segment] || segment;
    return { name, path };
  });

  // Sempre começar com "Ativa Licitações"
  const allBreadcrumbs = [
    { name: 'Ativa Licitações', path: '/' },
    ...breadcrumbs
  ];

  return (
    <nav className="flex items-center gap-1.5 text-sm">
      {/* Ícone de casa verde */}
      <Link to="/" className="text-primary hover:text-primary/80 flex items-center">
        <Home className="w-4 h-4" strokeWidth={2.5} />
      </Link>
      
      {allBreadcrumbs.map((crumb, index) => (
        <div key={crumb.path} className="flex items-center gap-1.5">
          <ChevronRight className="w-3 h-3 text-gray-600" />
          {index === allBreadcrumbs.length - 1 ? (
            <span className="text-primary font-normal">{crumb.name}</span>
          ) : index === 0 ? (
            <Link to={crumb.path} className="text-gray-700 hover:text-gray-900 transition-colors font-normal">
              {crumb.name}
            </Link>
          ) : (
            <Link to={crumb.path} className="text-primary hover:text-primary/80 transition-colors font-normal">
              {crumb.name}
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
}