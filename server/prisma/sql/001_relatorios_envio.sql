-- Envio de relatórios de licitações ao cliente.
--
-- Um relatório reúne várias licitações sob um único número (o "N.Relatório")
-- e uma única data de envio, para um cliente. É o que a tela
-- "Licitações Enviadas > Por Cliente" consulta.
--
-- Script puramente aditivo e idempotente: só cria o que ainda não existe,
-- não altera nem remove nada. Pode ser reexecutado com segurança.

CREATE TABLE IF NOT EXISTS relatorios_envio (
  id            uuid        NOT NULL,
  num_relatorio integer     NOT NULL,
  cliente_id    uuid        NOT NULL,
  dt_envio      timestamptz NOT NULL,
  enviado_por   uuid,
  observacoes   text,
  created_at    timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT relatorios_envio_pkey PRIMARY KEY (id),
  CONSTRAINT relatorios_envio_cliente_id_fkey
    FOREIGN KEY (cliente_id) REFERENCES clientes (id),
  CONSTRAINT relatorios_envio_enviado_por_fkey
    FOREIGN KEY (enviado_por) REFERENCES users (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS relatorios_envio_num_relatorio_key
  ON relatorios_envio (num_relatorio);
CREATE INDEX IF NOT EXISTS relatorios_envio_cliente_id_idx
  ON relatorios_envio (cliente_id);
CREATE INDEX IF NOT EXISTS relatorios_envio_dt_envio_idx
  ON relatorios_envio (dt_envio);

CREATE TABLE IF NOT EXISTS relatorios_envio_itens (
  id             uuid        NOT NULL,
  relatorio_id   uuid        NOT NULL,
  contratacao_id uuid        NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT relatorios_envio_itens_pkey PRIMARY KEY (id),
  CONSTRAINT relatorios_envio_itens_relatorio_id_fkey
    FOREIGN KEY (relatorio_id) REFERENCES relatorios_envio (id) ON DELETE CASCADE,
  CONSTRAINT relatorios_envio_itens_contratacao_id_fkey
    FOREIGN KEY (contratacao_id) REFERENCES contratacoes (id) ON DELETE CASCADE
);

-- Uma licitação não pode aparecer duas vezes no mesmo relatório.
CREATE UNIQUE INDEX IF NOT EXISTS relatorios_envio_itens_relatorio_contratacao_key
  ON relatorios_envio_itens (relatorio_id, contratacao_id);
CREATE INDEX IF NOT EXISTS relatorios_envio_itens_contratacao_id_idx
  ON relatorios_envio_itens (contratacao_id);
