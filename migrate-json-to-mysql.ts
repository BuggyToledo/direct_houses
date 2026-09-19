import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

const DATA_DIR = path.join(process.cwd(), '.data');

async function runMigration() {
  console.log('🚀 Iniciando script de migração: JSON (.data/) -> MySQL');

  const host = process.env.DB_HOST || '127.0.0.1';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'direct_houses';

  console.log(`Conectando em mysql://${user}@${host}:${port}/${database}...`);

  let connection: mysql.Connection;
  try {
    connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database,
      charset: 'utf8mb4',
    });
    console.log('✅ Conexão MySQL efetuada com sucesso.');
  } catch (err: any) {
    console.error('❌ Não foi possível conectar ao MySQL:', err.message);
    console.log('Certifique-se de que o MySQL está rodando e as variáveis DB_HOST, DB_USER, DB_PASSWORD e DB_NAME estão corretas.');
    process.exit(1);
  }

  try {
    // 1. Garantir empresa padrão (id=1)
    await connection.execute(`
      INSERT IGNORE INTO companies (id, name, slug, whatsapp_phone)
      VALUES (1, 'Direct Houses', 'direct-houses', '5521987654321')
    `);
    console.log('🏢 Empresa padrão (Direct Houses, ID=1) verificada.');

    // 2. Migrar Brokers
    const brokersFile = path.join(DATA_DIR, 'brokers.json');
    if (fs.existsSync(brokersFile)) {
      const brokers = JSON.parse(fs.readFileSync(brokersFile, 'utf-8'));
      for (const b of brokers) {
        await connection.execute(`
          INSERT INTO brokers (id, company_id, name, phone, email, active, leads_received, created_at)
          VALUES (?, 1, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            phone = VALUES(phone),
            email = VALUES(email),
            active = VALUES(active),
            leads_received = VALUES(leads_received)
        `, [
          b.id,
          b.name,
          b.phone,
          b.email || null,
          b.active ? 1 : 0,
          b.leadsReceived || 0,
          b.createdAt ? new Date(b.createdAt) : new Date(),
        ]);
      }
      console.log(`✅ ${brokers.length} corretores migrados.`);
    }

    // 3. Migrar Roleta Config
    const roletaConfigFile = path.join(DATA_DIR, 'roleta-config.json');
    if (fs.existsSync(roletaConfigFile)) {
      const cfg = JSON.parse(fs.readFileSync(roletaConfigFile, 'utf-8'));
      await connection.execute(`
        INSERT INTO roleta_config (id, company_id, auto_dispatch_enabled, notify_client_with_broker_name, last_assigned_index)
        VALUES (1, 1, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          auto_dispatch_enabled = VALUES(auto_dispatch_enabled),
          notify_client_with_broker_name = VALUES(notify_client_with_broker_name),
          last_assigned_index = VALUES(last_assigned_index)
      `, [
        cfg.autoDispatchEnabled ? 1 : 0,
        cfg.notifyClientWithBrokerName ? 1 : 0,
        cfg.lastAssignedIndex || 0,
      ]);
      console.log('✅ Configuração da Roleta migrada.');
    }

    // 4. Migrar Lançamentos
    const lancamentosFile = path.join(DATA_DIR, 'lancamentos.json');
    if (fs.existsSync(lancamentosFile)) {
      const lancamentos = JSON.parse(fs.readFileSync(lancamentosFile, 'utf-8'));
      for (const l of lancamentos) {
        await connection.execute(`
          INSERT INTO lancamentos (
            id, company_id, status, fonte_principal, url_publica_direct_house,
            conteudo_publico_autorizado, nome, bairro, cidade, tipologias,
            metragens, quartos, preco_a_partir_de, condicoes_comerciais, diferenciais,
            previsao_entrega, descricao, fotos, localidade, vizinhanca,
            fotos_upload, book_pdf_upload, construtora, telefone_construtora,
            email_construtora, contato_terceiro, endereco_completo, dados_cadastrais,
            link_book_pdf, documento_origem_nome, notas_internas, publicavel, versao_atual, versoes
          ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            status = VALUES(status),
            nome = VALUES(nome),
            bairro = VALUES(bairro),
            cidade = VALUES(cidade),
            tipologias = VALUES(tipologias),
            preco_a_partir_de = VALUES(preco_a_partir_de),
            diferenciais = VALUES(diferenciais),
            publicavel = VALUES(publicavel),
            versao_atual = VALUES(versao_atual),
            versoes = VALUES(versoes)
        `, [
          l.id,
          l.status || 'ativo',
          l.fontePrincipal || 'documento_interno',
          l.urlPublicaDirectHouse || null,
          l.conteudoPublicoAutorizado || null,
          l.nome,
          l.bairro || '',
          l.cidade || 'Rio de Janeiro',
          l.tipologias || '',
          l.metragens || null,
          l.quartos || null,
          l.precoAPartirDe || null,
          l.condicoesComerciais || null,
          l.diferenciais || null,
          l.previsaoEntrega || null,
          l.descricao || null,
          l.fotos || null,
          l.localidade || null,
          l.vizinhanca || null,
          l.fotosUpload ? JSON.stringify(l.fotosUpload) : null,
          l.bookPdfUpload ? JSON.stringify(l.bookPdfUpload) : null,
          l.construtora || null,
          l.telefoneConstrutora || null,
          l.emailConstrutora || null,
          l.contatoTerceiro || null,
          l.enderecoCompleto || null,
          l.dadosCadastrais || null,
          l.linkBookPdf || null,
          l.documentoOrigemNome || null,
          l.notasInternas || null,
          JSON.stringify(l.publicavel || {}),
          l.versaoAtual || 1,
          l.historicoVersoes ? JSON.stringify(l.historicoVersoes) : null,
        ]);
      }
      console.log(`✅ ${lancamentos.length} lançamentos imobiliários migrados.`);
    }

    // 5. Migrar Leads
    const leadsFile = path.join(DATA_DIR, 'leads.json');
    if (fs.existsSync(leadsFile)) {
      const leads = JSON.parse(fs.readFileSync(leadsFile, 'utf-8'));
      for (const lead of leads) {
        await connection.execute(`
          INSERT INTO leads (
            id, company_id, nome, telefone, email, tipo_atendimento,
            produto_imovel, valor_interesse, bairros_interesse, temperatura,
            observacoes, initial_message, origem, status, assigned_broker_id,
            assigned_broker_data, tags, notas_internas, historico_distribuicoes,
            raw_structured_text, trilha_navegacao, resumo_navegacao, historico_mensagens,
            created_at
          ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            nome = VALUES(nome),
            telefone = VALUES(telefone),
            email = VALUES(email),
            status = VALUES(status),
            observacoes = VALUES(observacoes),
            temperatura = VALUES(temperatura),
            assigned_broker_id = VALUES(assigned_broker_id),
            assigned_broker_data = VALUES(assigned_broker_data),
            tags = VALUES(tags),
            notas_internas = VALUES(notas_internas)
        `, [
          lead.id,
          lead.nome || 'Lead Sem Nome',
          lead.telefone || '',
          lead.email || null,
          lead.tipoAtendimento || null,
          lead.produtoImovel || null,
          lead.valorInteresse || null,
          lead.bairrosInteresse ? JSON.stringify(lead.bairrosInteresse) : null,
          lead.temperatura || 'morno',
          lead.observacoes || '',
          lead.initialMessage || null,
          lead.origem || 'whatsapp',
          lead.status || 'novo',
          lead.assignedBroker?.id || null,
          lead.assignedBroker ? JSON.stringify(lead.assignedBroker) : null,
          lead.tags ? JSON.stringify(lead.tags) : null,
          lead.notasInternas ? JSON.stringify(lead.notasInternas) : null,
          lead.historicoDistribuicoes ? JSON.stringify(lead.historicoDistribuicoes) : null,
          lead.rawStructuredText || null,
          lead.trilhaNavegacao ? JSON.stringify(lead.trilhaNavegacao) : null,
          lead.resumoNavegacao || null,
          lead.historicoMensagens ? JSON.stringify(lead.historicoMensagens) : null,
          lead.createdAt ? new Date(lead.createdAt) : new Date(),
        ]);
      }
      console.log(`✅ ${leads.length} leads migrados com sucesso.`);
    }

    // 6. Migrar Histórico da Roleta
    const historyFile = path.join(DATA_DIR, 'roleta-history.json');
    if (fs.existsSync(historyFile)) {
      const history = JSON.parse(fs.readFileSync(historyFile, 'utf-8'));
      for (const h of history) {
        await connection.execute(`
          INSERT INTO roleta_distributions (
            id, company_id, lead_id, lead_nome, lead_telefone,
            broker_id, broker_nome, broker_telefone, timestamp,
            tipo_distribuicao, status_envio_whatsapp, motivo, produto_imovel,
            valor_interesse, detalhes_envio, tempo_sla
          ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            status_envio_whatsapp = VALUES(status_envio_whatsapp)
        `, [
          h.id,
          h.leadId || '',
          h.leadNome || '',
          h.leadTelefone || '',
          h.brokerId || '',
          h.brokerNome || '',
          h.brokerTelefone || '',
          h.timestamp ? new Date(h.timestamp) : new Date(),
          h.tipoDistribuicao || 'automatica_roleta',
          h.statusEnvioWhatsApp || 'enviado',
          h.motivo || null,
          h.produtoImovel || null,
          h.valorInteresse || null,
          h.detalhesEnvio || null,
          h.tempoSLA || null,
        ]);
      }
      console.log(`✅ ${history.length} distribuições de roleta migradas.`);
    }

    // 7. Migrar Sessões Ativas do WhatsApp
    const sessionsFile = path.join(DATA_DIR, 'whatsapp-sessions.json');
    if (fs.existsSync(sessionsFile)) {
      const sessions = JSON.parse(fs.readFileSync(sessionsFile, 'utf-8'));
      const sessionList = Array.isArray(sessions) ? sessions : Object.values(sessions);
      for (const s of sessionList as any[]) {
        if (!s.jid) continue;
        await connection.execute(`
          INSERT INTO whatsapp_sessions (
            jid, company_id, phone, name, initial_message,
            messages, extracted_lead, assigned_broker, status, last_activity
          ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            messages = VALUES(messages),
            extracted_lead = VALUES(extracted_lead),
            assigned_broker = VALUES(assigned_broker),
            status = VALUES(status),
            last_activity = VALUES(last_activity)
        `, [
          s.jid,
          s.phone || '',
          s.name || null,
          s.initialMessage || null,
          JSON.stringify(s.messages || []),
          s.extractedLead ? JSON.stringify(s.extractedLead) : null,
          s.assignedBroker ? JSON.stringify(s.assignedBroker) : null,
          s.status || 'active',
          s.lastActivity ? new Date(s.lastActivity) : new Date(),
        ]);
      }
      console.log(`✅ ${sessionList.length} sessões WhatsApp migradas.`);
    }

    // 8. Migrar Violações de IA (DLP)
    const violationsFile = path.join(DATA_DIR, 'ai-violations.json');
    if (fs.existsSync(violationsFile)) {
      const violations = JSON.parse(fs.readFileSync(violationsFile, 'utf-8'));
      for (const v of violations) {
        await connection.execute(`
          INSERT INTO ai_violations (
            id, company_id, lead_id, whatsapp_jid, company_name,
            original_user_message, raw_ai_response, sanitized_response,
            violation_types, blocked_type, was_modified, model_used, created_at
          ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            sanitized_response = VALUES(sanitized_response),
            was_modified = VALUES(was_modified)
        `, [
          v.id,
          v.leadId || null,
          v.whatsappJid || v.jid || null,
          v.companyName || 'Direct Houses',
          v.originalUserMessage || v.promptUsuario || null,
          v.rawAiResponse || null,
          v.sanitizedResponse || null,
          JSON.stringify(v.violationTypes || (v.tipoViolacao ? [v.tipoViolacao] : [])),
          v.blockedType || v.categoria || 'bloqueio_dlp',
          v.wasModified !== false ? 1 : 0,
          v.modelUsed || null,
          v.createdAt ? new Date(v.createdAt) : (v.timestamp ? new Date(v.timestamp) : new Date()),
        ]);
      }
      console.log(`✅ ${violations.length} logs de auditoria DLP migrados.`);
    }

    console.log('🎉 MIGRAÇÃO CONCLUÍDA COM SUCESSO!');
  } catch (err: any) {
    console.error('❌ Erro durante a execução da migração:', err);
  } finally {
    await connection.end();
  }
}

// Executar se chamado via linha de comando
runMigration().catch(console.error);
