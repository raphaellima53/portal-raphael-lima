'use client';

import { PlusIcon } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { PageHead } from '@/components/ds';
import { Escolha } from '@/components/escolha';
import { usePaginacao } from '@/components/paginacao';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Table, TBody, Td, THead, Th, Tr } from '@/components/ui/table';
import { type Perfis, type Sessoes, useAcaoCfg, useCfg } from '@/lib/config';
import { baixaCsv } from '@/lib/relatorios';
import { AvisoMsg, ErroQ, type Msg, Painel, Vazio } from './comum';
import { Gate } from './usuarios';

const Acao = ({ v }: { v: number | null }) =>
  v == null ? (
    <span className="text-apagado-2">
      —<span className="sr-only">não se aplica</span>
    </span>
  ) : v ? (
    <span className="font-bold text-verde">
      ✓<span className="sr-only">sim</span>
    </span>
  ) : (
    <span className="font-bold text-vermelho">
      ✕<span className="sr-only">não</span>
    </span>
  );

/** tabela larga paginada dentro de um painel */
function TabelaPainel({
  titulo,
  sub,
  cab,
  linhas,
}: {
  titulo: string;
  sub?: string;
  cab: { t: string; centro?: boolean }[];
  linhas: React.ReactNode[][];
}) {
  const { fatia, rodape } = usePaginacao(linhas);
  return (
    <Painel titulo={titulo} sub={sub} className="mb-4">
      <Table aria-label={titulo}>
        <THead>
          <Tr>
            {cab.map((c) => (
              <Th key={c.t} className={c.centro ? 'text-center' : undefined}>
                {c.t}
              </Th>
            ))}
          </Tr>
        </THead>
        <TBody>
          {fatia.map((l, i) => (
            <Tr key={i}>
              {l.map((c, j) => (
                <Td key={j} className={cab[j]?.centro ? 'text-center' : j === 0 ? 'font-medium text-texto' : undefined}>
                  {c}
                </Td>
              ))}
            </Tr>
          ))}
        </TBody>
      </Table>
      {rodape}
    </Painel>
  );
}

/** Configurações › Perfis e hierarquias: tipo de perfil, cargo, hierarquia e setor, e o que cada um libera */
export function TelaPerfis({ abas }: { abas: React.ReactNode }) {
  const q = useCfg<Perfis>('/perfis');
  const d = q.data;
  const areaCel = (a: { acesso: string; rotulo: string } | null) =>
    !a ? (
      <span className="text-apagado-2">—</span>
    ) : (
      <Badge tom={a.acesso === 'total' ? 'green' : a.acesso === 'restrito' ? 'amber' : 'gray'}>{a.rotulo}</Badge>
    );
  return (
    <>
      <PageHead
        titulo="Perfis e hierarquias"
        acoes={
          <Button asChild variant="primary">
            <Link href="/configuracoes/usuarios/novo">
              <PlusIcon /> Novo usuário
            </Link>
          </Button>
        }
      />
      {abas}
      <ErroQ e={q.error} />
      {d && (
        <>
          <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {d.modelo.map(([k, t, p]) => (
              <Card key={k} className="px-5 py-4">
                <div className="text-lg font-bold text-texto">{k}</div>
                <div className="mb-1.5 text-azul">{t}</div>
                <div className="text-texto-2">{p}</div>
              </Card>
            ))}
          </div>
          <TabelaPainel
            titulo="Perfis cadastrados"
            cab={[
              { t: 'ID_cargo' },
              { t: 'Tipo de perfil' },
              { t: 'Cargo' },
              { t: 'Setor' },
              { t: 'Hierarquia sugerida' },
            ]}
            linhas={d.perfis.map((p) => [p.idCargo ?? '—', p.perfil, p.cargo, p.area, p.hierarquia])}
          />
          <TabelaPainel
            titulo="Hierarquias"
            sub="o que cada hierarquia pode fazer · Visualizador vê só o próprio escopo; Usuários e Configurações são só do tipo de perfil Admin"
            cab={[{ t: 'Nível' }, ...d.acoes.map((t) => ({ t, centro: true }))]}
            linhas={d.niveis.map((n) => [n.nome, ...n.acoes.map((v, i) => <Acao key={d.acoes[i]} v={v} />)])}
          />
          <TabelaPainel
            titulo="Matriz de permissões por perfil"
            sub="o nível sugerido de cada cargo e o que ele libera — ser Coordenador não torna ninguém Administrador"
            cab={[{ t: 'Cargo' }, { t: 'Nível sugerido' }, ...d.acoes.map((t) => ({ t, centro: true }))]}
            linhas={d.cargos.map((c) => [c.cargo, c.nivel, ...c.acoes.map((v, i) => <Acao key={d.acoes[i]} v={v} />)])}
          />
          <TabelaPainel
            titulo="Matriz de acesso por setor"
            sub="onde cada cargo atua · verde = Total, amarelo = Restrito (recorte fixo do cargo), — sem acesso"
            cab={[{ t: 'Cargo' }, { t: 'Nível sugerido' }, ...d.areas.map((t) => ({ t, centro: true }))]}
            linhas={d.setores.map((c) => [
              c.cargo,
              c.nivel,
              ...c.areas.map((a, i) => <span key={d.areas[i]}>{areaCel(a)}</span>),
            ])}
          />
          <TabelaPainel
            titulo="Telas de cada setor"
            sub="o que o acesso Total de cada setor libera; Configurações não é de setor nenhum"
            cab={[{ t: 'Tela ou aba' }, { t: 'Menu' }, ...d.areas.map((t) => ({ t, centro: true }))]}
            linhas={d.telas.map((t) => [
              t.label,
              t.menu,
              ...t.areas.map((on, i) => <Acao key={d.areas[i]} v={on ? 1 : null} />),
            ])}
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <Painel titulo="Recortes do acesso restrito" sub="as telas que cada Restrito libera">
              <div className="px-5 py-2">
                {d.recortes.map((r) => (
                  <Gate key={r.titulo} tom={r.padrao ? '' : 'mid'} k={r.titulo}>
                    {r.texto}
                  </Gate>
                ))}
              </div>
            </Painel>
            <Painel titulo="Regras de governança" sub="o que o sistema recusa por conta própria">
              <div className="px-5 py-2">
                <Gate tom="crit" k="Ninguém altera o próprio acesso">
                  Nem o nível Administrador. A alteração precisa de outra pessoa — a API recusa, não só a tela.
                </Gate>
                <Gate tom="crit" k="Não se apaga log">
                  Auditoria e Execuções do Relógio não aceitam exclusão, nem pelo nível Administrador.
                </Gate>
                <Gate tom="mid" k="Último administrador">
                  O sistema recusa rebaixar o último usuário com nível Administrador — a base não fica sem quem conceda
                  acesso.
                </Gate>
                <Gate tom="ok" k="Revisão periódica">
                  A cada 90 dias os acessos entram em revisão: quem não acessou no período e quem tem nível
                  Administrador ou Gestor aparecem primeiro.
                </Gate>
              </div>
            </Painel>
          </div>
        </>
      )}
    </>
  );
}

/** Configurações › Sessões e acessos: quem está dentro, políticas de acesso e o histórico de acesso */
export function TelaSessoes({ abas }: { abas: React.ReactNode }) {
  const q = useCfg<Sessoes>('/sessoes');
  const acao = useAcaoCfg();
  const [msg, setMsg] = useState<Msg>(null);
  const [evento, setEvento] = useState('');
  const [resultado, setResultado] = useState('');
  const d = q.data;
  const faz = (caminho: string, method: 'POST' | 'PUT' = 'POST') =>
    acao.mutate(
      { caminho, method },
      { onSuccess: (r) => setMsg({ txt: r.msg }), onError: (e) => setMsg({ txt: e.message, erro: true }) },
    );
  const hist = useMemo(
    () =>
      (d?.historico ?? []).filter((h) => (!evento || h.evento === evento) && (!resultado || h.resultado === resultado)),
    [d, evento, resultado],
  );
  const ativas = usePaginacao(d?.ativas ?? []);
  const pag = usePaginacao(hist);
  const outras = (d?.ativas ?? []).filter((s) => !s.estaSessao).length;

  return (
    <>
      <PageHead titulo="Sessões e acessos" />
      {abas}
      <AvisoMsg msg={msg} />
      <ErroQ e={q.error} />
      {d && (
        <>
          <div className="mb-4 grid gap-4 xl:grid-cols-[3fr_2fr]">
            <Painel
              titulo="Sessões ativas"
              acoes={
                <>
                  <Badge tom="blue">{d.ativas.length}</Badge>
                  {outras > 0 && (
                    <Button size="sm" disabled={acao.isPending} onClick={() => faz('/sessoes/encerrar-outras')}>
                      Encerrar todas as outras
                    </Button>
                  )}
                </>
              }
            >
              <Table aria-label="Sessões ativas">
                <THead>
                  <Tr>
                    <Th>Usuário</Th>
                    <Th>Dispositivo</Th>
                    <Th>Origem</Th>
                    <Th>Última atividade</Th>
                    <Th>
                      <span className="sr-only">Ações</span>
                    </Th>
                  </Tr>
                </THead>
                <TBody>
                  {ativas.fatia.length ? (
                    ativas.fatia.map((s) => (
                      <Tr key={s.id}>
                        <Td>
                          <div className="font-medium text-texto">{s.nome}</div>
                          {s.estaSessao && <Badge tom="blue">Esta sessão</Badge>}
                        </Td>
                        <Td>{s.dispositivo}</Td>
                        <Td className="tabular-nums">{s.origem}</Td>
                        <Td className="whitespace-nowrap">{s.ultima}</Td>
                        <Td className="text-right">
                          {s.estaSessao ? (
                            <span className="text-apagado-2">—</span>
                          ) : (
                            <Button
                              size="sm"
                              disabled={acao.isPending}
                              aria-label={`Encerrar sessão de ${s.nome}`}
                              onClick={() => faz(`/sessoes/${s.id}/encerrar`)}
                            >
                              Encerrar
                            </Button>
                          )}
                        </Td>
                      </Tr>
                    ))
                  ) : (
                    <Vazio cols={5} txt="nenhuma sessão ativa" />
                  )}
                </TBody>
              </Table>
              {ativas.rodape}
            </Painel>
            <Painel titulo="Políticas de acesso" sub="valem para toda a instituição; salvam ao clicar">
              <div className="grid gap-1 px-5 py-3">
                {d.politicas.map((p) => (
                  <div key={p.k} className="flex items-center gap-3 border-b border-borda-suave py-2.5 last:border-b-0">
                    <div className="flex-1">
                      <div className="font-semibold text-texto">{p.t}</div>
                      <div className="text-apagado">{p.d}</div>
                    </div>
                    <Switch
                      aria-label={p.t}
                      checked={p.on}
                      disabled={acao.isPending}
                      onCheckedChange={() => faz(`/sessoes/politicas/${p.k}`, 'PUT')}
                    />
                  </div>
                ))}
              </div>
            </Painel>
          </div>
          <Painel
            titulo="Histórico de acesso"
            acoes={
              <>
                <Escolha
                  rotulo="Evento"
                  todos="Todos os eventos"
                  valor={evento}
                  aoMudar={(v) => {
                    setEvento(v);
                    pag.setPag(1);
                  }}
                  opcoes={[...new Set(d.historico.map((h) => h.evento))].map((e) => ({ v: e, l: e }))}
                  className="w-[190px]"
                />
                <Escolha
                  rotulo="Resultado"
                  todos="Todos os resultados"
                  valor={resultado}
                  aoMudar={(v) => {
                    setResultado(v);
                    pag.setPag(1);
                  }}
                  opcoes={[...new Set(d.historico.map((h) => h.resultado))].map((e) => ({ v: e, l: e }))}
                  className="w-[190px]"
                />
                <Button
                  size="sm"
                  disabled={!hist.length}
                  onClick={() =>
                    baixaCsv(
                      'historico-de-acesso',
                      [
                        { k: 'quando', t: 'Quando' },
                        { k: 'quem', t: 'Quem' },
                        { k: 'evento', t: 'Evento' },
                        { k: 'resultado', t: 'Resultado' },
                        { k: 'detalhe', t: 'Detalhe' },
                      ],
                      hist,
                    )
                  }
                >
                  Exportar
                </Button>
              </>
            }
          >
            <Table aria-label="Histórico de acesso">
              <THead>
                <Tr>
                  <Th>Quando</Th>
                  <Th>Quem</Th>
                  <Th>Evento</Th>
                  <Th>Resultado</Th>
                  <Th>Detalhe</Th>
                </Tr>
              </THead>
              <TBody>
                {pag.fatia.length ? (
                  pag.fatia.map((h) => (
                    <Tr key={h.id}>
                      <Td className="font-medium whitespace-nowrap text-texto tabular-nums">{h.quando}</Td>
                      <Td>{h.quem}</Td>
                      <Td>{h.evento}</Td>
                      <Td>
                        <Badge tom={h.tom}>{h.resultado}</Badge>
                      </Td>
                      <Td className="text-apagado">{h.detalhe}</Td>
                    </Tr>
                  ))
                ) : (
                  <Vazio cols={5} txt="nenhum registro com esses filtros" />
                )}
              </TBody>
            </Table>
            {pag.rodape}
          </Painel>
        </>
      )}
    </>
  );
}
