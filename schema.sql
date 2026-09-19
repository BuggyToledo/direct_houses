-- ============================================================
-- SCHEMA MYSQL COMPLETO - DIRECT HOUSES ASSISTENTE COMERCIAL
-- Alinhado à arquitetura de dados e governança DLP do sistema
-- ============================================================

CREATE DATABASE IF NOT EXISTS `direct_houses` 
  DEFAULT CHARACTER SET utf8mb4 
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `direct_houses`;

-- ============================================================
-- 1. EMPRESAS (Pronto para Multi-tenant / Multi-unidades)
-- ============================================================
CREATE TABLE IF NOT EXISTS `companies` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `slug` VARCHAR(80) NOT NULL UNIQUE,
  `whatsapp_phone` VARCHAR(30) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Inserir empresa padrão se não existir
INSERT IGNORE INTO `companies` (`id`, `name`, `slug`, `whatsapp_phone`)
VALUES (1, 'Direct Houses', 'direct-houses', '5521987654321');

-- ============================================================
-- 2. CORRETORES / BROKERS (Roleta Comercial de Plantão)
-- ============================================================
CREATE TABLE IF NOT EXISTS `brokers` (
  `id` VARCHAR(64) PRIMARY KEY,
  `company_id` INT UNSIGNED NOT NULL DEFAULT 1,
  `name` VARCHAR(150) NOT NULL,
  `phone` VARCHAR(30) NOT NULL,
  `email` VARCHAR(150) NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `leads_received` INT UNSIGNED NOT NULL DEFAULT 0,
  `last_assigned_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_brokers_company_active` (`company_id`, `active`),
  INDEX `idx_brokers_phone` (`phone`),
  CONSTRAINT `fk_brokers_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 3. LANÇAMENTOS IMOBILIÁRIOS & GOVERNANÇA DLP
-- ============================================================
CREATE TABLE IF NOT EXISTS `lancamentos` (
  `id` VARCHAR(64) PRIMARY KEY,
  `company_id` INT UNSIGNED NOT NULL DEFAULT 1,
  `status` VARCHAR(30) NOT NULL DEFAULT 'ativo',
  `fonte_principal` VARCHAR(50) NOT NULL DEFAULT 'documento_interno',
  
  -- Nível 1: Diretório / Canal Público Oficial
  `url_publica_direct_house` VARCHAR(255) NULL,
  `conteudo_publico_autorizado TEXT` NULL,
  
  -- Nível 2: Dados Comerciais Aprovados para Divulgação
  `nome` VARCHAR(150) NOT NULL,
  `bairro` VARCHAR(100) NOT NULL,
  `cidade` VARCHAR(100) NOT NULL,
  `tipologias` VARCHAR(150) NOT NULL,
  `metragens` VARCHAR(100) NULL,
  `quartos` VARCHAR(80) NULL,
  `preco_a_partir_de` VARCHAR(80) NULL,
  `condicoes_comerciais` TEXT NULL,
  `diferenciais` TEXT NULL,
  `previsao_entrega` VARCHAR(60) NULL,
  `descricao` TEXT NULL,
  `fotos` TEXT NULL,
  `localidade` TEXT NULL,
  `vizinhanca` TEXT NULL,
  `fotos_upload` JSON NULL,
  `book_pdf_upload` JSON NULL,
  
  -- Nível 3: Confidencial / Dados Internos (Bloqueados por DLP)
  `construtora` VARCHAR(100) NULL,
  `telefone_construtora` VARCHAR(50) NULL,
  `email_construtora` VARCHAR(150) NULL,
  `contato_terceiro` VARCHAR(150) NULL,
  `endereco_completo` VARCHAR(255) NULL,
  `dados_cadastrais` TEXT NULL,
  `link_book_pdf` VARCHAR(255) NULL,
  `documento_origem_nome` VARCHAR(255) NULL,
  `notas_internas` TEXT NULL,
  
  -- Governança e Auditoria
  `publicavel` JSON NOT NULL,
  `versoes` JSON NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_lancamentos_company_status` (`company_id`, `status`),
  INDEX `idx_lancamentos_bairro` (`bairro`),
  INDEX `idx_lancamentos_nome` (`nome`),
  CONSTRAINT `fk_lancamentos_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4. LEADS E HISTÓRICO DE QUALIFICAÇÃO
-- ============================================================
CREATE TABLE IF NOT EXISTS `leads` (
  `id` VARCHAR(64) PRIMARY KEY,
  `company_id` INT UNSIGNED NOT NULL DEFAULT 1,
  `nome` VARCHAR(150) NOT NULL,
  `telefone` VARCHAR(40) NOT NULL,
  `email` VARCHAR(150) NULL,
  `tipo_atendimento` VARCHAR(100) NULL,
  `produto_imovel` VARCHAR(150) NULL,
  `valor_interesse` VARCHAR(80) NULL,
  `bairros_interesse` JSON NULL,
  `temperatura` ENUM('quente', 'morno', 'frio') NULL DEFAULT 'morno',
  `observacoes` TEXT NULL,
  `initial_message` TEXT NULL,
  `origem` VARCHAR(80) NOT NULL DEFAULT 'whatsapp',
  `status` VARCHAR(40) NOT NULL DEFAULT 'novo',
  `assigned_broker_id` VARCHAR(64) NULL,
  `assigned_broker_data` JSON NULL,
  `tags` JSON NULL,
  `notas_internas` JSON NULL,
  `historico_distribuicoes` JSON NULL,
  `raw_structured_text` TEXT NULL,
  `trilha_navegacao` JSON NULL,
  `resumo_navegacao` TEXT NULL,
  `historico_mensagens` JSON NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_leads_company_status` (`company_id`, `status`),
  INDEX `idx_leads_telefone` (`telefone`),
  INDEX `idx_leads_broker` (`assigned_broker_id`),
  INDEX `idx_leads_created_at` (`created_at`),
  CONSTRAINT `fk_leads_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 5. SESSÕES ATIVAS DE WHATSAPP (BAILEYS / IA)
-- ============================================================
CREATE TABLE IF NOT EXISTS `whatsapp_sessions` (
  `jid` VARCHAR(100) PRIMARY KEY,
  `company_id` INT UNSIGNED NOT NULL DEFAULT 1,
  `phone` VARCHAR(40) NOT NULL,
  `name` VARCHAR(150) NULL,
  `initial_message` TEXT NULL,
  `messages` JSON NOT NULL,
  `extracted_lead` JSON NULL,
  `assigned_broker` JSON NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'active',
  `last_activity` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_sessions_company_status` (`company_id`, `status`),
  INDEX `idx_sessions_phone` (`phone`),
  INDEX `idx_sessions_last_activity` (`last_activity`),
  CONSTRAINT `fk_sessions_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 6. HISTÓRICO DE DISTRIBUIÇÕES NA ROLETA (AUDITORIA E SLA)
-- ============================================================
CREATE TABLE IF NOT EXISTS `roleta_distributions` (
  `id` VARCHAR(64) PRIMARY KEY,
  `company_id` INT UNSIGNED NOT NULL DEFAULT 1,
  `lead_id` VARCHAR(64) NOT NULL,
  `lead_nome` VARCHAR(150) NOT NULL,
  `lead_telefone` VARCHAR(40) NOT NULL,
  `broker_id` VARCHAR(64) NOT NULL,
  `broker_nome` VARCHAR(150) NOT NULL,
  `broker_telefone` VARCHAR(40) NOT NULL,
  `timestamp` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `tipo_distribuicao` VARCHAR(50) NOT NULL DEFAULT 'automatica_roleta',
  `status_envio_whatsapp` VARCHAR(40) NOT NULL DEFAULT 'enviado',
  `motivo` TEXT NULL,
  `produto_imovel` VARCHAR(150) NULL,
  `valor_interesse` VARCHAR(80) NULL,
  `detalhes_envio` TEXT NULL,
  `tempo_sla` VARCHAR(30) NULL,
  INDEX `idx_dist_company_timestamp` (`company_id`, `timestamp`),
  INDEX `idx_dist_broker` (`broker_id`),
  INDEX `idx_dist_lead` (`lead_id`),
  CONSTRAINT `fk_dist_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 7. AUDITORIA DE SEGURANÇA E VIOLAÇÕES DE DLP (AI LOSS PREVENTION)
-- ============================================================
CREATE TABLE IF NOT EXISTS `ai_violations` (
  `id` VARCHAR(64) PRIMARY KEY,
  `company_id` INT UNSIGNED NOT NULL DEFAULT 1,
  `timestamp` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `jid` VARCHAR(100) NULL,
  `lead_nome` VARCHAR(150) NULL,
  `tipo_violacao` VARCHAR(60) NOT NULL,
  `categoria` VARCHAR(60) NOT NULL,
  `trecho_bloqueado` TEXT NOT NULL,
  `severidade` VARCHAR(30) NOT NULL DEFAULT 'alta',
  `acao_tomada` VARCHAR(80) NOT NULL DEFAULT 'bloqueado_e_substituido',
  `prompt_usuario` TEXT NULL,
  INDEX `idx_violations_company_time` (`company_id`, `timestamp`),
  INDEX `idx_violations_jid` (`jid`),
  CONSTRAINT `fk_violations_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 8. CONFIGURAÇÕES DA ROLETA POR EMPRESA
-- ============================================================
CREATE TABLE IF NOT EXISTS `roleta_config` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `company_id` INT UNSIGNED NOT NULL UNIQUE DEFAULT 1,
  `auto_dispatch_enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `notify_client_with_broker_name` TINYINT(1) NOT NULL DEFAULT 1,
  `last_assigned_index` INT NOT NULL DEFAULT 0,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_roleta_config_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Inserir configuração padrão da roleta
INSERT IGNORE INTO `roleta_config` (`id`, `company_id`, `auto_dispatch_enabled`, `notify_client_with_broker_name`, `last_assigned_index`)
VALUES (1, 1, 1, 1, 0);
