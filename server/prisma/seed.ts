import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Criando seed data...');

  // ── Admin padrão ──
  const adminEmail = 'admin@ativa.com';
  const existingAdmin = await prisma.users.findUnique({ where: { email: adminEmail } });

  if (!existingAdmin) {
    const hash = await bcrypt.hash('admin123', 10);
    await prisma.users.create({
      data: {
        email: adminEmail,
        password_hash: hash,
        full_name: 'Administrador',
        role: 'admin',
      },
    });
    console.log(`✅ Admin criado: ${adminEmail} / admin123`);
  } else {
    console.log(`ℹ️  Admin já existe: ${adminEmail}`);
  }

  // ── Menus ──
  const menusData = [
    { nome: 'Licitações', path: null, ordem: 1, children: [
      { nome: 'Consulta', path: '/licitacoes/consulta', ordem: 1 },
      { nome: 'Cadastro', path: '/licitacoes/cadastro', ordem: 2 },
      { nome: 'Tipos', path: '/licitacoes/tipos', ordem: 3 },
      { nome: 'Marcações Pendentes', path: '/licitacoes/marcacoes-pendentes', ordem: 4 },
      { nome: 'Rel. Produtividade', path: '/licitacoes/relatorio-produtividade', ordem: 5 },
    ]},
    { nome: 'Órgãos', path: null, ordem: 2, children: [
      { nome: 'Cadastro', path: '/orgaos/cadastro', ordem: 1 },
      { nome: 'Sem IBGE', path: '/orgaos/sem-ibge', ordem: 2 },
      { nome: 'Agrupamentos', path: '/orgaos/agrupamentos', ordem: 3 },
    ]},
    { nome: 'Empresa', path: null, ordem: 3, children: [
      { nome: 'Atividades', path: '/empresa/atividades', ordem: 1 },
      { nome: 'Caixas Email', path: '/empresa/caixas-email', ordem: 2 },
      { nome: 'Sites', path: '/empresa/sites', ordem: 3 },
      { nome: 'Permissões', path: '/empresa/permissoes', ordem: 4 },
      { nome: 'Clientes', path: '/empresa/clientes', ordem: 5 },
    ]},
  ];

  for (const menu of menusData) {
    const existing = await prisma.menus.findFirst({ where: { nome: menu.nome, parent_id: null } });
    if (!existing) {
      const parent = await prisma.menus.create({
        data: { nome: menu.nome, path: menu.path, ordem: menu.ordem },
      });
      if (menu.children) {
        for (const child of menu.children) {
          await prisma.menus.create({
            data: { nome: child.nome, path: child.path, ordem: child.ordem, parent_id: parent.id },
          });
        }
      }
      console.log(`✅ Menu criado: ${menu.nome} (${menu.children?.length || 0} sub-menus)`);
    } else {
      console.log(`ℹ️  Menu já existe: ${menu.nome}`);
    }
  }

  console.log('\n🎉 Seed finalizado!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
